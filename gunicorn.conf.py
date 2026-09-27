"""
Gunicorn configuration file for Render deployment.
Automatically binds to Render's assigned $PORT on 0.0.0.0.
"""

import os

port = os.environ.get('PORT', '10000')
bind = f"0.0.0.0:{port}"
workers = 2
timeout = 120
accesslog = '-'
errorlog = '-'
loglevel = 'info'
