// ─────────────────────────────────────────────────────────────────────────────
//  NA.V.R. · שיעור 1 · מקל השקד
//  All the texts, timings and colors you may want to tweak live here.
//  Times are in SECONDS. After changing a `say` text, re-generate the voice:
//      npm run voice        (needs: pip install edge-tts)
// ─────────────────────────────────────────────────────────────────────────────

export const CONFIG = {
  // Voice used by tools/gen-voice.mjs (edge-tts). Alternatives: 'he-IL-HilaNeural'
  voice: { name: 'he-IL-AvriNeural', rate: '-15%', pitch: '-4Hz', volume: '+0%' },

  // Subtitles under the voice (true/false)
  subtitles: true,
  subtitleHeight: 0.2,    // subtitles float this far above eye height (m), clear of the letter slots

  // Every spoken line, in order of the lesson. `id` = file name in assets/audio/<id>.mp3.
  // `text` is the subtitle; `tts` (optional) is what the voice reads, if different.
  // Niqqud only on the verses (Jeremiah 1:11–14); the teacher's own words are plain.
  lines: {
    // 1 · darkness
    intro1:     { text: 'אנחנו בתוכנית אימון לנבואה.' },
    intro2:     { text: 'התוכנית בודקת את היחס בין דימוי, מילים והקשבה.' },
    closeEyes:  { text: 'עצום את העיניים.' },
    openEyes:   { text: 'עכשיו פקח אותן.' },
    // 2–3 · test one: the almond branch. The image opens through the word.
    see:        { text: 'מה אתה רואה?' },
    almond1:    { text: 'הנביא ענה: "מַקֵּל שָׁקֵד אֲנִי רֹאֶה".', tts: 'הנביא ענה: מַקֵּל שָׁקֵד אֲנִי רֹאֶה.' },
    almond2:    { text: 'והוא שמע: "כִּי שֹׁקֵד אֲנִי עַל דְּבָרִי לַעֲשֹׂתוֹ".', tts: 'והוא שמע: כִּי שֹׁקֵד אֲנִי עַל דְּבָרִי לַעֲשֹׂתוֹ.' },
    almond3:    { text: 'שקד. שוקד. אותן אותיות. התמונה נפתחת דרך המילה.', tts: 'שָׁקֵד. ... שׁוֹקֵד. ... אותן אותיות. התמונה נפתחת דרך המילה.' },
    letters:    { text: 'גע באותיות. אין סדר נכון.' },
    alsoThis:   { text: 'גם זה הוא.' },
    // 4 · transition
    lookAround: { text: 'תִּסְתַּכֵּל סְבִיבֶךָ.' },
    hint:       { text: 'מאחוריך.' },
    // 5 · test two: the pot. No wordplay this time.
    potVerse1:  { text: 'סִיר נָפוּחַ אֲנִי רֹאֶה, וּפָנָיו מִפְּנֵי צָפוֹנָה.' },
    potVerse2:  { text: 'מִצָּפוֹן תִּפָּתַח הָרָעָה עַל כָּל יֹשְׁבֵי הָאָרֶץ.' },
    potNoWord:  { text: 'הפעם אין משחק מילים. סיר אינו נשמע כמו צפון.' },
    potAbstract:{ text: 'המחשבה צריכה לזוז למקום אחר. צורה. כיוון. תנועה.' },
    potBlown:   { text: 'ומהו סיר נפוח? סיר שנפחו בו. כמו כלי שהיוצר נושף בו צורה.' },
    potBreath:  { text: 'כמו האדם: "וַיִּפַּח בְּאַפָּיו נִשְׁמַת חַיִּים".', tts: 'כמו האדם: וַיִּפַּח בְּאַפָּיו נִשְׁמַת חַיִּים.' },
    potStay:    { text: 'הישאר איתו.' },
    // 6 · exit
    exit:       { text: 'המבחן השני נשאר פתוח. נחזור אליו.' },
  },

  // Verses that appear in space (Jeremiah 1:11–14)
  verse: 'כִּי שֹׁקֵד אֲנִי עַל דְּבָרִי לַעֲשֹׂתוֹ',
  potVerse: 'סִיר נָפוּחַ אֲנִי רֹאֶה וּפָנָיו מִפְּנֵי צָפוֹנָה',

  // Words recognised when the three letters sit in the slots (read right→left).
  // key = plain letters, value = label shown softly under the slots.
  words: {
    'שקד': 'שָׁקֵד · שׁוֹקֵד',
    'קדש': 'קֹדֶשׁ',
  },
  letters: ['ש', 'ק', 'ד'],

  timing: {
    darkSilence: 5,        // 1: silence in total darkness before the voice
    betweenIntro: 1.5,     // 1: short silence between the first two lines
    eyesClosed: 6,         // 1: eyes closed, silence
    drawBark: 10,          // 2: the branch draws itself (wood)
    drawBlossom: 7,        // 2: then the blossoms open
    aliveHold: 8,          // 2: the branch is alive (wind, touch) before the question
    answerPause: 8,        // 3: wait after "מה אתה רואה?" (trigger / pinch / space skips)
    verseHold: 3,          // 3: pause after the verse
    lettersFloatOut: 4,    // 3: letters drift from the branch toward the user
    lettersMinTime: 15,    // 3: the "continue" mark appears after this…
    lettersMaxTime: 90,    // …and the lesson continues by itself after this
    sink: 9,               // 4: the branch sinks into darkness
    darkHold: 4,           // 4: darkness before the light finds the pot
    potReveal: 6,          // 4: the light finds the pot
    potHintAfter: 10,      // 4: if the learner hasn't turned toward the pot after this → hint
    potFindMax: 45,        // 4: …and the lesson continues anyway after this
    potAnswerPause: 10,    // 5: silence after "מה אתה רואה?"
    potVersePause: 4,      // 5: between the two verses
    potThink: 5,           // 5: silences between the teacher's sentences
    potStay: 25,           // 5: stay with the pot (open; Yoni decides later)
    exitFade: 10,          // 6: everything returns to darkness
    endHold: 5,            // 6: silence before the end card
  },

  // ── The look: texture, atmosphere, emotion. 0 switches an effect off. ──
  // Current direction (Yoni): black void, crisp, "like an invisible sun" — a strong warm
  // directional key light with hard shadows and bright rim highlights; the source is never seen.
  look: {
    voidColor: 0x050506,  // background
    showRoom: false,      // walls / ceiling / window / light shaft (the older paper-room look)
    showFloor: false,     // a dark floor that catches the branch's hard shadow, fading into black
    floorColor: 0x2b2520,
    floorFade: 2.4,       // metres from the centre until the floor is gone into black
    sun: {                // the invisible sun (directional, parallel rays)
      dir: [0.62, 0.58, 0.52],   // direction TOWARD the sun: from the upper right, fairly frontal → bark lit, still rims
      colorFrom: 0x8a93b8, colorTo: 0xffe2c2,  // pre-dawn → warm
      intensityFrom: 0.5, intensityTo: 3.2,
      shadowMap: 1024,           // shadow resolution (crisp, hard edges); 0 = no shadows
      shadowSize: 1.6,           // half-size of the shadow area around the branch (m)
    },
    fill: 0x5a6078,       // cool fill in the shadows (keeps hatching visible)
    fillIntensity: 0.95,
    rimColor: 0xffe8d0,   // bright edge highlight on branch & blossoms (sun side)
    rim: 1.2,
    speck: 0.25,          // crisp paper "tooth" specks
    translucency: 0.55,   // blossoms glow when the sun is behind them
    translucencyTint: 0xffe6cf, // warm cream glow through the petals
    petalMax: 0.95,
    barkRimEdge: [0.62, 0.8], // narrow rim on the wood (a wide one washed the bark out to pale tan)
    blossomForward: 0.35, // blossoms face out from the wood, tilted this much toward the twig tip      // soft ceiling for petal brightness (no clipped pure white on black)
    grain: 0.2,           // paper grain strength (world-space, stable, no shimmer)
    crayon: 0.07,         // gouache/crayon streaks
    hatch: 0.85,          // ink hatching in the shadows
    hatchFreq: 24,        // hatch lines per metre
    hatchStart: 1.05,     // light level below which hatching starts…
    hatchCross: 0.5,      // …and below which it cross-hatches
    fogDensity: 0.02,     // haze depth
    hazeCool: 0x050506,   // far / shadow haze (pre-dawn blue-violet)
    hazeWarm: 0x0b0806,   // haze near the window (dusk apricot)
    shadowTint: 0x9aa3d6, // cool shade color (warm light / cool shadow)
    shadowAmt: 0.5, 
    dissolve: 0.0,        // walls dissolve into haze toward the ceiling
    breatheAmp: 0.07,     // the light "breathes"
    breatheSpeed: 0.35,
    bleedColor: 0xecd2cf, // blossom color bleeding into the room
    bleedRadius: 1.5,     // metres around the branch
    bleed: 0.35,
    glow: 0.2,            // warm glow around the blossom
    dust: 220,            // dust motes (in the window light)
    petals: 22,           // drifting petals
    skyTop: 0x4f5b82, skyMid: 0xc4a3b3, skyLow: 0xf2c49b, // window: dusk/pre-dawn gradient
    beam: 0.11,           // window light shaft
    jitter: 0.018,        // how irregular / faceted the room is (m)
    exitNeutral: 0.55,    // how far the palette returns to neutral at the exit
    quality: 'high',      // 'low' = cheaper shaders (fewer noise octaves) if Quest drops frames
  },

  // Test two: the boiling pot at virtual NORTH (= +Z, behind the learner's start direction)
  pot: {
    x: 0.75, z: 1.75,        // metres from the start point: behind, a little to the right
    belowEye: 0.4,           // pot centre this far below eye height
    tilt: 0.4,               // its face (mouth) tilts toward the learner: "ופניו מפני צפונה"
    size: 1.25,              // overall size (1 ≈ 45 cm wide)
    color: 0x5f4d3f,         // dark bronze / clay
    water: 0x2a1d17,
    steam: 70,               // steam particles
    steamColor: 0xffe6cf,
    shadows: true,
    sunDir: [-0.55, 0.6, -0.55],   // direction TOWARD the invisible sun once it finds the pot (from the learner's side)
    foundDeg: 35,            // the learner "found" the pot when looking within this angle of it
    // interaction, left open for Yoni. 'stillness': boils more when the learner is still/quiet,
    // calms when they move a lot. 'none': boils steadily at boilBase.
    interaction: 'stillness',
    boilBase: 0.45,
    boilRise: 0.12,          // per second, toward full boil while still
    boilFall: 0.6,           // per second, calming when moving
    motionCalm: 0.5,         // head+hands speed (m/s) at which it is fully calm
  },

  // Gentle wind: sways the branch, carries the falling petals
  wind: { strength: 1.0, sway: 0.035, drift: 0.05 },

  // Touching / brushing the branch (controller, hand, or mouse on desktop)
  touch: {
    radius: 0.07,            // metres from the wood
    minSpeed: 0.05,          // the hand must be moving at least this fast (m/s)
    cooldown: 0.5,
    shed: 3,                 // petals shed per touch
    trembleAmp: 0.05, trembleFreq: 18, trembleDecay: 2.2,
    landRadius: 0.09, landChance: 0.35, landHold: 4,   // a falling petal may rest on a hand
  },

  // ?hero=1 still: camera/target offsets from the branch position (metres)
  hero: { cx: 0.35, cy: 0.05, cz: 1.2, tx: 0.3, ty: -0.04, tz: 0 },

  palette: {
    paper:   0xe4ddd0,     // walls
    ink:     0x2b2925,     // ink (hatching)
    text:    0xf1e8da,     // letters / subtitles / lines on the black background
    shade:   0xb9b3a7,     // toon shadow tone
    // almond (Prunus dulcis): nearly-white petals with a faint blush, deep magenta-red heart,
    // red-tipped stamens, a few closed pink buds. The ONLY color in the scene.
    blossom:     0xfbf4f1,  // petal body: almost white, the faintest blush
    blossomEdge: 0xfefbf8,  // petal tips: warm white (lit side glows cream from the sun)
    blossomCore: 0x9e1f3d,  // the deep magenta-red base / calyx cup
    blossomBud:  0xe58aa2,  // closed buds: pink
    sepal:       0x6e2a2c,  // dark red-brown calyx
    stamen:      0xf1e2dc,  // pale filaments
    anther:      0xb3283f,  // red tips
    blossomEmissive: 0x1e1414, // self-light of the blossoms (keep low so whites don't blow out)
    blossomPairs: 0.45,     // share of open flowers that get a sibling right next to them
    // light temperature drift during entry (from → to)
    floor:   0xcfc3ae,     // floorboards
    bark:    0x5d534b,     // grey-brown almond wood
    barkKnot: 0x3a332e,
    barkBud:  0x4f3a33,
    barkCut:  0xbfae95,     // the pale cut end
    lightFrom: 0xb9c2dc,   // pre-dawn blue
    lightTo:   0xffd9b8,   // first warm light
  },

  // The floating branch (metres; the user starts at 0,0,0 facing -Z, so x<0 = front-left)
  branch: {
    x: -0.75, y: 1.45, z: -1.55,   // ~1.7 m away, front-left
    followEyeHeight: true,         // if true, y = user's eye height + eyeOffset (works seated or standing)
    eyeOffset: 0.02,               // ≈ eye level; the slots sit lower, so nothing overlaps
    hoverAmp: 0.035,               // bob up/down (m)
    hoverSpeed: 0.45,              // bob speed (rad/s)
    turnAmp: 0.3,                  // slow turn, ± radians
    turnSpeed: 0.09,               // turn speed (rad/s)
    yaw: 0.45, tilt: 0.05,         // resting orientation (0.45 ≈ its face turned to the user)
    scale: 1.35,                   // overall size (1 ≈ 75 cm long)
    seed: 4,                       // change the small irregularities of the branch
  },
  // Lesson objects (slots / letters / verse) are placed this many degrees to the RIGHT
  // of the branch, as seen from the user, so the letters read against the clean wall.
  slotsOffsetDeg: 30,
  slotsBelowEye: 0.42,             // slots this far below eye height (m)
  room: { width: 5.0, depth: 5.0, height: 2.8 },

  // Developer: start from a stage (0–5: dark, draw, almond, turn, pot, exit) – also via URL: ?stage=3   ?fast=1 (10x faster)
  debug: { startStage: 0 },
};
