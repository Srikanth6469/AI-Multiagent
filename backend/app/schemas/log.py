from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class LogRead(BaseModel):
    id: int
    run_id: int
    agent_type: Optional[str] = None
    level: str
    message: str
    created_at: datetime

    class Config:
        from_attributes = True
        orm_mode = True
