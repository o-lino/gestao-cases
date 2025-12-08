from fastapi import APIRouter
from app.api.v1.endpoints import auth, cases, ai, files, notifications, users, moderation, matching

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(cases.router, prefix="/cases", tags=["cases"])
api_router.include_router(ai.router, prefix="/cases", tags=["ai"])
api_router.include_router(files.router, prefix="/files", tags=["files"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(moderation.router, prefix="/moderation", tags=["moderation"])
api_router.include_router(matching.router, prefix="/matching", tags=["matching"])
