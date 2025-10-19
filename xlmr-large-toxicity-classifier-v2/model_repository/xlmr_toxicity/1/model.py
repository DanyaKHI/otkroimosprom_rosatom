import os
import math
import numpy as np
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

import triton_python_backend_utils as pb_utils

_MODEL_NAME = "textdetox/xlmr-large-toxicity-classifier-v2"

def _sigmoid(x):
    return 1 / (1 + torch.exp(-x))

class TritonPythonModel:
    def initialize(self, args):
       
        self.device = torch.device("cpu")

       
        self.tokenizer = AutoTokenizer.from_pretrained(_MODEL_NAME)
        self.model = AutoModelForSequenceClassification.from_pretrained(_MODEL_NAME)
        self.model.eval().to(self.device)

       
        self.num_labels = int(getattr(self.model.config, "num_labels", 2))

       
        self.toxic_idx = 1
        id2label = getattr(self.model.config, "id2label", None)
        if isinstance(id2label, dict) and len(id2label) == self.num_labels:
            for k, v in id2label.items():
                try:
                    ki = int(k)
                except Exception:
                    continue
                if isinstance(v, str) and "tox" in v.lower():
                    self.toxic_idx = ki
                    break

       
        self.max_length = 256
        self.return_full_probs = False 

    def execute(self, requests):
        responses = []

       
        all_texts = []
        sizes = []
        for request in requests:
            t = pb_utils.get_input_tensor_by_name(request, "TEXT")
            arr = t.as_numpy().reshape(-1)
            texts = [x.decode("utf-8") if isinstance(x, (bytes, bytearray)) else str(x) for x in arr]
            all_texts.extend(texts)
            sizes.append(len(texts))

        if len(all_texts) == 0:
           
            for request in requests:
                out = np.empty((0,), dtype=np.float32)
                responses.append(pb_utils.InferenceResponse(output_tensors=[pb_utils.Tensor("P_TOXIC", out)]))
            return responses

       
        with torch.no_grad():
            enc = self.tokenizer(
                all_texts,
                padding=True,
                truncation=True,
                max_length=self.max_length,
                return_tensors="pt"
            )
            enc = {k: v.to(self.device) for k, v in enc.items()}
            out = self.model(**enc)
            logits = out.logits 

            if self.num_labels == 1:
               
                probs_toxic = _sigmoid(logits.squeeze(-1)) 
            else:
               
                probs = torch.softmax(logits, dim=-1) 
                idx = max(0, min(self.toxic_idx, self.num_labels - 1))
                probs_toxic = probs[:, idx] 

            scores = probs_toxic.detach().cpu().numpy().astype(np.float32) 

       
        offset = 0
        for request, n in zip(requests, sizes):
            chunk = scores[offset:offset + n]
            offset += n
            out_tensor = pb_utils.Tensor("P_TOXIC", chunk)
            responses.append(pb_utils.InferenceResponse(output_tensors=[out_tensor]))

        return responses

    def finalize(self):
        pass
