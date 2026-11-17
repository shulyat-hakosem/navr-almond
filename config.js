// ─────────────────────────────────────────────────────────────────────────────
//  NA.V.R. · שיעור 1 · מקל השקד
//  All the texts, timings and colors you may want to tweak live here.
//  Times are in SECONDS. After changing a `say` text, re-generate the voice:
//      npm run voice        (needs: pip install edge-tts)
// ─────────────────────────────────────────────────────────────────────────────

export const CONFIG = {
  // v7 · Voice: Google Gemini TTS (tools/gen-voice-gemini.mjs, needs GEMINI_API_KEY). Fallback: edge-tts (tools/gen-voice.mjs).
  // almond lines: gemini-2.5-pro-preview-tts; pot lines: gemini-2.5-flash-preview-tts (the pro model's daily quota ran out). Same voice.
  gemini: { model: 'gemini-2.5-flash-preview-tts', voice: 'Charon',
            style: 'Read aloud in Hebrew, exactly as written, nothing else. Style: slow, quiet, low, mysterious and very clear, with small pauses between sentences.' },
  voice: { name: 'he-IL-AvriNeural', rate: '-15%', pitch: '-4Hz', volume: '+0%' },

  // Subtitles under the voice (true/false)
  subtitles: true,
  subtitleHeight: 0.2,    // subtitles float this far above eye height (m), clear of the letter slots

  // Every spoken line, in order of the lesson. `id` = file name in assets/audio/<id>.mp3.
  // `text` is the subtitle; `tts` (optional) is what the voice reads, if different.
  // v6: FULL niqqud on every line (subtitles + voice) — the niqqud steers the pronunciation.
  // tools/gen-voice.mjs also reads: maqaf → space, ה׳ → אֲדֹנָי, כָּל → כֹּל, יְרוּשָׁלִַם → יְרוּשָׁלַיִם.
  // Verses: Jeremiah 1 / Genesis 2:7, Miqra according to the Masorah (Sefaria), cantillation removed.
  lines: {
    // 1 · darkness
    intro1:     { text: 'אֲנַחְנוּ בְּתוֹכְנִית אִמּוּן לִנְבוּאָה.' },
    intro2:     { text: 'הַתּוֹכְנִית בּוֹדֶקֶת אֶת הַיַּחַס בֵּין דִּמּוּי, מִלִּים וְהַקְשָׁבָה.' },
    // title card · Jeremiah 1:11–12 (read aloud in darkness; the card shows the text, no subtitle)
    tvAlmond:     { text: 'וַיְהִי דְבַר־ה׳ אֵלַי לֵאמֹר: מָה־אַתָּה רֹאֶה יִרְמְיָהוּ?' },
    tvAlmondFull: { text: 'וַיְהִי דְבַר־ה׳ אֵלַי לֵאמֹר: מָה־אַתָּה רֹאֶה יִרְמְיָהוּ? וָאֹמַר: מַקֵּל שָׁקֵד אֲנִי רֹאֶה. וַיֹּאמֶר ה׳ אֵלַי: הֵיטַבְתָּ לִרְאוֹת, כִּי־שֹׁקֵד אֲנִי עַל־דְּבָרִי לַעֲשֹׂתוֹ.' },
    closeEyes:  { text: 'עֲצוֹם אֶת הָעֵינַיִם.' },
    openEyes:   { text: 'עַכְשָׁו פְּקַח אוֹתָן.' },
    // 2–3 · test one: the almond branch. The image opens through the word.
    see:        { text: 'מָה אַתָּה רוֹאֶה?' },
    // listening guide (only when the browser can hear the learner; otherwise silence → continue)
    seeYes:     { text: 'כֵּן. גַּם הַנָּבִיא רָאָה כָּךְ.' },
    seeOther:   { text: 'תּוֹדָה. כָּל רְאִיָּה הִיא הַתְחָלָה.', tts: 'תּוֹדָה. כֹּל רְאִיָּה, הִיא הַתְחָלָה.' },
    almond1:    { text: 'הַנָּבִיא עָנָה: "מַקֵּל שָׁקֵד אֲנִי רֹאֶה".' },
    almond2:    { text: 'וְהוּא שָׁמַע: "הֵיטַבְתָּ לִרְאוֹת, כִּי שֹׁקֵד אֲנִי עַל דְּבָרִי לַעֲשֹׂתוֹ".' },
    almond3:    { text: 'שָׁקֵד. שׁוֹקֵד. אוֹתָן אוֹתִיּוֹת. הַתְּמוּנָה נִפְתַּחַת דֶּרֶךְ הַמִּלָּה.', tts: 'שָׁקֵד. ... שׁוֹקֵד. ... אוֹתָן אוֹתִיּוֹת. הַתְּמוּנָה נִפְתַּחַת דֶּרֶךְ הַמִּלָּה.' },
    letters:    { text: 'גַּע בָּאוֹתִיּוֹת. אֵין סֵדֶר נָכוֹן.' },
    alsoThis:   { text: 'גַּם זֶה הוּא.' },
    // 4 · transition · title card · Jeremiah 1:13 (short: the opening only)
    tvPot:      { text: 'וַיְהִי דְבַר־ה׳ אֵלַי שֵׁנִית.', tts: 'וַיְּהִי... דְּבַר ה׳ אֵלַי שֵׁנִית.' },
    lookAround: { text: 'הִסְתַּכֵּל סְבִיבְךָ.' },
    hint:       { text: 'מֵאֲחוֹרֶיךָ.' },
    // 5 · v7 · test two: the pot. Cold, then it heats. Few words, long silences. We don't know — that is the point.
    potYes:     { text: 'כֵּן. סִיר.' },
    potDir:     { text: 'כֵּן. שִׂים לֵב לְאָן פָּנָיו.' },
    potOther:   { text: 'הִשָּׁאֵר עִם מָה שֶׁאַתָּה רוֹאֶה.' },
    potVerse1:  { text: 'סִיר נָפוּחַ אֲנִי רֹאֶה, וּפָנָיו מִפְּנֵי צָפוֹנָה.', tts: 'סִיר, נָפוּחַ, אֲנִי רֹאֶה. וּפָנָיו, מִפְּנֵי צָפוֹנָה.' },
    potSmith:   { text: 'כְּלִי שֶׁנַּפָּח עָשָׂה בְּיָדָיו.' },
    potIron:    { text: 'לֹא עֵץ שֶׁצּוֹמֵחַ. בַּרְזֶל.' },
    potHeat:    { text: 'וְהַבַּרְזֶל מִתְחַמֵּם. כְּמוֹ מִלְחָמָה שֶׁמִּתְקָרֶבֶת.' },
    potUnknown: { text: 'מָה בְּתוֹכוֹ? אֵינֶנּוּ יוֹדְעִים.' },
    // 6 · into the pot (only after the gaze): the army on the iron walls, the interpretation, the fulfilment
    intoPot:    { text: 'הַבֵּט לְתוֹכוֹ.' },
    in1:        { text: 'מִצָּפוֹן תִּפָּתַח הָרָעָה עַל כָּל יֹשְׁבֵי הָאָרֶץ.' },
    in2:        { text: 'וְכָךְ הָיָה. נְבוּכַדְנֶאצַּר, מֶלֶךְ בָּבֶל, בָּא עִם צְבָאוֹ מִן הַצָּפוֹן.' },
    in3:        { text: 'בִּשְׁנַת 586 לִפְנֵי הַסְּפִירָה, יְרוּשָׁלַיִם נִפְרְצָה, וּבֵית הַמִּקְדָּשׁ עָלָה בָּאֵשׁ.',
                  tts: 'בִּשְׁנַת חֲמֵשׁ מֵאוֹת שְׁמוֹנִים וָשֵׁשׁ לִפְנֵי הַסְּפִירָה, יְרוּשָׁלַיִם נִפְרְצָה, וּבֵית הַמִּקְדָּשׁ עָלָה בָּאֵשׁ.' },
    exit:       { text: 'כָּאן מִסְתַּיֵּם הַשִּׁעוּר הָרִאשׁוֹן.' },
  },

  // Title cards before each prophecy (shown in darkness, the verse read aloud).
  // titleVerse: 'question' = only the opening ("מה אתה ראה?") so the test isn't given away;
  //             'full' = the whole vision verse(s) on the card (also via URL ?titles=full).
  titleVerse: 'question',
  titles: {
    almond: { prophet: 'יִרְמְיָהוּ', ref: 'פֶּרֶק א׳ · פְּסוּקִים יא–יב', line: 'tvAlmond', full: 'tvAlmondFull' },
    pot:    { prophet: 'יִרְמְיָהוּ', ref: 'פֶּרֶק א׳ · פָּסוּק יג', line: 'tvPot', short: true },
  },

  // Listening guide (test): after "מה אתה רואה?" the learner may answer aloud (Web Speech API, he-IL,
  // free, browser-provided). No recognition / no permission / error → silent fallback to the old pause.
  listen: {
    enabled: true,
    almond: { yes: ['שקד', 'שקדיה', 'ענף', 'פרח', 'פריח', 'עץ', 'מקל', 'זרד', 'ציצ', 'ניצנ'] },
    pot:    { dir: ['צפון', 'כיוון', 'נוטה', 'נוטים', 'זורם', 'נמשך', 'דרום', 'אליי', 'רוח'],
              yes: ['סיר', 'אדים', 'רותח', 'רתיח', 'בועות', 'בועה', 'אש', 'קיטור', 'ניצוצ', 'גיצ', 'מבעבע', 'מים', 'עשן', 'כלי', 'קדרה'] },
  },

  // Verses that appear in space (Jeremiah 1:11–14)
  verse: 'כִּי שֹׁקֵד אֲנִי עַל דְּבָרִי לַעֲשֹׂתוֹ',
  potVerse: 'סִיר נָפוּחַ אֲנִי רֹאֶה, וּפָנָיו מִפְּנֵי צָפוֹנָה',

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
    // v7 · the pot (see CONFIG.pot for heating)
    potAnswerPause: 7,     // 5: silence after "מה אתה רואה?" (skippable)
    potQuiet: 3.5,         // 5: the silences between the few lines
    potLong: 5,            // 5: the longer silence before "we don't know"
    gazeDwell: 3.5,        // 5: a steady gaze into the mouth this long swallows the learner
    gazeMax: 30,           // 5: …or the lesson goes on by itself after this
    titleIn: 2.5,          // title card: prophet + reference fade in, in darkness
    titleHold: 2.5,        // title card: hold after the verse was read
    intoSwallow: 3.5,      // 6: the mouth grows a little, the light goes out (no motion toward the viewer)
    insideIn: 4,           // 6: the inside of the pot appears around you (firelight, iron walls)
    armyApproach: 6,       // 6: the army's shadows and sounds arrive before the voice
    armyBetween: 2.5,      // 6: pauses between the lines (the army keeps passing)
    exitFade: 8,           // 6: the army passes, everything returns to silence
    endHold: 4,            // 6: silence before the end card
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
    // v7: lying on the floor, close, tipped over, mouth turned toward the learner (its back to the north)
    x: 0.15, z: 1.15,         // metres from the start point: behind the learner (virtual north), close
    floorY: 0,               // the floor (local-floor reference space)
    tilt: 1.2,               // tipped over onto its side (rad from upright)
    turn: -0.55,             // …and turned sideways: the mouth at three-quarters toward the learner
    roll: 0.18,              // a little askew: thrown, not placed
    size: 1.75,              // overall size (1 ≈ 45 cm wide)
    color: 0x4d4038,         // dark iron
    glowColor: 0xff4a14,     // the iron's faint glow once hot
    water: 0x1d1512,
    steam: 46,               // steam particles (thin)
    steamColor: 0xffe6cf,
    steamMax: 0.3,           // steam opacity at full heat
    shadows: true,
    sunDir: [-0.75, 0.42, -0.5],   // direction TOWARD the invisible sun once it finds the pot (low, grazing: horror)
    foundDeg: 35,            // the learner "found" the pot when looking within this angle of it
    // heating: starts COLD (no fire). Heat rises while the learner looks at it, faster when close or reaching toward it.
    heatGaze: 1 / 55,        // per second while looking at it
    heatNear: 1 / 25,        // extra per second when the head is within nearDist, or a hand within handDist
    nearDist: 0.75, handDist: 0.45,   // head: horizontal distance to the pot's centre
    heatFloor: 1 / 90,       // the heat never lags behind this ramp (it develops even if nobody looks)
    boilFrom: 0.3,           // heat at which the first bubbles appear
    gazeDeg: 14,             // a gaze within this angle of the mouth counts as "looking into it"
    flowDir: [0, 0, -1],     // the thin steam leans this way: from the north, toward the learner
    sparks: 26, flames: 0, sparkColor: 0xffb060, flameColor: 0xff7a2a,
    sparkMax: 0.25,          // only a few, only at full heat
    sparkReach: 1.4,
    steamPush: 0.45,
    engulf: 0,
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
