"""Measures the release build's startup time, memory usage, and installer size.

Run from the repository root after `pnpm tauri build`. Writes a Markdown report
to the job summary when run in GitHub Actions.
"""

import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import psutil

RUNS = 5
STARTUP_TIMEOUT = 30
SETTLE_SECONDS = 3

BUNDLE = Path("src-tauri/target/release/bundle")
if sys.platform == "darwin":
    APP = BUNDLE / "macos/Minidit.app/Contents/MacOS/minidit"
    INSTALLERS = sorted(BUNDLE.glob("dmg/*.dmg"))
else:
    APP = Path("src-tauri/target/release/minidit.exe")
    INSTALLERS = sorted([*BUNDLE.glob("nsis/*.exe"), *BUNDLE.glob("msi/*.msi")])


def webview_processes(app: psutil.Process) -> list[psutil.Process]:
    """The app's WebView processes. On macOS they are not its children, so
    every WebKit process counts; nothing else uses WebKit on the runner."""
    if sys.platform == "darwin":
        return [
            process
            for process in psutil.process_iter(["name"])
            if (process.info["name"] or "").startswith("com.apple.WebKit")
        ]
    return app.children(recursive=True)


def memory_mb(app: psutil.Process) -> float:
    """Memory that the app and its WebView processes use on their own (USS),
    which is close to what Task Manager and Activity Monitor show."""
    total = 0
    for process in [app, *webview_processes(app)]:
        try:
            total += process.memory_full_info().uss
        except psutil.Error:
            pass
    return total / 1024 / 1024


def measure_once(index: int) -> tuple[float, float]:
    ready = Path(tempfile.gettempdir()) / f"minidit-ready-{index}"
    ready.unlink(missing_ok=True)
    env = {**os.environ, "MINIDIT_READY_FILE": str(ready)}
    start = time.perf_counter()
    process = subprocess.Popen([str(APP)], env=env)
    try:
        while not ready.exists():
            if time.perf_counter() - start > STARTUP_TIMEOUT:
                raise TimeoutError("The app did not report that it was ready.")
            time.sleep(0.005)
        startup = time.perf_counter() - start
        time.sleep(SETTLE_SECONDS)
        memory = memory_mb(psutil.Process(process.pid))
    finally:
        process.kill()
        process.wait()
        # Lets the WebView processes exit before the next run.
        time.sleep(2)
    return startup, memory


def main() -> None:
    results = [measure_once(index) for index in range(RUNS)]
    lines = [
        f"## {sys.platform}",
        "",
        "| Run | Startup | Memory |",
        "| --- | --- | --- |",
        *(
            f"| {index + 1} | {startup * 1000:.0f} ms | {memory:.0f} MB |"
            for index, (startup, memory) in enumerate(results)
        ),
        "",
        "| Installer | Size |",
        "| --- | --- |",
        *(
            f"| {path.name} | {path.stat().st_size / 1024 / 1024:.1f} MB |"
            for path in INSTALLERS
        ),
        "",
    ]
    report = "\n".join(lines)
    print(report)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as file:
            file.write(report)


if __name__ == "__main__":
    main()
