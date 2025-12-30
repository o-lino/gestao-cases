from fastapi import APIRouter
from app.api.v1.endpoints import auth, cases, ai, files, notifications, users, moderation, matching, agents, involvements, hierarchy, admin_config, curator, external_data

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(cases.router, prefix="/cases", tags=["cases"])
api_router.include_router(ai.router, prefix="/cases", tags=["ai"])
api_router.include_router(files.router, prefix="/files", tags=["files"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(moderation.router, prefix="/moderation", tags=["moderation"])
api_router.include_router(matching.router, prefix="/matching", tags=["matching"])
api_router.include_router(agents.router, prefix="/agents", tags=["agents"])
api_router.include_router(involvements.router, prefix="/involvements", tags=["involvements"])
api_router.include_router(hierarchy.router, prefix="/hierarchy", tags=["hierarchy"])
api_router.include_router(admin_config.router, prefix="/admin", tags=["admin"])
api_router.include_router(curator.router, prefix="/curator", tags=["curator"])
api_router.include_router(external_data.router, prefix="/external-data", tags=["external-data"])

