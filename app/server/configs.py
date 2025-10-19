import os

class ToxicityClassifier:
    host = os.getenv("TOXICITY_CLASSIFIER_HOST", "http://localhost:8000")
    model = os.getenv("TOXICITY_CLASSIFIER_MODEL", "xlmr_toxicity")
    timeout = float(os.getenv("TOXICITY_CLASSIFIER_TIMEOUT", "30"))
    
TOXICITY_CLASSIFIER = ToxicityClassifier()

class RubertEmbedder:
    host = os.getenv("RUBERT_HOST", "http://localhost:8000")
    model = os.getenv("RUBERT_MODEL", "rubert_tiny2_embeddings")
    timeout = float(os.getenv("RUBERT_TIMEOUT", "30"))
    normalize = os.getenv("RUBERT_NORMALIZE", "true").lower() == "true"
    
RUBERT_EMBEDDER = RubertEmbedder()

class FactorsDev:
    host = os.getenv("FACTORS_DEV_HOST", "http://localhost:8081")
    timeout = float(os.getenv("FACTORS_DEV_TIMEOUT", "15"))
    
FACTORS_DEV = FactorsDev()

facts: dict = {
    "action_item": 0,
    "category": 1,
}

class DataBase:
    user = os.getenv("DATABASE_USER", "server_user")
    password = os.getenv("DATABASE_PASSWORD", "1231234")
    host = os.getenv("DATABASE_HOST", "localhost:5432")
    name = os.getenv("DATABASE_NAME", "ai_atom")
    
    def url(self):
        return f"postgresql+psycopg2://{self.user}:{self.password}@{self.host}/{self.name}"
    
DATABASE = DataBase()

class JWT:
    secret = os.getenv("JWT_SECRET", "CHANGE_ME_IN_PROD")
    expires_min = int(os.getenv("JWT_EXPIRES_MIN", "60"))
    role_admin = 1
    
JWT_c = JWT()

class Qwen:
    host = os.getenv("QWEN_URL", "http://localhost:8000")
    model = os.getenv("QWEN_MODEL", "qwen_cpu")
    timeout = int(os.getenv("QWEN_TIMEOUT", "600"))  # генерация на CPU может быть долгой
    
    
QWEN = Qwen()