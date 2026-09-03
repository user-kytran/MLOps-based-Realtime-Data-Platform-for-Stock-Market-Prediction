import logging
import os
from typing import Optional
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from fastapi import HTTPException, status

from ..models.user import GoogleProfile

logger = logging.getLogger(__name__)

DEFAULT_GOOGLE_CLIENT_ID = "169634127018-b3sq9e202f16lib2ch7a1uj9tph966r8.apps.googleusercontent.com"
ALLOWED_ISSUERS = ["accounts.google.com", "https://accounts.google.com"]

_request_adapter: Optional[google_requests.Request] = None


def get_google_request_adapter() -> google_requests.Request:
    """Return a singleton Google Auth transport request adapter."""
    global _request_adapter
    if _request_adapter is None:
        _request_adapter = google_requests.Request()
    return _request_adapter


def get_configured_google_client_id() -> str:
    """Get the Google Client ID configured in environment or default."""
    return os.getenv("GOOGLE_CLIENT_ID", DEFAULT_GOOGLE_CLIENT_ID).strip()


def verify_google_id_token(token: str, client_id: Optional[str] = None) -> GoogleProfile:
    """
    Cryptographically verifies Google ID Token using official Google authentication library.
    Validates:
      1. Cryptographic RSA signature against Google's public JWK certs
      2. Audience (aud) matches GOOGLE_CLIENT_ID
      3. Issuer (iss) matches Google accounts domains
      4. Expiration timestamp (exp)
    """
    if not token or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google ID token credential cannot be empty."
        )

    expected_audience = client_id or get_configured_google_client_id()
    adapter = get_google_request_adapter()

    try:
        payload = id_token.verify_oauth2_token(
            token.strip(),
            adapter,
            audience=expected_audience
        )
    except ValueError as e:
        logger.warning(f"Google ID token verification failed (ValueError): {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google ID token: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error during Google ID token verification: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Failed to verify Google identity credential."
        )

    # Verify issuer
    issuer = payload.get("iss", "")
    if issuer not in ALLOWED_ISSUERS:
        logger.warning(f"Invalid Google token issuer: {issuer}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token issuer: {issuer}"
        )

    sub = payload.get("sub")
    email = payload.get("email")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google ID token is missing 'sub' subject claim."
        )
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google ID token is missing 'email' claim."
        )

    return GoogleProfile(
        sub=str(sub),
        email=str(email),
        email_verified=bool(payload.get("email_verified", False)),
        name=payload.get("name"),
        picture=payload.get("picture"),
    )
