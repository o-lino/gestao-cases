
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from app.api import deps
from app.models.collaborator import Collaborator
from app.services.file_service import file_service
from pydantic import BaseModel

router = APIRouter()

class FileUploadRequest(BaseModel):
    filename: str
    content_type: str

@router.post("/upload-url")
async def get_upload_url(
    *,
    upload_request: FileUploadRequest,
    current_user: Collaborator = Depends(deps.get_current_user),
) -> Any:
    """
    Get a presigned URL for uploading a file to S3.
    """
    # In a real app, we might want to sanitize the filename or add a UUID prefix
    object_name = f"uploads/{upload_request.filename}"
    
    url = file_service.generate_presigned_url(object_name)
    if not url:
        raise HTTPException(status_code=500, detail="Could not generate upload URL")
    
    return {"upload_url": url, "object_name": object_name}
