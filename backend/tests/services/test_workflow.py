
import pytest
from fastapi import HTTPException
from app.services.workflow import workflow_service
from app.schemas.case import CaseStatus
from app.models.collaborator import Collaborator

def test_validate_transition_valid():
    user = Collaborator(role="USER")
    result = workflow_service.validate_transition(CaseStatus.DRAFT, CaseStatus.SUBMITTED, user)
    assert result is True

def test_validate_transition_invalid_status():
    user = Collaborator(role="ADMIN")
    with pytest.raises(HTTPException) as excinfo:
        workflow_service.validate_transition(CaseStatus.DRAFT, CaseStatus.APPROVED, user)
    assert excinfo.value.status_code == 422

def test_validate_transition_unauthorized_role():
    user = Collaborator(role="USER")
    # User cannot move from SUBMITTED to REVIEW (only Manager/Admin)
    with pytest.raises(HTTPException) as excinfo:
        workflow_service.validate_transition(CaseStatus.SUBMITTED, CaseStatus.REVIEW, user)
    assert excinfo.value.status_code == 403

def test_validate_transition_manager_role():
    user = Collaborator(role="MANAGER")
    result = workflow_service.validate_transition(CaseStatus.SUBMITTED, CaseStatus.REVIEW, user)
    assert result is True
