#!/usr/bin/env python3
"""Validate the photo archive using only Python's standard library."""
from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "data" / "photos.json"
errors: list[str] = []


def error(message: str) -> None:
    errors.append(message)


def valid_iso(value, label: str, *, nullable: bool = False) -> None:
    if value is None and nullable:
        return
    if not isinstance(value, str) or not value:
        error(f"{label}: expected ISO date-time string")
        return
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        error(f"{label}: invalid ISO date-time: {value}")


def valid_asset(value, label: str) -> None:
    if not isinstance(value, str) or not value.startswith("assets/photos/") or ".." in value:
        error(f"{label}: invalid local asset path: {value!r}")
        return
    target = (ROOT / value).resolve()
    try:
        target.relative_to(ROOT)
    except ValueError:
        error(f"{label}: asset escapes repository root")
        return
    if not target.is_file():
        error(f"{label}: missing file: {value}")


def main() -> int:
    try:
        data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"ERROR: cannot read {DATA_FILE}: {exc}")
        return 1

    if data.get("schemaVersion") != 2:
        error("schemaVersion must be 2")
    valid_iso(data.get("updatedAt"), "updatedAt")

    entries = data.get("entries")
    if not isinstance(entries, list):
        error("entries must be an array")
        entries = []

    seen_ids: set[str] = set()
    photo_count = 0
    for index, entry in enumerate(entries):
        prefix = f"entries[{index}]"
        if not isinstance(entry, dict):
            error(f"{prefix}: must be an object")
            continue
        entry_id = entry.get("id")
        if not isinstance(entry_id, str) or not entry_id:
            error(f"{prefix}.id: required non-empty string")
        elif entry_id in seen_ids:
            error(f"{prefix}.id: duplicate id {entry_id!r}")
        else:
            seen_ids.add(entry_id)

        if not isinstance(entry.get("title"), str) or not entry.get("title"):
            error(f"{prefix}.title: required non-empty string")
        valid_iso(entry.get("capturedAt"), f"{prefix}.capturedAt", nullable=True)
        if entry.get("sourceTime") is not None:
            valid_iso(entry.get("sourceTime"), f"{prefix}.sourceTime", nullable=True)
        valid_iso(entry.get("importedAt"), f"{prefix}.importedAt")

        for key in ("cover", "coverThumb"):
            if entry.get(key):
                valid_asset(entry[key], f"{prefix}.{key}")

        photos = entry.get("photos")
        if not isinstance(photos, list):
            error(f"{prefix}.photos: must be an array")
            continue
        cover_index = entry.get("coverIndex", 0)
        if not isinstance(cover_index, int) or cover_index < 0 or (photos and cover_index >= len(photos)):
            error(f"{prefix}.coverIndex: must point to an existing photo")
        for photo_index, photo in enumerate(photos):
            photo_count += 1
            pfx = f"{prefix}.photos[{photo_index}]"
            if not isinstance(photo, dict):
                error(f"{pfx}: must be an object")
                continue
            valid_asset(photo.get("src"), f"{pfx}.src")
            valid_asset(photo.get("thumb"), f"{pfx}.thumb")
            for key in ("alt", "caption"):
                if not isinstance(photo.get(key), str) or not photo.get(key):
                    error(f"{pfx}.{key}: required non-empty string")

        source = entry.get("source")
        if isinstance(source, dict):
            if source.get("src"):
                valid_asset(source["src"], f"{prefix}.source.src")
            if source.get("thumb"):
                valid_asset(source["thumb"], f"{prefix}.source.thumb")

    if errors:
        print("Archive validation failed:")
        for message in errors:
            print(f" - {message}")
        return 1

    print(f"Archive OK: {len(entries)} entries, {photo_count} photos, schema v2")
    return 0


if __name__ == "__main__":
    sys.exit(main())
