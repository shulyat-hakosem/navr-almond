# WebXR session-path test using Meta's IWER (Immersive Web Emulation Runtime):
# emulated Quest 2 → Enter VR → controller grab & snap → hand-tracking pinch grab → Enter AR.
import asyncio, json
from playwright.async_api import async_playwright
BASE = 'http://127.0.0.1:8080/index.html'
IWER = open('/workspace/navr-almond/tests/iwer.min.js').read()
INIT = IWER + "\n;window.__xr = new IWER.XRDevice(IWER.metaQuest2); window.__xr.installRuntime({ forceInstall: true });"
async def main():
    errs = []; res = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
        async def open_(q):
            pg = await b.new_page(viewport={'width': 1280, 'height': 800})
            pg.on('console', lambda m: errs.append(f'{q} {m.type}: {m.text}') if m.type in ('error','warning') else None)
            pg.on('pageerror', lambda e: errs.append(f'{q} pageerror: {e}'))
            await pg.add_init_script(INIT)
            await pg.goto(BASE + q); await pg.wait_for_function('window.NAVR && NAVR.ready', timeout=30000)
            return pg
        pg = await open_('?stage=2&fast=1')
        res['vr_button_enabled'] = await pg.evaluate("!document.getElementById('enter-vr').disabled")
        res['ar_button_shown'] = await pg.evaluate("!document.getElementById('enter-ar').hidden")
        await pg.click('#enter-vr')
        await pg.wait_for_function('NAVR.presenting()', timeout=15000)
        res['vr_presenting'] = True
        await pg.wait_for_function('NAVR.state.lettersReady', timeout=30000)
        await pg.wait_for_timeout(800)
        res['inputs_controller_mode'] = await pg.evaluate('NAVR.inputs()')
        # ── controller: touch-grab ש, carry it to slot 0 (rightmost), release ──
        lp = await pg.evaluate("NAVR.letterPos('ש')"); sp = await pg.evaluate('NAVR.slotPos(0)')
        await pg.evaluate(f"(()=>{{const c=__xr.controllers.right; c.position.set({lp[0]},{lp[1]},{lp[2]}+0.02); }})()")
        await pg.wait_for_timeout(300)
        await pg.evaluate("__xr.controllers.right.updateButtonValue('trigger', 1)")
        await pg.wait_for_timeout(300)
        res['ctrl_grabbed'] = await pg.evaluate("NAVR.letterHeld('ש')")
        await pg.evaluate(f"__xr.controllers.right.position.set({sp[0]},{sp[1]},{sp[2]}+0.02)")
        await pg.wait_for_timeout(300)
        await pg.evaluate("__xr.controllers.right.updateButtonValue('trigger', 0)")
        await pg.wait_for_timeout(500)
        res['ctrl_snapped_slot'] = await pg.evaluate("NAVR.letterSlot('ש')")
        # ── controller brushes through the branch → tremble + shed petals ──
        bp = await pg.evaluate('NAVR.branchPoint(12)')
        for k in range(12):
            x = bp[0] - 0.15 + k * 0.025
            await pg.evaluate(f"__xr.controllers.right.position.set({x},{bp[1]},{bp[2]})")
            await pg.wait_for_timeout(60)
        await pg.wait_for_timeout(300)
        res['branch_touch'] = await pg.evaluate('NAVR.branchStats()')
        # ── hand tracking: pinch-grab ק and drop into slot 1 ──
        await pg.evaluate("__xr.primaryInputMode = 'hand'")
        await pg.wait_for_timeout(600)
        res['inputs_hand_mode'] = await pg.evaluate('NAVR.inputs()')
        lp = await pg.evaluate("NAVR.letterPos('ק')"); sp = await pg.evaluate('NAVR.slotPos(1)')
        # find hand offset so that the pinch point sits on the letter
        async def place_pinch(target):
            for _ in range(3):
                await pg.wait_for_timeout(200)
                gp = await pg.evaluate("(()=>{const s=window.__pinchProbe&&0; return null})()")
                d = await pg.evaluate("""(t)=>{ const h=__xr.hands.right; return [h.position.x,h.position.y,h.position.z]; }""", target)
                break
            await pg.evaluate(f"__xr.hands.right.position.set({target[0]},{target[1]},{target[2]}+0.05)")
        await place_pinch(lp)
        await pg.wait_for_timeout(300)
        await pg.evaluate("__xr.hands.right.updatePinchValue(1)")
        await pg.wait_for_timeout(400)
        res['hand_grabbed'] = await pg.evaluate("NAVR.letterHeld('ק')")
        await place_pinch(sp)
        await pg.wait_for_timeout(400)
        await pg.evaluate("__xr.hands.right.updatePinchValue(0)")
        await pg.wait_for_timeout(500)
        res['hand_snapped_slot'] = await pg.evaluate("NAVR.letterSlot('ק')")
        res['hand_debug'] = {'slot1': sp, 'letter_after': await pg.evaluate("NAVR.letterPos('ק')"), 'start': lp}
        await pg.screenshot(path='/workspace/navr-almond/screens/xr-emulated-quest2.png')
        # ── turning north: the pot is behind the learner; hint after ~10 s (1 s in fast mode), found by turning ──
        pg3 = await open_('?stage=3&fast=1')
        await pg3.click('#enter-vr'); await pg3.wait_for_function('NAVR.presenting()', timeout=15000)
        await pg3.wait_for_function('NAVR.state.potShown', timeout=30000)
        res['looking_at_pot_before_turn'] = await pg3.evaluate('NAVR.lookingAtPot()')
        await pg3.wait_for_function('NAVR.state.potHint', timeout=20000); res['hint_given'] = True
        c = await pg3.evaluate('NAVR.potCenter()'); h = await pg3.evaluate('NAVR.headPos()')
        import math
        yaw = math.atan2(-(c[0] - h[0]), -(c[2] - h[2]))
        await pg3.evaluate(f"__xr.quaternion.set(0, {math.sin(yaw/2)}, 0, {math.cos(yaw/2)})")
        await pg3.wait_for_function('NAVR.state.potFound', timeout=10000)
        res['pot_found_by_turning'] = True
        await pg3.wait_for_function('NAVR.state.stage===4', timeout=10000); res['pot_stage'] = True
        await pg3.wait_for_timeout(1500)
        res['boil_still'] = await pg3.evaluate('NAVR.potBoil()')
        await pg3.screenshot(path='/workspace/navr-almond/screens/xr-emulated-quest2-pot.png')
        # ── AR (passthrough) session ──
        pg2 = await open_('?stage=5&fast=1')
        if res['ar_button_shown']:
            await pg2.click('#enter-ar'); await pg2.wait_for_function('NAVR.presenting()', timeout=15000)
            res['ar_presenting'] = await pg2.evaluate('NAVR.sessionMode()')
            await pg2.wait_for_function('NAVR.state.done', timeout=60000); res['ar_lesson_done'] = True
        await b.close()
    print(json.dumps(res, ensure_ascii=False, indent=1)); print('\n'.join(errs) or 'NO console errors/warnings')
asyncio.run(main())
