"""
Seed script to create a sample user with rich habits, completions, and tasks for immediate demonstration.
"""

from datetime import date, timedelta
from app import create_app
from database import get_db_connection
from auth import hash_password

def seed_demo_data():
    app = create_app()
    with app.app_context():
        conn = get_db_connection()
        today = date.today()

        # Check if demo user already exists
        existing = conn.execute("SELECT id FROM users WHERE email = 'alex@habitpulse.com'").fetchone()
        if existing:
            print("Demo user already seeded.")
            conn.close()
            return

        cursor = conn.cursor()
        # Create user
        cursor.execute("""
            INSERT INTO users (name, email, password_hash)
            VALUES (?, ?, ?)
        """, ('Alex Morgan', 'alex@habitpulse.com', hash_password('password123')))
        user_id = cursor.lastrowid

        # Settings
        cursor.execute("""
            INSERT INTO user_settings (user_id, theme, start_of_week, time_format, onboarding_completed, streak_freeze_enabled)
            VALUES (?, 'system', 'monday', '12h', 1, 1)
        """, (user_id,))

        # Categories
        cat_health = cursor.execute("INSERT INTO categories (user_id, name, icon, color, is_default) VALUES (?, 'Health', 'heart-pulse', '#10b981', 1)", (user_id,)).lastrowid
        cat_fitness = cursor.execute("INSERT INTO categories (user_id, name, icon, color, is_default) VALUES (?, 'Fitness', 'dumbbell', '#f59e0b', 1)", (user_id,)).lastrowid
        cat_study = cursor.execute("INSERT INTO categories (user_id, name, icon, color, is_default) VALUES (?, 'Study', 'book-open', '#8b5cf6', 1)", (user_id,)).lastrowid
        cat_work = cursor.execute("INSERT INTO categories (user_id, name, icon, color, is_default) VALUES (?, 'Work', 'briefcase', '#3b82f6', 1)", (user_id,)).lastrowid

        # Habits
        h1 = cursor.execute("""
            INSERT INTO habits (user_id, category_id, name, description, icon, color, frequency_type, frequency_days, start_date, goal_value, goal_unit, status)
            VALUES (?, ?, 'Morning Workout', 'Cardio and strength routine', 'dumbbell', '#f59e0b', 'weekdays', '[0,1,2,3,4]', ?, 30, 'minutes', 'active')
        """, (user_id, cat_fitness, (today - timedelta(days=20)).isoformat())).lastrowid

        h2 = cursor.execute("""
            INSERT INTO habits (user_id, category_id, name, description, icon, color, frequency_type, frequency_days, start_date, goal_value, goal_unit, status)
            VALUES (?, ?, 'Read 20 Minutes', 'Books on productivity & tech', 'book-open', '#8b5cf6', 'daily', '[0,1,2,3,4,5,6]', ?, 20, 'pages', 'active')
        """, (user_id, cat_study, (today - timedelta(days=15)).isoformat())).lastrowid

        h3 = cursor.execute("""
            INSERT INTO habits (user_id, category_id, name, description, icon, color, frequency_type, frequency_days, start_date, goal_value, goal_unit, status)
            VALUES (?, ?, 'Drink 2L Water', 'Hydrate consistently throughout the day', 'droplet', '#10b981', 'daily', '[0,1,2,3,4,5,6]', ?, 2, 'liters', 'active')
        """, (user_id, cat_health, (today - timedelta(days=25)).isoformat())).lastrowid

        h4 = cursor.execute("""
            INSERT INTO habits (user_id, category_id, name, description, icon, color, frequency_type, frequency_days, start_date, goal_value, goal_unit, status)
            VALUES (?, ?, 'Evening Meditation', 'Quiet reflection before sleep', 'smile', '#ec4899', 'daily', '[0,1,2,3,4,5,6]', ?, 10, 'minutes', 'active')
        """, (user_id, cat_health, (today - timedelta(days=10)).isoformat())).lastrowid

        # Habit completions history to produce real streaks
        # For h1 (Morning Workout - weekdays only)
        curr = today - timedelta(days=14)
        while curr <= today:
            if curr.weekday() < 5 and curr != (today - timedelta(days=3)):
                cursor.execute("INSERT OR IGNORE INTO habit_completions (habit_id, user_id, date) VALUES (?, ?, ?)", (h1, user_id, curr.isoformat()))
            curr += timedelta(days=1)

        # For h2 (Read 20 mins - daily streak)
        for i in range(1, 10):
            d = today - timedelta(days=i)
            cursor.execute("INSERT OR IGNORE INTO habit_completions (habit_id, user_id, date) VALUES (?, ?, ?)", (h2, user_id, d.isoformat()))
        # Complete h2 today as well
        cursor.execute("INSERT OR IGNORE INTO habit_completions (habit_id, user_id, date) VALUES (?, ?, ?)", (h2, user_id, today.isoformat()))

        # For h3 (Drink 2L Water) - complete today
        cursor.execute("INSERT OR IGNORE INTO habit_completions (habit_id, user_id, date) VALUES (?, ?, ?)", (h3, user_id, today.isoformat()))

        # Tasks for Today
        cursor.execute("""
            INSERT INTO tasks (user_id, category_id, title, description, date, time, priority, completed, sort_order)
            VALUES (?, ?, 'Finish payment integration', 'Implement webhook listeners and idempotency', ?, '14:30', 'high', 1, 1)
        """, (user_id, cat_work, today.isoformat()))

        cursor.execute("""
            INSERT INTO tasks (user_id, category_id, title, description, date, time, priority, completed, sort_order)
            VALUES (?, ?, 'Reply to client emails', 'Confirm launch schedule for next week', ?, '16:00', 'medium', 0, 2)
        """, (user_id, cat_work, today.isoformat()))

        cursor.execute("""
            INSERT INTO tasks (user_id, category_id, title, description, date, time, priority, completed, sort_order)
            VALUES (?, ?, 'Review chapter 4 notes', 'Summarize key takeaways in notebook', ?, '19:00', 'low', 0, 3)
        """, (user_id, cat_study, today.isoformat()))

        # Tomorrow's planned tasks
        tomorrow = today + timedelta(days=1)
        cursor.execute("""
            INSERT INTO tasks (user_id, category_id, title, description, date, time, priority, completed, sort_order)
            VALUES (?, ?, 'Launch staging deployment', 'Verify production migrations and env vars', ?, '10:00', 'high', 0, 1)
        """, (user_id, cat_work, tomorrow.isoformat()))

        cursor.execute("""
            INSERT INTO tasks (user_id, category_id, title, description, date, time, priority, completed, sort_order)
            VALUES (?, ?, 'Grocery shopping', 'Buy fresh greens, fruit, and oats', ?, '18:00', 'medium', 0, 2)
        """, (user_id, cat_health, tomorrow.isoformat()))

        # Goals
        cursor.execute("""
            INSERT INTO goals (user_id, category_id, title, description, target_value, current_value, unit, status)
            VALUES (?, ?, 'Read 20 Books This Year', 'Expand knowledge in engineering and design', 20, 8, 'books', 'active')
        """, (user_id, cat_study))

        cursor.execute("""
            INSERT INTO goals (user_id, category_id, title, description, target_value, current_value, unit, status)
            VALUES (?, ?, 'Run 100 Kilometers', 'Build aerobic base and cardiovascular endurance', 100, 42, 'km', 'active')
        """, (user_id, cat_fitness))

        conn.commit()
        conn.close()
        print("Demo account successfully seeded: alex@habitpulse.com / password123")

if __name__ == '__main__':
    seed_demo_data()
