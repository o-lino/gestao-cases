
from typing import Generic, TypeVar, List
from pydantic import BaseModel, ConfigDict

T = TypeVar("T")

class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response following the requirements specification"""
    items: List[T]
    total: int
    page: int
    size: int
    pages: int
    
    model_config = ConfigDict(from_attributes=True)
    
    @classmethod
    def create(cls, items: List[T], total: int, page: int, size: int):
        """Factory method to create paginated responses"""
        return cls(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=(total + size - 1) // size if size > 0 else 0  # Ceiling division
        )
