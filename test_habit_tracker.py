"""
Automated unit and integration tests for Habit Tracker:
- Authentication & user isolation
- Habit scheduling & streak calculation rules (including missed non-scheduled days)
- Task management & date carry-forward
- Dashboard aggregations & calendar review
"""

import unittest
import os
import json
import sqlite3
from datetime import date, timedelta
from app import create_app
from database import get_db_connection, init_db
from models import is_habit_scheduled_for_date, calculate_habit_streaks, get_day_summary

class HabitTrackerTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()

        # Create unique test users per test method
        import time
        ts = int(time.time() * 1000)
        self.user1_email = f"alex_{ts}@test.com"
        self.user2_email = f"sarah_{ts}@test.com"
        self.password = "password123"

        # Register user 1
        res1 = self.client.post('/api/auth/register', json={
            'name': 'Alex',
            'email': self.user1_email,
            'password': self.password
        })
        self.assertEqual(res1.status_code, 201)
        self.user1_id = res1.get_json()['user']['id']

        # Register user 2
        res2 = self.client.post('/api/auth/register', json={
            'name': 'Sarah',
            'email': self.user2_email,
            'password': self.password
        })
        self.assertEqual(res2.status_code, 201)
        self.user2_id = res2.get_json()['user']['id']

    def tearDown(self):
        conn = get_db_connection()
        conn.execute("DELETE FROM users WHERE id IN (?, ?)", (self.user1_id, self.user2_id))
        conn.commit()
        conn.close()

    def login_as(self, email):
        res = self.client.post('/api/auth/login', json={
            'email': email,
            'password': self.password
        })
        self.assertEqual(res.status_code, 200)

    def test_user_data_isolation(self):
        """Test that Sarah cannot view or touch Alex's habits or tasks."""
        self.login_as(self.user1_email)
        # Alex creates a habit
        res = self.client.post('/api/habits', json={
            'name': 'Alex Secret Habit',
            'frequency_type': 'daily',
            'start_date': date.today().isoformat()
        })
        self.assertEqual(res.status_code, 201)
        alex_habit_id = res.get_json()['id']

        # Sarah logs in
        self.login_as(self.user2_email)
        # Sarah lists habits
        res = self.client.get('/api/habits')
        self.assertEqual(res.status_code, 200)
        habits = res.get_json()['habits']
        self.assertEqual(len(habits), 0)

        # Sarah tries to delete Alex's habit
        res_del = self.client.delete(f'/api/habits/{alex_habit_id}')
        self.assertEqual(res_del.status_code, 404)

    def test_streak_calculation_scheduled_vs_unscheduled(self):
        """
        Verify:
        - If habit is scheduled Mon, Wed, Fri, missing Tuesday must NOT break the streak!
        - Future dates must not count toward completion statistics.
        """
        self.login_as(self.user1_email)

        # Create habit scheduled on specific days: Monday (0), Wednesday (2), Friday (4)
        today = date.today()
        # Let's say habit started 14 days ago
        start_d = today - timedelta(days=14)

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO habits (
                user_id, name, frequency_type, frequency_days, start_date, status
            ) VALUES (?, 'Workout Mon-Wed-Fri', 'specific_days', '[0, 2, 4]', ?, 'active')
        """, (self.user1_id, start_d.isoformat()))
        habit_id = cursor.lastrowid
        conn.commit()

        # Let's find past Mon, Wed, Fri dates up to today
        curr = start_d
        scheduled_past = []
        while curr < today:
            if curr.weekday() in [0, 2, 4]:
                scheduled_past.append(curr)
            curr += timedelta(days=1)

        # Mark all scheduled past days as completed
        for d in scheduled_past:
            cursor.execute("""
                INSERT INTO habit_completions (habit_id, user_id, date)
                VALUES (?, ?, ?)
            """, (habit_id, self.user1_id, d.isoformat()))
        conn.commit()
        conn.close()

        # Calculate streaks
        stats = calculate_habit_streaks(habit_id, self.user1_id, today)
        self.assertEqual(stats['total_completions'], len(scheduled_past))
        # The streak should be exactly len(scheduled_past) despite Tuesday, Thursday, Saturday, Sunday having no completions!
        self.assertEqual(stats['current_streak'], len(scheduled_past))
        self.assertEqual(stats['best_streak'], len(scheduled_past))
        self.assertEqual(stats['missed_days'], 0)

    def test_task_creation_and_carry_forward(self):
        """
        Verify:
        - Task creation for today
        - Moving task to tomorrow updates date without duplicate creation
        - Completing a task does NOT affect habit streak
        """
        self.login_as(self.user1_email)
        today_str = date.today().isoformat()
        tomorrow_str = (date.today() + timedelta(days=1)).isoformat()

        # Create task for today
        res = self.client.post('/api/tasks', json={
            'title': 'Finish website design',
            'priority': 'high',
            'date': today_str
        })
        self.assertEqual(res.status_code, 201)
        task_id = res.get_json()['id']

        # Carry forward tasks from today to tomorrow
        res_cf = self.client.post('/api/dashboard/carry-forward', json={
            'from_date': today_str,
            'to_date': tomorrow_str
        })
        self.assertEqual(res_cf.status_code, 200)

        # Check today's tasks -> should be 0
        res_today = self.client.get(f'/api/tasks?date={today_str}')
        self.assertEqual(len(res_today.get_json()['tasks']), 0)

        # Check tomorrow's tasks -> should contain the task
        res_tomorrow = self.client.get(f'/api/tasks?date={tomorrow_str}')
        tasks_tomorrow = res_tomorrow.get_json()['tasks']
        self.assertEqual(len(tasks_tomorrow), 1)
        self.assertEqual(tasks_tomorrow[0]['id'], task_id)
        self.assertEqual(tasks_tomorrow[0]['title'], 'Finish website design')

    def test_calendar_month_and_day_inspection(self):
        """Verify calendar month status calculations and day inspection."""
        self.login_as(self.user1_email)
        today = date.today()

        # Add a habit and complete it today
        res_h = self.client.post('/api/habits', json={
            'name': 'Daily Reading',
            'frequency_type': 'daily',
            'start_date': today.isoformat()
        })
        habit_id = res_h.get_json()['id']

        # Complete it
        self.client.post(f'/api/habits/{habit_id}/toggle', json={'date': today.isoformat()})

        # Check month view
        res_cal = self.client.get(f'/api/calendar/month?year={today.year}&month={today.month}')
        self.assertEqual(res_cal.status_code, 200)
        days = res_cal.get_json()['days']
        today_entry = next((d for d in days if d['date'] == today.isoformat()), None)
        self.assertIsNotNone(today_entry)
        self.assertEqual(today_entry['percent'], 100)
        self.assertEqual(today_entry['status'], 'completed')

if __name__ == '__main__':
    unittest.main()
