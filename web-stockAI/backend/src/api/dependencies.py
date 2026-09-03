import logging
from typing import Optional
from fastapi import Request, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from ..models.user import UserResponse
from ..services.session_service import (
    SESSION_COOKIE_NAME,
    resolve_session_user,
)

logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)


def extract_session_token(
    request: Request,
    bearer_auth: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Optional[str]:
    """
    Extract session token primarily from the HttpOnly session cookie,
    with a fallback to Bearer header for programmatic API clients and testing.
    """
    # 1. Check HttpOnly Cookie
    cookie_token = request.cookies.get(SESSION_COOKIE_NAME)
    if cookie_token and cookie_token.strip():
        return cookie_token.strip()

    # 2. Check Authorization Header (Bearer token)
    if bearer_auth and bearer_auth.credentials:
        return bearer_auth.credentials.strip()

    return None


async def get_current_user(
    request: Request,
    token: Optional[str] = Depends(extract_session_token),
) -> UserResponse:
    """
    FastAPI dependency that resolves the currently authenticated StockAI user.
    Raises HTTP 401 Unauthorized if session is missing, invalid, or expired.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in with Google.",
            headers={"WWW-Authenticate": "Cookie"},
        )

    user = resolve_session_user(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired or is invalid. Please sign in again.",
            headers={"WWW-Authenticate": "Cookie"},
        )

    return user


async def get_optional_user(
    request: Request,
    token: Optional[str] = Depends(extract_session_token),
) -> Optional[UserResponse]:
    """
    FastAPI dependency for endpoints that work for both authenticated and guest users.
    Returns UserResponse if authenticated, None otherwise.
    """
    if not token:
        return None
    return resolve_session_user(token)
