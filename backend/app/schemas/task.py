from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class TaskRead(BaseModel):
    id: int
    run_id: int
    agent_type: str
    status: str
    input: Optional[str] = None
    output: Optional[str] = None
    order_index: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        orm_mode = True
