# NA.V.R. · שיעור 1 · מקל השקד — WebXR prototype (Meta Quest 2)

Static site, no build step. three.js r160 + Frank Ruhl Libre (OFL) are bundled locally.

## Run locally
    python3 -m http.server 8080      # then open http://localhost:8080
Desktop preview: "תצוגה מקדימה במחשב" — drag letters with the mouse, drag empty space to look, Space/click = continue.
Dev URL flags: `?stage=3` start at a stage (0–5), `?fast=1` 10× faster (no voice), `?autostart=desktop`.

## Tweak
Everything (texts, timings, palette, voice) is in `config.js`.
After changing a spoken text: `pip install edge-tts && npm run voice` (re-generates `assets/audio/*.mp3`).

## Files
    index.html              overlay + Enter VR / Passthrough / desktop buttons, import map
    config.js               ALL texts / timings / colors / voice settings
    src/main.js             renderer, XR session, the 6-stage lesson timeline
    src/world.js            room (toon + ink lines), procedural floating almond branch + floor shadow, blossom, petals, light
    src/text.js             Hebrew text → canvas textures (correct RTL + niqqud), letter blocks
    src/input.js            Quest controllers, hand tracking (pinch), mouse fallback
    src/audio.js            voice playback + procedural ambience (room tone, wind, bird, swell)
    assets/audio/*.mp3      voice lines (edge-tts, he-IL-AvriNeural, rate −15%)
    assets/fonts/           Frank Ruhl Libre (SIL OFL)
    vendor/                 three.js r160 (MIT) + BufferGeometryUtils
    tools/gen-voice.mjs     voice generator
    tests/smoke.py          headless desktop test + screenshots → screens/
    tests/xr.py             emulated Quest 2 (Meta IWER): VR session, controller grab, hand pinch, AR session

## Controls on Quest
Controllers: touch a letter + trigger/grip to grab, or point the ray + trigger. Trigger on empty space = "I answered / continue".
Hands: pinch near a letter (or point and pinch). Release near a slot to snap it.
Letters read right→left: שקד → שָׁקֵד · שׁוֹקֵד, קדש → קֹדֶשׁ.

Hero still: `?hero=1&pr=1.5` renders a composed blossom frame; `python3 tests/hero.py` saves screens/hero-frame.png (2560x1440, supersampled from 3840x2160, light vignette + grain).

## Look v3: black void + invisible sun
`CONFIG.look`: `showRoom:false` (the old room is still there if set to true), `voidColor`, `sun` (direction, colour, intensity, `shadowMap` 1024, where 0 turns shadows off, and `shadowSize`), `fill`, `rim`, `translucency` (backlit blossoms), `speck`, `hatch*`, `floorFade`, `quality` ('low' drops the heavy shader bits; for more headroom, also set `sun.shadowMap: 0`).
Hero still: `python3 tests/hero.py screens/hero-frame-v3.png`.

## Look v4: almond colours
The `palette` almond colours are `blossom`, `blossomEdge`, `blossomCore`, `blossomBud`, `sepal`, `stamen`, `anther`, `blossomEmissive` and `blossomPairs`. `look.translucencyTint` and `look.petalMax` set a soft brightness ceiling so petals don't clip to white. The hero camera offsets are in `hero`. The floor is off (`look.showFloor: false`).
Hero still: `python3 tests/hero.py screens/hero-frame-v4.png`.

## v5: the new flow (Jeremiah 1:11–14, two tests)
Stages (`?stage=N`):
0. **dark**: silence, the voice, eyes closed, eyes open.
1. **draw**: the branch draws itself. The wood appears first as light ink strokes, then fills with color, then the blossoms open. The branch then comes alive: wind sways it, touching it makes it tremble and shed petals, and a falling petal may rest on a hand.
2. **almond**: "מה אתה רואה?", then מקל שקד / שוקד and the ש-ק-ד letters.
3. **turn**: the branch sinks into the dark. The same invisible sun finds the boiling pot at virtual north, behind the learner. You hear it from that direction (positional audio), and a hint plays after `timing.potHintAfter`.
4. **potTest**: the pot. It boils more when the learner is still and calms when they move (`CONFIG.pot.interaction`: 'stillness' | 'none').
5. **exit**.

All the narration is in `CONFIG.lines`; run `npm run voice` after changing it. The pot, wind and touch settings are in `CONFIG.pot`, `CONFIG.wind` and `CONFIG.touch`.
Stills: `python3 tests/hero.py screens/<name>.png shot=dark|drawing|branch|pot`. Each also writes `-small.jpg`.
