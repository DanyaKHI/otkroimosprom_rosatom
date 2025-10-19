import os
import numpy as np
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import triton_python_backend_utils as pb_utils

MODEL_ID = "qualifire/prompt-injection-jailbreak-sentinel-v2"

def _pick_attack_index(config):
   
    idx = 1 
    id2label = getattr(config, "id2label", None)
    if isinstance(id2label, dict):
        try:
           
            items = [(int(k), v) if not isinstance(k, int) else (k, v) for k, v in id2label.items()]
            items.sort(key=lambda kv: kv[0])
            for k, v in items:
                s = str(v).lower()
                if any(tok in s for tok in ["attack", "inject", "injection", "jailbreak", "malicious", "unsafe"]):
                    return k
        except Exception:
            pass
    return idx

class TritonPythonModel:
    def initialize(self, args):
        self.device = torch.device("cpu")
       
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, use_auth_token=os.getenv("HUGGING_FACE_HUB_TOKEN"))
        self.model = AutoModelForSequenceClassification.from_pretrained(
            MODEL_ID, use_auth_token=os.getenv("HUGGING_FACE_HUB_TOKEN")
        ).to(self.device).eval()

        self.num_labels = int(getattr(self.model.config, "num_labels", 2))
        self.attack_idx = _pick_attack_index(self.model.config)
        self.max_length = 512
       
        pb_utils.Logger.log_info(f"[sentinel] num_labels={self.num_labels} attack_idx={self.attack_idx}")

    def execute(self, requests):
        responses = []
        all_texts, sizes = [], []

        for req in requests:
            t = pb_utils.get_input_tensor_by_name(req, "TEXT")
            arr = t.as_numpy().reshape(-1)
            texts = [x.decode("utf-8") if isinstance(x, (bytes, bytearray)) else str(x) for x in arr]
            all_texts.extend(texts)
            sizes.append(len(texts))

        if not all_texts:
            for req in requests:
                responses.append(pb_utils.InferenceResponse(
                    output_tensors=[pb_utils.Tensor("P_ATTACK", np.empty((0,), dtype=np.float32))]
                ))
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
                probs_attack = torch.sigmoid(logits.squeeze(-1)) 
            else:
                probs = torch.softmax(logits, dim=-1) 
                ai = max(0, min(self.attack_idx, self.num_labels - 1))
                probs_attack = probs[:, ai] 

            scores = probs_attack.detach().cpu().numpy().astype(np.float32)

        offset = 0
        for req, n in zip(requests, sizes):
            chunk = scores[offset:offset + n]
            offset += n
            responses.append(pb_utils.InferenceResponse(
                output_tensors=[pb_utils.Tensor("P_ATTACK", chunk)]
            ))

        return responses

    def finalize(self):
        pass
