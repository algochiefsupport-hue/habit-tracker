"""
Dashboard aggregation routes: Today view, Tomorrow planning, carry-forward, and review.
"""

from datetime import datetime, date, timedelta
from flask import Blueprint, request, jsonify
from database import get_db_connection
from auth import get_current_user_id, login_required
from models import get_day_summary, parse_date, format_date, calculate_habit_streaks

dashboard_bp = Blueprint('dashboard_bp', __name__)

MOTIVATIONAL_QUOTES = [
    "Let's make today count.",
    "Small daily improvements lead to stunning results.",
    "Consistency transforms average into excellence.",
    "Action is the foundational key to all success.",
    "Focus on progress, not perfection.",
    "Win the morning, win the day."
]

def get_time_greeting(hour):
    if 5 <= hour < 12:
        return "Good morning"
    elif 12 <= hour < 17:
        return "Good afternoon"
    elif 17 <= hour < 22:
        return "Good evening"
    else:
        return "Good night"

@dashboard_bp.route('/api/dashboard/today', methods=['GET'])
@login_required
def get_today_dashboard():
    user_id = get_current_user_id()
    today_d = date.today()
    tomorrow_d = today_d + timedelta(days=1)

    conn = get_db_connection()
    user = conn.execute("SELECT name FROM users WHERE id = ?", (user_id,)).fetchone()
    settings = conn.execute("SELECT * FROM user_settings WHERE user_id = ?", (user_id,)).fetchone()
    streak_freeze = bool(settings['streak_freeze_enabled']) if settings else False
    conn.close()

    user_name = user['name'] if user else "Friend"
    greeting = f"{get_time_greeting(datetime.now().hour)}, {user_name}"

    # Get today's detailed summary
    today_summary = get_day_summary(user_id, today_d)

    # Attach current streak for each habit in today's habits
    for habit in today_summary['habits']:
        stats = calculate_habit_streaks(habit['id'], user_id, today_d, streak_freeze)
        habit['stats'] = stats

    # Get tomorrow's preview count
    tomorrow_summary = get_day_summary(user_id, tomorrow_d)

    # Calculate smart motivational message
    completed = today_summary['completed_items']
    total = today_summary['total_items']
    remaining = total - completed

    if total == 0:
        motivation = "Ready to start your day? Add a habit or task to begin."
    elif remaining == 0:
        motivation = "All items completed today! Outstanding work."
    elif remaining == 1:
        motivation = "Just 1 more item to complete today's plan!"
    elif completed > 0:
        motivation = f"Great momentum! {remaining} more items to complete today's goals."
    else:
        motivation = "Let's kickstart today's first win."

    # Quote selection based on day of year
    quote = MOTIVATIONAL_QUOTES[today_d.timetuple().tm_yday % len(MOTIVATIONAL_QUOTES)]

    return jsonify({
        'greeting': greeting,
        'user_name': user_name,
        'date': today_d.isoformat(),
        'date_display': today_d.strftime('%A, %B %d'),
        'quote': quote,
        'motivation': motivation,
        'progress': {
            'habits_completed': today_summary['habits_completed'],
            'habits_total': today_summary['habits_total'],
            'tasks_completed': today_summary['tasks_completed'],
            'tasks_total': today_summary['tasks_total'],
            'total_items': total,
            'completed_items': completed,
            'remaining_items': remaining,
            'percent': today_summary['percent']
        },
        'habits': today_summary['habits'],
        'tasks': today_summary['tasks'],
        'tomorrow_preview': {
            'date': tomorrow_d.isoformat(),
            'habits_count': tomorrow_summary['habits_total'],
            'tasks_count': tomorrow_summary['tasks_total'],
            'total_planned': tomorrow_summary['total_items']
        }
    }), 200

@dashboard_bp.route('/api/dashboard/tomorrow', methods=['GET'])
@login_required
def get_tomorrow_dashboard():
    """
    Dedicated Tomorrow Planning view:
    Shows tomorrow's date, automatically scheduled recurring habits, and planned tasks.
    """
    user_id = get_current_user_id()
    tomorrow_d = date.today() + timedelta(days=1)

    summary = get_day_summary(user_id, tomorrow_d)

    return jsonify({
        'date': tomorrow_d.isoformat(),
        'date_display': tomorrow_d.strftime('%A, %B %d'),
        'habits': summary['habits'],
        'tasks': summary['tasks'],
        'habits_count': summary['habits_total'],
        'tasks_count': summary['tasks_total']
    }), 200

@dashboard_bp.route('/api/dashboard/carry-forward', methods=['POST'])
@login_required
def carry_forward_tasks():
    """
    Moves all unfinished tasks from source date (default today) to target date (default tomorrow).
    Updates task dates directly rather than cloning.
    """
    user_id = get_current_user_id()
    data = request.get_json() or {}
    from_date = data.get('from_date') or date.today().isoformat()
    to_date = data.get('to_date') or (parse_date(from_date) + timedelta(days=1)).isoformat()
    task_ids = data.get('task_ids')  # Optional list of specific task IDs to move

    conn = get_db_connection()
    if task_ids:
        # Move specific tasks
        placeholders = ','.join('?' * len(task_ids))
        conn.execute(f"""
            UPDATE tasks SET date = ?, completed = 0, completed_at = NULL
            WHERE id IN ({placeholders}) AND user_id = ?
        """, (*task_ids, user_id))
    else:
        # Move all uncompleted tasks from from_date
        conn.execute("""
            UPDATE tasks SET date = ?
            WHERE user_id = ? AND date = ? AND completed = 0
        """, (to_date, user_id, from_date))

    conn.commit()
    conn.close()

    return jsonify({
        'message': f'Unfinished tasks moved to {to_date}.',
        'from_date': from_date,
        'to_date': to_date
    }), 200

@dashboard_bp.route('/api/dashboard/review', methods=['GET'])
@login_required
def get_daily_review():
    """Returns end-of-day summary for today or requested date."""
    user_id = get_current_user_id()
    target_date = request.args.get('date') or date.today().isoformat()
    summary = get_day_summary(user_id, target_date)

    unfinished_tasks = [t for t in summary['tasks'] if not t['completed']]

    return jsonify({
        'date': summary['date'],
        'percent': summary['percent'],
        'habits_completed': summary['habits_completed'],
        'habits_total': summary['habits_total'],
        'tasks_completed': summary['tasks_completed'],
        'tasks_total': summary['tasks_total'],
        'completed_habits': [h for h in summary['habits'] if h['is_completed']],
        'remaining_habits': [h for h in summary['habits'] if not h['is_completed']],
        'completed_tasks': [t for t in summary['tasks'] if t['completed']],
        'remaining_tasks': unfinished_tasks,
        'unfinished_count': len(unfinished_tasks)
    }), 200
