from typing import Any, List, Optional
from pydantic import BaseModel, Field


class StandardResponse(BaseModel):
    success: bool = True
    message: str = ""
    data: Optional[Any] = None
    errors: List[str] = Field(default_factory=list)
    request_id: Optional[str] = None
