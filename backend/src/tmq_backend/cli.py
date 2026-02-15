"""TMQ CLI - Start frontend and backend with a single command."""
from __future__ import annotations

import os
import signal
import subprocess
import sys
from pathlib import Path


def get_project_root() -> Path:
    """Find project root (contains frontend/ and backend/)."""
    # Start from this file's location and go up
    current = Path(__file__).resolve().parent
    while current != current.parent:
        if (current / "frontend").exists() and (current / "backend").exists():
            return current
        current = current.parent
    # Fallback: assume we're in backend/src/tmq_backend
    return Path(__file__).resolve().parent.parent.parent.parent


def run():
    """Start both frontend and backend servers."""
    root = get_project_root()

    # Load .env from project root
    env_file = root / ".env"
    env = os.environ.copy()

    if env_file.exists():
        print(f"Loading environment from {env_file}")
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, value = line.partition("=")
                    env[key.strip()] = value.strip()

    # Determine commands based on platform
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"

    print("\n" + "=" * 50)
    print("  thats_my_quant")
    print("=" * 50)
    print(f"  Backend:  http://localhost:8000")
    print(f"  Frontend: http://localhost:5173")
    print("=" * 50 + "\n")

    processes = []

    try:
        # Start backend
        backend_cmd = [
            sys.executable, "-m", "uvicorn",
            "tmq_backend.main:app",
            "--reload",
            "--host", "0.0.0.0",
            "--port", "8000"
        ]
        backend_proc = subprocess.Popen(
            backend_cmd,
            cwd=root / "backend",
            env=env,
        )
        processes.append(("Backend", backend_proc))

        # Start frontend
        frontend_cmd = [npm_cmd, "run", "dev"]
        frontend_proc = subprocess.Popen(
            frontend_cmd,
            cwd=root / "frontend",
            env=env,
            shell=(sys.platform == "win32"),
        )
        processes.append(("Frontend", frontend_proc))

        # Wait for either to exit
        while True:
            for name, proc in processes:
                ret = proc.poll()
                if ret is not None:
                    print(f"\n{name} exited with code {ret}")
                    raise KeyboardInterrupt

            # Small sleep to avoid busy loop
            import time
            time.sleep(0.5)

    except KeyboardInterrupt:
        print("\nShutting down...")
        for name, proc in processes:
            if proc.poll() is None:
                print(f"  Stopping {name}...")
                if sys.platform == "win32":
                    proc.terminate()
                else:
                    proc.send_signal(signal.SIGTERM)

        # Wait for graceful shutdown
        for name, proc in processes:
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                print(f"  Force killing {name}...")
                proc.kill()

        print("Done.")


if __name__ == "__main__":
    run()
