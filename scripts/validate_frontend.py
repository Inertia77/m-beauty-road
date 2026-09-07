#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import shutil
import struct
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []


def err(message: str) -> None:
    errors.append(message)


def local_path(ref: str) -> str | None:
    value = (ref or '').strip()
    if not value or value.startswith('#') or value.startswith('//'):
        return None
    parts = urlsplit(value)
    if parts.scheme or parts.netloc:
        return None
    if parts.path.startswith('/'):
        err(f'absolute site-root URL is unsafe for GitHub Pages subpath: {value}')
        return None
    if '..' in Path(parts.path).parts:
        err(f'path traversal in frontend reference: {value}')
        return None
    return parts.path or None


class IndexParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: set[str] = set()
        self.refs: list[tuple[str, str]] = []
        self.meta: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs) -> None:
        data = dict(attrs)
        if data.get('id'):
            self.ids.add(data['id'])
        for key in ('href', 'src'):
            if data.get(key):
                self.refs.append((tag, data[key]))
        if tag == 'meta' and data.get('name') and data.get('content') is not None:
            self.meta[data['name']] = data['content']


def png_size(path: Path) -> tuple[int, int] | None:
    try:
        data = path.read_bytes()[:24]
        if len(data) < 24 or data[:8] != b'\x89PNG\r\n\x1a\n':
            err(f'{path.relative_to(ROOT)} is not a valid PNG')
            return None
        return struct.unpack('>II', data[16:24])
    except OSError as exc:
        err(f'{path.relative_to(ROOT)}: {exc}')
        return None


def check_file(path: str, label: str) -> None:
    target = ROOT / path
    if not target.is_file():
        err(f'{label}: missing {path}')


def validate_index() -> IndexParser:
    parser = IndexParser()
    parser.feed((ROOT / 'index.html').read_text(encoding='utf-8'))

    required_ids = {
        'mainContent', 'beautyView', 'journeyView', 'heroCard',
        'photoCount', 'entryCount', 'yearCount', 'updatedAt', 'entries',
        'journeyCount', 'cityCount', 'countryCount', 'stopCount',
        'journeyUpdatedAt', 'journeys', 'lightbox', 'lightboxImg',
        'lightboxCaption', 'lightboxMeta', 'prevPhoto', 'nextPhoto',
        'closeLightbox', 'installHelp', 'howToInstall', 'closeInstallHelp',
        'installBtn'
    }
    for missing in sorted(required_ids - parser.ids):
        err(f'index.html: missing required id #{missing}')

    for tag, ref in parser.refs:
        path = local_path(ref)
        if path:
            check_file(path, f'index.html <{tag}>')

    if parser.meta.get('robots') != 'noindex,nofollow,noarchive':
        err('index.html: robots meta must remain noindex,nofollow,noarchive')
    return parser


def validate_manifest(index: IndexParser) -> None:
    try:
        manifest = json.loads((ROOT / 'manifest.webmanifest').read_text(encoding='utf-8'))
    except Exception as exc:
        err(f'manifest.webmanifest: {exc}')
        return

    if manifest.get('display') != 'standalone':
        err('manifest.webmanifest: display must be standalone')
    if manifest.get('scope') != './':
        err('manifest.webmanifest: scope must be ./ for GitHub Pages')
    if not str(manifest.get('start_url', '')).startswith('./'):
        err('manifest.webmanifest: start_url must be relative')
    if manifest.get('theme_color') != index.meta.get('theme-color'):
        err('manifest.webmanifest: theme_color must match index theme-color')

    seen: set[tuple[str, str]] = set()
    for icon in manifest.get('icons', []):
        src = local_path(str(icon.get('src', '')))
        sizes = str(icon.get('sizes', ''))
        purpose = str(icon.get('purpose', 'any'))
        if not src:
            err('manifest.webmanifest: icon src must be a local relative path')
            continue
        check_file(src, 'manifest icon')
        match = re.fullmatch(r'(\d+)x(\d+)', sizes)
        if not match:
            err(f'manifest.webmanifest: invalid icon sizes {sizes!r}')
            continue
        expected = (int(match.group(1)), int(match.group(2)))
        actual = png_size(ROOT / src)
        if actual and actual != expected:
            err(f'{src}: declared {expected[0]}x{expected[1]}, actual {actual[0]}x{actual[1]}')
        seen.add((sizes, purpose))

    for required in {('192x192', 'any'), ('512x512', 'any'), ('512x512', 'maskable')}:
        if required not in seen:
            err(f'manifest.webmanifest: missing icon variant {required[0]} purpose={required[1]}')

    apple = ROOT / 'assets' / 'apple-touch-icon-180.png'
    if apple.is_file() and png_size(apple) != (180, 180):
        err('assets/apple-touch-icon-180.png must be 180x180')


def validate_service_worker() -> None:
    sw = (ROOT / 'sw.js').read_text(encoding='utf-8')
    match = re.search(r'const CORE = \[(.*?)\];', sw, re.S)
    if not match:
        err('sw.js: CORE precache list not found')
        return
    core = set(re.findall(r"url\('([^']*)'\)", match.group(1)))
    required = {
        'index.html', 'assets/app.css', 'assets/lux.css', 'assets/interactions.css',
        'assets/app.js', 'assets/interactions.js', 'data/photos.json',
        'data/journeys.json', 'manifest.webmanifest', 'assets/icon-192.png',
        'assets/icon-512.png', 'assets/apple-touch-icon-180.png',
        'assets/maskable-icon-512.png'
    }
    for missing in sorted(required - core):
        err(f'sw.js: CORE missing {missing}')
    for path in sorted(core - {''}):
        check_file(path, 'sw.js CORE')


def validate_javascript() -> None:
    node = shutil.which('node')
    if not node:
        if os.environ.get('GITHUB_ACTIONS'):
            err('node executable is required for JavaScript syntax checks in CI')
        else:
            print('Frontend / PWA note: node not found; skipped JavaScript syntax check')
        return
    for relative in ('assets/app.js', 'assets/interactions.js'):
        result = subprocess.run(
            [node, '--check', str(ROOT / relative)],
            text=True,
            capture_output=True,
            check=False,
        )
        if result.returncode:
            detail = (result.stderr or result.stdout).strip()
            err(f'{relative}: JavaScript syntax check failed\n{detail}')


def validate_repository_hygiene() -> None:
    for stale in (ROOT / 'assets').rglob('*.b64'):
        err(f'obsolete base64 staging file must not be committed: {stale.relative_to(ROOT)}')
    for required in (
        'assets/icon-source.svg', 'scripts/generate_icons.py',
        'data/photos.schema.json', 'data/journeys.schema.json'
    ):
        check_file(required, 'repository')


def main() -> int:
    index = validate_index()
    validate_manifest(index)
    validate_service_worker()
    validate_javascript()
    validate_repository_hygiene()
    if errors:
        print('Frontend / PWA validation failed:')
        for item in errors:
            print(' -', item)
        return 1
    print('Frontend / PWA OK: references, icons, cache core, JavaScript and repository hygiene are consistent')
    return 0


if __name__ == '__main__':
    sys.exit(main())
