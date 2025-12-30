from typing import List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.api import deps
from app.models.case import Case
from app.models.collaborator import Collaborator
from app.schemas.case import CaseCreate, CaseResponse, CaseUpdate, CaseStatus, AuditLogResponse
from app.services.case_service import case_service
from app.schemas.common import PaginatedResponse
from app.services.search_worker import trigger_variable_search

router = APIRouter()

@router.post("/", response_model=CaseResponse, status_code=status.HTTP_201_CREATED)
async def create_case(
    *,
    db: AsyncSession = Depends(deps.get_db),
    case_in: CaseCreate,
    current_user: Collaborator = Depends(deps.get_current_user),
    background_tasks: BackgroundTasks,
) -> Any:
    """
    Create new case.
    Automatically triggers search for all variables in background.
    """
    case = await case_service.create(db, case_in, current_user)
    
    # Auto-trigger search for all variables in background
    if case.variables:
        for var in case.variables:
            if not var.is_cancelled:
                background_tasks.add_task(trigger_variable_search, db, var.id)
    
    return case

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


class CaseCancelRequest(BaseModel):
    reason: Optional[str] = None


@router.post("/{case_id}/cancel", response_model=CaseResponse)
async def cancel_case(
    *,
    db: AsyncSession = Depends(deps.get_db),
    case_id: int,
    cancel_in: CaseCancelRequest,
    current_user: Collaborator = Depends(deps.get_current_user),
) -> Any:
    """
    Cancel a case and all its active variables.
    The case status will be set to CANCELLED and all non-cancelled variables
    will be marked as cancelled with the provided reason.
    """
    return await case_service.cancel(db, case_id, current_user, cancel_in.reason)


@router.get("/{case_id}/history", response_model=List[AuditLogResponse])
async def get_case_history(
    *,
    db: AsyncSession = Depends(deps.get_db),
    case_id: int,
    current_user: Collaborator = Depends(deps.get_current_user),
) -> Any:
    """
    Get case history (audit logs) with enriched user information.
    """
    from app.models.audit import AuditLog
    from sqlalchemy import select, desc
    import logging
    
    # Verify case exists
    case = await case_service.get(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    try:
        query = select(AuditLog).where(
            AuditLog.entity_type == "CASE",
            AuditLog.entity_id == case_id
        ).order_by(desc(AuditLog.created_at))
        
        result = await db.execute(query)
        logs = result.scalars().all()
        
        # Enrich logs with user names
        enriched_logs = []
        user_cache = {}
        
        for log in logs:
            actor_name = None
            if log.actor_id:
                if log.actor_id not in user_cache:
                    user_result = await db.execute(
                        select(Collaborator).where(Collaborator.id == log.actor_id)
                    )
                    user = user_result.scalars().first()
                    user_cache[log.actor_id] = user.name if user else f"Usuário #{log.actor_id}"
                actor_name = user_cache[log.actor_id]
            
            enriched_logs.append({
                "id": log.id,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "actor_id": log.actor_id,
                "actor_name": actor_name,
                "action_type": log.action_type,
                "changes": log.changes,
                "created_at": log.created_at
            })
        
        return enriched_logs
    except Exception as e:
        # Log the error but return empty list to avoid breaking the UI
        logging.warning(f"Failed to fetch audit logs for case {case_id}: {e}")
        return []

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
    import logging
    
    # Verify case exists
    case = await case_service.get(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    try:
        query = select(CaseDocument).where(CaseDocument.case_id == case_id).order_by(desc(CaseDocument.created_at))
        result = await db.execute(query)
        return result.scalars().all()
    except Exception as e:
        logging.warning(f"Failed to fetch documents for case {case_id}: {e}")
        return []

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
    import logging
    
    # Verify case exists
    case = await case_service.get(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    try:
        query = select(Comment).where(Comment.case_id == case_id).order_by(desc(Comment.created_at))
        result = await db.execute(query)
        return result.scalars().all()
    except Exception as e:
        logging.warning(f"Failed to fetch comments for case {case_id}: {e}")
        return []


# ============================================================================
# Variable Management Endpoints
# ============================================================================

from app.schemas.case import CaseVariableCreate, CaseVariableResponse, CaseVariableCancel


@router.post("/{case_id}/variables", response_model=CaseVariableResponse, status_code=status.HTTP_201_CREATED)
async def add_case_variable(
    *,
    db: AsyncSession = Depends(deps.get_db),
    case_id: int,
    variable_in: CaseVariableCreate,
    current_user: Collaborator = Depends(deps.get_current_user),
    background_tasks: BackgroundTasks,
) -> Any:
    """
    Add a new variable to an existing case.
    Notifies project approvers (MANAGER/ADMIN) of the addition.
    Automatically triggers search for the variable in background.
    Allowed when case is in DRAFT, REVIEW, SUBMITTED, or APPROVED status.
    """
    variable = await case_service.add_variable(db, case_id, variable_in, current_user)
    
    # Auto-trigger search for the new variable in background
    background_tasks.add_task(trigger_variable_search, db, variable.id)
    
    return variable


@router.patch("/{case_id}/variables/{variable_id}/cancel", response_model=CaseVariableResponse)
async def cancel_case_variable(
    *,
    db: AsyncSession = Depends(deps.get_db),
    case_id: int,
    variable_id: int,
    cancel_in: CaseVariableCancel,
    current_user: Collaborator = Depends(deps.get_current_user),
) -> Any:
    """
    Cancel a variable in a case.
    Notifies the entire involved chain (creator, reviewer, table owner if matched).
    Only allowed when case is in DRAFT or REVIEW status.
    """
    return await case_service.cancel_variable(db, case_id, variable_id, cancel_in, current_user)


@router.delete("/{case_id}/variables/{variable_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_case_variable(
    *,
    db: AsyncSession = Depends(deps.get_db),
    case_id: int,
    variable_id: int,
    current_user: Collaborator = Depends(deps.get_current_user),
) -> None:
    """
    Delete a variable permanently from a case.
    Only allowed when case is in DRAFT, REVIEW, SUBMITTED, or APPROVED status.
    Not allowed for CLOSED or CANCELLED cases.
    """
    return await case_service.delete_variable(db, case_id, variable_id, current_user)
