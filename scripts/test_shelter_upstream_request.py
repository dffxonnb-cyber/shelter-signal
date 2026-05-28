"""Diagnose the data.go.kr shelter upstream request without printing the key."""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = PROJECT_ROOT / ".env"
ENDPOINT = "https://apis.data.go.kr/1543061/animalShelterSrvc_v2/shelterInfo_v2"
DEFAULT_PARAMS = {
    "pageNo": "1",
    "numOfRows": "10",
    "_type": "json",
    "upr_cd": "6410000",
    "org_cd": "3780000",
}
TIMEOUT_SECONDS = 20


def load_dotenv(path: Path) -> dict[str, str]:
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


def get_service_key() -> str:
    env_values = load_dotenv(ENV_PATH)
    return (env_values.get("DATA_GO_KR_SERVICE_KEY") or os.environ.get("DATA_GO_KR_SERVICE_KEY") or "").strip()


def normalize_service_key_for_query(service_key: str) -> tuple[str, bool]:
    trimmed = service_key.strip().strip('"').strip("'")
    if not re.search(r"%[0-9a-fA-F]{2}", trimmed):
        return trimmed, False
    try:
        return urllib.parse.unquote(trimmed), True
    except Exception:
        return trimmed, False


def build_url(service_key: str) -> tuple[str, bool]:
    normalized_key, decoded_once = normalize_service_key_for_query(service_key)
    query = urllib.parse.urlencode({"serviceKey": normalized_key, **DEFAULT_PARAMS})
    return f"{ENDPOINT}?{query}", decoded_once


def request_once(url: str) -> tuple[int, str, str]:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json, application/xml;q=0.9, text/plain;q=0.8",
            "User-Agent": "shelter-signal-shelter-upstream-diagnostic/0.1",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            body = response.read().decode("utf-8", errors="replace")
            return response.status, response.headers.get("Content-Type", ""), body
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return exc.code, exc.headers.get("Content-Type", ""), body


def nested_get(data: Any, path: tuple[str, ...]) -> Any:
    current = data
    for key in path:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def parse_error_message(body: str) -> tuple[str | None, str | None]:
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        data = None

    if isinstance(data, dict):
        code = nested_get(data, ("response", "header", "resultCode")) or data.get("resultCode")
        message = nested_get(data, ("response", "header", "resultMsg")) or data.get("resultMsg")
        return str(code) if code else None, str(message) if message else None

    try:
        root = ET.fromstring(body)
    except ET.ParseError:
        return None, None

    code = find_xml_text(root, {"resultCode", "returnReasonCode"})
    message = find_xml_text(root, {"resultMsg", "errMsg", "returnAuthMsg"})
    return code, message


def find_xml_text(root: ET.Element, names: set[str]) -> str | None:
    for element in root.iter():
        tag = element.tag.rsplit("}", 1)[-1]
        if tag in names and element.text:
            return element.text.strip()
    return None


def sanitize_snippet(body: str) -> str:
    return (
        re.sub(r"serviceKey=([^&\s<>\"']+)", "serviceKey=[redacted]", body, flags=re.IGNORECASE)
        .replace("\r", " ")
        .replace("\n", " ")
        .strip()[:800]
    )


def main() -> int:
    service_key = get_service_key()
    print(f"DATA_GO_KR_SERVICE_KEY present: {bool(service_key)}")
    if not service_key:
        print("No local DATA_GO_KR_SERVICE_KEY found in environment or .env.")
        return 1

    url, decoded_once = build_url(service_key)
    safe_url = re.sub(r"serviceKey=([^&]+)", "serviceKey=[redacted]", url)
    print(f"Decode-once applied: {decoded_once}")
    print(f"Endpoint: {ENDPOINT}")
    print(f"Request URL: {safe_url}")
    print(f"Request params without key: {DEFAULT_PARAMS}")

    status, content_type, body = request_once(url)
    error_code, error_message = parse_error_message(body)
    print(f"Status code: {status}")
    print(f"Content-Type: {content_type or '(none)'}")
    if error_code or error_message:
        print(f"Public-data error: {error_code or '(no code)'} {error_message or ''}".strip())
    print(f"Sanitized body snippet: {sanitize_snippet(body)}")
    return 0 if 200 <= status < 300 else 2


if __name__ == "__main__":
    sys.exit(main())
