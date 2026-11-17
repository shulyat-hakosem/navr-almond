# v7 flow test: short pot title card, cold pot that heats, gaze-into-the-mouth (desktop auto-turn), swallowed,
# inside the pot (army shadows), end.  `python3 tests/v7.py` (fast)  ·  `python3 tests/v7.py real` (real time, timings)
import asyncio, sys
from playwright.async_api import async_playwright
BASE = 'http://127.0.0.1:8080/index.html'; OUT = '/workspace/navr-almond/screens/'
REAL = len(sys.argv) > 1 and sys.argv[1] == 'real'
async def main():
    errors = []; res = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True,
            args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1280, 'height': 800})
        await ctx.add_init_script("delete window.SpeechRecognition; delete window.webkitSpeechRecognition;")
        pg = await ctx.new_page()
        pg.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        await pg.goto(BASE + ('?stage=3&autostart=desktop' if REAL else '?stage=3&fast=1&autostart=desktop'))
        await pg.wait_for_function('window.NAVR && window.NAVR.ready', timeout=30000)
        T = 900000 if REAL else 120000
        await pg.wait_for_function("NAVR.state.titleShown === 'pot'", timeout=T); await pg.wait_for_timeout(1500 if REAL else 300)
        if not REAL: await pg.screenshot(path=OUT + 'v7-test-1-title-pot.png')
        await pg.wait_for_function("NAVR.state.potFound", timeout=T)
        res['heat_found'] = await pg.evaluate('NAVR.potHeat()')
        if not REAL: await pg.screenshot(path=OUT + 'v7-test-2-pot-cold.png')
        await pg.wait_for_function('NAVR.state.potVerseShown', timeout=T)
        res['heat_verse'] = await pg.evaluate('NAVR.potHeat()')
        await pg.wait_for_function('NAVR.state.gazeWait', timeout=T)
        res['heat_gaze'] = await pg.evaluate('NAVR.potHeat()')
        if not REAL: await pg.screenshot(path=OUT + 'v7-test-3-pot-hot.png')
        await pg.wait_for_function('NAVR.state.swallowed', timeout=T)
        res['dwell'] = await pg.evaluate('NAVR.state.dwell')
        await pg.wait_for_function('NAVR.state.army', timeout=T); await pg.wait_for_timeout(9000 if REAL else 1200)
        if not REAL: await pg.screenshot(path=OUT + 'v7-test-4-inside.png')
        await pg.wait_for_function('NAVR.state.done', timeout=T); await pg.wait_for_timeout(1500)
        if not REAL: await pg.screenshot(path=OUT + 'v7-test-5-end.png')
        res['t'] = await pg.evaluate('NAVR.state.t'); res['spoken'] = await pg.evaluate('NAVR.state.spoken')
        res['voices'] = await pg.evaluate('NAVR.voicesLoaded()')
        await b.close()
    print(res)
    real = [e for e in errors if 'AudioContext was not allowed' not in e]
    print('\n'.join(real) or 'NO console errors/warnings')
asyncio.run(main())
