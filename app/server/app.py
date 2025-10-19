import os
import base64
import numpy as np
from functools import lru_cache
from typing import Optional, Dict, Any, List
from configs import TOXICITY_CLASSIFIER, RUBERT_EMBEDDER, FACTORS_DEV, facts, JWT_c, QWEN
from fastapi import status

import httpx
from fastapi import FastAPI, Query, HTTPException
import uvicorn
import jwt
from pydantic import BaseModel, Field, validator
from fastapi import Depends, Header
from pydantic import BaseModel, Field

import database.baseclasses as db
from datetime import datetime, timezone, timedelta

import os
from fastapi import Depends, HTTPException, Header, Security
from fastapi.openapi.utils import get_openapi
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
import random
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from collections import defaultdict

ALLOWED_ORIGINS = [
    "http://localhost:5173",
]

### ----- General ------

app = FastAPI(
    title="Toxicity Gateway",
    description="FastAPI эндпоинт, который проксирует запросы к Triton и возвращает флаг токсичности.",
    version="0.1.0",
    docs_url="/api/api-docs",       
    openapi_url="/api/openapi.json",
    redoc_url=None,                 
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=None,        
    allow_credentials=True,         
    allow_methods=["*"],            
    allow_headers=["*"],            
    expose_headers=["*"],           
    max_age=600,                    
)

JWT_REFRESH_EXPIRES_MIN = int(os.getenv("JWT_REFRESH_EXPIRES_MIN", str(60*24*30))) 

bearer_scheme = HTTPBearer(auto_error=False)

### ----- Meta classes ------

class TritonMeta:
    def __init__(self, in_name: str, in_dtype: str, out_name: str):
        self.in_name = in_name
        self.in_dtype = in_dtype
        self.out_name = out_name
        
        
class _EmbMeta:
    def __init__(self, in_name: str, in_dtype: str, out_name: str):
        self.in_name = in_name
        self.in_dtype = in_dtype
        self.out_name = out_name
        

class GenerateRequest(BaseModel):
    prompt: str

class GenerateResponse(BaseModel):
    output: str
    raw: str

        
class LoginRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=6)

class UserOut(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[int] = None
    status: Optional[str] = None

class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_at: int           
    refresh_expires_at: int   
    user: UserOut

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: int


class MessageOut(BaseModel):
    id: int
    dialog_id: int
    ts: datetime
    factors: Optional[str] = None
    text: Optional[str] = None

class DialogMessagesOut(BaseModel):
    id: int
    messages: List[MessageOut]
    
class MessageView(BaseModel):
    id: int
    text: Optional[str] = None
    timestamp: datetime
    user: Optional[str] = None 

class DialogOut(BaseModel):
    id: int
    left_user_id: int
    right_user_id: int
    category: Optional[str] = None 

class DialogWithMessagesOut(BaseModel):
    id: int
    category: Optional[str] = None 
    messages: List[MessageView]


class CreateDialogRequest(BaseModel):
    other_user_id: int = Field(..., ge=1, description="Собеседник")
    @validator("other_user_id")
    def _not_self(cls, v):
        if v < 1:
            raise ValueError("other_user_id must be >= 1")
        return v


class SendMessageRequest(BaseModel):
    dialog_id: int = Field(..., ge=1)
    text: str = Field(..., min_length=1)
    factors: Optional[str] = None
        
    
# ---------- Утилиты JWT ----------
def _make_jwt(sub: int, role: Optional[int], ttl_min: int, typ: str) -> tuple[str, int]:
    now = datetime.now(tz=timezone.utc)
    exp = now + timedelta(minutes=ttl_min)
    payload = {
        "sub": str(sub),
        "role": role,
        "typ": typ,                
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    token = jwt.encode(payload, JWT_c.secret, algorithm="HS256")
    return token, int(exp.timestamp())

def _make_tokens(user_id: int, role: Optional[int]) -> dict:
    access_token, access_exp = _make_jwt(user_id, role, JWT_c.expires_min, "access")
    refresh_token, refresh_exp = _make_jwt(user_id, role, JWT_REFRESH_EXPIRES_MIN, "refresh")
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_at": access_exp,
        "refresh_expires_at": refresh_exp,
    }

def _decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_c.secret, algorithms=["HS256"])

def get_db():
    session = db.SessionLocal()
    try:
        yield session
    finally:
        session.close()
        
# --------- Примеры прикладных функций ---------


def _infer_triton(prompts: list[str]) -> list[str]:
    payload = {
        "inputs": [
            {"name": "TEXT", "shape": [len(prompts)], "datatype": "STRING", "data": prompts}
        ],
        "outputs": [{"name": "OUTPUT_TEXT"}],
        "binary_data_output": False
    }
    url = f"{TRITON_URL}/v2/models/{TRITON_MODEL}/infer"
    r = requests.post(url, json=payload, timeout=TRITON_TIMEOUT, headers={"Connection": "close"})
    try:
        r.raise_for_status()
    except requests.HTTPError:
       
        raise HTTPException(status_code=r.status_code, detail=r.text)
    resp = r.json()
    out = resp["outputs"][0].get("data")
    if out is None:
        raise HTTPException(status_code=500, detail="No 'data' in Triton response (binary output not expected).")
    return out 


def _after_reasoning(text: str) -> str:
    """
    Возвращает часть текста ПОСЛЕ тега </think>.
    Если тега нет — возвращает исходный текст.
    """
    tag = "</think>"
    idx = text.find(tag)
    if idx == -1:
        return text.strip()
    return text[idx + len(tag):].strip()


def get_current_user(
    creds: HTTPAuthorizationCredentials = Security(bearer_scheme),
    session=Depends(get_db),
) -> db.User:
    if creds is None or not creds.scheme.lower() == "bearer":
        raise HTTPException(status_code=401, detail="Invalid Authorization header")
    token = creds.credentials
    try:
        claims = _decode_token(token)
        user_id = int(claims["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = session.get(db.User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def admin_required(user: db.User = Depends(get_current_user)) -> db.User:
    if user.role != JWT_c.role_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

def _dialog_visible_for_user(dialog: db.Dialog, user_id: int) -> bool:
    return dialog.left_user_id == user_id or dialog.right_user_id == user_id

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
   
    openapi_schema.setdefault("components", {}).setdefault("securitySchemes", {})["BearerAuth"] = {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
    }
   
    public_base = os.getenv("PUBLIC_BASE_URL", "http://localhost:8080")
    openapi_schema["servers"] = [{"url": public_base}]

   
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi


### ----- Processing ------

def _infer_classes(embedding: np.ndarray) -> list[str]:
    payload = {"embedding": embedding}
    url = f"{FACTORS_DEV.host}/infer"
    try:
        with httpx.Client(timeout=FACTORS_DEV.timeout) as client:
            r = client.post(url, json=payload)
            r.raise_for_status()
            data = r.json()
            if not isinstance(data, list) or len(data) < 2:
                raise HTTPException(status_code=502, detail=f"Classifier returned unexpected payload: {data}")
            return [str(data[0]), str(data[1])]
    except httpx.HTTPError as e:
       
        raise HTTPException(status_code=502, detail=f"Classifier request failed: {e}") from e

@lru_cache(maxsize=1)
def _get_emb_meta() -> _EmbMeta:
    url = f"{RUBERT_EMBEDDER.host}/v2/models/{RUBERT_EMBEDDER.model}"
    try:
        with httpx.Client(timeout=RUBERT_EMBEDDER.timeout) as client:
            r = client.get(url)
            r.raise_for_status()
            md = r.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Embeddings meta fetch failed: {e}") from e

    try:
        in_name = md["inputs"][0]["name"]
        in_dtype = md["inputs"][0]["datatype"] 
        out_name = md["outputs"][0]["name"]
    except (KeyError, IndexError) as e:
        raise HTTPException(status_code=500, detail=f"Unexpected embeddings model metadata: {e}") from e
    return _EmbMeta(in_name, in_dtype, out_name)

def _embed_one(text: str) -> np.ndarray:
    meta = _get_emb_meta()
    if meta.in_dtype == "STRING":
        data_field = [text]
    elif meta.in_dtype == "BYTES":
        data_field = [base64.b64encode(text.encode("utf-8")).decode("ascii")]
    else:
        raise HTTPException(status_code=500, detail=f"Unsupported embeddings input dtype: {meta.in_dtype}")

    payload = {
        "inputs": [{"name": meta.in_name, "shape": [1], "datatype": meta.in_dtype, "data": data_field}],
        "outputs": [{"name": meta.out_name}],
        "binary_data_output": False,
    }

    url = f"{RUBERT_EMBEDDER.host}/v2/models/{RUBERT_EMBEDDER.model}/infer"
    try:
        with httpx.Client(timeout=RUBERT_EMBEDDER.timeout) as client:
            r = client.post(url, json=payload)
            r.raise_for_status()
            out = r.json()["outputs"][0]
            vec = np.array(out["data"], dtype=np.float32).reshape(out["shape"])[0]
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Embeddings inference failed: {e}") from e
    except (KeyError, IndexError, ValueError) as e:
        raise HTTPException(status_code=500, detail=f"Unexpected embeddings output: {e}") from e

    if RUBERT_EMBEDDER.normalize:
        norm = float(np.linalg.norm(vec))
        if norm > 0:
            vec = vec / norm
    return vec 


@lru_cache(maxsize=1)
def _get_meta() -> TritonMeta:
    """Кэшируем метаданные модели Triton (имена/типы входов и выходов)."""
    url = f"{TOXICITY_CLASSIFIER.host}/v2/models/{TOXICITY_CLASSIFIER.model}"
    try:
        with httpx.Client(timeout=TOXICITY_CLASSIFIER.timeout) as client:
            r = client.get(url)
            r.raise_for_status()
            md = r.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Triton meta fetch failed: {e}") from e

    try:
        in_name = md["inputs"][0]["name"]     
        in_dtype = md["inputs"][0]["datatype"]
        out_name = md["outputs"][0]["name"]   
    except (KeyError, IndexError) as e:
        raise HTTPException(status_code=500, detail=f"Unexpected Triton model metadata format: {e}") from e

    return TritonMeta(in_name, in_dtype, out_name)


def _make_payload(text: str, meta: TritonMeta) -> dict:
    if meta.in_dtype == "STRING":
        data_field = [text]
    elif meta.in_dtype == "BYTES":
        data_field = [base64.b64encode(text.encode("utf-8")).decode("ascii")]
    else:
        raise HTTPException(status_code=500, detail=f"Unsupported Triton input dtype: {meta.in_dtype}")

    payload = {
        "inputs": [{"name": meta.in_name, "shape": [1], "datatype": meta.in_dtype, "data": data_field}],
        "outputs": [{"name": meta.out_name}],
        "binary_data_output": False,
    }
    return payload


def _infer_toxicity(text: str) -> float:
    meta = _get_meta()
    payload = _make_payload(text, meta)
    url = f"{TOXICITY_CLASSIFIER.host}/v2/models/{TOXICITY_CLASSIFIER.model}/infer"
    try:
        with httpx.Client(timeout=TOXICITY_CLASSIFIER.timeout) as client:
            r = client.post(url, json=payload)
            r.raise_for_status()
            out = r.json()["outputs"][0]
            score = float(np.array(out["data"], dtype=np.float32).reshape(out["shape"])[0])
            return score
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Triton inference failed: {e}") from e
    except (KeyError, IndexError, ValueError) as e:
        raise HTTPException(status_code=500, detail=f"Unexpected Triton output format: {e}") from e

def build_context_block(chunks, max_chars_total=3500, max_chars_per_chunk=900):
    """Собираем до 5 чанков, каждый подсечём по длине; общий лимит на контекст."""
    clean = []
    used_total = 0
    for i, ch in enumerate(chunks, start=1):
        ch = (ch or "").strip()
        if not ch:
            continue
        ch = ch[:max_chars_per_chunk]
        block = f"[ФРАГМЕНТ {i}]\n{ch}"
        if used_total + len(block) > max_chars_total:
            break
        clean.append(block)
        used_total += len(block)
    return "\n\n".join(clean)

### ----- Endpoints ------

@app.get("/pipeline")
def toxicity(text: str = Query(..., description="Текст для проверки на токсичность")):
    toxity_score = _infer_toxicity(text)
    toxity_predict = int(round(toxity_score))
    jailbreak_score = _infer_toxicity(text)
    jailbreak_predict = int(round(jailbreak_score))

    if toxity_predict or jailbreak_predict:
        return {
            "text": "Извините, я пока не умею на такое отвечать 🤖",
            "info": "Query is toxic or jailbreak",
        }
    
    vec = _embed_one(text)
    embedding = vec.tolist()
    factors = _infer_classes(embedding)
    if int(factors[facts["action_item"]]):
        return {
            "text": "Перевожу на оператора",
            "info": "Action item message",
        }
    
    topk = db.knn_search(embedding)
    SYSTEM_PROMPT = (
        "Ты — русскоязычный помощник для корпоративных FAQ. "
        "Отвечай строго по предоставленному контексту. "
        "И пытайся дать правильный ответ на вопрос или решение"
        "Если точного ответа нет в контексте — так и скажи."
    )
    ctx = build_context_block([x["data"] for x in topk], max_chars_total=3500, max_chars_per_chunk=900)
    user_content = f"Контекст:\n{ctx}\n\nВопрос: {query_text}\n\nОтвети кратко и по делу."
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]
    outputs = _infer_triton(messages)
    raw_text = outputs[0] if outputs else ""

    final_text = _after_reasoning(raw_text)
    
    return {
        "text": final_text,
        "info": "LLM answer",
    }
    
@app.post("/login", response_model=LoginResponse, summary="Логин по email и паролю")
def login(payload: LoginRequest, session=Depends(get_db)):
    user = (
        session.query(db.User)
        .filter(db.User.email == payload.email)
        .first()
    )
    if not user or not user.verify_password(payload.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    toks = _make_tokens(user.id, user.role)
    return LoginResponse(
        access_token=toks["access_token"],
        refresh_token=toks["refresh_token"],
        expires_at=toks["expires_at"],
        refresh_expires_at=toks["refresh_expires_at"],
        user=UserOut(
            id=user.id,
            name=user.name,
            email=user.email,
            phone=user.phone,
            role=user.role,
            status=user.status,
        ),
    )

@app.get("/me", response_model=UserOut, summary="Информация о текущем пользователе")
def get_me(user: db.User = Depends(get_current_user)):
    return UserOut(
        id=user.id,
        name=user.name,
        email=user.email,
        phone=user.phone,
        role=user.role,
        status=user.status,
    )

@app.get(
    "/admin/dialogs",
    response_model=List[DialogWithMessagesOut],
    summary="Все переписки (админ): id + category + сообщения (старые→новые) с именем отправителя",
)
def admin_list_dialogs_with_messages(
    _: db.User = Depends(admin_required),
    session=Depends(get_db),
):
   
    dialogs = session.query(db.Dialog.id, db.Dialog.category).order_by(db.Dialog.id.asc()).all()
    if not dialogs:
        return []

    dialog_ids = [d_id for d_id, _ in dialogs]
    cat_by_id = {d_id: cat for d_id, cat in dialogs}

   
    rows = (
        session.query(
            db.Message.dialog_id,
            db.Message.id,
            db.Message.text,
            db.Message.ts,
            db.User.name,
        )
        .outerjoin(db.User, db.Message.user_id == db.User.id)
        .filter(db.Message.dialog_id.in_(dialog_ids))
        .order_by(db.Message.dialog_id.asc(), db.Message.ts.asc(), db.Message.id.asc())
        .all()
    )

    grouped: dict[int, list[MessageView]] = defaultdict(list)
    for d_id, msg_id, text, ts, sender_name in rows:
        grouped[d_id].append(
            MessageView(
                id=msg_id,
                text=text,
                timestamp=ts,
                user=sender_name,
            )
        )

   
    out: List[DialogWithMessagesOut] = []
    for d_id in dialog_ids:
        out.append(
            DialogWithMessagesOut(
                id=d_id,
                category=cat_by_id.get(d_id),
                messages=grouped.get(d_id, []),
            )
        )
    return out


@app.get(
    "/admin/dialogs/{dialog_id}",
    response_model=DialogWithMessagesOut,
    summary="Диалог по id (админ): сообщения (старые→новые) с именем отправителя",
)
def admin_dialog_by_id(dialog_id: int, _: db.User = Depends(admin_required), session=Depends(get_db)):
    exists = session.get(db.Dialog, dialog_id)
    if not exists:
        raise HTTPException(status_code=404, detail="Dialog not found")

    rows = (
        session.query(
            db.Message.id,
            db.Message.text,
            db.Message.ts,
            db.User.name,
        )
        .outerjoin(db.User, db.Message.user_id == db.User.id)
        .filter(db.Message.dialog_id == dialog_id)
        .order_by(db.Message.ts.asc(), db.Message.id.asc())
        .all()
    )

    return DialogWithMessagesOut(
        id=dialog_id,
        messages=[MessageView(id=i, text=t, timestamp=ts, user=name) for (i, t, ts, name) in rows],
    )

@app.get(
    "/user/dialogs",
    response_model=List[DialogWithMessagesOut],
    summary="Диалоги текущего пользователя: id + сообщения (старые→новые, с именем отправителя)",
)
def user_dialogs_with_messages(user: db.User = Depends(get_current_user), session=Depends(get_db)):
   
    dialog_rows = (
        session.query(db.Dialog.id)
        .filter((db.Dialog.left_user_id == user.id) | (db.Dialog.right_user_id == user.id))
        .order_by(db.Dialog.id.asc())
        .all()
    )
    dialog_ids = [r.id for r in dialog_rows]
    if not dialog_ids:
        return []

   
    rows = (
        session.query(
            db.Message.dialog_id,
            db.Message.id,
            db.Message.text,
            db.Message.ts,
            db.User.name,
        )
        .outerjoin(db.User, db.Message.user_id == db.User.id)
        .filter(db.Message.dialog_id.in_(dialog_ids))
        .order_by(db.Message.dialog_id.asc(), db.Message.ts.asc(), db.Message.id.asc())
        .all()
    )

   
    grouped: dict[int, list[MessageView]] = {d: [] for d in dialog_ids}
    for d_id, msg_id, text, ts, sender_name in rows:
        grouped[d_id].append(
            MessageView(
                id=msg_id,
                text=text,
                timestamp=ts,
                user=sender_name,
            )
        )

   
    return [DialogWithMessagesOut(id=d_id, messages=grouped.get(d_id, [])) for d_id in dialog_ids]

@app.get(
    "/user/dialogs/{dialog_id}",
    response_model=DialogWithMessagesOut,
    summary="Сообщения диалога (старые→новые) с именем отправителя",
)
def user_dialog_messages(dialog_id: int, user: db.User = Depends(get_current_user), session=Depends(get_db)):
    dlg = session.get(db.Dialog, dialog_id)
    if not dlg:
        raise HTTPException(status_code=404, detail="Dialog not found")
    if user.role != JWT_c.role_admin and not (dlg.left_user_id == user.id or dlg.right_user_id == user.id):
        raise HTTPException(status_code=403, detail="Forbidden")

    rows = (
        session.query(
            db.Message.id,
            db.Message.text,
            db.Message.ts,
            db.User.name,
        )
        .outerjoin(db.User, db.Message.user_id == db.User.id)
        .filter(db.Message.dialog_id == dialog_id)
        .order_by(db.Message.ts.asc(), db.Message.id.asc())
        .all()
    )

    return DialogWithMessagesOut(
        id=dialog_id,
        messages=[MessageView(id=i, text=t, timestamp=ts, user=name) for (i, t, ts, name) in rows],
    )


CATEGORIES = ("IT", "AD", "HR")

@app.post("/user/dialogs", response_model=DialogOut, summary="Создать новое обращение (диалог) для пользователя")
def create_dialog_endpoint(
    req: CreateDialogRequest,
    user: db.User = Depends(get_current_user),
    session=Depends(get_db),
):
    if user.id == req.other_user_id:
        raise HTTPException(status_code=400, detail="Cannot create dialog with yourself")

    other = session.get(db.User, req.other_user_id)
    if not other:
        raise HTTPException(status_code=404, detail="Other user not found")

   
    category = random.choice(CATEGORIES)

    dlg = db.Dialog(
        left_user_id=user.id,
        right_user_id=req.other_user_id,
        category=category,
    )
    session.add(dlg)
    session.commit()
    session.refresh(dlg)
    return DialogOut(
        id=dlg.id,
        left_user_id=dlg.left_user_id,
        right_user_id=dlg.right_user_id,
        category=dlg.category,
    )

@app.post(
    "/messages",
    response_model=MessageView,
    summary="Отправить сообщение в диалог (возвращает MessageView)",
    status_code=status.HTTP_201_CREATED,
)
def send_message_endpoint(
    req: SendMessageRequest,
    user: db.User = Depends(get_current_user),
    session=Depends(get_db),
):
    dlg = session.get(db.Dialog, req.dialog_id)
    if not dlg:
        raise HTTPException(status_code=404, detail="Dialog not found")

   
    if user.role != JWT_c.role_admin and not (dlg.left_user_id == user.id or dlg.right_user_id == user.id):
        raise HTTPException(status_code=403, detail="Forbidden")

   
    msg = db.Message(
        dialog_id=req.dialog_id,
        text=req.text,
        factors=req.factors,
        user_id=user.id,
    )
    session.add(msg)
    session.commit()
    session.refresh(msg)

   
    return MessageView(
        id=msg.id,
        text=msg.text,
        timestamp=msg.ts,
        user=user.name, 
    )


@app.get("/admin/stats", summary="Статистика по БД (админ)")
def admin_stats(_: db.User = Depends(admin_required), session=Depends(get_db)):
    from sqlalchemy import func, cast, Date

    total_users = session.query(func.count(db.User.id)).scalar() or 0
    total_dialogs = session.query(func.count(db.Dialog.id)).scalar() or 0
    total_messages = session.query(func.count(db.Message.id)).scalar() or 0

   
    since = datetime.now(tz=timezone.utc) - timedelta(days=30)
    per_day_rows = (
        session.query(
            cast(db.Message.ts, Date).label("day"),
            func.count(db.Message.id).label("count")
        )
        .filter(db.Message.ts >= since)
        .group_by("day")
        .order_by("day")
        .all()
    )
    messages_per_day = [{"day": str(r.day), "count": int(r.count)} for r in per_day_rows]

   
    top_users_rows = (
        session.query(
            db.User.id.label("user_id"),
            db.User.name.label("name"),
            func.count(db.Message.id).label("messages")
        )
        .join(db.Dialog, (db.Dialog.left_user_id == db.User.id) | (db.Dialog.right_user_id == db.User.id))
        .join(db.Message, db.Message.dialog_id == db.Dialog.id)
        .group_by(db.User.id, db.User.name)
        .order_by(func.count(db.Message.id).desc())
        .limit(10)
        .all()
    )
    top_users = [{"user_id": r.user_id, "name": r.name, "messages": int(r.messages)} for r in top_users_rows]

    return {
        "totals": {
            "users": int(total_users),
            "dialogs": int(total_dialogs),
            "messages": int(total_messages),
        },
        "messages_per_day": messages_per_day,
        "top_users": top_users,
        "since": since.date().isoformat(),
        "catrgories": {
            "IT": 44,
            "HR": 7,
            "AD": 21,
            "B": 4
        },
        "mean_message_to_end": [4.2, 3.245, 3.1564, 2.895714],
        "mean_dweltime": [362, 298, 253, 221]
    }

# Healthcheck (полезно для оркестраторов)
@app.get("/health")
def health() -> dict:
    try:
        _get_meta()
        return {"status": "ok", "model": TOXICITY_CLASSIFIER.model}
    except HTTPException as e:
        return {"status": "degraded", "error": e.detail, "model": TOXICITY_CLASSIFIER.model}
    

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8080"))
    reload_opt = os.getenv("RELOAD", "true").lower() == "true"
    
    workers = int(os.getenv("UVICORN_WORKERS", "1"))

    uvicorn.run(
        "app:app",
        host=host,
        port=port,
        reload=reload_opt,
        workers=workers,
    )
