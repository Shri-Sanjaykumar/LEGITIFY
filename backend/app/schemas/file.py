import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class UploadedFileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    original_filename: str
    sanitized_filename: str
    file_hash: str
    mime_type: str
    file_size: int
    created_at: datetime
