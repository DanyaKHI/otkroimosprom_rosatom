import os
import torch
from transformers import AutoTokenizer, AutoModel
import numpy as np

import triton_python_backend_utils as pb_utils

_MODEL_NAME = "cointegrated/rubert-tiny2"

def _mean_pooling(last_hidden_state, attention_mask):
   
    mask = attention_mask.unsqueeze(-1).type_as(last_hidden_state) 
    masked = last_hidden_state * mask
    summed = masked.sum(dim=1) 
    denom = mask.sum(dim=1).clamp(min=1e-9) 
    return summed / denom

class TritonPythonModel:
    def initialize(self, args):
       
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

       
        self.tokenizer = AutoTokenizer.from_pretrained(_MODEL_NAME)
        self.model = AutoModel.from_pretrained(_MODEL_NAME)
        self.model.eval().to(self.device)

       
        self.l2_normalize = True

       
        self.hidden_size = self.model.config.hidden_size

    def execute(self, requests):
        responses = []

       
        all_texts = []
        req_slices = [] 
        for request in requests:
            inp = pb_utils.get_input_tensor_by_name(request, "TEXT")
           
            arr = inp.as_numpy().reshape(-1)
            texts = [x.decode("utf-8") if isinstance(x, (bytes, bytearray)) else str(x) for x in arr]
            all_texts.extend(texts)
            req_slices.append(len(texts))

       
        with torch.no_grad():
            enc = self.tokenizer(
                all_texts,
                padding=True,
                truncation=True,
                max_length=256,       
                return_tensors="pt"
            )
            enc = {k: v.to(self.device) for k, v in enc.items()}

            out = self.model(**enc)
            token_embeddings = out.last_hidden_state 
            sentence_embeddings = _mean_pooling(token_embeddings, enc["attention_mask"]) 

            if self.l2_normalize:
                sentence_embeddings = torch.nn.functional.normalize(sentence_embeddings, p=2, dim=1)

            all_embs = sentence_embeddings.detach().cpu().numpy().astype(np.float32)

       
        offset = 0
        for request, chunk_size in zip(requests, req_slices):
            embs = all_embs[offset:offset + chunk_size] 
            offset += chunk_size
            out_tensor = pb_utils.Tensor("EMBEDDINGS", embs)
            responses.append(pb_utils.InferenceResponse(output_tensors=[out_tensor]))

        return responses

    def finalize(self):
       
        pass
