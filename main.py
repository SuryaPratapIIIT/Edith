"""
Root entrypoint for Render and container deployments.
Imports the FastAPI application from backend.main.
"""
import sys
from pathlib import Path

# Add backend directory to sys.path so pace_engine and modules resolve
backend_dir = Path(__file__).resolve().parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from backend.main import app

if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
