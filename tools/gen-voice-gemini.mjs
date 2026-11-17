// v7 · Generates assets/audio/<id>.mp3 for every CONFIG.lines entry with Google Gemini TTS.
// Usage: GEMINI_API_KEY=… node tools/gen-voice-gemini.mjs [id1 id2 …]     (needs ffmpeg)
// Same pronunciation helpers as tools/gen-voice.mjs: maqaf → space, ה׳ → אֲדֹנָי, כָּל → כֹּל, no quotes.
import { CONFIG } from '../config.js';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
const out = new URL('../assets/audio/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const G = { ...CONFIG.gemini, model: process.env.GEMINI_TTS_MODEL || CONFIG.gemini.model }, key = process.env.GEMINI_API_KEY;
if (!key) { console.error('GEMINI_API_KEY is not set'); process.exit(1); }
const only = process.argv.slice(2);
const missing = only[0] === '--missing';   // only lines without an mp3 yet
const prep = (t) => t.replace(/־/g, ' ').replace(/ה׳/g, 'אֲדֹנָי').replace(/כָּל(?=[\s־,.]|$)/g, 'כֹּל')
  .replace(/יְרוּשָׁלִַם/g, 'יְרוּשָׁלַיִם').replace(/["«»]/g, '').replace(/\s*\.\.\.\s*/g, '... ');
async function tts(text) {
  const body = { contents: [{ parts: [{ text: `${G.style}\n\nText: ${text}` }] }],
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: G.voice } } } } };
  for (let a = 0; a < 10; a++) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${G.model}:generateContent`,
      { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    const d = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
    if (r.ok && d) return Buffer.from(d.data, 'base64');
    if (JSON.stringify(j).includes('PerDay')) throw new Error(`daily quota exhausted for ${G.model}`);
    console.warn('retry', a + 1, r.status, JSON.stringify(j.error || j).slice(0, 160));
    await new Promise((res) => setTimeout(res, r.status === 429 ? 22000 : 3000));   // free tier: a few requests per minute
  }
  throw new Error('Gemini TTS failed');
}
const jobs = Object.entries(CONFIG.lines).filter(([id]) => missing ? !existsSync(`${out}${id}.mp3`) : (!only.length || only.includes(id)));
let i = 0;
await Promise.all([0].map(async () => {
  while (i < jobs.length) {
    const [id, line] = jobs[i++];
    const pcm = await tts(prep(line.tts || line.text)), tmp = `/tmp/gemini-${id}.pcm`;
    writeFileSync(tmp, pcm);
    // trim the silence at both ends (keep a short tail), 24 kHz mono PCM → mp3
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', tmp,
      '-af', // …and long inner pauses capped at 0.7 s
      'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,apad=pad_dur=0.15,areverse,silenceremove=stop_periods=-1:stop_duration=0.75:stop_threshold=-45dB:stop_silence=0.7,apad=pad_dur=0.25',
      '-codec:a', 'libmp3lame', '-b:a', '64k', `${out}${id}.mp3`]);
    rmSync(tmp); console.log('✓', id);
  }
}));
