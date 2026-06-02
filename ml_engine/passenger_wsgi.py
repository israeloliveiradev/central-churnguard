import os
import sys

# Add application directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Dynamically locate and add cPanel virtualenv site-packages to sys.path
venv_base = os.path.expanduser('~/virtualenv/domains/churnguard')
if os.path.exists(venv_base):
    for root, dirs, files in os.walk(venv_base):
        if 'site-packages' in dirs:
            site_packages_path = os.path.join(root, 'site-packages')
            if site_packages_path not in sys.path:
                sys.path.insert(0, site_packages_path)

from a2wsgi import ASGIMiddleware
from main import app

# Wrap ASGI app (FastAPI) as WSGI for Phusion Passenger (cPanel)
application = ASGIMiddleware(app)
