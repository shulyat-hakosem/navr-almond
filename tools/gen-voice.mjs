// Generates assets/audio/<id>.mp3 for every CONFIG.lines entry using edge-tts.
// Usage: node tools/gen-voice.mjs   (pip install edge-tts)
import { CONFIG } from '../config.js';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const out = new URL('../assets/audio/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const v = CONFIG.voice;
for (const [id, line] of Object.entries(CONFIG.lines)) {
  const text = line.tts || line.text;
  execFileSync('edge-tts', ['--voice', v.name, `--rate=${v.rate}`, `--pitch=${v.pitch}`, `--volume=${v.volume}`,
    '--text', text, '--write-media', `${out}${id}.mp3`], { stdio: 'inherit' });
  console.log('✓', id);
}
