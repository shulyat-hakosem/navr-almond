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

## v6: title cards, niqqud narration, the boiling pot, into the pot, listening guide
- **Title cards** (`CONFIG.titles`, `src/text.js → makeTitleCard`): before each prophecy, in darkness: prophet, chapter · verses, then the verse (full niqqud, Miqra al pi ha-Masorah via Sefaria) read aloud. Almond card after the intro (Jer 1:11–12), pot card in the dark after the branch sinks (Jer 1:13–16), fulfilment card (Jer 1:15) inside the pot. `titleVerse: 'question'` shows only "מה אתה ראה" so the test isn't given away; `?titles=full` / `'full'` shows the whole vision verse.
- **Narration**: every line in `CONFIG.lines` now carries full niqqud (subtitles too). `npm run voice` (or `node tools/gen-voice.mjs id1 id2`) also maps maqaf → space, ה׳ → אֲדֹנָי, כָּל → כֹּל, יְרוּשָׁלִַם → יְרוּשָׁלַיִם.
- **The pot** (`src/pot.js`): visibly boils (jittered bubbles, churn), with a fire beneath; steam, sparks and flames all stream one way, `CONFIG.pot.flowDir` (default `[0,0,-1]`: from the north toward the learner; `[0,0,1]` = away, north). `boilMin` keeps it boiling even when the learner moves.
- **Into the pot** (stage 5, still `?stage=5`): "הַבֵּט לְתוֹכוֹ", the pot opens beneath the gaze and grows, the mouth rises over the eyes, a spark/steam cloud swallows the head, black veil (also in passthrough). In the dark, Babylon's army approaches from the north (synthesised in `src/audio.js → armyStart`: feet, hooves, chariot wheels, metal, a distant horn; no sound files), the Jer 1:15 card, the fulfilment narration, end card.
- **Listening guide** (`src/listen.js`, `CONFIG.listen`): after "מָה אַתָּה רוֹאֶה?" the learner may answer aloud (Web Speech API, he-IL). Keywords pick a pre-recorded reply (`seeYes/seeOther`, `potYes/potDir/potOther`); silence, no API, no permission or an error → the old pause, silently. In VR it listens only if the mic was allowed beforehand (the small "לענות בקול" button on the start page). `?nolisten=1` turns it off.
- Stills: `python3 tests/hero.py screens/x.png "shot=title&card=almond|pot|fulfil"`, `shot=pot`, `"shot=into&k=0.6"`. Flow test: `python3 tests/v6.py`.

## v7: the pot reworked (cold → heat, gaze in, shadow-army inside), Gemini narration
- **The pot** (`src/pot.js`, `CONFIG.pot`): close (≈1.2 m behind the start, virtual north), lying tipped over on the floor, a little askew, its mouth turned toward the learner (its back to the north: "וּפָנָיו מִפְּנֵי צָפוֹנָה", the face that comes from the north). A faint pool of light on the floor, a contact shadow. Low grazing light.
- **It starts cold**: no fire, still dark water, silence. It heats while the learner looks at it (`heatGaze`), faster when they come close or reach a hand toward it (`heatNear`, `nearDist`, `handDist`), never slower than `heatFloor`. With heat: the iron ticks and knocks, then the first bubbles (`boilFrom`), thin steam (`steamMax`), the iron glows faintly, only a few sparks at full heat (`sparkMax`). Works with gaze alone.
- **Few words** (`potVerse1, potSmith, potIron, potHeat, potUnknown`) with silences (`timing.potQuiet`, `potLong`). Pot title card is short (`titles.pot.short`): Jeremiah 1:13, "וַיְהִי דְבַר ה׳ אֵלַי שֵׁנִית".
- **Into the pot** only after that: "הַבֵּט לְתוֹכוֹ", then a steady gaze into the mouth (`pot.gazeDeg`, `timing.gazeDwell`) swallows the learner; after `gazeMax` it goes on anyway. The mouth grows slightly in place and the light goes out (no motion toward the viewer). Inside (`src/inside.js`): a huge, still iron vessel lit by fire from below; Babylon's army passes as shadow-play on the walls (`assets/army.png`, slowly circling ≈7°/s). Loud army sound (drums, feet, galloping hooves, whinnying horses, chariot wheels, clashing iron, shouts, horns; `src/audio.js → armyStart`), ducked to 55% under the voice: `in1` (the verse's own interpretation), `in2` (Nebuchadnezzar from the north), `in3` (586 BCE).
- **Narration**: Google Gemini TTS, voice `Charon` (`CONFIG.gemini`). `GEMINI_API_KEY=… npm run voice` (all lines) or `node tools/gen-voice-gemini.mjs id1 id2` / `--missing`. Model via `GEMINI_TTS_MODEL`. Inner pauses are capped at 0.7 s. `npm run voice:edge` = the old edge-tts voice.
- Stills: `python3 tests/hero.py x.png "shot=pot&heat=0|0.85"`, `"shot=inside&yaw=0.2&scroll=0.3"`. Flow test: `python3 tests/v7.py` (fast) or `python3 tests/v7.py real` (real time, prints stage timings).
