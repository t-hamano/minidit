"""Measures the release build's startup time, memory usage, and installer size.

Run from the repository root after `pnpm tauri build`. Writes a Markdown report
to the job summary, and to the file named by `MEASURE_REPORT` when set.
"""

import os
import re
import statistics
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import psutil

RUNS = 5
STARTUP_TIMEOUT = 30
SETTLE_SECONDS = 3

# The targets from the specification.
MAX_STARTUP_MS = 500
MAX_MEMORY_MB = 100
MAX_INSTALLER_MB = 10

if sys.platform == "darwin":
    # The universal build that releases ship.
    BUNDLE = Path("src-tauri/target/universal-apple-darwin/release/bundle")
    APP = BUNDLE / "macos/Minidit.app/Contents/MacOS/minidit"
    INSTALLERS = sorted(BUNDLE.glob("dmg/*.dmg"))
else:
    BUNDLE = Path("src-tauri/target/release/bundle")
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


# One line per process, such as `minidit [123]: 64-bit    Footprint: 27 MB`.
# The `Summary Footprint` line has no process ID, so it is not matched.
FOOTPRINT = re.compile(r"\[\d+\]:.*?Footprint:\s+([\d.]+)\s*(KB|MB|GB)")
UNITS = {"KB": 1 / 1024, "MB": 1, "GB": 1024}


def footprint_mb(pids: list[int]) -> float:
    """The physical footprint of macOS processes, which Activity Monitor
    shows as their memory. psutil's USS walks every memory region, which
    takes too long for WebKit processes."""
    output = subprocess.run(
        ["sudo", "footprint", *map(str, pids)],
        capture_output=True,
        text=True,
        timeout=60,
        check=True,
    ).stdout
    matches = FOOTPRINT.findall(output)
    if len(matches) != len(pids):
        raise RuntimeError(f"Unexpected footprint output:\n{output}")
    return sum(float(value) * UNITS[unit] for value, unit in matches)


def memory_mb(app: psutil.Process) -> float:
    """Memory that the app and its WebView processes use on their own, as
    Activity Monitor and Task Manager show it."""
    processes = [app, *webview_processes(app)]
    if sys.platform == "darwin":
        return footprint_mb([process.pid for process in processes])
    total = 0
    for process in processes:
        try:
            total += process.memory_full_info().uss
        except psutil.NoSuchProcess:
            # Exited meanwhile. Any other error, such as `AccessDenied`,
            # fails the measurement rather than understating it.
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
        print(f"Run {index + 1}: ready in {startup * 1000:.0f} ms", flush=True)
        time.sleep(SETTLE_SECONDS)
        memory = memory_mb(psutil.Process(process.pid))
        print(f"Run {index + 1}: {memory:.0f} MB", flush=True)
    finally:
        process.kill()
        process.wait()
        # Lets the WebView processes exit before the next run.
        time.sleep(2)
    return startup, memory


def status(value: float, limit: float) -> str:
    return "✅" if value <= limit else "⚠️"


def main() -> None:
    # The Windows console encoding cannot print the status emoji.
    sys.stdout.reconfigure(encoding="utf-8")
    results = [measure_once(index) for index in range(RUNS)]
    startup_ms = statistics.median(startup for startup, _ in results) * 1000
    memory = statistics.median(memory for _, memory in results)
    installers = [
        (path.name, path.stat().st_size / 1024 / 1024) for path in INSTALLERS
    ]
    platform = "macOS" if sys.platform == "darwin" else "Windows"
    lines = [
        f"### {platform}",
        "",
        "| | Result | Target |",
        "| --- | --- | --- |",
        f"| Startup (median of {RUNS}) | {status(startup_ms, MAX_STARTUP_MS)} {startup_ms:.0f} ms | {MAX_STARTUP_MS} ms |",
        f"| Memory (median of {RUNS}) | {status(memory, MAX_MEMORY_MB)} {memory:.0f} MB | {MAX_MEMORY_MB} MB |",
        *(
            f"| `{name}` | {status(size, MAX_INSTALLER_MB)} {size:.1f} MB | {MAX_INSTALLER_MB} MB |"
            for name, size in installers
        ),
        "",
        "<details><summary>Each run</summary>",
        "",
        "| Run | Startup | Memory |",
        "| --- | --- | --- |",
        *(
            f"| {index + 1} | {startup * 1000:.0f} ms | {run_memory:.0f} MB |"
            for index, (startup, run_memory) in enumerate(results)
        ),
        "",
        "</details>",
        "",
    ]
    report = "\n".join(lines)
    print(report)
    for target in (
        os.environ.get("GITHUB_STEP_SUMMARY"),
        os.environ.get("MEASURE_REPORT"),
    ):
        if target:
            with open(target, "a", encoding="utf-8") as file:
                file.write(report)


if __name__ == "__main__":
    main()
