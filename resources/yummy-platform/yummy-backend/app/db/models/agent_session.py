from sqlalchemy import String, Text, JSON, DateTime, ForeignKey, Integer, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum, uuid

class AgentType(str, enum.Enum):
    po = "po"
    ba = "ba"
    scrum = "scrum"
    code = "code"
    review = "review"
    security = "security"
    qa = "qa"
    docs = "docs"
    arch = "arch"
    deploy = "deploy"
    obs = "obs"

class AgentSession(Base):
    __tablename__ = "agent_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), nullable=True)
    agent_type: Mapped[AgentType] = mapped_column(SAEnum(AgentType), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=True)
    context: Mapped[dict] = mapped_column(JSON, default=dict)
    token_usage: Mapped[int] = mapped_column(Integer, default=0)
    model_used: Mapped[str] = mapped_column(String(100), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="sessions")
    messages: Mapped[list["Message"]] = relationship(back_populates="session")
