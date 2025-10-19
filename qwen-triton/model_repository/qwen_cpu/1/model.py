
import os
import json
import numpy as np
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
import triton_python_backend_utils as pb_utils

MODEL_ID = os.environ.get("MODEL_ID", "Qwen/Qwen3-1.7B")

DEFAULT_GEN_KW = {
    "max_new_tokens": int(os.environ.get("MAX_NEW_TOKENS", "256")),
    "temperature": float(os.environ.get("TEMPERATURE", "0.7")),
    "top_p": float(os.environ.get("TOP_P", "0.9")),
    "do_sample": os.environ.get("DO_SAMPLE", "true").lower() == "true",
}

def _as_python_list(tensor_or_list):
    if isinstance(tensor_or_list, (list, tuple)):
        return list(tensor_or_list)
    return tensor_or_list.tolist()

class TritonPythonModel:
    def initialize(self, args):
       
        torch.set_num_threads(int(os.environ.get("TORCH_NUM_THREADS", "4")))
        self.device = torch.device("cpu")

       
        self.tokenizer = AutoTokenizer.from_pretrained(
            MODEL_ID,
            use_fast=True,
            trust_remote_code=True
        )
       
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token

        self.model = AutoModelForCausalLM.from_pretrained(
            MODEL_ID,
            torch_dtype=torch.float32,
            low_cpu_mem_usage=True,
            trust_remote_code=True
        ).to(self.device)
        self.model.eval()

       
        self.use_chat_template = bool(int(os.environ.get("USE_CHAT_TEMPLATE", "1")))

        pb_utils.Logger.log_info(f"[Qwen Triton CPU] Loaded {MODEL_ID}")

    def _build_inputs(self, prompts):
       
        if self.use_chat_template and hasattr(self.tokenizer, "apply_chat_template"):
            rendered = []
            for p in prompts:
               
                messages = [{"role": "user", "content": p}]
                text = self.tokenizer.apply_chat_template(
                    messages, tokenize=False, add_generation_prompt=True
                )
                rendered.append(text)
            return rendered
        else:
            return prompts

    def execute(self, requests):
        responses = []

       
        all_prompts = []
        sizes = []
        for req in requests:
            t = pb_utils.get_input_tensor_by_name(req, "TEXT")
            arr = t.as_numpy().reshape(-1)
            prompts = [
                x.decode("utf-8") if isinstance(x, (bytes, bytearray)) else str(x)
                for x in arr
            ]
            all_prompts.extend(prompts)
            sizes.append(len(prompts))

        if not all_prompts:
            for req in requests:
                empty = np.array([], dtype=object) 
                responses.append(pb_utils.InferenceResponse(
                    output_tensors=[pb_utils.Tensor("OUTPUT_TEXT", empty)]
                ))
            return responses

       
        texts = self._build_inputs(all_prompts)
        with torch.no_grad():
            enc = self.tokenizer(
                texts,
                padding=True,
                truncation=True,
                max_length=int(os.environ.get("MAX_INPUT_TOKENS", "2048")),
                return_tensors="pt"
            )
            enc = {k: v.to(self.device) for k, v in enc.items()}

            gen_kw = dict(DEFAULT_GEN_KW)
           
            if "NO_REPEAT_NGRAM_SIZE" in os.environ:
                gen_kw["no_repeat_ngram_size"] = int(os.environ["NO_REPEAT_NGRAM_SIZE"])

            output_ids = self.model.generate(
                **enc,
                **gen_kw,
                pad_token_id=self.tokenizer.pad_token_id,
                eos_token_id=self.tokenizer.eos_token_id
            )

           
            input_len = enc["input_ids"].shape[1]
            gen_tokens = output_ids[:, input_len:]
            outputs = self.tokenizer.batch_decode(gen_tokens, skip_special_tokens=True)

       
        offset = 0
        for req, n in zip(requests, sizes):
            chunk = outputs[offset:offset+n]
            offset += n
           
            out_np = np.array(chunk, dtype=object)
            responses.append(pb_utils.InferenceResponse(
                output_tensors=[pb_utils.Tensor("OUTPUT_TEXT", out_np)]
            ))

        return responses

    def finalize(self):
        pass
