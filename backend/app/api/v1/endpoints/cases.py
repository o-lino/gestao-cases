from typing import List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.models.case import Case
from app.models.collaborator import Collaborator
from app.schemas.case import CaseCreate, CaseResponse, CaseUpdate, CaseStatus
from app.services.case_service import case_service
from app.schemas.common import PaginatedResponse

router = APIRouter()

@router.post("/", response_model=CaseResponse, status_code=status.HTTP_201_CREATED)
async def create_case(
    *,
    db: AsyncSession = Depends(deps.get_db),
    case_in: CaseCreate,
    current_user: Collaborator = Depends(deps.get_current_user),
) -> Any:
    """
    Create new case.
    """
    return await case_service.create(db, case_in, current_user)

@router.get("/", response_model=PaginatedResponse[CaseResponse])
async def read_cases(
    db: AsyncSession = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    status: Optional[CaseStatus] = None,
    created_by: Optional[int] = None,
    current_user: Collaborator = Depends(deps.get_current_user),
) -> Any:
    """
    Retrieve cases with optional filtering and pagination.
    """
    return await case_service.get_multi(db, skip, limit, status, created_by)

@router.get("/{case_id}", response_model=CaseResponse)
async def read_case(
    *,
    db: AsyncSession = Depends(deps.get_db),
    case_id: int,
    current_user: Collaborator = Depends(deps.get_current_user),
) -> Any:
    """
    Get case by ID.
    """
    case = await case_service.get(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case

@router.patch("/{case_id}", response_model=CaseResponse)
async def update_case(
    *,
    db: AsyncSession = Depends(deps.get_db),
    case_id: int,
    case_in: CaseUpdate,
    current_user: Collaborator = Depends(deps.get_current_user),
) -> Any:
    """
    Update a case.
    """
    return await case_service.update(db, case_id, case_in, current_user)

@router.delete("/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_case(
    *,
    db: AsyncSession = Depends(deps.get_db),
    case_id: int,
    current_user: Collaborator = Depends(deps.get_current_user),
) -> None:
    """
    Delete a case.
    Only the creator or admin can delete a case.
    """
    from sqlalchemy import select, delete as sql_delete
    
    case = await case_service.get(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Check permission: only creator or admin can delete
    if case.created_by != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized to delete this case")
    
    # Delete the case (cascade will handle related records)
    await db.execute(sql_delete(Case).where(Case.id == case_id))
    await db.commit()
    return None


@router.post("/{case_id}/transition", response_model=CaseResponse)
async def transition_case(
    *,
    db: AsyncSession = Depends(deps.get_db),
    case_id: int,
    target_status: CaseStatus,
    current_user: Collaborator = Depends(deps.get_current_user),
) -> Any:
    """
    Transition case status.
    """
    return await case_service.transition(db, case_id, target_status, current_user)

@router.get("/{case_id}/history", response_model=List[Any])
async def get_case_history(
    *,
    db: AsyncSession = Depends(deps.get_db),
    case_id: int,
    current_user: Collaborator = Depends(deps.get_current_user),
) -> Any:
    """
    Get case history (audit logs).
    """
    from app.models.audit import AuditLog
    from sqlalchemy import select, desc
    
    # Verify case exists
    case = await case_service.get(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
        
    query = select(AuditLog).where(
        AuditLog.entity_type == "CASE",
        AuditLog.entity_id == case_id
    ).order_by(desc(AuditLog.created_at))
    
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{case_id}/documents", response_model=List[Any])
async def get_case_documents(
    *,
    db: AsyncSession = Depends(deps.get_db),
    case_id: int,
    current_user: Collaborator = Depends(deps.get_current_user),
) -> Any:
    """
    Get case documents.
    """
    from app.models.document import CaseDocument
    from sqlalchemy import select, desc
    
    # Verify case exists
    case = await case_service.get(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
        
    query = select(CaseDocument).where(CaseDocument.case_id == case_id).order_by(desc(CaseDocument.created_at))
    result = await db.execute(query)
    return result.scalars().all()

from pydantic import BaseModel

class DocumentCreate(BaseModel):
    filename: str
    s3_key: str

@router.post("/{case_id}/documents", response_model=Any)
async def create_case_document(
    *,
    db: AsyncSession = Depends(deps.get_db),
    case_id: int,
    document_in: DocumentCreate,
    current_user: Collaborator = Depends(deps.get_current_user),
) -> Any:
    """
    Register a new document for the case.
    """
    from app.models.document import CaseDocument
    from sqlalchemy import select

    # Verify case exists
    case = await case_service.get(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
        
    db_doc = CaseDocument(
        case_id=case_id,
        filename=document_in.filename,
        s3_key=document_in.s3_key,
        uploaded_by=current_user.id
    )
    db.add(db_doc)
    await db.commit()
    await db.refresh(db_doc)
    return db_doc

from app.schemas.comment import CommentCreate, CommentResponse

@router.post("/{case_id}/comments", response_model=CommentResponse)
async def create_case_comment(
    *,
    db: AsyncSession = Depends(deps.get_db),
    case_id: int,
    comment_in: CommentCreate,
    current_user: Collaborator = Depends(deps.get_current_user),
) -> Any:
    """
    Add a comment to a case.
    """
    from app.models.comment import Comment
    
    # Verify case exists
    case = await case_service.get(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
        
    db_comment = Comment(
        case_id=case_id,
        content=comment_in.content,
        created_by=current_user.id
    )
    db.add(db_comment)
    await db.commit()
    await db.refresh(db_comment)
    return db_comment

@router.get("/{case_id}/comments", response_model=List[CommentResponse])
async def get_case_comments(
    *,
    db: AsyncSession = Depends(deps.get_db),
    case_id: int,
    current_user: Collaborator = Depends(deps.get_current_user),
) -> Any:
    """
    Get comments for a case.
    """
    from app.models.comment import Comment
    from sqlalchemy import select, desc
    
    # Verify case exists
    case = await case_service.get(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
        
    query = select(Comment).where(Comment.case_id == case_id).order_by(desc(Comment.created_at))
    result = await db.execute(query)
    return result.scalars().all()
