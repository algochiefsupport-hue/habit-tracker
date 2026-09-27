"""
Authentication routes for register, login, logout, password reset, and account deletion.
"""

from flask import Blueprint, request, jsonify, session
from database import get_db_connection, create_default_categories
from auth import hash_password, verify_password, get_current_user_id, login_required, generate_reset_token, validate_reset_token

auth_bp = Blueprint('auth_bp', __name__)

@auth_bp.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not name or not email or not password:
        return jsonify({'error': 'Name, email, and password are required.'}), 400

    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters long.'}), 400

    conn = get_db_connection()
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        conn.close()
        return jsonify({'error': 'An account with this email already exists.'}), 409

    pwd_hash = hash_password(password)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
        (name, email, pwd_hash)
    )
    user_id = cursor.lastrowid

    # Create default user settings
    cursor.execute("""
        INSERT INTO user_settings (user_id, theme, start_of_week, time_format, date_format)
        VALUES (?, 'system', 'monday', '12h', 'YYYY-MM-DD')
    """, (user_id,))

    # Seed default categories
    create_default_categories(user_id, cursor=cursor)

    conn.commit()
    conn.close()

    session['user_id'] = user_id
    return jsonify({
        'message': 'Account created successfully.',
        'user': {
            'id': user_id,
            'name': name,
            'email': email
        },
        'token': str(user_id)
    }), 201

@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required.'}), 400

    conn = get_db_connection()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()

    if not user or not verify_password(user['password_hash'], password):
        return jsonify({'error': 'Invalid email or password.'}), 401

    session['user_id'] = user['id']
    return jsonify({
        'message': 'Logged in successfully.',
        'user': {
            'id': user['id'],
            'name': user['name'],
            'email': user['email']
        },
        'token': str(user['id'])
    }), 200

@auth_bp.route('/api/auth/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    return jsonify({'message': 'Logged out successfully.'}), 200

@auth_bp.route('/api/auth/me', methods=['GET'])
@login_required
def get_me():
    user_id = get_current_user_id()
    conn = get_db_connection()
    user = conn.execute("SELECT id, name, email, created_at, streak_freeze_available FROM users WHERE id = ?", (user_id,)).fetchone()
    settings = conn.execute("SELECT * FROM user_settings WHERE user_id = ?", (user_id,)).fetchone()
    conn.close()

    if not user:
        return jsonify({'error': 'User not found.'}), 404

    settings_dict = dict(settings) if settings else {}
    return jsonify({
        'user': dict(user),
        'settings': settings_dict
    }), 200

@auth_bp.route('/api/auth/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    if not email:
        return jsonify({'error': 'Email is required.'}), 400

    conn = get_db_connection()
    user = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()

    if not user:
        # Avoid user enumeration by returning a friendly response
        return jsonify({'message': 'If this email exists, a reset code has been generated.', 'token': None}), 200

    token = generate_reset_token(user['id'])
    return jsonify({
        'message': 'Reset instructions generated.',
        'reset_token': token
    }), 200

@auth_bp.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json() or {}
    token = data.get('token', '').strip()
    new_password = data.get('password', '')

    if not token or not new_password:
        return jsonify({'error': 'Token and new password are required.'}), 400

    if len(new_password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters long.'}), 400

    user_id = validate_reset_token(token)
    if not user_id:
        return jsonify({'error': 'Invalid or expired reset token.'}), 400

    pwd_hash = hash_password(new_password)
    conn = get_db_connection()
    conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (pwd_hash, user_id))
    conn.execute("UPDATE password_resets SET used = 1 WHERE token = ?", (token,))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Password has been reset successfully. Please log in.'}), 200

@auth_bp.route('/api/auth/password', methods=['PUT'])
@login_required
def change_password():
    user_id = get_current_user_id()
    data = request.get_json() or {}
    current_password = data.get('current_password', '')
    new_password = data.get('new_password', '')

    if not current_password or not new_password:
        return jsonify({'error': 'Current password and new password are required.'}), 400

    if len(new_password) < 6:
        return jsonify({'error': 'New password must be at least 6 characters long.'}), 400

    conn = get_db_connection()
    user = conn.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user or not verify_password(user['password_hash'], current_password):
        conn.close()
        return jsonify({'error': 'Incorrect current password.'}), 400

    pwd_hash = hash_password(new_password)
    conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (pwd_hash, user_id))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Password updated successfully.'}), 200

@auth_bp.route('/api/auth/account', methods=['DELETE'])
@login_required
def delete_account():
    user_id = get_current_user_id()
    conn = get_db_connection()
    conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    session.pop('user_id', None)
    return jsonify({'message': 'Account and all associated data deleted successfully.'}), 200

@auth_bp.route('/api/auth/onboarding', methods=['POST'])
@login_required
def complete_onboarding():
    user_id = get_current_user_id()
    conn = get_db_connection()
    conn.execute("UPDATE user_settings SET onboarding_completed = 1 WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Onboarding marked complete.'}), 200
