#!/usr/bin/env python3
"""Create sanitized, immutable media assets from explicitly approved public images."""
import argparse
import hashlib
import io
import json
from datetime import datetime
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]

def process(path, module):
    directory = ROOT / 'assets' / ('photos' if module == 'beauty' else 'journeys')
    directory.mkdir(parents=True, exist_ok=True)
    with Image.open(path) as source:
        source.load()
        captured = None
        try:
            exif = source.getexif().get_ifd(34665)
            timestamp, offset = exif.get(36867), exif.get(36881)
            if timestamp and offset:
                captured = datetime.strptime(timestamp + offset, '%Y:%m:%d %H:%M:%S%z').isoformat()
        except (ValueError, TypeError, AttributeError):
            pass
        original = ImageOps.exif_transpose(source).convert('RGB')
    def variant(limit, quality):
        image = original.copy()
        image.thumbnail((limit, limit), Image.Resampling.LANCZOS)
        # A fresh pixel-only image ensures metadata is not copied.
        clean = Image.new('RGB', image.size)
        clean.paste(image)
        buffer = io.BytesIO()
        clean.save(buffer, 'WEBP', quality=quality, method=6)
        raw = buffer.getvalue()
        digest = hashlib.sha256(raw).hexdigest()[:24]
        dest = directory / (digest + '.webp')
        if dest.exists() and dest.read_bytes() != raw:
            raise ValueError('Hash collision: ' + str(dest))
        if not dest.exists():
            dest.write_bytes(raw)
        return dest.relative_to(ROOT).as_posix(), *image.size
    full,w,h = variant(2160, 88)
    if max(w,h) <= 640:
        thumb,tw,th = full,w,h
    else:
        thumb,tw,th = variant(640, 82)
    return dict(src=full,thumb=thumb,width=w,height=h,thumbWidth=tw,thumbHeight=th,alt='',caption='',capturedAt=captured)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--module',choices=['beauty','journeys'],required=True)
    parser.add_argument('--approved-public',action='store_true',required=True,help='Confirm visual content is safe and approved for public release')
    parser.add_argument('images',nargs='+',type=Path)
    args=parser.parse_args()
    print(json.dumps([process(p,args.module) for p in args.images],ensure_ascii=False,indent=2))

if __name__=='__main__':
    main()
