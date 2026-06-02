import os
import sys

# Add application directory to path
sys.path.insert(0, os.path.dirname(__file__))

from a2wsgi import ASGIMiddleware
from main import app

# Wrap ASGI app (FastAPI) as WSGI for Phusion Passenger (cPanel)
application = ASGIMiddleware(app)
