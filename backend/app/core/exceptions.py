from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import IntegrityError
from pydantic import ValidationError


class BusinessRuleException(Exception):
    """Exception for business rule violations"""
    def __init__(self, detail: str, code: str = "BUSINESS_RULE_VIOLATION"):
        self.detail = detail
        self.code = code
        super().__init__(self.detail)


async def business_rule_exception_handler(request: Request, exc: BusinessRuleException):
    """Handler for business rule violations following RFC 7807"""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "type": "about:blank",
            "title": "Business Rule Violation",
            "status": 422,
            "detail": exc.detail,
            "instance": str(request.url.path),
            "code": exc.code
        }
    )


async def integrity_error_handler(request: Request, exc: IntegrityError):
    """Handler for database integrity errors following RFC 7807"""
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={
            "type": "about:blank",
            "title": "Database Integrity Error",
            "status": 409,
            "detail": "A database constraint was violated. This may indicate duplicate data or invalid references.",
            "instance": str(request.url.path),
            "code": "INTEGRITY_ERROR"
        }
    )


async def validation_error_handler(request: Request, exc: RequestValidationError):
    """Handler for request validation errors following RFC 7807"""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "type": "about:blank",
            "title": "Validation Error",
            "status": 422,
            "detail": "One or more fields failed validation",
            "instance": str(request.url.path),
            "code": "VALIDATION_ERROR",
            "errors": exc.errors()
        }
    )
