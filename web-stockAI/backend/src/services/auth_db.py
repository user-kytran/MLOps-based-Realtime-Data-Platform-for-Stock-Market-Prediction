import logging
import os
from datetime import datetime, timezone
from typing import Optional, Tuple
import psycopg2
from psycopg2.extras import RealDictCursor

from ..models.user import UserResponse, SessionInfo

logger = logging.getLogger(__name__)


def get_pg_connection():
    """Create and return a new connection to PostgreSQL Warehouse database."""
    return psycopg2.connect(
        host=os.getenv("WAREHOUSE_HOST", "warehouse-db"),
        port=int(os.getenv("WAREHOUSE_PORT", "5432")),
        database=os.getenv("WAREHOUSE_DB", "warehouse"),
        user=os.getenv("WAREHOUSE_USER", "warehouse_user"),
        password=os.getenv("WAREHOUSE_PASSWORD", "warehouse_pass"),
    )


def init_auth_tables():
    """Ensure authentication tables and indexes exist on system startup."""
    try:
        with get_pg_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id SERIAL PRIMARY KEY,
                        email VARCHAR(255) UNIQUE NOT NULL,
                        name VARCHAR(255),
                        full_name VARCHAR(255),
                        google_id VARCHAR(255),
                        avatar_url TEXT,
                        role VARCHAR(50) DEFAULT 'user' NOT NULL,
                        is_active BOOLEAN DEFAULT TRUE,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );

                    ALTER TABLE users ALTER COLUMN google_id DROP NOT NULL;
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

                    CREATE TABLE IF NOT EXISTS oauth_accounts (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        provider VARCHAR(50) NOT NULL,
                        provider_account_id VARCHAR(255) NOT NULL,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT uq_oauth_provider_account UNIQUE (provider, provider_account_id)
                    );

                    CREATE TABLE IF NOT EXISTS sessions (
                        id VARCHAR(128) PRIMARY KEY,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        user_agent TEXT,
                        ip_address VARCHAR(45)
                    );

                    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
                    CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_id ON oauth_accounts(user_id);
                    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
                    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
                """)
                conn.commit()
                logger.info("✅ Database authentication tables verified and ready.")
    except Exception as e:
        logger.error(f"❌ Failed to initialize authentication tables: {e}")


def find_user_by_oauth_provider(provider: str, provider_account_id: str) -> Optional[UserResponse]:
    """Find a local user by OAuth provider and provider_account_id (sub)."""
    try:
        with get_pg_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT u.id, u.email, COALESCE(u.name, u.full_name) as name, u.avatar_url, u.role, u.created_at
                    FROM users u
                    JOIN oauth_accounts o ON u.id = o.user_id
                    WHERE o.provider = %s AND o.provider_account_id = %s;
                """, (provider, str(provider_account_id)))
                row = cur.fetchone()
                if row:
                    return UserResponse(**row)
    except Exception as e:
        logger.error(f"Error querying user by OAuth provider: {e}")
    return None


def find_user_by_email(email: str) -> Optional[UserResponse]:
    """Find a local user by email."""
    try:
        with get_pg_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, email, COALESCE(name, full_name) as name, avatar_url, role, created_at
                    FROM users
                    WHERE LOWER(email) = LOWER(%s);
                """, (email,))
                row = cur.fetchone()
                if row:
                    return UserResponse(**row)
    except Exception as e:
        logger.error(f"Error querying user by email: {e}")
    return None


def find_user_by_id(user_id: int) -> Optional[UserResponse]:
    """Find a local user by internal ID."""
    try:
        with get_pg_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, email, COALESCE(name, full_name) as name, avatar_url, role, created_at
                    FROM users
                    WHERE id = %s;
                """, (user_id,))
                row = cur.fetchone()
                if row:
                    return UserResponse(**row)
    except Exception as e:
        logger.error(f"Error querying user by ID {user_id}: {e}")
    return None


def create_user_with_oauth(
    email: str,
    name: Optional[str],
    avatar_url: Optional[str],
    provider: str,
    provider_account_id: str,
    role: str = "user",
) -> UserResponse:
    """Create a new local user and link the OAuth account atomically in a transaction."""
    with get_pg_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # 1. Insert user
            cur.execute("""
                INSERT INTO users (email, name, full_name, google_id, avatar_url, role, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, NOW())
                RETURNING id, email, COALESCE(name, full_name) as name, avatar_url, role, created_at;
            """, (email.lower(), name, name, str(provider_account_id), avatar_url, role))
            user_data = cur.fetchone()
            user_id = user_data["id"]

            # 2. Insert OAuth account
            cur.execute("""
                INSERT INTO oauth_accounts (user_id, provider, provider_account_id)
                VALUES (%s, %s, %s)
                ON CONFLICT (provider, provider_account_id) DO NOTHING;
            """, (user_id, provider, str(provider_account_id)))
            conn.commit()

            return UserResponse(**user_data)


def link_oauth_account(user_id: int, provider: str, provider_account_id: str):
    """Link an existing local user to an OAuth account."""
    with get_pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO oauth_accounts (user_id, provider, provider_account_id)
                VALUES (%s, %s, %s)
                ON CONFLICT (provider, provider_account_id) DO NOTHING;
            """, (user_id, provider, str(provider_account_id)))
            conn.commit()


def update_user_profile(user_id: int, name: Optional[str] = None, avatar_url: Optional[str] = None):
    """Update profile information for an existing user."""
    try:
        with get_pg_connection() as conn:
            with conn.cursor() as cur:
                updates = []
                params = []
                if name:
                    updates.append("name = %s, full_name = %s")
                    params.extend([name, name])
                if avatar_url:
                    updates.append("avatar_url = %s")
                    params.append(avatar_url)
                if updates:
                    updates.append("updated_at = NOW()")
                    params.append(user_id)
                    query = f"UPDATE users SET {', '.join(updates)} WHERE id = %s;"
                    cur.execute(query, tuple(params))
                    conn.commit()
    except Exception as e:
        logger.error(f"Error updating user profile {user_id}: {e}")


def insert_session(
    session_id: str,
    user_id: int,
    expires_at: datetime,
    user_agent: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> SessionInfo:
    """Store a new authenticated server-side session."""
    with get_pg_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO sessions (id, user_id, expires_at, created_at, user_agent, ip_address)
                VALUES (%s, %s, %s, NOW(), %s, %s)
                RETURNING id, user_id, expires_at, created_at, user_agent, ip_address;
            """, (session_id, user_id, expires_at, user_agent, ip_address))
            conn.commit()
            return SessionInfo(**cur.fetchone())


def get_session_and_user(session_id: str) -> Optional[Tuple[SessionInfo, UserResponse]]:
    """Retrieve session info and associated user if session is valid and not expired."""
    try:
        with get_pg_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT 
                        s.id AS session_id,
                        s.user_id,
                        s.expires_at,
                        s.created_at AS session_created_at,
                        s.user_agent,
                        s.ip_address,
                        u.id AS u_id,
                        u.email,
                        COALESCE(u.name, u.full_name) AS name,
                        u.avatar_url,
                        u.role,
                        u.created_at AS user_created_at
                    FROM sessions s
                    JOIN users u ON s.user_id = u.id
                    WHERE s.id = %s AND s.expires_at > NOW();
                """, (session_id,))
                row = cur.fetchone()
                if not row:
                    return None

                session = SessionInfo(
                    id=row["session_id"],
                    user_id=row["user_id"],
                    expires_at=row["expires_at"],
                    created_at=row["session_created_at"],
                    user_agent=row["user_agent"],
                    ip_address=row["ip_address"],
                )
                user = UserResponse(
                    id=row["u_id"],
                    email=row["email"],
                    name=row["name"],
                    avatar_url=row["avatar_url"],
                    role=row["role"],
                    created_at=row["user_created_at"],
                )
                return session, user
    except Exception as e:
        logger.error(f"Error fetching session {session_id}: {e}")
    return None


def delete_session(session_id: str) -> bool:
    """Delete a session by ID (logout)."""
    try:
        with get_pg_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM sessions WHERE id = %s;", (session_id,))
                conn.commit()
                return cur.rowcount > 0
    except Exception as e:
        logger.error(f"Error deleting session {session_id}: {e}")
        return False


def delete_expired_sessions() -> int:
    """Clean up expired sessions from database."""
    try:
        with get_pg_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM sessions WHERE expires_at <= NOW();")
                conn.commit()
                return cur.rowcount
    except Exception as e:
        logger.error(f"Error cleaning expired sessions: {e}")
        return 0
