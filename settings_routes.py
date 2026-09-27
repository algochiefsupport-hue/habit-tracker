"""
User settings, preferences, notification schedules, and JSON data backup/restore routes.
"""

import json
from datetime import datetime
from flask import Blueprint, request, jsonify, Response
from database import get_db_connection, create_default_categories
from auth import get_current_user_id, login_required

settings_bp = Blueprint('settings_bp', __name__)

@settings_bp.route('/api/settings', methods=['GET'])
@login_required
def get_settings():
    user_id = get_current_user_id()
    conn = get_db_connection()
    user = conn.execute("SELECT id, name, email, created_at, streak_freeze_available FROM users WHERE id = ?", (user_id,)).fetchone()
    settings = conn.execute("SELECT * FROM user_settings WHERE user_id = ?", (user_id,)).fetchone()
    conn.close()

    if not user:
        return jsonify({'error': 'User not found.'}), 404

    return jsonify({
        'user': dict(user),
        'settings': dict(settings) if settings else {}
    }), 200

@settings_bp.route('/api/settings', methods=['PUT'])
@login_required
def update_settings():
    user_id = get_current_user_id()
    data = request.get_json() or {}

    # Update user basic profile
    name = data.get('name')
    conn = get_db_connection()
    if name:
        conn.execute("UPDATE users SET name = ? WHERE id = ?", (name.strip(), user_id))

    # Update settings fields
    theme = data.get('theme')
    start_of_week = data.get('start_of_week')
    time_format = data.get('time_format')
    date_format = data.get('date_format')
    daily_planning_enabled = 1 if data.get('daily_planning_enabled') else 0
    daily_planning_time = data.get('daily_planning_time', '21:00')
    habit_reminders_enabled = 1 if data.get('habit_reminders_enabled') else 0
    task_reminders_enabled = 1 if data.get('task_reminders_enabled') else 0
    sound_enabled = 1 if data.get('sound_enabled') else 0
    streak_freeze_enabled = 1 if data.get('streak_freeze_enabled') else 0
    timezone = data.get('timezone', 'UTC')

    conn.execute("""
        UPDATE user_settings SET
            theme = COALESCE(?, theme),
            start_of_week = COALESCE(?, start_of_week),
            time_format = COALESCE(?, time_format),
            date_format = COALESCE(?, date_format),
            daily_planning_enabled = ?,
            daily_planning_time = ?,
            habit_reminders_enabled = ?,
            task_reminders_enabled = ?,
            sound_enabled = ?,
            streak_freeze_enabled = ?,
            timezone = COALESCE(?, timezone)
        WHERE user_id = ?
    """, (
        theme, start_of_week, time_format, date_format,
        daily_planning_enabled, daily_planning_time,
        habit_reminders_enabled, task_reminders_enabled,
        sound_enabled, streak_freeze_enabled, timezone,
        user_id
    ))
    conn.commit()

    updated = conn.execute("SELECT * FROM user_settings WHERE user_id = ?", (user_id,)).fetchone()
    conn.close()

    return jsonify({'message': 'Settings updated successfully.', 'settings': dict(updated)}), 200

@settings_bp.route('/api/data/export', methods=['GET'])
@login_required
def export_data():
    """Exports complete user workspace data to a structured JSON object."""
    user_id = get_current_user_id()
    conn = get_db_connection()

    user = conn.execute("SELECT id, name, email, created_at FROM users WHERE id = ?", (user_id,)).fetchone()
    settings = conn.execute("SELECT * FROM user_settings WHERE user_id = ?", (user_id,)).fetchone()
    categories = conn.execute("SELECT name, icon, color, is_default FROM categories WHERE user_id = ?", (user_id,)).fetchall()
    habits = conn.execute("SELECT * FROM habits WHERE user_id = ?", (user_id,)).fetchall()
    completions = conn.execute("SELECT * FROM habit_completions WHERE user_id = ?", (user_id,)).fetchall()
    tasks = conn.execute("SELECT * FROM tasks WHERE user_id = ?", (user_id,)).fetchall()
    goals = conn.execute("SELECT * FROM goals WHERE user_id = ?", (user_id,)).fetchall()
    conn.close()

    export_payload = {
        'version': '1.0',
        'exported_at': datetime.utcnow().isoformat(),
        'user': dict(user),
        'settings': dict(settings) if settings else {},
        'categories': [dict(c) for c in categories],
        'habits': [dict(h) for h in habits],
        'habit_completions': [dict(c) for c in completions],
        'tasks': [dict(t) for t in tasks],
        'goals': [dict(g) for g in goals]
    }

    return Response(
        json.dumps(export_payload, indent=2),
        mimetype='application/json',
        headers={'Content-Disposition': f'attachment;filename=habit_tracker_backup_{datetime.now().strftime("%Y%m%d")}.json'}
    )

@settings_bp.route('/api/data/import', methods=['POST'])
@login_required
def import_data():
    """Restores user data from uploaded JSON."""
    user_id = get_current_user_id()
    data = request.get_json() or {}

    if not data or 'habits' not in data:
        return jsonify({'error': 'Invalid backup format.'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Import habits
        for h in data.get('habits', []):
            freq_days = h.get('frequency_days', '[0,1,2,3,4,5,6]')
            if not isinstance(freq_days, str):
                freq_days = json.dumps(freq_days)

            cursor.execute("""
                INSERT INTO habits (
                    user_id, name, description, icon, color,
                    frequency_type, frequency_days, start_date, goal_value, goal_unit,
                    reminder_enabled, reminder_time, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                user_id, h['name'], h.get('description', ''), h.get('icon', 'target'),
                h.get('color', '#10b981'), h.get('frequency_type', 'daily'), freq_days,
                h.get('start_date', datetime.now().strftime('%Y-%m-%d')),
                h.get('goal_value'), h.get('goal_unit'),
                h.get('reminder_enabled', 0), h.get('reminder_time', '20:00'),
                h.get('status', 'active')
            ))
            new_habit_id = cursor.lastrowid

            # Find matching completions from backup and insert
            old_habit_id = h.get('id')
            if old_habit_id:
                for comp in data.get('habit_completions', []):
                    if comp.get('habit_id') == old_habit_id:
                        cursor.execute("""
                            INSERT OR IGNORE INTO habit_completions (habit_id, user_id, date, note)
                            VALUES (?, ?, ?, ?)
                        """, (new_habit_id, user_id, comp['date'], comp.get('note', '')))

        # Import tasks
        for t in data.get('tasks', []):
            cursor.execute("""
                INSERT INTO tasks (
                    user_id, title, description, date, time,
                    priority, reminder_enabled, reminder_time, completed, completed_at, sort_order
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                user_id, t['title'], t.get('description', ''), t['date'], t.get('time'),
                t.get('priority', 'medium'), t.get('reminder_enabled', 0), t.get('reminder_time'),
                t.get('completed', 0), t.get('completed_at'), t.get('sort_order', 0)
            ))

        # Import goals
        for g in data.get('goals', []):
            cursor.execute("""
                INSERT INTO goals (
                    user_id, title, description, target_value, current_value, unit, start_date, end_date, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                user_id, g['title'], g.get('description', ''), g.get('target_value', 1.0),
                g.get('current_value', 0.0), g.get('unit', 'times'), g.get('start_date'),
                g.get('end_date'), g.get('status', 'active')
            ))

        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({'error': f'Failed to import data: {str(e)}'}), 500

    conn.close()
    return jsonify({'message': 'Data imported and restored successfully.'}), 200

@settings_bp.route('/api/data/reset', methods=['POST'])
@login_required
def reset_data():
    """Resets all habits, completions, tasks, and goals for the user, re-seeding default categories."""
    user_id = get_current_user_id()
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM habit_completions WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM habits WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM tasks WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM goals WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM categories WHERE user_id = ?", (user_id,))

    # Re-seed categories
    create_default_categories(user_id, cursor=cursor)

    conn.commit()
    conn.close()

    return jsonify({'message': 'All user data has been reset to defaults.'}), 200
