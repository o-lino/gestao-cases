from pydantic import BaseModel, ConfigDict
from datetime import datetime

class CommentBase(BaseModel):
    content: str

class CommentCreate(CommentBase):
    pass

class CommentResponse(CommentBase):
    id: int
    case_id: int
    created_by: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
