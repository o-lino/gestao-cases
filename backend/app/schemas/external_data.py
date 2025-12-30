"""
External Data Schemas

Pydantic schemas for external data synchronization endpoints.
These schemas validate data coming from external systems (HR, Data Catalog, etc.)
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, EmailStr


# =============================================================================
# Collaborator Sync
# =============================================================================

class CollaboratorSyncItem(BaseModel):
    """Schema for a single collaborator record"""
    email: EmailStr = Field(..., description="Email address (unique identifier)")
    name: str = Field(..., min_length=1, description="Full name")
    role: Optional[str] = Field("USER", description="Role: USER, ADMIN, MODERATOR, CURATOR")
    active: Optional[bool] = Field(True, description="Whether collaborator is active")


class CollaboratorSyncRequest(BaseModel):
    """Request schema for collaborator sync"""
    data: List[CollaboratorSyncItem] = Field(..., min_items=1, description="List of collaborators to sync")


# =============================================================================
# DataTable Sync
# =============================================================================

class DataTableSyncItem(BaseModel):
    """Schema for a single data table record"""
    name: str = Field(..., min_length=1, description="Technical table name (unique identifier)")
    display_name: str = Field(..., min_length=1, description="Human-readable name")
    description: Optional[str] = Field(None, description="Table description")
    schema_name: Optional[str] = Field(None, description="Schema/layer: bronze, silver, gold")
    database_name: Optional[str] = Field(None, description="Database name")
    full_path: Optional[str] = Field(None, description="Full path in data lake")
    domain: Optional[str] = Field(None, description="Business domain: vendas, clientes, etc.")
    keywords: Optional[List[str]] = Field(None, description="Search keywords/tags")
    columns: Optional[List[Dict[str, Any]]] = Field(None, description="Column definitions [{name, type, description}]")
    row_count: Optional[int] = Field(None, description="Approximate row count")
    owner_email: Optional[EmailStr] = Field(None, description="Owner email (resolved to owner_id)")
    is_active: Optional[bool] = Field(True, description="Whether table is active")
    is_sensitive: Optional[bool] = Field(False, description="Whether table contains sensitive data")


class DataTableSyncRequest(BaseModel):
    """Request schema for data table sync"""
    data: List[DataTableSyncItem] = Field(..., min_items=1, description="List of data tables to sync")


# =============================================================================
# Organizational Hierarchy Sync
# =============================================================================

class HierarchySyncItem(BaseModel):
    """Schema for a single hierarchy record"""
    collaborator_email: EmailStr = Field(..., description="Collaborator email (resolved to collaborator_id)")
    supervisor_email: Optional[EmailStr] = Field(None, description="Supervisor email (resolved to supervisor_id)")
    job_level: int = Field(1, ge=1, le=8, description="Job level: 1=Analyst, 6=Director, 8=VP")
    job_title: Optional[str] = Field(None, description="Job title")
    department: Optional[str] = Field(None, description="Department name")
    cost_center: Optional[str] = Field(None, description="Cost center code")
    is_active: Optional[bool] = Field(True, description="Whether hierarchy record is active")


class HierarchySyncRequest(BaseModel):
    """Request schema for hierarchy sync"""
    data: List[HierarchySyncItem] = Field(..., min_items=1, description="List of hierarchy records to sync")


# =============================================================================
# Response Schemas
# =============================================================================

class SyncError(BaseModel):
    """Details about a sync error"""
    index: int = Field(..., description="Index of the item that failed")
    identifier: str = Field(..., description="Identifier of the item (email, name, etc.)")
    error: str = Field(..., description="Error message")


class SyncResult(BaseModel):
    """Result of a sync operation"""
    created: int = Field(0, description="Number of records created")
    updated: int = Field(0, description="Number of records updated")
    skipped: int = Field(0, description="Number of records skipped")
    errors: List[SyncError] = Field(default_factory=list, description="List of errors")
    total_processed: int = Field(0, description="Total records processed")
    
    @property
    def success_count(self) -> int:
        return self.created + self.updated


class ExternalDataStats(BaseModel):
    """Statistics about external data tables"""
    collaborators_total: int
    collaborators_active: int
    data_tables_total: int
    data_tables_active: int
    hierarchy_records: int
