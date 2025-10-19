import os, json

def _parse_list_env(name: str, default_list: list[str]) -> list[str]:
    """
    Поддерживает:
      - JSON-массив:  MODEL_PATHS='["m1.cbm","m2.cbm"]'
      - CSV-строку:   MODEL_PATHS='m1.cbm,m2.cbm'
    """
    raw = os.getenv(name)
    if not raw:
        return default_list
   
    try:
        val = json.loads(raw)
        if isinstance(val, list):
            return [str(x) for x in val]
    except Exception:
        pass
   
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    return parts if parts else default_list

MODELS_DIR = os.getenv("MODELS_DIR", "models")

MODEL_PATHS = _parse_list_env(
    "MODEL_PATHS",
    ["catboost_action.cbm", "catboost_multiclass.cbm"],
)
MODEL_PATHS = [p if os.path.isabs(p) else os.path.join(MODELS_DIR, p) for p in MODEL_PATHS]

LE_PATHS = _parse_list_env(
    "LE_PATHS",
    ["label_encoder_action.joblib", "label_encoder.joblib"],
)
LE_PATHS = [p if os.path.isabs(p) else os.path.join(MODELS_DIR, p) for p in LE_PATHS]
