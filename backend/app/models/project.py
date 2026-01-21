from sqlalchemy import Boolean, Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from backend.app.core.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(100), unique=True, nullable=False)

    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    projects = relationship("Project", back_populates="owner")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    owner = relationship("User", back_populates="projects")

    runs = relationship("Run", back_populates="project", cascade="all, delete-orphan")
    is_locked = Column(Boolean, default=False)
    

class Run(Base):
    __tablename__ = "runs"

    id = Column(Integer, primary_key=True, index=True , nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)

    status = Column(String(50), nullable=False, default="pending")
    final_summary = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="runs")
    tasks = relationship("Task", back_populates="run", cascade="all, delete-orphan")
    logs = relationship("Log", back_populates="run", cascade="all, delete-orphan")
    is_archived = Column(Boolean, default=False)
    is_locked = Column(Boolean, default=False)
    


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("runs.id"), nullable=False)

    agent_type = Column(String(50), nullable=False)
    status = Column(String(50), nullable=False, default="pending")

    input = Column(Text, nullable=True)
    output = Column(Text, nullable=True)
    order_index = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    run = relationship("Run", back_populates="tasks")
    
    
    parent_task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    depth = Column(Integer, default=0)
    branch = Column(String(50), default="main")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    run = relationship("Run", back_populates="tasks")


class Log(Base):
    __tablename__ = "logs"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("runs.id"), nullable=False)

    agent_type = Column(String(50), nullable=True)
    level = Column(String(20), default="info")
    message = Column(Text, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    run = relationship("Run", back_populates="logs")


