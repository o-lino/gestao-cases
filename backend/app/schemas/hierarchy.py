"""
Pydantic Schemas for Organizational Hierarchy
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class JobLevelInfo(BaseModel):
    """Information about a job level"""
    level: int
    label: str


class HierarchyBase(BaseModel):
    """Base schema for organizational hierarchy"""
    job_level: int = Field(..., ge=1, le=8, description="Job level (1-8)")
    job_title: Optional[str] = Field(None, max_length=100)
    department: Optional[str] = Field(None, max_length=100)
    cost_center: Optional[str] = Field(None, max_length=50)


class HierarchyCreate(HierarchyBase):
    """Schema for creating a hierarchy entry"""
    collaborator_id: int
    supervisor_id: Optional[int] = None


class HierarchyUpdate(BaseModel):
    """Schema for updating a hierarchy entry"""
    supervisor_id: Optional[int] = None
    job_level: Optional[int] = Field(None, ge=1, le=8)
    job_title: Optional[str] = Field(None, max_length=100)
    department: Optional[str] = Field(None, max_length=100)
    cost_center: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None


class CollaboratorBrief(BaseModel):
    """Brief collaborator info for hierarchy responses"""
    id: int
    email: str
    name: str

    class Config:
        from_attributes = True


class HierarchyResponse(HierarchyBase):
    """Response schema for hierarchy entry"""
    id: int
    collaborator_id: int
    supervisor_id: Optional[int]
    is_active: bool
    job_level_label: str
    created_at: datetime
    updated_at: Optional[datetime]
    
    # Nested info
    collaborator: Optional[CollaboratorBrief] = None
    supervisor: Optional[CollaboratorBrief] = None

    class Config:
        from_attributes = True


class HierarchyListResponse(BaseModel):
    """Response for listing hierarchy entries"""
    items: List[HierarchyResponse]
    total: int


class HierarchyChain(BaseModel):
    """Response showing full hierarchy chain for a collaborator"""
    collaborator: CollaboratorBrief
    chain: List[HierarchyResponse]  # From immediate supervisor up to top


class BulkHierarchyCreate(BaseModel):
    """Schema for bulk creating hierarchy entries"""
    entries: List[HierarchyCreate]


class BulkHierarchyResult(BaseModel):
    """Result of bulk hierarchy creation"""
    created: int
    updated: int
    errors: List[dict]
