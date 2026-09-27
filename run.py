"""
Launcher script for Habit Tracker + Daily Task Planner.
"""

import os
from app import create_app

app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print("==========================================================")
    print(f"HabitPulse App is live at: http://127.0.0.1:{port}")
    print("==========================================================")
    app.run(host='0.0.0.0', port=port, debug=False)
