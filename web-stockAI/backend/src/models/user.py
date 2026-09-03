from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class GoogleAuthRequest(BaseModel):
    """Payload sent from Frontend containing the Google ID Token."""
    credential: Optional[str] = Field(None, description="Google ID Token credential from Google Identity Services")
    id_token: Optional[str] = Field(None, description="Alternative field for Google ID Token")

    def get_token(self) -> str:
        token = self.credential or self.id_token
        if not token or not token.strip():
            raise ValueError("Google ID Token credential is required")
        return token.strip()


class UserResponse(BaseModel):
    """Public user profile data returned to client."""
    id: int
    email: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str = "user"
    created_at: Optional[datetime] = None


class GoogleProfile(BaseModel):
    """Validated claims extracted from Google ID Token."""
    sub: str
    email: str
    email_verified: bool = False
    name: Optional[str] = None
    picture: Optional[str] = None


class SessionInfo(BaseModel):
    """Internal representation of a StockAI server session."""
    id: str
    user_id: int
    expires_at: datetime
    created_at: datetime
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None


class MessageResponse(BaseModel):
    """Generic status and message response."""
    status: str
    message: str
