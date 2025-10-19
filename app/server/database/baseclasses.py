from __future__ import annotations

from functools import wraps
from typing import Callable, TypeVar, Any, Optional

from sqlalchemy import (
    create_engine, ForeignKey, Text, Integer, BigInteger, DateTime,
    func, Index, select, or_
)
from sqlalchemy.orm import (
    DeclarativeBase, Mapped, mapped_column, relationship,
    Session, sessionmaker
)
from sqlalchemy import text
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text, bindparam
from sqlalchemy.dialects.postgresql import ARRAY, DOUBLE_PRECISION
from configs import DATABASE

from pydantic import BaseModel, Field, validator
from fastapi import Depends, Header
from passlib.context import CryptContext
from pydantic import BaseModel, Field, EmailStr
from sqlalchemy.dialects.postgresql import ARRAY, DOUBLE_PRECISION
from sqlalchemy import BigInteger, Text, LargeBinary, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

pwd_ctx = CryptContext(
    schemes=["bcrypt_sha256", "bcrypt"],
    default="bcrypt_sha256",
    deprecated="auto",
)

DATABASE_URL = DATABASE.url()

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(bind=engine, expire_on_commit=False, class_=Session)


# --------- Базовый класс ----------
class Base(DeclarativeBase):
    pass


# --------- Модели ----------
class User(Base):
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[Optional[str]] = mapped_column(Text)
    phone: Mapped[Optional[str]] = mapped_column(Text)
    role: Mapped[Optional[int]] = mapped_column(Integer)
    status: Mapped[Optional[str]] = mapped_column(Text)
    password_hash: Mapped[Optional[str]] = mapped_column(Text)

    dialogs_left: Mapped[list["Dialog"]] = relationship(
        back_populates="left_user",
        foreign_keys="Dialog.left_user_id",
        cascade="all, delete-orphan",
        passive_deletes=True
    )
    dialogs_right: Mapped[list["Dialog"]] = relationship(
        back_populates="right_user",
        foreign_keys="Dialog.right_user_id",
        cascade="all, delete-orphan",
        passive_deletes=True
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} name={self.name!r}>"
    
    def set_password(self, password: str) -> None:
        self.password_hash = pwd_ctx.hash(password)

    def verify_password(self, password: str) -> bool:
        if not self.password_hash:
            return False
        return pwd_ctx.verify(password, self.password_hash)

class Dialog(Base):
    __tablename__ = "dialog"
    __table_args__ = (
        Index("idx_dialog_left_user", "left_user_id"),
        Index("idx_dialog_right_user", "right_user_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    left_user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("user.id", ondelete="CASCADE"), nullable=False
    )
    right_user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("user.id", ondelete="CASCADE"), nullable=False
    )
   
    category: Mapped[str | None] = mapped_column(Text) 

    left_user: Mapped[User] = relationship(
        "User", foreign_keys=[left_user_id], back_populates="dialogs_left"
    )
    right_user: Mapped[User] = relationship(
        "User", foreign_keys=[right_user_id], back_populates="dialogs_right"
    )
    messages: Mapped[list["Message"]] = relationship(
        back_populates="dialog",
        cascade="all, delete-orphan",
        passive_deletes=True
    )


class Message(Base):
    __tablename__ = "message"
    __table_args__ = (
        Index("idx_message_dialog", "dialog_id"),
        Index("idx_message_user", "user_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    dialog_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("dialog.id", ondelete="CASCADE"), nullable=False
    )
   
    user_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey('user.id', ondelete="SET NULL"), nullable=True
    )

    ts: Mapped[Any] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    factors: Mapped[str | None] = mapped_column(Text)
    text: Mapped[str | None] = mapped_column("text", Text)

    dialog: Mapped["Dialog"] = relationship("Dialog", back_populates="messages")
    sender: Mapped["User | None"] = relationship("User") 

class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    data: Mapped[bytes | None] = mapped_column(LargeBinary)

    chunks: Mapped[list["Chunk"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

class Chunk(Base):
    __tablename__ = "chunks"
    __table_args__ = (
        Index("idx_chunks_document_id", "document_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    document_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    data: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float]] = mapped_column(ARRAY(DOUBLE_PRECISION), nullable=False)

    document: Mapped[Document] = relationship("Document", back_populates="chunks")


# Инициализация схемы (один раз при старте сервиса)
def init_models() -> None:
    Base.metadata.create_all(engine)


# --------- Декораторы для запросов ----------
F = TypeVar("F", bound=Callable[..., Any])

def db_query(func: F) -> F:
    """
    Read-only операции. Создает и закрывает сессию, если она не передана.
    В случае исключения делает rollback (на всякий).
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        session: Optional[Session] = kwargs.get("session")
        created_here = session is None
        if created_here:
            session = SessionLocal()
            kwargs["session"] = session
        try:
            result = func(*args, **kwargs)
           
            return result
        except Exception:
            if created_here:
                session.rollback()
            raise
        finally:
            if created_here:
                session.close()
    return wrapper 


def db_update(func: F) -> F:
    """
    Изменяющие операции. Гарантирует транзакцию (commit/rollback) и закрытие сессии,
    если она была создана декоратором.
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        session: Optional[Session] = kwargs.get("session")
        created_here = session is None
        if created_here:
            session = SessionLocal()
            kwargs["session"] = session
        try:
            with session.begin(): 
                return func(*args, **kwargs)
        except Exception:
            if created_here:
                session.rollback() 
            raise
        finally:
            if created_here:
                session.close() 
    return wrapper 


@db_query
def knn_search(embedding: List[float], k: int = 5, session: Session | None = None) -> List[Dict[str, Any]]:
    """
    Top-k ближайших чанков по L2 расстоянию.
    Возвращает [{"id": <chunk_id>, "data": <chunk_text>}, ...]
    """
    if not embedding:
        return []

    dim = len(embedding)

    sql = text("""
        WITH q AS (SELECT :emb AS e)
        SELECT c.id, c.data
        FROM chunks c, q
        WHERE array_length(c.embedding, 1) = :dim
        ORDER BY (
            SELECT SUM( (c.embedding[i] - q.e[i]) * (c.embedding[i] - q.e[i]) )
            FROM generate_subscripts(c.embedding, 1) AS i
        ) ASC
        LIMIT :k
    """).bindparams(
        bindparam("emb", value=embedding, type_=ARRAY(DOUBLE_PRECISION))
    )

    rows = session.execute(sql, {"dim": dim, "k": k}).mappings().all()
    return [{"id": r["id"], "data": r["data"]} for r in rows]


