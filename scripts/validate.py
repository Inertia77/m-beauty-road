#!/usr/bin/env python3
from __future__ import annotations
import json, subprocess, sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []
try:
    from PIL import Image
except ImportError:
    Image = None
try:
    from jsonschema import Draft202012Validator, FormatChecker
except ImportError:
    Draft202012Validator = None

def err(msg): errors.append(msg)
def load(name):
    try: return json.loads((ROOT / 'data' / name).read_text(encoding='utf-8'))
    except Exception as e: err(f'{name}: {e}'); return {}
def iso(v, label, nullable=False):
    if v is None and nullable: return
    if not isinstance(v, str) or not v: return err(f'{label}: expected ISO date-time')
    try: datetime.fromisoformat(v.replace('Z','+00:00'))
    except ValueError: err(f'{label}: invalid ISO date-time {v}')
def file(v, label, required=True):
    if v is None and not required: return
    if not isinstance(v, str) or not v.startswith('assets/') or '..' in v: return err(f'{label}: invalid asset path')
    p = (ROOT / v).resolve()
    try: p.relative_to(ROOT)
    except ValueError: return err(f'{label}: escapes repository')
    if not p.is_file(): err(f'{label}: missing {v}')
def image_check(path,label,expected=None):
    if Image is None or not isinstance(path,str) or not path.startswith('assets/') or '..' in path: return
    target=(ROOT/path).resolve()
    if not target.is_relative_to(ROOT) or not target.is_file(): return
    try:
        with Image.open(target) as im:
            im.load()
            if expected and all(type(n) is int for n in expected) and im.size != expected:
                err(f'{label}: declared {expected}, actual {im.size}')
    except Exception as exc: err(f'{label}: cannot decode image: {exc}')

def schema_check(data,name):
    if Draft202012Validator is None: return
    schema=json.loads((ROOT/'data'/name).read_text(encoding='utf-8'))
    for issue in Draft202012Validator(schema,format_checker=FormatChecker()).iter_errors(data):
        err(f'{name}: {issue.json_path}: {issue.message}')

def photo(p, label):
    if not isinstance(p, dict): return err(f'{label}: must be object')
    file(p.get('src'), f'{label}.src'); file(p.get('thumb'), f'{label}.thumb')
    image_check(p.get('src'),f'{label}.src',(p.get('width'),p.get('height')))
    image_check(p.get('thumb'),f'{label}.thumb',(p.get('thumbWidth'),p.get('thumbHeight')))
    if p.get('src') == p.get('thumb') and all(type(p.get(k)) is int for k in ('width','height','thumbWidth','thumbHeight')) and (p['width'],p['height']) != (p['thumbWidth'],p['thumbHeight']): err(f'{label}: identical paths with conflicting dimensions')
    if p.get('capturedAt') is not None: iso(p.get('capturedAt'), f'{label}.capturedAt', True)
    for k in ('width','height','thumbWidth','thumbHeight'):
        if k in p and (type(p[k]) is not int or p[k] <= 0): err(f'{label}.{k}: expected positive integer')
    for k in ('alt','caption'):
        if not isinstance(p.get(k), str) or not p.get(k): err(f'{label}.{k}: required')

def validate_beauty(d):
    if d.get('schemaVersion') != 2: err('photos.json: schemaVersion must be 2')
    iso(d.get('updatedAt'), 'photos.updatedAt')
    entries = d.get('entries', [])
    if not isinstance(entries, list): err('photos.entries: must be array'); return 0,0
    seen=set(); count=0
    for i,e in enumerate(entries):
        x=f'photos.entries[{i}]'
        if not isinstance(e,dict): err(f'{x}: must be object'); continue
        id=e.get('id')
        if not isinstance(id,str) or not id.strip(): err(f'{x}.id: required')
        elif id in seen: err(f'{x}.id: duplicate {id}')
        else: seen.add(id)
        if not isinstance(e.get('title'),str) or not e['title'].strip(): err(f'{x}.title: required')
        iso(e.get('capturedAt'), f'{x}.capturedAt', True)
        if e.get('sourceTime') is not None: iso(e.get('sourceTime'), f'{x}.sourceTime', True)
        iso(e.get('importedAt'), f'{x}.importedAt')
        file(e.get('cover'), f'{x}.cover', False); file(e.get('coverThumb'), f'{x}.coverThumb', False)
        photos=e.get('photos', [])
        if not isinstance(photos,list): err(f'{x}.photos: must be array'); continue
        ci=e.get('coverIndex',0)
        if not isinstance(ci,int) or ci<0 or (photos and ci>=len(photos)): err(f'{x}.coverIndex: invalid')
        for j,p in enumerate(photos): photo(p, f'{x}.photos[{j}]'); count += 1
        src=e.get('source')
        if isinstance(src,dict): file(src.get('src'),f'{x}.source.src',False); file(src.get('thumb'),f'{x}.source.thumb',False)
    return len(entries),count

def validate_journeys(d):
    if d.get('schemaVersion') != 1: err('journeys.json: schemaVersion must be 1')
    if d.get('updatedAt') is not None: iso(d.get('updatedAt'),'journeys.updatedAt',True)
    items=d.get('journeys',[])
    if not isinstance(items,list): err('journeys.journeys: must be array'); return 0
    seen=set()
    for i,j in enumerate(items):
        x=f'journeys.journeys[{i}]'
        if not isinstance(j,dict): err(f'{x}: must be object'); continue
        id=j.get('id')
        if not isinstance(id,str) or not id.strip(): err(f'{x}.id: required')
        elif id in seen: err(f'{x}.id: duplicate {id}')
        else: seen.add(id)
        if not j.get('title'): err(f'{x}.title: required')
        for k in ('startAt','endAt'):
            if j.get(k) is not None: iso(j.get(k),f'{x}.{k}',True)
        if j.get('startAt') and j.get('endAt'):
            try:
                if datetime.fromisoformat(j['endAt'].replace('Z','+00:00')) < datetime.fromisoformat(j['startAt'].replace('Z','+00:00')): err(f'{x}: endAt precedes startAt')
            except (ValueError, TypeError, AttributeError): err(f'{x}: incompatible date-time values')
        iso(j.get('importedAt'),f'{x}.importedAt')
        file(j.get('cover'),f'{x}.cover',False); file(j.get('coverThumb'),f'{x}.coverThumb',False)
        photos=j.get('photos',[])
        if not isinstance(photos,list): err(f'{x}.photos: must be array')
        else:
            for n,p in enumerate(photos): photo(p,f'{x}.photos[{n}]')
        stops=j.get('stops',[])
        if not isinstance(stops,list): err(f'{x}.stops: must be array')
        else:
            for n,s in enumerate(stops):
                y=f'{x}.stops[{n}]'
                if not isinstance(s,dict) or not s.get('name'): err(f'{y}.name: required')
                else:
                    if s.get('visitedAt') is not None: iso(s.get('visitedAt'),f'{y}.visitedAt',True)
                    indexes=s.get('photoIndexes',[])
                    if not isinstance(indexes,list) or any(type(n) is not int or n<0 or not isinstance(photos,list) or n>=len(photos) for n in indexes): err(f'{y}.photoIndexes: invalid photo reference')
    return len(items)

def main():
    b=load('photos.json'); j=load('journeys.json')
    if not isinstance(b,dict) or not isinstance(j,dict): err('Archive root must be an object'); b=b if isinstance(b,dict) else {}; j=j if isinstance(j,dict) else {}
    schema_check(b,'photos.schema.json'); schema_check(j,'journeys.schema.json')
    if Image is None or Draft202012Validator is None: print('Note: install Pillow and jsonschema for full media/schema checks')
    e,p=validate_beauty(b); n=validate_journeys(j)
    if errors:
        print('Archive validation failed:')
        for x in errors: print(' -',x)
        return 1
    print(f'Archive OK: {e} beauty entries, {p} beauty photos, {n} journeys')
    frontend = subprocess.run([sys.executable, str(ROOT / 'scripts' / 'validate_frontend.py')], check=False)
    return frontend.returncode

if __name__ == '__main__': sys.exit(main())
