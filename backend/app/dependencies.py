# Compatibility bridge for app modules importing dependency utilities
from deps import (
    get_current_user,
    get_current_user as get_current_active_user,
    get_current_patient,
    get_current_provider,
    get_any_authenticated_user,
    require_role
)

__all__ = [
    "get_current_user",
    "get_current_active_user",
    "get_current_patient",
    "get_current_provider",
    "get_any_authenticated_user",
    "require_role"
]
