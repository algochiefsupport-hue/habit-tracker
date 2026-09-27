"""
Database setup, connection pooling, schema initialization, and migration management for Habit Tracker.
Uses SQLite with WAL mode, foreign keys, and indexes for optimal performance and safety.
"""

import sqlite3
import os
import json
from datetime import datetime, date

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'habit_tracker.db')

def get_db_connection():
    """Returns a SQLite connection with foreign keys enabled and row_factory set."""
    conn = sqlite3.connect(DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn

def init_db():
    """Initializes the database schema if tables do not exist."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        streak_freeze_available INTEGER DEFAULT 1
    );
    """)

    # User settings
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        theme TEXT DEFAULT 'system',
        start_of_week TEXT DEFAULT 'monday',
        time_format TEXT DEFAULT '12h',
        date_format TEXT DEFAULT 'YYYY-MM-DD',
        daily_planning_enabled INTEGER DEFAULT 1,
        daily_planning_time TEXT DEFAULT '21:00',
        habit_reminders_enabled INTEGER DEFAULT 1,
        task_reminders_enabled INTEGER DEFAULT 1,
        sound_enabled INTEGER DEFAULT 1,
        streak_freeze_enabled INTEGER DEFAULT 1,
        timezone TEXT DEFAULT 'UTC',
        onboarding_completed INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # Categories
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        icon TEXT DEFAULT 'folder',
        color TEXT DEFAULT '#6366f1',
        is_default INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # Habits
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS habits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        category_id INTEGER,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT DEFAULT 'target',
        color TEXT DEFAULT '#10b981',
        frequency_type TEXT DEFAULT 'daily',
        frequency_days TEXT DEFAULT '[0,1,2,3,4,5,6]',
        start_date TEXT NOT NULL,
        goal_value REAL,
        goal_unit TEXT,
        reminder_enabled INTEGER DEFAULT 0,
        reminder_time TEXT,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );
    """)

    # Habit completions
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS habit_completions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        habit_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        note TEXT,
        UNIQUE(habit_id, date),
        FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # Goals
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        category_id INTEGER,
        title TEXT NOT NULL,
        description TEXT,
        target_value REAL NOT NULL DEFAULT 1.0,
        current_value REAL NOT NULL DEFAULT 0.0,
        unit TEXT DEFAULT 'times',
        start_date TEXT,
        end_date TEXT,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );
    """)

    # Daily Tasks
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        category_id INTEGER,
        goal_id INTEGER,
        title TEXT NOT NULL,
        description TEXT,
        date TEXT NOT NULL,
        time TEXT,
        priority TEXT DEFAULT 'medium',
        reminder_enabled INTEGER DEFAULT 0,
        reminder_time TEXT,
        completed INTEGER DEFAULT 0,
        completed_at TIMESTAMP,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
        FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE SET NULL
    );
    """)

    # Password reset tokens
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS password_resets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # Create indexes for fast query performance
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id, status);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_completions_user_date ON habit_completions(user_id, date);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_completions_habit ON habit_completions(habit_id, date);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasks(user_id, date);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id, status);")

    conn.commit()
    conn.close()

def create_default_categories(user_id, cursor=None):
    """Seed default categories for a new user."""
    should_close = False
    if cursor is None:
        conn = get_db_connection()
        cursor = conn.cursor()
        should_close = True

    default_categories = [
        ('Health', 'heart-pulse', '#10b981'),
        ('Fitness', 'dumbbell', '#f59e0b'),
        ('Work', 'briefcase', '#3b82f6'),
        ('Study', 'book-open', '#8b5cf6'),
        ('Personal', 'smile', '#ec4899'),
        ('Finance', 'wallet', '#14b8a6')
    ]

    for name, icon, color in default_categories:
        cursor.execute("""
            INSERT INTO categories (user_id, name, icon, color, is_default)
            VALUES (?, ?, ?, ?, 1)
        """, (user_id, name, icon, color))

    if should_close:
        conn.commit()
        conn.close()

if __name__ == '__main__':
    init_db()
    print("Database initialized successfully at", DB_PATH)
