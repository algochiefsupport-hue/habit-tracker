"""
Habit management and habit completion routes.
"""

import json
from datetime import datetime, date, timedelta
from flask import Blueprint, request, jsonify
from database import get_db_connection
from auth import get_current_user_id, login_required
from models import calculate_habit_streaks, is_habit_scheduled_for_date, parse_date, format_date

habit_bp = Blueprint('habit_bp', __name__)

@habit_bp.route('/api/habits', methods=['GET'])
@login_required
def get_habits():
    user_id = get_current_user_id()
    status_filter = request.args.get('status', 'active')
    category_id = request.args.get('category_id')

    conn = get_db_connection()
    query = """
        SELECT h.*, c.name as category_name, c.color as category_color
        FROM habits h
        LEFT JOIN categories c ON h.category_id = c.id
        WHERE h.user_id = ?
    """
    params = [user_id]

    if status_filter != 'all':
        query += " AND h.status = ?"
        params.append(status_filter)

    if category_id:
        query += " AND h.category_id = ?"
        params.append(category_id)

    query += " ORDER BY h.id DESC"
    rows = conn.execute(query, params).fetchall()

    # Get user settings to check streak freeze
    settings = conn.execute("SELECT streak_freeze_enabled FROM user_settings WHERE user_id = ?", (user_id,)).fetchone()
    streak_freeze = bool(settings['streak_freeze_enabled']) if settings else False
    conn.close()

    result = []
    today = date.today()
    for row in rows:
        h_dict = dict(row)
        if isinstance(h_dict.get('frequency_days'), str):
            try:
                h_dict['frequency_days'] = json.loads(h_dict['frequency_days'])
            except Exception:
                h_dict['frequency_days'] = [0, 1, 2, 3, 4, 5, 6]

        # Calculate streak metrics
        stats = calculate_habit_streaks(row['id'], user_id, today, streak_freeze)
        h_dict['stats'] = stats
        result.append(h_dict)

    return jsonify({'habits': result}), 200

@habit_bp.route('/api/habits', methods=['POST'])
@login_required
def create_habit():
    user_id = get_current_user_id()
    data = request.get_json() or {}

    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Habit name is required.'}), 400

    description = data.get('description', '').strip()
    icon = data.get('icon', 'target')
    color = data.get('color', '#10b981')
    category_id = data.get('category_id')
    frequency_type = data.get('frequency_type', 'daily')
    frequency_days = data.get('frequency_days', [0, 1, 2, 3, 4, 5, 6])
    if not isinstance(frequency_days, str):
        frequency_days = json.dumps(frequency_days)

    start_date = data.get('start_date') or date.today().isoformat()
    goal_value = data.get('goal_value')
    goal_unit = data.get('goal_unit', '')
    reminder_enabled = 1 if data.get('reminder_enabled') else 0
    reminder_time = data.get('reminder_time', '20:00')

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO habits (
            user_id, category_id, name, description, icon, color,
            frequency_type, frequency_days, start_date, goal_value, goal_unit,
            reminder_enabled, reminder_time, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    """, (
        user_id, category_id, name, description, icon, color,
        frequency_type, frequency_days, start_date, goal_value, goal_unit,
        reminder_enabled, reminder_time
    ))
    habit_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({'message': 'Habit created successfully.', 'id': habit_id}), 201

@habit_bp.route('/api/habits/<int:habit_id>', methods=['GET'])
@login_required
def get_habit_details(habit_id):
    user_id = get_current_user_id()
    conn = get_db_connection()
    habit = conn.execute("""
        SELECT h.*, c.name as category_name, c.color as category_color
        FROM habits h
        LEFT JOIN categories c ON h.category_id = c.id
        WHERE h.id = ? AND h.user_id = ?
    """, (habit_id, user_id)).fetchone()

    if not habit:
        conn.close()
        return jsonify({'error': 'Habit not found.'}), 404

    # Fetch last 90 days completion history for heatmap
    today = date.today()
    start_90 = today - timedelta(days=89)
    completions = conn.execute("""
        SELECT date, completed_at, note FROM habit_completions
        WHERE habit_id = ? AND user_id = ? AND date >= ?
        ORDER BY date ASC
    """, (habit_id, user_id, start_90.isoformat())).fetchall()

    settings = conn.execute("SELECT streak_freeze_enabled FROM user_settings WHERE user_id = ?", (user_id,)).fetchone()
    streak_freeze = bool(settings['streak_freeze_enabled']) if settings else False
    conn.close()

    h_dict = dict(habit)
    if isinstance(h_dict.get('frequency_days'), str):
        try:
            h_dict['frequency_days'] = json.loads(h_dict['frequency_days'])
        except Exception:
            h_dict['frequency_days'] = [0, 1, 2, 3, 4, 5, 6]

    stats = calculate_habit_streaks(habit_id, user_id, today, streak_freeze)
    h_dict['stats'] = stats

    completion_map = {r['date']: {'completed_at': r['completed_at'], 'note': r['note']} for r in completions}

    # Build 90-day history array with scheduled and completed flags
    history = []
    curr = start_90
    while curr <= today:
        d_str = curr.isoformat()
        is_sched = is_habit_scheduled_for_date(habit, curr)
        is_comp = d_str in completion_map
        history.append({
            'date': d_str,
            'scheduled': is_sched,
            'completed': is_comp,
            'details': completion_map.get(d_str)
        })
        curr += timedelta(days=1)

    h_dict['history'] = history

    return jsonify({'habit': h_dict}), 200

@habit_bp.route('/api/habits/<int:habit_id>', methods=['PUT'])
@login_required
def update_habit(habit_id):
    user_id = get_current_user_id()
    data = request.get_json() or {}

    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Habit name is required.'}), 400

    description = data.get('description', '').strip()
    icon = data.get('icon', 'target')
    color = data.get('color', '#10b981')
    category_id = data.get('category_id')
    frequency_type = data.get('frequency_type', 'daily')
    frequency_days = data.get('frequency_days', [0, 1, 2, 3, 4, 5, 6])
    if not isinstance(frequency_days, str):
        frequency_days = json.dumps(frequency_days)

    start_date = data.get('start_date') or date.today().isoformat()
    goal_value = data.get('goal_value')
    goal_unit = data.get('goal_unit', '')
    reminder_enabled = 1 if data.get('reminder_enabled') else 0
    reminder_time = data.get('reminder_time', '20:00')

    conn = get_db_connection()
    habit = conn.execute("SELECT id FROM habits WHERE id = ? AND user_id = ?", (habit_id, user_id)).fetchone()
    if not habit:
        conn.close()
        return jsonify({'error': 'Habit not found.'}), 404

    conn.execute("""
        UPDATE habits SET
            category_id = ?, name = ?, description = ?, icon = ?, color = ?,
            frequency_type = ?, frequency_days = ?, start_date = ?, goal_value = ?, goal_unit = ?,
            reminder_enabled = ?, reminder_time = ?
        WHERE id = ? AND user_id = ?
    """, (
        category_id, name, description, icon, color,
        frequency_type, frequency_days, start_date, goal_value, goal_unit,
        reminder_enabled, reminder_time, habit_id, user_id
    ))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Habit updated successfully.'}), 200

@habit_bp.route('/api/habits/<int:habit_id>/status', methods=['PATCH'])
@login_required
def update_habit_status(habit_id):
    user_id = get_current_user_id()
    data = request.get_json() or {}
    status = data.get('status')
    if status not in ('active', 'paused', 'archived'):
        return jsonify({'error': 'Invalid status. Must be active, paused, or archived.'}), 400

    conn = get_db_connection()
    habit = conn.execute("SELECT id FROM habits WHERE id = ? AND user_id = ?", (habit_id, user_id)).fetchone()
    if not habit:
        conn.close()
        return jsonify({'error': 'Habit not found.'}), 404

    conn.execute("UPDATE habits SET status = ? WHERE id = ? AND user_id = ?", (status, habit_id, user_id))
    conn.commit()
    conn.close()

    return jsonify({'message': f'Habit marked as {status}.'}), 200

@habit_bp.route('/api/habits/<int:habit_id>', methods=['DELETE'])
@login_required
def delete_habit(habit_id):
    user_id = get_current_user_id()
    conn = get_db_connection()
    habit = conn.execute("SELECT id FROM habits WHERE id = ? AND user_id = ?", (habit_id, user_id)).fetchone()
    if not habit:
        conn.close()
        return jsonify({'error': 'Habit not found.'}), 404

    # Foreign keys ON DELETE CASCADE will clean up completions
    conn.execute("DELETE FROM habits WHERE id = ? AND user_id = ?", (habit_id, user_id))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Habit deleted successfully.'}), 200

@habit_bp.route('/api/habits/<int:habit_id>/toggle', methods=['POST'])
@login_required
def toggle_habit_completion(habit_id):
    user_id = get_current_user_id()
    data = request.get_json() or {}
    target_date = data.get('date') or date.today().isoformat()
    note = data.get('note', '')

    target_d = parse_date(target_date)
    today = date.today()

    # Rule: Future dates cannot be completed
    if target_d > today:
        return jsonify({'error': 'Cannot mark habits completed for future dates.'}), 400

    date_str = format_date(target_d)

    conn = get_db_connection()
    habit = conn.execute("SELECT * FROM habits WHERE id = ? AND user_id = ?", (habit_id, user_id)).fetchone()
    if not habit:
        conn.close()
        return jsonify({'error': 'Habit not found.'}), 404

    existing = conn.execute(
        "SELECT id FROM habit_completions WHERE habit_id = ? AND user_id = ? AND date = ?",
        (habit_id, user_id, date_str)
    ).fetchone()

    if existing:
        # Undo completion
        conn.execute("DELETE FROM habit_completions WHERE id = ?", (existing['id'],))
        is_completed = False
    else:
        # Mark complete
        conn.execute(
            "INSERT INTO habit_completions (habit_id, user_id, date, note) VALUES (?, ?, ?, ?)",
            (habit_id, user_id, date_str, note)
        )
        is_completed = True

    conn.commit()

    settings = conn.execute("SELECT streak_freeze_enabled FROM user_settings WHERE user_id = ?", (user_id,)).fetchone()
    streak_freeze = bool(settings['streak_freeze_enabled']) if settings else False
    conn.close()

    stats = calculate_habit_streaks(habit_id, user_id, today, streak_freeze)

    return jsonify({
        'is_completed': is_completed,
        'date': date_str,
        'stats': stats,
        'message': 'Habit marked as completed.' if is_completed else 'Habit completion undone.'
    }), 200
