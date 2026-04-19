from sqlalchemy import String, Text, Integer, DateTime, ForeignKey, JSON, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum, uuid

class SprintStatus(str, enum.Enum):
    planning = "planning"
    active = "active"
    review = "review"
    done = "done"

class StoryStatus(str, enum.Enum):
    backlog = "backlog"
    todo = "todo"
    in_progress = "in_progress"
    review = "review"
    done = "done"
    blocked = "blocked"

class Sprint(Base):
    __tablename__ = "sprints"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"))
    name: Mapped[str] = mapped_column(String(255))
    goal: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[SprintStatus] = mapped_column(SAEnum(SprintStatus), default=SprintStatus.planning)
    velocity: Mapped[int] = mapped_column(Integer, default=0)
    capacity: Mapped[int] = mapped_column(Integer, default=0)
    start_date: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=True)
    end_date: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=True)
    ai_insights: Mapped[dict] = mapped_column(JSON, default=dict)
    project: Mapped["Project"] = relationship(back_populates="sprints")
    stories: Mapped[list["UserStory"]] = relationship(back_populates="sprint")

class UserStory(Base):
    __tablename__ = "user_stories"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sprint_id: Mapped[str] = mapped_column(String(36), ForeignKey("sprints.id"), nullable=True)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"))
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str] = mapped_column(Text, nullable=True)
    acceptance_criteria: Mapped[list] = mapped_column(JSON, default=list)
    story_points: Mapped[int] = mapped_column(Integer, nullable=True)
    status: Mapped[StoryStatus] = mapped_column(SAEnum(StoryStatus), default=StoryStatus.backlog)
    priority: Mapped[int] = mapped_column(Integer, default=5)
    ai_generated: Mapped[bool] = mapped_column(default=False)
    jira_id: Mapped[str] = mapped_column(String(50), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    sprint: Mapped["Sprint"] = relationship(back_populates="stories")
    tasks: Mapped[list["Task"]] = relationship(back_populates="story")

class Task(Base):
    __tablename__ = "tasks"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(String(36), ForeignKey("user_stories.id"))
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str] = mapped_column(Text, nullable=True)
    assignee_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    status: Mapped[StoryStatus] = mapped_column(SAEnum(StoryStatus), default=StoryStatus.todo)
    estimated_hours: Mapped[int] = mapped_column(Integer, nullable=True)
    story: Mapped["UserStory"] = relationship(back_populates="tasks")
