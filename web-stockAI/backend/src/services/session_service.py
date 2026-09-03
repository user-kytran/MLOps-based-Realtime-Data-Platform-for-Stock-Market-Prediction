import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from fastapi import Request, Response

from ..models.user import UserResponse, SessionInfo
from .auth_db import (
    insert_session,
    get_session_and_user,
    delete_session,
    find_user_by_oauth_provider,
    find_user_by_email,
    create_user_with_oauth,
    link_oauth_account,
    update_user_profile,
)
from .google_auth import GoogleProfile

logger = logging.getLogger(__name__)

SESSION_COOKIE_NAME = "stockai_session"
SESSION_EXPIRE_DAYS = int(os.getenv("SESSION_EXPIRE_DAYS", "14"))
SESSION_EXPIRE_SECONDS = SESSION_EXPIRE_DAYS * 24 * 60 * 60


def get_cookie_config(request: Request) -> Tuple[bool, Optional[str]]:
    """
    Determine the appropriate 'secure' and 'domain' settings for session cookies
    based on the incoming request and runtime environment.
    """
    host = request.headers.get("host", "").lower()
    origin = request.headers.get("origin", "").lower()
    proto = request.headers.get("x-forwarded-proto", request.url.scheme).lower()

    # Determine if HTTPS
    is_secure = proto == "https" or "kytran.io.vn" in host or "kytran.io.vn" in origin

    # Determine domain attribute
    # If the request comes from the production domain *.kytran.io.vn, share cookie across subdomains
    cookie_domain: Optional[str] = None
    if "kytran.io.vn" in host or "kytran.io.vn" in origin:
        cookie_domain = ".kytran.io.vn"

    return is_secure, cookie_domain


def generate_session_token() -> str:
    """Generate a cryptographically secure 256-bit random session identifier."""
    return secrets.token_urlsafe(32)


def get_client_ip(request: Request) -> Optional[str]:
    """Extract client IP address considering proxy headers."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return None


def authenticate_or_register_google_user(profile: GoogleProfile) -> UserResponse:
    """
    Find or create a local StockAI user from a validated Google profile.
    Always uses Google 'sub' as the stable identity identifier.
    """
    # 1. Search for existing user mapped to this Google sub
    user = find_user_by_oauth_provider(provider="google", provider_account_id=profile.sub)
    if user:
        # Update user profile information if changed
        update_user_profile(
            user_id=user.id,
            name=profile.name,
            avatar_url=profile.picture,
        )
        return user

    # 2. Check if a local user exists with the same verified email
    if profile.email_verified:
        existing_email_user = find_user_by_email(profile.email)
        if existing_email_user:
            # Safely link this Google identity to the existing verified user
            link_oauth_account(
                user_id=existing_email_user.id,
                provider="google",
                provider_account_id=profile.sub,
            )
            update_user_profile(
                user_id=existing_email_user.id,
                name=profile.name or existing_email_user.name,
                avatar_url=profile.picture or existing_email_user.avatar_url,
            )
            return existing_email_user

    # 3. Create a brand new local user linked to this Google OAuth account
    new_user = create_user_with_oauth(
        email=profile.email,
        name=profile.name,
        avatar_url=profile.picture,
        provider="google",
        provider_account_id=profile.sub,
        role="user",
    )
    logger.info(f"✨ Created new local user ID={new_user.id} ({new_user.email}) via Google OAuth sub={profile.sub}")
    return new_user


def create_session_for_user(user: UserResponse, request: Request) -> str:
    """Create a new server-side session in database and return session token."""
    session_id = generate_session_token()
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=SESSION_EXPIRE_SECONDS)
    user_agent = request.headers.get("user-agent")
    ip_address = get_client_ip(request)

    insert_session(
        session_id=session_id,
        user_id=user.id,
        expires_at=expires_at,
        user_agent=user_agent,
        ip_address=ip_address,
    )
    return session_id


def set_auth_cookie(response: Response, session_id: str, request: Request):
    """Set the HttpOnly Secure session cookie on the response."""
    is_secure, cookie_domain = get_cookie_config(request)
    
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_id,
        max_age=SESSION_EXPIRE_SECONDS,
        httponly=True,
        secure=is_secure,
        samesite="lax",
        path="/",
        domain=cookie_domain,
    )


def clear_auth_cookie(response: Response, request: Request):
    """Clear the session cookie upon logout across possible domain configurations."""
    _, cookie_domain = get_cookie_config(request)
    
    # Delete host-only cookie
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
    )
    # Delete domain cookie if applicable
    if cookie_domain:
        response.delete_cookie(
            key=SESSION_COOKIE_NAME,
            path="/",
            domain=cookie_domain,
        )


def resolve_session_user(session_id: str) -> Optional[UserResponse]:
    """Retrieve the authenticated UserResponse associated with an active session."""
    result = get_session_and_user(session_id)
    if not result:
        return None
    session, user = result
    return user


def invalidate_session(session_id: str) -> bool:
    """Invalidate and remove a server-side session from database."""
    return delete_session(session_id)
