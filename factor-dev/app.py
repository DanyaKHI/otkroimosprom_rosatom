from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Tuple
import numpy as np
import os
import logging
from joblib import load as joblib_load
from catboost import CatBoostClassifier
from configs import MODEL_PATHS, LE_PATHS
from contextlib import asynccontextmanager
import uvicorn

# ---------- Logging ----------
DEBUG = os.getenv("DEBUG", "false").lower() == "true"
logging.basicConfig(level=logging.DEBUG if DEBUG else logging.INFO,
                    format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("cb-infer")

# ---------- Schemas ----------
class InferenceRequest(BaseModel):
    embedding: List[float] = Field(..., min_length=1)

# ---------- Globals ----------
models: List[CatBoostClassifier] | None = None
les: List | None = None
classes_counts: List[int] | None = None
expected_dim: Optional[int] = None
model_files: List[str] | None = None
le_files: List[str] | None = None

# ---------- Utils ----------
def _load_cbc(path: str) -> CatBoostClassifier:
    if not os.path.isfile(path):
        raise FileNotFoundError(path)
    m = CatBoostClassifier()
    m.load_model(path)
    return m

def _is_multiclass(model: CatBoostClassifier) -> bool:
    try:
        params = model.get_all_params() or {}
        loss = (params.get("loss_function", "") or "").lower()
        return ("multiclass" in loss) or ("multiclassonevsall" in loss)
    except Exception:
        return False

def _pairs_models_les() -> List[Tuple[str, str]]:
    if len(MODEL_PATHS) != len(LE_PATHS):
        raise RuntimeError(f"Counts mismatch: models={len(MODEL_PATHS)} != label_encoders={len(LE_PATHS)}")
    return list(zip(MODEL_PATHS, LE_PATHS))

def _ensure_loaded():
    global models, les, classes_counts, model_files, le_files
    log.info("Loading models & label encoders (env-configured)...")

    kept_models: List[CatBoostClassifier] = []
    kept_les: List = []
    kept_model_files: List[str] = []
    kept_le_files: List[str] = []

    for m_path, le_path in _pairs_models_les():
        log.info(f"  model: {m_path}")
        log.info(f"  label encoder: {le_path}")
       
        le = joblib_load(le_path)

       
        mdl = _load_cbc(m_path)
        if not _is_multiclass(mdl):
            log.warning(f"Skip non-multiclass model: {m_path} (will not be used)")
            continue

        kept_models.append(mdl)
        kept_les.append(le)
        kept_model_files.append(m_path)
        kept_le_files.append(le_path)

    if not kept_models:
        raise RuntimeError("No multiclass CatBoostClassifier models found after filtering. "
                           "Adjust MODEL_PATHS/LE_PATHS or models' loss_function.")

    models = kept_models
    les = kept_les
    model_files = kept_model_files
    le_files = kept_le_files
    classes_counts = [-1] * len(models) 

    log.info(f"Loaded {len(models)} multiclass model(s).")

def _to_row(vec: List[float]) -> np.ndarray:
    arr = np.asarray(vec, dtype=np.float32)
    if arr.ndim != 1:
        raise ValueError("`embedding` must be a 1D list of floats.")
    return arr.reshape(1, -1)

def _idx_to_label(le, idx: int) -> str:
    try:
        classes = getattr(le, "classes_", None)
        if classes is not None and 0 <= idx < len(classes):
            return str(classes[idx])
    except Exception:
        pass
    return str(idx)

def _predict_one(i: int, model: CatBoostClassifier, x_row: np.ndarray, le) -> str:
    global classes_counts, expected_dim

   
    if expected_dim is None:
        expected_dim = x_row.shape[1]
        log.info(f"Fix embedding dim = {expected_dim}")
    elif x_row.shape[1] != expected_dim:
        raise HTTPException(status_code=400, detail=f"Embedding dim mismatch: got {x_row.shape[1]}, expected {expected_dim}")

   
    if classes_counts[i] in (-1, None):
        proba = model.predict_proba(x_row) 
        classes_counts[i] = int(proba.shape[1])
        if classes_counts[i] < 3:
           
            fname = model_files[i] if model_files else f"#{i}"
            raise HTTPException(status_code=500, detail=f"Model appears binary at inference (C={classes_counts[i]}): {fname}")
        log.info(f"Model №{i} classes = {classes_counts[i]}")

    y = model.predict(x_row, prediction_type="Class")
    cls_val = y[0] if np.ndim(y) == 1 else y[0][0]
    try:
        cls_idx = int(cls_val)
    except Exception:
        proba = model.predict_proba(x_row)
        cls_idx = int(np.argmax(proba[0]))

    return _idx_to_label(le, cls_idx)

# ---------- FastAPI ----------
@asynccontextmanager
async def lifespan(app: FastAPI):
    _ensure_loaded()
    yield

app = FastAPI(title="CatBoost Inference (Multiclass only, env-config)", version="1.2.0", lifespan=lifespan)

@app.get("/health")
def health():
    return {
        "status": "ok",
        "models": len(models or []),
        "label_encoders": len(les or []),
        "classes_counts": classes_counts,
        "expected_dim": expected_dim,
        "model_files": model_files,
        "le_files": le_files,
    }

@app.post("/infer", response_model=List[str])
def infer(req: InferenceRequest):
    try:
        if models is None or les is None:
            raise RuntimeError("Models are not loaded")
        x = _to_row(req.embedding)

        preds: List[str] = []
        for i, (m, le) in enumerate(zip(models, les)):
            preds.append(_predict_one(i, m, x, le))
        return preds

    except HTTPException:
        raise
    except Exception as e:
        if DEBUG:
            import traceback
            raise HTTPException(status_code=500, detail=f"Inference error: {e} | {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Inference error: {e}")

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8081"))
    _ensure_loaded()
    uvicorn.run(app, host=host, port=port, reload=False, log_level="info")
