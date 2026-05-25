"""One-command local validation for the Phase 1 data pipeline."""

from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = PROJECT_ROOT / ".env"
MIGRATIONS_DIR = PROJECT_ROOT / "sql" / "migrations"
MODELS_DIR = PROJECT_ROOT / "sql" / "models"
TESTS_DIR = PROJECT_ROOT / "sql" / "tests"
INGESTION_SCRIPT = PROJECT_ROOT / "ingestion" / "run_animal_ingestion.py"


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :].strip()
        key, separator, value = line.partition("=")
        if separator and key.strip():
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_dotenv(ENV_PATH)

POSTGRES_DB = os.environ.get("POSTGRES_DB", "shelter_signal")
POSTGRES_USER = os.environ.get("POSTGRES_USER", "shelter_signal")
POSTGRES_SERVICE = os.environ.get("POSTGRES_SERVICE", "postgres")


def run_command(
    command: list[str],
    *,
    input_text: str | None = None,
    check: bool = False,
) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        command,
        input=input_text,
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
        cwd=PROJECT_ROOT,
        check=False,
    )
    if check and result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "command failed")
    return result


def psql(sql: str, *, tuples_only: bool = False) -> subprocess.CompletedProcess[str]:
    command = [
        "docker",
        "compose",
        "exec",
        "-T",
        POSTGRES_SERVICE,
        "psql",
        "-v",
        "ON_ERROR_STOP=1",
        "-U",
        POSTGRES_USER,
        "-d",
        POSTGRES_DB,
    ]
    if tuples_only:
        command.append("-At")
    return run_command(command, input_text=sql, check=True)


def check_docker() -> None:
    print("Checking Docker...")
    for command in (["docker", "--version"], ["docker", "compose", "version"], ["docker", "info"]):
        result = run_command(command)
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or "Docker is not available.")
    print("Docker is available.")


def start_postgres() -> None:
    print("Starting PostgreSQL with Docker Compose...")
    run_command(["docker", "compose", "up", "-d", POSTGRES_SERVICE], check=True)

    for attempt in range(1, 31):
        result = run_command(
            [
                "docker",
                "compose",
                "exec",
                "-T",
                POSTGRES_SERVICE,
                "pg_isready",
                "-U",
                POSTGRES_USER,
                "-d",
                POSTGRES_DB,
            ]
        )
        if result.returncode == 0:
            print("PostgreSQL is ready.")
            return
        time.sleep(2)

    raise RuntimeError("PostgreSQL did not become ready within 60 seconds.")


def apply_sql_files(directory: Path, label: str) -> None:
    files = sorted(directory.glob("*.sql"))
    if not files:
        raise RuntimeError(f"No SQL files found in {directory}.")

    print(f"Applying {label}...")
    for path in files:
        psql(path.read_text(encoding="utf-8"))
        print(f"  applied {path.relative_to(PROJECT_ROOT)}")


def load_mock_data() -> None:
    print("Loading mock rescued animal data...")
    result = run_command(
        [sys.executable, str(INGESTION_SCRIPT), "--mock", "--load-db"],
        check=True,
    )
    print(result.stdout.strip())


def strip_trailing_semicolon(sql: str) -> str:
    stripped = sql.strip()
    while stripped.endswith(";"):
        stripped = stripped[:-1].rstrip()
    return stripped


def run_sql_tests() -> list[str]:
    print("Running SQL tests...")
    failures: list[str] = []
    for path in sorted(TESTS_DIR.glob("*.sql")):
        test_sql = strip_trailing_semicolon(path.read_text(encoding="utf-8"))
        count_sql = f"SELECT COUNT(*) FROM (\n{test_sql}\n) AS failures;"
        result = psql(count_sql, tuples_only=True)
        failure_count = int(result.stdout.strip() or "0")
        if failure_count:
            failures.append(f"{path.name}: {failure_count} failing rows")
            preview_sql = f"SELECT * FROM (\n{test_sql}\n) AS failures LIMIT 5;"
            preview = psql(preview_sql)
            print(f"  FAIL {path.name}: {failure_count} failing rows")
            print(preview.stdout.strip())
        else:
            print(f"  PASS {path.name}")
    return failures


def print_previews() -> None:
    previews = {
        "mart.alert_candidates": "SELECT * FROM mart.alert_candidates LIMIT 10;",
        "mart.rescue_window_summary": "SELECT * FROM mart.rescue_window_summary LIMIT 10;",
        "mart.region_summary": "SELECT * FROM mart.region_summary LIMIT 10;",
        "mart.shelter_summary": "SELECT * FROM mart.shelter_summary LIMIT 10;",
        "mart.kind_summary": "SELECT * FROM mart.kind_summary LIMIT 10;",
    }

    print("Analytics previews:")
    for label, query in previews.items():
        print(f"\n[{label}]")
        result = psql(query)
        print(result.stdout.strip())


def main() -> int:
    summary: list[tuple[str, bool, str]] = []
    try:
        check_docker()
        summary.append(("Docker available", True, ""))

        start_postgres()
        summary.append(("PostgreSQL ready", True, ""))

        apply_sql_files(MIGRATIONS_DIR, "migrations")
        summary.append(("Migrations applied", True, ""))

        load_mock_data()
        summary.append(("Mock data loaded", True, ""))

        apply_sql_files(MODELS_DIR, "models")
        summary.append(("Models applied", True, ""))

        test_failures = run_sql_tests()
        summary.append(("SQL tests passed", not test_failures, "; ".join(test_failures)))

        print_previews()
    except Exception as exc:
        summary.append(("Validation completed", False, str(exc)))

    print("\nValidation summary:")
    failed = False
    for label, passed, detail in summary:
        status = "PASS" if passed else "FAIL"
        print(f"  {status} {label}{': ' + detail if detail else ''}")
        failed = failed or not passed

    if failed:
        print("\nPipeline validation failed.")
        return 1

    print("\nPipeline validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
