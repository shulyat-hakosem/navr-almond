# Headless smoke test of the desktop preview: every stage of the new flow, with screenshots.
import asyncio
from playwright.async_api import async_playwright
BASE = 'http://127.0.0.1:8080/index.html'
OUT = '/workspace/navr-almond/screens/'
async def main():
    errors = []; res = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True,
            args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
        async def page_for(q):
            pg = await b.new_page(viewport={'width': 1280, 'height': 800})
            pg.on('console', lambda m: (errors.append(f'[{q}] {m.type}: {m.text}') if m.type in ('error', 'warning') else None))
            pg.on('pageerror', lambda e: errors.append(f'[{q}] pageerror: {e}'))
            await pg.goto(BASE + q); await pg.wait_for_function('window.NAVR && window.NAVR.ready', timeout=30000)
            return pg
        pg = await page_for('')
        await pg.wait_for_timeout(500); await pg.screenshot(path=OUT + '00-enter-overlay.png')
        await pg.click('#enter-desktop'); await pg.wait_for_timeout(7000)
        res['stage_after_7s'] = await pg.evaluate('NAVR.stageName()')
        await pg.screenshot(path=OUT + '01-dark-voice.png')
        pg1 = await page_for('?stage=1&fast=1&autostart=desktop')
        await pg1.wait_for_function('NAVR.state.drawing', timeout=10000); await pg1.wait_for_timeout(600)
        await pg1.screenshot(path=OUT + '02-branch-drawing.png')
        await pg1.wait_for_function('NAVR.state.alive', timeout=20000); res['alive'] = True
        pg2 = await page_for('?stage=2&fast=1&autostart=desktop')
        await pg2.wait_for_function('NAVR.state.lettersReady', timeout=30000); await pg2.wait_for_timeout(800)
        await pg2.screenshot(path=OUT + '03-almond-letters.png')
        await pg2.evaluate("window.NAVR.placeWord('קדש')"); await pg2.wait_for_timeout(1200)
        await pg2.screenshot(path=OUT + '04-word-kodesh.png')
        res['word'] = await pg2.evaluate('NAVR.state.word')
        pg3 = await page_for('?stage=3&fast=1&autostart=desktop')
        await pg3.wait_for_function('NAVR.state.potShown', timeout=30000)
        await pg3.wait_for_function('NAVR.state.potFound', timeout=30000)   # desktop: hint, then the view turns north
        res['pot_hint_given'] = await pg3.evaluate('!!NAVR.state.potHint')
        await pg3.wait_for_function('NAVR.state.potVerseShown', timeout=30000); await pg3.wait_for_timeout(1500)
        await pg3.screenshot(path=OUT + '05-pot.png')
        res['boil'] = await pg3.evaluate('NAVR.potBoil()')
        await pg3.wait_for_function('NAVR.state.done', timeout=90000)
        await pg3.wait_for_timeout(2500); await pg3.screenshot(path=OUT + '06-exit.png')
        res['done'] = True
        await b.close()
    print(res)
    real = [e for e in errors if 'AudioContext was not allowed' not in e]
    print('\n'.join(real) or 'NO console errors/warnings')
asyncio.run(main())
