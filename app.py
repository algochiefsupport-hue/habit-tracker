"""
Flask application server for Habit Tracker + Daily Task Planner.
"""

import os
from flask import Flask, render_template, send_from_directory, jsonify
from database import init_db
from routes.auth_routes import auth_bp
from routes.habit_routes import habit_bp
from routes.task_routes import task_bp
from routes.dashboard_routes import dashboard_bp
from routes.insight_routes import insight_bp
from routes.goal_routes import goal_bp
from routes.settings_routes import settings_bp

def create_app():
    app = Flask(__name__, static_folder='static', template_folder='templates')
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'habit-tracker-secret-key-production-ready-2026')
    app.config['JSON_SORT_KEYS'] = False

    # Initialize SQLite database
    init_db()

    # Register Blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(habit_bp)
    app.register_blueprint(task_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(insight_bp)
    app.register_blueprint(goal_bp)
    app.register_blueprint(settings_bp)

    @app.route('/')
    def index():
        return render_template('index.html')

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({'error': 'Not found'}), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({'error': 'Internal server error'}), 500

    return app

app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"Habit Tracker server running at http://127.0.0.1:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
