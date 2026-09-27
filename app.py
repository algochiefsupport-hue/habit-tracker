"""
Flask application server for Habit Tracker + Daily Task Planner.
Supports both modular folder structure and flat root structure for easy cloud deployment.
"""

import os
from flask import Flask, render_template, send_from_directory, jsonify, send_file
from database import init_db

# Graceful import: works whether files are in routes/ folder or directly in root directory
try:
    from routes.auth_routes import auth_bp
    from routes.habit_routes import habit_bp
    from routes.task_routes import task_bp
    from routes.dashboard_routes import dashboard_bp
    from routes.insight_routes import insight_bp
    from routes.goal_routes import goal_bp
    from routes.settings_routes import settings_bp
except ImportError:
    from auth_routes import auth_bp
    from habit_routes import habit_bp
    from task_routes import task_bp
    from dashboard_routes import dashboard_bp
    from insight_routes import insight_bp
    from goal_routes import goal_bp
    from settings_routes import settings_bp

def create_app():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    templates_dir = os.path.join(base_dir, 'templates')
    static_dir = os.path.join(base_dir, 'static')

    app = Flask(
        __name__,
        static_folder=static_dir if os.path.exists(static_dir) else base_dir,
        template_folder=templates_dir if os.path.exists(templates_dir) else base_dir
    )
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
        index_in_templates = os.path.join(base_dir, 'templates', 'index.html')
        if os.path.exists(index_in_templates):
            return render_template('index.html')
        return send_file(os.path.join(base_dir, 'index.html'))

    # Universal static file router: handles both /static/css/main.css and root files
    @app.route('/static/<path:filename>')
    def serve_static(filename):
        # 1. Try static folder if present
        target_in_static = os.path.join(base_dir, 'static', filename)
        if os.path.exists(target_in_static):
            return send_from_directory(os.path.join(base_dir, 'static'), filename)

        # 2. Try file by its basename in root
        basename = os.path.basename(filename)
        target_in_root = os.path.join(base_dir, basename)
        if os.path.exists(target_in_root):
            return send_from_directory(base_dir, basename)

        # 3. Fallback direct match
        return send_from_directory(base_dir, filename)

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
