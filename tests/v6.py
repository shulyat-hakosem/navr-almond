# v6 flow test: title cards, listening guide (mocked SpeechRecognition + real fallback), boiling pot,
# into the pot, army + fulfilment, end. Screenshots → screens/v6-test-*.png
import asyncio
from playwright.async_api import async_playwright
BASE = 'http://127.0.0.1:8080/index.html'
OUT = '/workspace/navr-almond/screens/'
MOCK = """(() => { const said = %s;
  class FakeSR { constructor(){ this.lang=''; } start(){ setTimeout(() => {
      const alt = { transcript: said }; const r = [alt]; r.isFinal = true;
      this.onresult && this.onresult({ results: [r] }); setTimeout(() => this.onend && this.onend(), 50); }, 400); }
    abort(){} stop(){} }
  window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR; })();"""
async def main():
    errors = []; res = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True,
            args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
        async def page_for(q, said=None):
            ctx = await b.new_context(viewport={'width': 1280, 'height': 800})
            if said is not None: await ctx.add_init_script(MOCK % repr(said))
            pg = await ctx.new_page()
            pg.on('console', lambda m: (errors.append(f'[{q}] {m.type}: {m.text}') if m.type in ('error', 'warning') else None))
            pg.on('pageerror', lambda e: errors.append(f'[{q}] pageerror: {e}'))
            await pg.goto(BASE + q); await pg.wait_for_function('window.NAVR && window.NAVR.ready', timeout=30000)
            return pg
        # 1 · almond title card + listening (mock says "ענף של שקד")
        pg = await page_for('?fast=1&autostart=desktop', 'אני רואה ענף עם פרחים')
        await pg.wait_for_function("NAVR.state.titleShown === 'almond'", timeout=30000); await pg.wait_for_timeout(1200)
        await pg.screenshot(path=OUT + 'v6-test-1-title-almond.png')
        await pg.wait_for_function("NAVR.state.response", timeout=60000)
        res['almond_heard'] = await pg.evaluate('NAVR.state.heard'); res['almond_response'] = await pg.evaluate('NAVR.state.response')
        await pg.wait_for_function("NAVR.state.lettersReady", timeout=60000)
        # 2 · pot title card in the dark (stage 3)
        pg3 = await page_for('?stage=3&fast=1&autostart=desktop', 'הכל זורם לכיוון שלי')
        await pg3.wait_for_function("NAVR.state.titleShown === 'pot'", timeout=30000); await pg3.wait_for_timeout(1200)
        await pg3.screenshot(path=OUT + 'v6-test-2-title-pot.png')
        await pg3.wait_for_function('NAVR.state.potVerseShown', timeout=60000); await pg3.wait_for_timeout(800)
        await pg3.screenshot(path=OUT + 'v6-test-3-pot.png')
        res['pot_response'] = await pg3.evaluate('NAVR.state.response')
        await pg3.wait_for_function('NAVR.state.intoDescended', timeout=90000)
        await pg3.screenshot(path=OUT + 'v6-test-4-into.png')
        await pg3.wait_for_function('NAVR.state.swallowed', timeout=30000)
        await pg3.wait_for_function("NAVR.state.titleShown === 'fulfil'", timeout=30000); await pg3.wait_for_timeout(1200)
        await pg3.screenshot(path=OUT + 'v6-test-5-fulfil.png')
        await pg3.wait_for_function('NAVR.state.done', timeout=90000); await pg3.wait_for_timeout(2500)
        await pg3.screenshot(path=OUT + 'v6-test-6-end.png')
        res['titles'] = await pg3.evaluate('NAVR.state.titles'); res['army'] = await pg3.evaluate('!!NAVR.state.army')
        res['spoken_tail'] = await pg3.evaluate('NAVR.state.spoken.slice(-8)')
        # 3 · fallback: no SpeechRecognition at all → the old pause, lesson continues
        ctx = await b.new_context(); await ctx.add_init_script("delete window.SpeechRecognition; delete window.webkitSpeechRecognition;")
        pf = await ctx.new_page(); pf.on('pageerror', lambda e: errors.append(f'[fallback] pageerror: {e}'))
        await pf.goto(BASE + '?stage=2&fast=1&autostart=desktop'); await pf.wait_for_function('NAVR.state.lettersReady', timeout=60000)
        res['fallback_ok'] = (await pf.evaluate('NAVR.state.response')) is None
        # 4 · real headless SR (no service) → must also fall back
        pr = await page_for('?stage=2&fast=1&autostart=desktop'); await pr.wait_for_function('NAVR.state.lettersReady', timeout=60000)
        res['real_sr_ok'] = True
        res['voices'] = await pr.evaluate('NAVR.voicesLoaded()')
        await b.close()
    print(res)
    real = [e for e in errors if 'AudioContext was not allowed' not in e]
    print('\n'.join(real) or 'NO console errors/warnings')
asyncio.run(main())
