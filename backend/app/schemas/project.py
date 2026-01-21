from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# ---------- Base schema ----------

class ProjectBase(BaseModel):
    title: str
    description: Optional[str] = None  # correct spelling


# ---------- Input schema (for POST /projects) ----------

class ProjectCreate(ProjectBase):
    pass



class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None

# ---------- Output schema (for responses) ----------

class ProjectRead(ProjectBase):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        # For Pydantic v1 + FastAPI: enables ORM (SQLAlchemy) objects
        orm_mode = True
        # For Pydantic v2, FastAPI shims this to from_attributes=True