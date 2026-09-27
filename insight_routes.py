"""
Analytics, insights, weekly/monthly graphs, heatmaps, and calendar routes.
"""

import calendar
from datetime import datetime, date, timedelta
from flask import Blueprint, request, jsonify
from database import get_db_connection
from auth import get_current_user_id, login_required
from models import get_day_summary, calculate_habit_streaks, parse_date, format_date

insight_bp = Blueprint('insight_bp', __name__)

@insight_bp.route('/api/insights/summary', methods=['GET'])
@login_required
def get_insights_summary():
    user_id = get_current_user_id()
    today_d = date.today()

    conn = get_db_connection()
    # Total habits and active habits
    total_habits = conn.execute("SELECT COUNT(*) as c FROM habits WHERE user_id = ?", (user_id,)).fetchone()['c']
    active_habits = conn.execute("SELECT COUNT(*) as c FROM habits WHERE user_id = ? AND status = 'active'", (user_id,)).fetchone()['c']

    # Total completions count
    total_completions = conn.execute(
        "SELECT COUNT(*) as c FROM habit_completions WHERE user_id = ?", (user_id,)
    ).fetchone()['c']

    # Habits list for performance table
    habit_rows = conn.execute("""
        SELECT h.id, h.name, h.icon, h.color, h.status, c.name as category_name
        FROM habits h
        LEFT JOIN categories c ON h.category_id = c.id
        WHERE h.user_id = ?
        ORDER BY h.status ASC, h.id ASC
    """, (user_id,)).fetchall()

    settings = conn.execute("SELECT streak_freeze_enabled FROM user_settings WHERE user_id = ?", (user_id,)).fetchone()
    streak_freeze = bool(settings['streak_freeze_enabled']) if settings else False
    conn.close()

    habit_performance = []
    total_rate_sum = 0
    active_count_for_rate = 0
    max_streak_overall = 0
    best_streak_overall = 0

    for h in habit_rows:
        stats = calculate_habit_streaks(h['id'], user_id, today_d, streak_freeze)
        habit_performance.append({
            'id': h['id'],
            'name': h['name'],
            'icon': h['icon'],
            'color': h['color'],
            'status': h['status'],
            'category_name': h['category_name'],
            'current_streak': stats['current_streak'],
            'best_streak': stats['best_streak'],
            'total_completions': stats['total_completions'],
            'completion_rate': stats['completion_rate']
        })
        if h['status'] == 'active':
            total_rate_sum += stats['completion_rate']
            active_count_for_rate += 1
            if stats['current_streak'] > max_streak_overall:
                max_streak_overall = stats['current_streak']
            if stats['best_streak'] > best_streak_overall:
                best_streak_overall = stats['best_streak']

    avg_completion_rate = round(total_rate_sum / active_count_for_rate, 1) if active_count_for_rate > 0 else 0.0

    # Weekly Progress (last 7 days)
    weekly_data = []
    for i in range(6, -1, -1):
        d = today_d - timedelta(days=i)
        day_sum = get_day_summary(user_id, d)
        weekly_data.append({
            'date': d.isoformat(),
            'day_name': d.strftime('%a'),
            'day_full': d.strftime('%A, %b %d'),
            'percent': day_sum['percent'],
            'completed_items': day_sum['completed_items'],
            'total_items': day_sum['total_items']
        })

    # Activity Heatmap (last 60 days)
    heatmap_data = []
    for i in range(59, -1, -1):
        d = today_d - timedelta(days=i)
        day_sum = get_day_summary(user_id, d)
        # Intensity level 0 (0%), 1 (1-33%), 2 (34-66%), 3 (67-99%), 4 (100%)
        p = day_sum['percent']
        if day_sum['total_items'] == 0:
            level = 0
        elif p == 100:
            level = 4
        elif p >= 67:
            level = 3
        elif p >= 33:
            level = 2
        else:
            level = 1

        heatmap_data.append({
            'date': d.isoformat(),
            'day': d.day,
            'percent': p,
            'status': day_sum['status'],
            'level': level,
            'completed': day_sum['completed_items'],
            'total': day_sum['total_items']
        })

    return jsonify({
        'total_habits': total_habits,
        'active_habits': active_habits,
        'total_completions': total_completions,
        'current_overall_streak': max_streak_overall,
        'best_overall_streak': best_streak_overall,
        'average_completion_rate': avg_completion_rate,
        'weekly_progress': weekly_data,
        'heatmap': heatmap_data,
        'habit_performance': habit_performance
    }), 200

@insight_bp.route('/api/calendar/month', methods=['GET'])
@login_required
def get_calendar_month():
    user_id = get_current_user_id()
    today_d = date.today()

    try:
        year = int(request.args.get('year', today_d.year))
        month = int(request.args.get('month', today_d.month))
    except (ValueError, TypeError):
        year = today_d.year
        month = today_d.month

    # Get number of days in month
    num_days = calendar.monthrange(year, month)[1]

    days = []
    for day in range(1, num_days + 1):
        d = date(year, month, day)
        day_sum = get_day_summary(user_id, d)
        days.append({
            'date': d.isoformat(),
            'day': day,
            'weekday': d.weekday(),  # 0=Monday
            'percent': day_sum['percent'],
            'status': day_sum['status'],
            'habits_completed': day_sum['habits_completed'],
            'habits_total': day_sum['habits_total'],
            'tasks_completed': day_sum['tasks_completed'],
            'tasks_total': day_sum['tasks_total'],
            'total_items': day_sum['total_items'],
            'is_today': (d == today_d),
            'is_future': (d > today_d)
        })

    return jsonify({
        'year': year,
        'month': month,
        'month_name': calendar.month_name[month],
        'days': days
    }), 200

@insight_bp.route('/api/calendar/day', methods=['GET'])
@login_required
def get_calendar_day():
    user_id = get_current_user_id()
    date_str = request.args.get('date') or date.today().isoformat()
    target_d = parse_date(date_str)
    day_sum = get_day_summary(user_id, target_d)

    return jsonify({
        'summary': day_sum,
        'formatted_date': target_d.strftime('%A, %B %d, %Y')
    }), 200
