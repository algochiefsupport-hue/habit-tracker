"""
Task management routes: daily planner, carry forward, reordering, and priority management.
"""

from datetime import datetime, date, timedelta
from flask import Blueprint, request, jsonify
from database import get_db_connection
from auth import get_current_user_id, login_required
from models import parse_date, format_date

task_bp = Blueprint('task_bp', __name__)

@task_bp.route('/api/tasks', methods=['GET'])
@login_required
def get_tasks():
    user_id = get_current_user_id()
    date_str = request.args.get('date') or date.today().isoformat()
    category_id = request.args.get('category_id')
    priority = request.args.get('priority')
    search = request.args.get('search', '').strip()

    conn = get_db_connection()
    query = """
        SELECT t.*, c.name as category_name, c.color as category_color, g.title as goal_title
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN goals g ON t.goal_id = g.id
        WHERE t.user_id = ? AND t.date = ?
    """
    params = [user_id, date_str]

    if category_id:
        query += " AND t.category_id = ?"
        params.append(category_id)

    if priority:
        query += " AND t.priority = ?"
        params.append(priority)

    if search:
        query += " AND (t.title LIKE ? OR t.description LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])

    query += " ORDER BY t.sort_order ASC, t.id ASC"
    rows = conn.execute(query, params).fetchall()
    conn.close()

    tasks = [dict(r) for r in rows]
    return jsonify({'tasks': tasks, 'date': date_str}), 200

@task_bp.route('/api/tasks', methods=['POST'])
@login_required
def create_task():
    user_id = get_current_user_id()
    data = request.get_json() or {}

    title = data.get('title', '').strip()
    if not title:
        return jsonify({'error': 'Task title is required.'}), 400

    description = data.get('description', '').strip()
    target_date = data.get('date') or date.today().isoformat()
    time_val = data.get('time')
    priority = data.get('priority', 'medium')
    category_id = data.get('category_id')
    goal_id = data.get('goal_id')
    reminder_enabled = 1 if data.get('reminder_enabled') else 0
    reminder_time = data.get('reminder_time')

    conn = get_db_connection()
    # Get highest sort_order for this date
    max_order = conn.execute(
        "SELECT MAX(sort_order) as m FROM tasks WHERE user_id = ? AND date = ?",
        (user_id, target_date)
    ).fetchone()
    next_order = (max_order['m'] or 0) + 1

    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO tasks (
            user_id, category_id, goal_id, title, description,
            date, time, priority, reminder_enabled, reminder_time,
            sort_order, completed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    """, (
        user_id, category_id, goal_id, title, description,
        target_date, time_val, priority, reminder_enabled, reminder_time,
        next_order
    ))
    task_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({'message': 'Task created successfully.', 'id': task_id}), 201

@task_bp.route('/api/tasks/<int:task_id>', methods=['PUT'])
@login_required
def update_task(task_id):
    user_id = get_current_user_id()
    data = request.get_json() or {}

    title = data.get('title', '').strip()
    if not title:
        return jsonify({'error': 'Task title is required.'}), 400

    description = data.get('description', '').strip()
    target_date = data.get('date')
    time_val = data.get('time')
    priority = data.get('priority', 'medium')
    category_id = data.get('category_id')
    goal_id = data.get('goal_id')
    reminder_enabled = 1 if data.get('reminder_enabled') else 0
    reminder_time = data.get('reminder_time')

    conn = get_db_connection()
    task = conn.execute("SELECT id, date FROM tasks WHERE id = ? AND user_id = ?", (task_id, user_id)).fetchone()
    if not task:
        conn.close()
        return jsonify({'error': 'Task not found.'}), 404

    target_date = target_date or task['date']

    conn.execute("""
        UPDATE tasks SET
            category_id = ?, goal_id = ?, title = ?, description = ?,
            date = ?, time = ?, priority = ?, reminder_enabled = ?, reminder_time = ?
        WHERE id = ? AND user_id = ?
    """, (
        category_id, goal_id, title, description,
        target_date, time_val, priority, reminder_enabled, reminder_time,
        task_id, user_id
    ))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Task updated successfully.'}), 200

@task_bp.route('/api/tasks/<int:task_id>/toggle', methods=['PATCH'])
@login_required
def toggle_task(task_id):
    user_id = get_current_user_id()
    conn = get_db_connection()
    task = conn.execute("SELECT * FROM tasks WHERE id = ? AND user_id = ?", (task_id, user_id)).fetchone()
    if not task:
        conn.close()
        return jsonify({'error': 'Task not found.'}), 404

    new_state = 0 if task['completed'] else 1
    completed_at = datetime.utcnow().isoformat() if new_state == 1 else None

    conn.execute(
        "UPDATE tasks SET completed = ?, completed_at = ? WHERE id = ? AND user_id = ?",
        (new_state, completed_at, task_id, user_id)
    )
    conn.commit()
    conn.close()

    return jsonify({
        'message': 'Task marked as completed.' if new_state == 1 else 'Task marked as pending.',
        'completed': bool(new_state),
        'completed_at': completed_at
    }), 200

@task_bp.route('/api/tasks/<int:task_id>/move', methods=['PATCH'])
@login_required
def move_task(task_id):
    """
    Moves a task to another date (e.g. tomorrow).
    Crucial requirement: update date directly instead of creating duplicate clutter.
    """
    user_id = get_current_user_id()
    data = request.get_json() or {}
    new_date = data.get('date')
    if not new_date:
        return jsonify({'error': 'Destination date is required.'}), 400

    conn = get_db_connection()
    task = conn.execute("SELECT id FROM tasks WHERE id = ? AND user_id = ?", (task_id, user_id)).fetchone()
    if not task:
        conn.close()
        return jsonify({'error': 'Task not found.'}), 404

    max_order = conn.execute(
        "SELECT MAX(sort_order) as m FROM tasks WHERE user_id = ? AND date = ?",
        (user_id, new_date)
    ).fetchone()
    next_order = (max_order['m'] or 0) + 1

    conn.execute(
        "UPDATE tasks SET date = ?, sort_order = ? WHERE id = ? AND user_id = ?",
        (new_date, next_order, task_id, user_id)
    )
    conn.commit()
    conn.close()

    return jsonify({'message': f'Task moved to {new_date}.', 'date': new_date}), 200

@task_bp.route('/api/tasks/<int:task_id>/duplicate', methods=['POST'])
@login_required
def duplicate_task(task_id):
    user_id = get_current_user_id()
    data = request.get_json() or {}
    target_date = data.get('date')

    conn = get_db_connection()
    task = conn.execute("SELECT * FROM tasks WHERE id = ? AND user_id = ?", (task_id, user_id)).fetchone()
    if not task:
        conn.close()
        return jsonify({'error': 'Task not found.'}), 404

    target_date = target_date or task['date']
    max_order = conn.execute(
        "SELECT MAX(sort_order) as m FROM tasks WHERE user_id = ? AND date = ?",
        (user_id, target_date)
    ).fetchone()
    next_order = (max_order['m'] or 0) + 1

    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO tasks (
            user_id, category_id, goal_id, title, description,
            date, time, priority, reminder_enabled, reminder_time,
            sort_order, completed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    """, (
        user_id, task['category_id'], task['goal_id'], task['title'], task['description'],
        target_date, task['time'], task['priority'], task['reminder_enabled'], task['reminder_time'],
        next_order
    ))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({'message': 'Task duplicated successfully.', 'id': new_id}), 201

@task_bp.route('/api/tasks/reorder', methods=['PATCH'])
@login_required
def reorder_tasks():
    user_id = get_current_user_id()
    data = request.get_json() or {}
    task_ids = data.get('task_ids', [])

    conn = get_db_connection()
    for order, task_id in enumerate(task_ids):
        conn.execute(
            "UPDATE tasks SET sort_order = ? WHERE id = ? AND user_id = ?",
            (order, task_id, user_id)
        )
    conn.commit()
    conn.close()

    return jsonify({'message': 'Tasks reordered successfully.'}), 200

@task_bp.route('/api/tasks/<int:task_id>', methods=['DELETE'])
@login_required
def delete_task(task_id):
    user_id = get_current_user_id()
    conn = get_db_connection()
    task = conn.execute("SELECT id FROM tasks WHERE id = ? AND user_id = ?", (task_id, user_id)).fetchone()
    if not task:
        conn.close()
        return jsonify({'error': 'Task not found.'}), 404

    conn.execute("DELETE FROM tasks WHERE id = ? AND user_id = ?", (task_id, user_id))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Task deleted successfully.'}), 200
