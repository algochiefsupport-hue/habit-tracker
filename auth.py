"""
Authentication utilities, password hashing, session management, and auth decorators.
"""

import functools
import secrets
from datetime import datetime, timedelta
from flask import session, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from database import get_db_connection

def hash_password(password):
    """Securely hash a password."""
    return generate_password_hash(password, method='scrypt')

def verify_password(stored_hash, password):
    """Verify a plain password against the stored hash."""
    return check_password_hash(stored_hash, password)

def get_current_user_id():
    """Extract current user ID from session or Authorization header."""
    if 'user_id' in session:
        return session['user_id']
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ', 1)[1]
        conn = get_db_connection()
        row = conn.execute("SELECT id FROM users WHERE id = ?", (token,)).fetchone()
        conn.close()
        if row:
            return row['id']
    return None

def login_required(f):
    """Decorator to protect routes requiring authentication."""
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'error': 'Unauthorized', 'message': 'Please log in to continue.'}), 401
        return f(*args, **kwargs)
    return decorated_function

def generate_reset_token(user_id):
    """Create a temporary password reset token valid for 1 hour."""
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=1)
    conn = get_db_connection()
    conn.execute(
        "INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)",
        (user_id, token, expires_at.isoformat())
    )
    conn.commit()
    conn.close()
    return token

def validate_reset_token(token):
    """Validate a password reset token."""
    conn = get_db_connection()
    row = conn.execute(
        "SELECT * FROM password_resets WHERE token = ? AND used = 0",
        (token,)
    ).fetchone()
    conn.close()
    if not row:
        return None
    expires_at = datetime.fromisoformat(row['expires_at'])
    if datetime.utcnow() > expires_at:
        return None
    return row['user_id']
