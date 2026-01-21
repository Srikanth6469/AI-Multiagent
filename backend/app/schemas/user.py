
from typing import Optional

from pydantic import BaseModel, EmailStr



class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None



class UserCreate(UserBase):
    password: str



class UserRead(UserBase):
    id: int
    is_active: bool

    class Config:
        orm_mode = True
        from_attributes = True



class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: int
    email: EmailStr
