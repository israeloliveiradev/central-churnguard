import os
import sys

# Force single-thread mode for ML/NumPy libraries to prevent fork-safety crashes under Phusion Passenger
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"

# Add application directory to path
app_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, app_dir)

# -------------------------------------------------------------
# ATIVAÇÃO DO VIRTUALENV (CPANEL E DIRECTADMIN)
# -------------------------------------------------------------
app_name = os.path.basename(app_dir)

# Support both cPanel (~/virtualenv/app) and DirectAdmin (~/virtualenv/domains/app) layouts
venv_candidates = [
    os.path.expanduser(f'~/virtualenv/{app_name}'),
    os.path.expanduser(f'~/virtualenv/domains/{app_name}'),
]

venv_base = None
for candidate in venv_candidates:
    if os.path.exists(candidate):
        venv_base = candidate
        break

# Add site-packages (both lib and lib64) to sys.path
if venv_base and os.path.exists(venv_base):
    for ver in os.listdir(venv_base):
        for lib_dir_name in ['lib', 'lib64']:
            sp_path = os.path.join(venv_base, ver, lib_dir_name, f'python{ver}', 'site-packages')
            if os.path.exists(sp_path):
                if sp_path not in sys.path:
                    sys.path.insert(0, sp_path)
            
            # Alternative layout checks (python3.x folder mismatch)
            base_lib_dir = os.path.join(venv_base, ver, lib_dir_name)
            if os.path.exists(base_lib_dir):
                for py_dir in os.listdir(base_lib_dir):
                    sp_candidate = os.path.join(base_lib_dir, py_dir, 'site-packages')
                    if os.path.exists(sp_candidate):
                        if sp_candidate not in sys.path:
                            sys.path.insert(0, sp_candidate)

from a2wsgi import ASGIMiddleware
from main import app

# Converte o app ASGI (FastAPI) em WSGI para rodar no Phusion Passenger
application = ASGIMiddleware(app)
