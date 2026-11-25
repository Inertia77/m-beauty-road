#!/usr/bin/env python3
"""Browser regression checks with a synthetic journey intercepted in memory."""
import functools
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'data/photos.json').read_text())
photos=data['entries'][0]['photos'][:2]
fixture={'schemaVersion':1,'journeys':[{'id':'fixture-only','title':'Test journey','photos':photos,'stops':[{'name':'Test stop','photoIndexes':[1]}]}]}
handler=functools.partial(SimpleHTTPRequestHandler,directory=str(ROOT))
with ThreadingHTTPServer(('127.0.0.1',0),handler) as server:
    threading.Thread(target=server.serve_forever,daemon=True).start()
    url=f'http://127.0.0.1:{server.server_port}/'
    with sync_playwright() as p:
        browser=p.chromium.launch()
        context=browser.new_context(viewport={'width':390,'height':844},service_workers='block')
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.route('**/data/journeys.json',lambda route:route.fulfill(json=fixture))
        page.goto(url+'#journeys')
        expect(page.locator('#journeyCount')).to_have_text('1')
        page.locator('[data-journey="fixture-only"]').click()
        expect(page.locator('.journey-photo')).to_have_count(3)
        page.locator('.journey-photo').first.click()
        expect(page.locator('#lightbox')).to_be_visible()
        expect(page.locator('#lightboxImg')).to_have_attribute('src',photos[1]['src'])
        page.locator('#nextPhoto').click()
        expect(page.locator('#lightboxImg')).to_have_attribute('src',photos[0]['src'])
        page.locator('#closeLightbox').click()
        expect(page.locator('#lightbox')).not_to_be_visible()
        page.locator('.mobile-tab[data-view-target="beauty"]').click()
        expect(page.locator('#beautyView')).to_be_visible()
        expect(page.locator('#photoCount')).to_have_text(str(sum(len(e['photos']) for e in data['entries'])))
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'horizontal overflow'
        page.unroute('**/data/journeys.json')
        page.route('**/data/journeys.json',lambda route:route.fulfill(status=503,body='Unavailable'))
        page.goto(url+'#journeys')
        expect(page.locator('#journeys .error-state')).to_be_visible()
        assert not errors, errors
        browser.close()
print('Browser regression OK')
