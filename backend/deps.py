from typing import List
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
from security import decode_access_token
import models

# Standard HTTP Bearer scheme
security_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_bearer),
    db: Session = Depends(get_db)
) -> models.User:
    """
    Validates the JWT Bearer token and retrieves the authenticated user from the database.
    Rejects invalid tokens, expired tokens, or inactive users.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials or token has expired",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id = payload.get("user_id")
    email = payload.get("sub")
    if user_id is None or email is None:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is currently inactive"
        )

    return user


def require_role(allowed_roles: List[models.UserRole]):
    """
    Enforces role-based authorization based on the user's verified database record.
    Never trusts roles claims solely from the client.
    Robustly handles Enum instances and case-insensitive string values.
    """
    def role_dependency(current_user: models.User = Depends(get_current_user)) -> models.User:
        user_role = current_user.role
        user_role_str = (user_role.value if hasattr(user_role, "value") else str(user_role)).lower()
        allowed_strs = [(r.value if hasattr(r, "value") else str(r)).lower() for r in allowed_roles]

        if user_role_str not in allowed_strs:
            role_names = [r.value if hasattr(r, "value") else str(r) for r in allowed_roles]
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: requires one of the following roles: {', '.join(role_names)}"
            )
        return current_user

    return role_dependency


# Pre-defined convenience role guards
get_current_patient = require_role([models.UserRole.PATIENT])
get_current_provider = require_role([models.UserRole.PROVIDER])
get_any_authenticated_user = get_current_user

