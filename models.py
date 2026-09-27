"""
Core business logic, scheduling evaluation, streak algorithms, and data access helpers for Habit Tracker.
"""

import json
from datetime import datetime, date, timedelta
from database import get_db_connection

def parse_date(date_str):
    """Safely parse YYYY-MM-DD string to date object."""
    if isinstance(date_str, (date, datetime)):
        return date_str if isinstance(date_str, date) else date_str.date()
    return datetime.strptime(str(date_str)[:10], '%Y-%m-%d').date()

def format_date(d):
    """Format date object as YYYY-MM-DD."""
    if isinstance(d, datetime):
        return d.date().isoformat()
    return d.isoformat()

def is_habit_scheduled_for_date(habit, target_date):
    """
    Determines if a habit is scheduled to occur on target_date.
    target_date: date object or YYYY-MM-DD string
    habit: sqlite3.Row or dict representing habit record
    """
    target_d = parse_date(target_date)
    start_d = parse_date(habit['start_date'])

    # Cannot be scheduled before habit start_date
    if target_d < start_d:
        return False

    freq_type = habit['frequency_type']
    weekday = target_d.weekday()  # 0=Monday, 6=Sunday

    if freq_type == 'daily':
        return True
    elif freq_type == 'weekdays':
        return weekday < 5  # Mon-Fri
    elif freq_type == 'weekends':
        return weekday >= 5  # Sat-Sun
    elif freq_type in ('specific_days', 'custom'):
        freq_days = habit['frequency_days']
        if isinstance(freq_days, str):
            try:
                freq_days = json.loads(freq_days)
            except Exception:
                freq_days = [0, 1, 2, 3, 4, 5, 6]
        return weekday in freq_days

    return True

def get_habit_scheduled_dates_range(habit, start_date_range, end_date_range):
    """Returns a list of date objects where the habit was scheduled within the range (inclusive)."""
    curr = max(parse_date(start_date_range), parse_date(habit['start_date']))
    end = parse_date(end_date_range)
    scheduled = []
    while curr <= end:
        if is_habit_scheduled_for_date(habit, curr):
            scheduled.append(curr)
        curr += timedelta(days=1)
    return scheduled

def calculate_habit_streaks(habit_id, user_id, today_date=None, streak_freeze_enabled=False):
    """
    Computes:
    - current_streak (consecutive scheduled completed days up to today or yesterday if today is scheduled and pending)
    - best_streak (longest run of consecutive completed scheduled days)
    - total_completions
    - completion_rate (% of scheduled days up to today that were completed)
    - missed_days (scheduled days in past up to yesterday that were NOT completed)
    """
    conn = get_db_connection()
    habit = conn.execute("SELECT * FROM habits WHERE id = ? AND user_id = ?", (habit_id, user_id)).fetchone()
    if not habit:
        conn.close()
        return {
            'current_streak': 0,
            'best_streak': 0,
            'total_completions': 0,
            'completion_rate': 0.0,
            'missed_days': 0
        }

    # Fetch all completions for this habit
    comp_rows = conn.execute(
        "SELECT date FROM habit_completions WHERE habit_id = ? AND user_id = ? ORDER BY date ASC",
        (habit_id, user_id)
    ).fetchall()
    conn.close()

    completed_dates = {parse_date(r['date']) for r in comp_rows}
    today_d = parse_date(today_date) if today_date else date.today()
    start_d = parse_date(habit['start_date'])

    # If habit start date is in the future
    if start_d > today_d:
        return {
            'current_streak': 0,
            'best_streak': 0,
            'total_completions': len(completed_dates),
            'completion_rate': 0.0,
            'missed_days': 0
        }

    # Get all scheduled dates from start_date to today_d
    scheduled_dates = get_habit_scheduled_dates_range(habit, start_d, today_d)

    if not scheduled_dates:
        return {
            'current_streak': 0,
            'best_streak': 0,
            'total_completions': len(completed_dates),
            'completion_rate': 0.0,
            'missed_days': 0
        }

    # Best streak calculation across all scheduled dates up to today
    best_streak = 0
    current_run = 0
    total_scheduled = len(scheduled_dates)
    total_completed = 0
    missed_days = 0

    for d in scheduled_dates:
        is_completed = (d in completed_dates)
        if is_completed:
            total_completed += 1
            current_run += 1
            if current_run > best_streak:
                best_streak = current_run
        else:
            if d < today_d:
                missed_days += 1
            current_run = 0

    # Current streak calculation:
    # Look backwards through scheduled dates
    # If today is scheduled:
    #   if completed today: streak includes today and continues backward
    #   if not completed today: streak is evaluated based on previous scheduled days (today is still open)
    # If today is not scheduled:
    #   evaluated based on the most recent scheduled day
    current_streak = 0
    reversed_sched = list(reversed(scheduled_dates))

    if reversed_sched:
        first_date = reversed_sched[0]
        start_idx = 0
        if first_date == today_d:
            if today_d in completed_dates:
                # Today was completed! Streak counts today
                start_idx = 0
            else:
                # Today not completed yet - it's pending, check from the day before today
                start_idx = 1
        else:
            # Most recent scheduled date is prior to today
            start_idx = 0

        # Now count unbroken completed scheduled days backward
        streak_count = 0
        used_freeze = False

        for i in range(start_idx, len(reversed_sched)):
            d = reversed_sched[i]
            if d in completed_dates:
                streak_count += 1
            else:
                # If streak freeze is enabled and hasn't been used yet, forgive 1 missed day
                if streak_freeze_enabled and not used_freeze and streak_count > 0:
                    used_freeze = True
                    continue
                else:
                    break

        current_streak = streak_count

    completion_rate = round((total_completed / total_scheduled) * 100, 1) if total_scheduled > 0 else 0.0

    return {
        'current_streak': current_streak,
        'best_streak': best_streak,
        'total_completions': total_completed,
        'completion_rate': completion_rate,
        'missed_days': missed_days
    }

def get_day_summary(user_id, target_date):
    """
    Returns aggregated status for a specific date:
    - habits: list of habits scheduled on this date with their completion status
    - tasks: list of tasks scheduled on this date with their completion status
    - habits_completed / habits_total
    - tasks_completed / tasks_total
    - overall_percent
    - status: 'completed' (100%), 'partial' (>0%), 'missed' (0% on past dates with items), 'none'
    """
    target_d = parse_date(target_date)
    date_str = format_date(target_d)
    conn = get_db_connection()

    # Get active habits + habits that may be paused/archived now but were active on this date and completed
    habits_rows = conn.execute("""
        SELECT h.*, c.name as category_name, c.color as category_color,
               (SELECT 1 FROM habit_completions hc WHERE hc.habit_id = h.id AND hc.date = ?) as is_completed,
               (SELECT completed_at FROM habit_completions hc WHERE hc.habit_id = h.id AND hc.date = ?) as completed_at
        FROM habits h
        LEFT JOIN categories c ON h.category_id = c.id
        WHERE h.user_id = ? AND (h.status = 'active' OR (SELECT 1 FROM habit_completions hc WHERE hc.habit_id = h.id AND hc.date = ?) IS NOT NULL)
        ORDER BY h.id ASC
    """, (date_str, date_str, user_id, date_str)).fetchall()

    scheduled_habits = []
    for h in habits_rows:
        if is_habit_scheduled_for_date(h, target_d):
            scheduled_habits.append({
                'id': h['id'],
                'name': h['name'],
                'description': h['description'],
                'icon': h['icon'],
                'color': h['color'],
                'category_name': h['category_name'],
                'category_color': h['category_color'],
                'is_completed': bool(h['is_completed']),
                'completed_at': h['completed_at'],
                'frequency_type': h['frequency_type'],
                'goal_value': h['goal_value'],
                'goal_unit': h['goal_unit'],
                'reminder_enabled': bool(h['reminder_enabled']),
                'reminder_time': h['reminder_time']
            })

    # Get tasks for this date
    tasks_rows = conn.execute("""
        SELECT t.*, c.name as category_name, c.color as category_color, g.title as goal_title
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN goals g ON t.goal_id = g.id
        WHERE t.user_id = ? AND t.date = ?
        ORDER BY t.sort_order ASC, t.id ASC
    """, (user_id, date_str)).fetchall()

    tasks_list = []
    for t in tasks_rows:
        tasks_list.append({
            'id': t['id'],
            'title': t['title'],
            'description': t['description'],
            'date': t['date'],
            'time': t['time'],
            'priority': t['priority'],
            'category_name': t['category_name'],
            'category_color': t['category_color'],
            'goal_title': t['goal_title'],
            'reminder_enabled': bool(t['reminder_enabled']),
            'reminder_time': t['reminder_time'],
            'completed': bool(t['completed']),
            'completed_at': t['completed_at'],
            'sort_order': t['sort_order']
        })

    conn.close()

    habits_total = len(scheduled_habits)
    habits_completed = sum(1 for h in scheduled_habits if h['is_completed'])
    tasks_total = len(tasks_list)
    tasks_completed = sum(1 for t in tasks_list if t['completed'])

    total_items = habits_total + tasks_total
    completed_items = habits_completed + tasks_completed

    percent = round((completed_items / total_items) * 100) if total_items > 0 else 0

    today_d = date.today()
    if total_items == 0:
        day_status = 'none'
    elif percent == 100:
        day_status = 'completed'
    elif percent > 0:
        day_status = 'partial'
    else:
        day_status = 'missed' if target_d < today_d else 'pending'

    return {
        'date': date_str,
        'habits': scheduled_habits,
        'tasks': tasks_list,
        'habits_total': habits_total,
        'habits_completed': habits_completed,
        'tasks_total': tasks_total,
        'tasks_completed': tasks_completed,
        'total_items': total_items,
        'completed_items': completed_items,
        'percent': percent,
        'status': day_status
    }
