from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class RunBase(BaseModel):
    status: Optional[str] = None

class RunCreate(BaseModel):
    # For now, we don't need extra fields; it's created from project.
    pass

class RunRead(BaseModel):
    id: int
    project_id: int
    status: str
    final_summary: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        orm_mode = True
