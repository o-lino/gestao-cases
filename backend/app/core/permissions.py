"""
User role enumeration and permission levels.
"""
from enum import Enum


class UserRole(str, Enum):
    """User role levels with increasing permissions."""
    USER = "USER"           # Usuário comum - create own cases
    MODERATOR = "MODERATOR" # Moderador - approve/reject cases
    ADMIN = "ADMIN"         # Administrador - full access

    @classmethod
    def get_level(cls, role: str) -> int:
        """Get permission level for a role (higher = more permissions)."""
        levels = {
            cls.USER: 1,
            cls.MODERATOR: 2,
            cls.ADMIN: 3,
        }
        return levels.get(role, 0)

    @classmethod
    def has_permission(cls, user_role: str, required_role: str) -> bool:
        """Check if user_role has at least the permission level of required_role."""
        return cls.get_level(user_role) >= cls.get_level(required_role)


# Role descriptions for UI
ROLE_DESCRIPTIONS = {
    UserRole.USER: "Usuário comum - pode criar e gerenciar próprios cases",
    UserRole.MODERATOR: "Moderador - pode aprovar/rejeitar cases de outros",
    UserRole.ADMIN: "Administrador - acesso total ao sistema",
}
