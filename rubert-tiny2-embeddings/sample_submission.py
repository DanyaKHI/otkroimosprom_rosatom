import requests
import numpy as np
import base64

TRITON_URL = "http://localhost:8000"
MODEL = "rubert_tiny2_embeddings"

# кэшируем метаданные, чтобы не дёргать /v2/models каждый раз
_model_input_name = None
_model_input_dtype = None
_model_output_name = None

def _ensure_metadata():
    global _model_input_name, _model_input_dtype, _model_output_name
    if _model_input_name is not None:
        return
    r = requests.get(f"{TRITON_URL}/v2/models/{MODEL}", timeout=30)
    r.raise_for_status()
    md = r.json()
    _model_input_name  = md["inputs"][0]["name"]
    _model_input_dtype = md["inputs"][0]["datatype"]
    _model_output_name = md["outputs"][0]["name"]

def embed_one(text: str) -> np.ndarray:
    _ensure_metadata()

    if _model_input_dtype == "STRING":
        data_field = [text]
    elif _model_input_dtype == "BYTES":
        data_field = [base64.b64encode(text.encode("utf-8")).decode("ascii")]
    else:
        raise ValueError(f"Unsupported input datatype: {_model_input_dtype}")

    payload = {
        "inputs": [
            {
                "name": _model_input_name,
                "shape": [1],                # batch = 1
                "datatype": _model_input_dtype,
                "data": data_field
            }
        ],
        "outputs": [ { "name": _model_output_name } ],
        "binary_data_output": False         # хотим JSON, не raw бинарь
    }

    url = f"{TRITON_URL}/v2/models/{MODEL}/infer"
    r = requests.post(url, json=payload, timeout=60)
    r.raise_for_status()

    out = r.json()["outputs"][0]
    vec = np.array(out["data"], dtype=np.float32).reshape(out["shape"])[0]  # -> (312,)
    return vec

# пример:
if __name__ == "__main__":
    v = embed_one("Привет, как дела?")
    print(v.shape)  # (312,)
    print(v[:8])
