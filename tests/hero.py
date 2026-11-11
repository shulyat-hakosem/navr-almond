# Renders the hero still: 2560x1440, rendered at 1.5x (3840x2160) and downsampled (supersampling AA).
import asyncio
from playwright.async_api import async_playwright
from PIL import Image
import sys
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/navr-almond/screens/v5-03-branch-full.png'
Q = sys.argv[2] if len(sys.argv) > 2 else 'hero=1'   # e.g. shot=dark | shot=drawing | shot=branch | shot=pot
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width': 2560, 'height': 1440}, device_scale_factor=1)
        errs = []; pg.on('console', lambda m: errs.append(m.text) if m.type in ('error', 'warning') else None)
        await pg.goto('http://127.0.0.1:8080/index.html?' + Q + '&pr=1.5')
        await pg.wait_for_function('window.NAVR && NAVR.heroReady', timeout=120000)
        await pg.wait_for_timeout(1500)
        data = await pg.evaluate("NAVR.heroPNG")
        import base64, io
        img = Image.open(io.BytesIO(base64.b64decode(data.split(',')[1]))).convert('RGB')
        print('raw', img.size)
        img = img.resize((2560, 1440), Image.LANCZOS)
        # film finish: gentle vignette + fine grain
        import numpy as np
        a = np.asarray(img).astype(np.float32) / 255
        h, w = a.shape[:2]; y, x = np.mgrid[0:h, 0:w]
        r = np.sqrt(((x - w / 2) / (w / 2)) ** 2 + ((y - h / 2) / (h / 2)) ** 2)
        a *= (1 - 0.28 * np.clip(r - 0.45, 0, 1) ** 1.5)[..., None]
        a += np.random.default_rng(7).normal(0, 0.012, a.shape[:2])[..., None]
        Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).save(OUT, optimize=True)
        small = OUT.rsplit('.', 1)[0] + '-small.jpg'
        Image.open(OUT).convert('RGB').resize((1600, 900), Image.LANCZOS).save(small, quality=88)
        print(errs or 'no errors'); await b.close()
asyncio.run(main())
