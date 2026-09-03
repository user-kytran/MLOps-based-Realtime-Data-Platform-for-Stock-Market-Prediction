import logging
from typing import Optional
from fastapi import APIRouter, Request, Response, Depends, HTTPException, status

from ...models.user import (
    GoogleAuthRequest,
    UserResponse,
    MessageResponse,
)
from ...services.google_auth import (
    verify_google_id_token,
    get_configured_google_client_id,
)
from ...services.session_service import (
    authenticate_or_register_google_user,
    create_session_for_user,
    set_auth_cookie,
    clear_auth_cookie,
    invalidate_session,
)
from ..dependencies import get_current_user, extract_session_token

logger = logging.getLogger(__name__)

auth_router = APIRouter()


@auth_router.get("/config", tags=["auth"])
async def get_auth_config():
    """Returns public authentication configuration for client-side Google Identity Services."""
    return {
        "google_client_id": get_configured_google_client_id(),
        "auth_provider": "google",
    }


@auth_router.post("/google", response_model=UserResponse, tags=["auth"])
async def login_with_google(
    payload: GoogleAuthRequest,
    request: Request,
    response: Response,
):
    """
    Verify Google ID Token credential, resolve or create local StockAI user & OAuth account,
    create a secure server-side session, and issue an HttpOnly session cookie.
    """
    try:
        raw_token = payload.get_token()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # 1. Cryptographically verify the Google ID token
    google_profile = verify_google_id_token(raw_token)

    # 2. Authenticate or register local user in PostgreSQL (mapped by sub)
    user = authenticate_or_register_google_user(google_profile)

    # 3. Create server-side session
    session_id = create_session_for_user(user, request)

    # 4. Set HttpOnly Secure Cookie on response
    set_auth_cookie(response=response, session_id=session_id, request=request)

    logger.info(f"🎉 User {user.email} (ID={user.id}) logged in successfully with Google ID Token.")
    return user


@auth_router.get("/me", response_model=UserResponse, tags=["auth"])
async def get_authenticated_user(
    current_user: UserResponse = Depends(get_current_user),
):
    """
    Return the profile of the currently authenticated StockAI user.
    Requires a valid, non-expired StockAI session cookie.
    """
    return current_user


@auth_router.post("/logout", response_model=MessageResponse, tags=["auth"])
async def logout_user(
    request: Request,
    response: Response,
    token: Optional[str] = Depends(extract_session_token),
):
    """
    Invalidate the current server-side session in database and clear the session cookie.
    """
    if token:
        invalidate_session(token)
    
    clear_auth_cookie(response=response, request=request)
    return MessageResponse(
        status="success",
        message="Logged out successfully.",
    )
