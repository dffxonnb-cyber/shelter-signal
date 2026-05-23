"""Smoke test for the public animal protection API.

The real service key must stay in a local .env file and is never printed.
"""

from __future__ import annotations

import json
import os
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote_plus, urlencode
from urllib.request import Request, urlopen


# API details are kept near the top so they are easy to adjust after checking
# the official public-data portal documentation.
BASE_URL = "https://apis.data.go.kr/1543061/abandonmentPublicService_v2/abandonmentPublic_v2"
PAGE_NO = 1
NUM_OF_ROWS = 5
RESPONSE_TYPE = "json"

TIMEOUT_SECONDS = 20
PROJECT_ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = PROJECT_ROOT / ".env"
RAW_DIR = PROJECT_ROOT / "data" / "raw"
JSON_OUTPUT_PATH = RAW_DIR / "animal_api_sample.json"
XML_OUTPUT_PATH = RAW_DIR / "animal_api_sample.xml"


def load_dotenv(path: Path) -> dict[str, str]:
    """Load simple KEY=VALUE pairs from .env using only the standard library."""
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :].strip()
        key, separator, value = line.partition("=")
        if not separator:
            continue
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            values[key] = value
            os.environ.setdefault(key, value)
    return values


def get_api_key() -> str:
    env_values = load_dotenv(ENV_PATH)
    api_key = env_values.get("ANIMAL_API_KEY") or os.environ.get("ANIMAL_API_KEY")
    if not api_key or api_key == "your_api_key_here":
        raise RuntimeError(
            "ANIMAL_API_KEY was not found. Create a local .env file from "
            ".env.example and run the script again."
        )
    return api_key


def encode_service_key(api_key: str) -> str:
    """Avoid double-encoding keys copied from the portal as encoded strings."""
    if "%" in api_key:
        return api_key
    return quote_plus(api_key, safe="")


def build_request_url(api_key: str) -> str:
    if NUM_OF_ROWS > 10:
        raise ValueError("NUM_OF_ROWS must stay at 10 or below for this smoke test.")

    query = urlencode(
        {
            "pageNo": str(PAGE_NO),
            "numOfRows": str(NUM_OF_ROWS),
            "_type": RESPONSE_TYPE,
        }
    )
    return f"{BASE_URL}?serviceKey={encode_service_key(api_key)}&{query}"


def request_once(url: str) -> tuple[int, str, str]:
    request = Request(
        url,
        headers={
            "Accept": "application/json, application/xml;q=0.9, text/plain;q=0.8",
            "User-Agent": "shelter-signal-api-smoke-test/0.1",
        },
    )

    try:
        with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            body = response.read().decode("utf-8", errors="replace")
            content_type = response.headers.get("Content-Type", "")
            return response.status, content_type, body
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        content_type = exc.headers.get("Content-Type", "")
        return exc.code, content_type, body
    except URLError as exc:
        raise RuntimeError(f"API request failed before a response was received: {exc}") from exc


def nested_get(data: Any, path: tuple[str, ...]) -> Any:
    current = data
    for key in path:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def extract_json_items(data: Any) -> list[Any]:
    candidates = [
        nested_get(data, ("response", "body", "items", "item")),
        nested_get(data, ("body", "items", "item")),
        nested_get(data, ("items", "item")),
        nested_get(data, ("items",)),
    ]
    for candidate in candidates:
        if isinstance(candidate, list):
            return candidate
        if isinstance(candidate, dict):
            return [candidate]
    return []


def extract_json_total_count(data: Any) -> Any:
    for path in (
        ("response", "body", "totalCount"),
        ("body", "totalCount"),
        ("totalCount",),
    ):
        value = nested_get(data, path)
        if value is not None:
            return value
    return None


def format_keys(keys: list[str]) -> str:
    return ", ".join(keys) if keys else "(none)"


def print_json_summary(status_code: int, data: Any, saved_path: Path) -> None:
    top_level_keys = list(data.keys()) if isinstance(data, dict) else []
    items = extract_json_items(data)
    sample_item = next((item for item in items if isinstance(item, dict)), None)
    sample_item_keys = list(sample_item.keys()) if sample_item else []
    total_count = extract_json_total_count(data)
    api_result_code = nested_get(data, ("response", "header", "resultCode"))
    api_result_message = nested_get(data, ("response", "header", "resultMsg"))

    print(f"Status code: {status_code}")
    print("Response format: json")
    print(f"Total count: {total_count if total_count is not None else 'not found'}")
    print(f"Items returned: {len(items)}")
    print(f"Top-level response keys: {format_keys(top_level_keys)}")
    print(f"Sample item keys: {format_keys(sample_item_keys)}")
    if api_result_code or api_result_message:
        print(f"API result: {api_result_code or 'unknown'} {api_result_message or ''}".strip())
    print(f"Saved raw sample: {saved_path.relative_to(PROJECT_ROOT)}")


def strip_namespace(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def find_xml_total_count(root: ET.Element) -> str | None:
    for element in root.iter():
        if strip_namespace(element.tag) == "totalCount" and element.text:
            return element.text.strip()
    return None


def print_xml_or_text_summary(status_code: int, body: str, saved_path: Path) -> None:
    try:
        root = ET.fromstring(body)
    except ET.ParseError:
        print(f"Status code: {status_code}")
        print("Response format: text")
        print("Total count: not found")
        print("Items returned: 0")
        print("Top-level response keys: (none)")
        print("Sample item keys: (none)")
        print(f"Saved raw sample: {saved_path.relative_to(PROJECT_ROOT)}")
        return

    top_level_keys = [strip_namespace(child.tag) for child in list(root)]
    items = [element for element in root.iter() if strip_namespace(element.tag) == "item"]
    sample_item_keys = [strip_namespace(child.tag) for child in list(items[0])] if items else []
    total_count = find_xml_total_count(root)

    print(f"Status code: {status_code}")
    print("Response format: xml")
    print(f"Total count: {total_count if total_count is not None else 'not found'}")
    print(f"Items returned: {len(items)}")
    print(f"Top-level response keys: {format_keys(top_level_keys)}")
    print(f"Sample item keys: {format_keys(sample_item_keys)}")
    print(f"Saved raw sample: {saved_path.relative_to(PROJECT_ROOT)}")


def main() -> int:
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    try:
        api_key = get_api_key()
        url = build_request_url(api_key)
        status_code, _content_type, body = request_once(url)
    except Exception as exc:
        print(f"Smoke test could not run: {exc}", file=sys.stderr)
        return 1

    try:
        data = json.loads(body)
    except json.JSONDecodeError as exc:
        XML_OUTPUT_PATH.write_text(body, encoding="utf-8")
        print(
            "JSON parsing failed; saved the raw XML/text response for inspection. "
            f"Parser message: {exc.msg}"
        )
        print_xml_or_text_summary(status_code, body, XML_OUTPUT_PATH)
        return 0 if 200 <= status_code < 300 else 1

    JSON_OUTPUT_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print_json_summary(status_code, data, JSON_OUTPUT_PATH)
    return 0 if 200 <= status_code < 300 else 1


if __name__ == "__main__":
    raise SystemExit(main())
