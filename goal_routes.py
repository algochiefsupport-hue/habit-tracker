"""
Goals and Categories management routes.
"""

from datetime import datetime, date
from flask import Blueprint, request, jsonify
from database import get_db_connection
from auth import get_current_user_id, login_required

goal_bp = Blueprint('goal_bp', __name__)

# --- Goals Endpoints ---

@goal_bp.route('/api/goals', methods=['GET'])
@login_required
def get_goals():
    user_id = get_current_user_id()
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT g.*, c.name as category_name, c.color as category_color
        FROM goals g
        LEFT JOIN categories c ON g.category_id = c.id
        WHERE g.user_id = ?
        ORDER BY g.status ASC, g.id DESC
    """, (user_id,)).fetchall()
    conn.close()

    goals = []
    for r in rows:
        g_dict = dict(r)
        target = g_dict.get('target_value') or 1.0
        current = g_dict.get('current_value') or 0.0
        percent = round(min(100.0, (current / target) * 100)) if target > 0 else 0
        g_dict['percent'] = percent
        goals.append(g_dict)

    return jsonify({'goals': goals}), 200

@goal_bp.route('/api/goals', methods=['POST'])
@login_required
def create_goal():
    user_id = get_current_user_id()
    data = request.get_json() or {}

    title = data.get('title', '').strip()
    if not title:
        return jsonify({'error': 'Goal title is required.'}), 400

    description = data.get('description', '').strip()
    category_id = data.get('category_id')
    target_value = float(data.get('target_value', 10.0))
    current_value = float(data.get('current_value', 0.0))
    unit = data.get('unit', 'times').strip()
    start_date = data.get('start_date') or date.today().isoformat()
    end_date = data.get('end_date')

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO goals (
            user_id, category_id, title, description, target_value,
            current_value, unit, start_date, end_date, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    """, (
        user_id, category_id, title, description, target_value,
        current_value, unit, start_date, end_date
    ))
    goal_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({'message': 'Goal created successfully.', 'id': goal_id}), 201

@goal_bp.route('/api/goals/<int:goal_id>', methods=['PUT'])
@login_required
def update_goal(goal_id):
    user_id = get_current_user_id()
    data = request.get_json() or {}

    title = data.get('title', '').strip()
    if not title:
        return jsonify({'error': 'Goal title is required.'}), 400

    description = data.get('description', '').strip()
    category_id = data.get('category_id')
    target_value = float(data.get('target_value', 1.0))
    current_value = float(data.get('current_value', 0.0))
    unit = data.get('unit', 'times').strip()
    start_date = data.get('start_date')
    end_date = data.get('end_date')
    status = data.get('status', 'active')

    conn = get_db_connection()
    goal = conn.execute("SELECT id FROM goals WHERE id = ? AND user_id = ?", (goal_id, user_id)).fetchone()
    if not goal:
        conn.close()
        return jsonify({'error': 'Goal not found.'}), 404

    conn.execute("""
        UPDATE goals SET
            category_id = ?, title = ?, description = ?, target_value = ?,
            current_value = ?, unit = ?, start_date = ?, end_date = ?, status = ?
        WHERE id = ? AND user_id = ?
    """, (
        category_id, title, description, target_value,
        current_value, unit, start_date, end_date, status,
        goal_id, user_id
    ))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Goal updated successfully.'}), 200

@goal_bp.route('/api/goals/<int:goal_id>/progress', methods=['PATCH'])
@login_required
def update_goal_progress(goal_id):
    user_id = get_current_user_id()
    data = request.get_json() or {}
    delta = float(data.get('delta', 0.0))
    new_value = data.get('current_value')

    conn = get_db_connection()
    goal = conn.execute("SELECT * FROM goals WHERE id = ? AND user_id = ?", (goal_id, user_id)).fetchone()
    if not goal:
        conn.close()
        return jsonify({'error': 'Goal not found.'}), 404

    if new_value is not None:
        updated_val = max(0.0, float(new_value))
    else:
        updated_val = max(0.0, goal['current_value'] + delta)

    # Automatically set to completed if reached target
    status = 'completed' if updated_val >= goal['target_value'] else 'active'

    conn.execute(
        "UPDATE goals SET current_value = ?, status = ? WHERE id = ? AND user_id = ?",
        (updated_val, status, goal_id, user_id)
    )
    conn.commit()
    conn.close()

    return jsonify({
        'current_value': updated_val,
        'status': status,
        'message': 'Goal progress updated.'
    }), 200

@goal_bp.route('/api/goals/<int:goal_id>', methods=['DELETE'])
@login_required
def delete_goal(goal_id):
    user_id = get_current_user_id()
    conn = get_db_connection()
    goal = conn.execute("SELECT id FROM goals WHERE id = ? AND user_id = ?", (goal_id, user_id)).fetchone()
    if not goal:
        conn.close()
        return jsonify({'error': 'Goal not found.'}), 404

    conn.execute("DELETE FROM goals WHERE id = ? AND user_id = ?", (goal_id, user_id))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Goal deleted successfully.'}), 200

# --- Categories Endpoints ---

@goal_bp.route('/api/categories', methods=['GET'])
@login_required
def get_categories():
    user_id = get_current_user_id()
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM categories WHERE user_id = ? ORDER BY is_default DESC, name ASC", (user_id,)).fetchall()
    conn.close()
    return jsonify({'categories': [dict(r) for r in rows]}), 200

@goal_bp.route('/api/categories', methods=['POST'])
@login_required
def create_category():
    user_id = get_current_user_id()
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Category name is required.'}), 400

    icon = data.get('icon', 'folder')
    color = data.get('color', '#6366f1')

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO categories (user_id, name, icon, color, is_default)
        VALUES (?, ?, ?, ?, 0)
    """, (user_id, name, icon, color))
    cat_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({'message': 'Category created.', 'id': cat_id}), 201

@goal_bp.route('/api/categories/<int:category_id>', methods=['DELETE'])
@login_required
def delete_category(category_id):
    user_id = get_current_user_id()
    conn = get_db_connection()
    cat = conn.execute("SELECT id, is_default FROM categories WHERE id = ? AND user_id = ?", (category_id, user_id)).fetchone()
    if not cat:
        conn.close()
        return jsonify({'error': 'Category not found.'}), 404

    conn.execute("DELETE FROM categories WHERE id = ? AND user_id = ?", (category_id, user_id))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Category deleted.'}), 200
