// Listening guide (test): the learner may answer "מה אתה רואה?" aloud.
// Web Speech API (SpeechRecognition, he-IL) — free, provided by the browser. Where it is missing
// (Quest browser, Firefox…), not allowed, or fails, everything silently falls back to the old pause.
import { CONFIG } from '../config.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const strip = (s) => s.replace(/[\u0591-\u05C7]/g, '');          // niqqud / cantillation off

export function createListener() {
  let broken = !SR || !CONFIG.listen.enabled || new URLSearchParams(location.search).has('nolisten');
  const api = {
    get available() { return !broken; },
    disable() { broken = true; },
    /** listen up to `sec` seconds (or until `cancel()`); resolves with the transcript ('' = heard nothing / unavailable) */
    hear(sec, onInterim) {
      if (broken) return { done: Promise.resolve(''), cancel() {} };
      let rec, finished = false, text = '', timer, res;
      const done = new Promise((r) => (res = r));
      const finish = () => { if (finished) return; finished = true; clearTimeout(timer); try { rec && rec.abort(); } catch (e) {} res(text.trim()); };
      try {
        rec = new SR(); rec.lang = 'he-IL'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 3;
        rec.onresult = (e) => {
          let t = '', fin = false;
          for (let i = 0; i < e.results.length; i++) { t += [...e.results[i]].map((a) => a.transcript).join(' ') + ' '; if (e.results[i].isFinal) fin = true; }
          text = t; onInterim && onInterim(e.results[e.results.length - 1][0].transcript);
          if (fin) setTimeout(finish, 300);
        };
        rec.onerror = (e) => {
          // no permission / no service / no mic → stop trying for the rest of the lesson
          if (['not-allowed', 'service-not-allowed', 'network', 'audio-capture', 'language-not-supported'].includes(e.error)) broken = true;
          finish();
        };
        rec.onend = () => setTimeout(finish, 50);
        rec.start();
        timer = setTimeout(finish, sec * 1000);
      } catch (e) { broken = true; finish(); }
      return { done, cancel: finish };
    },
    /** which response fits? returns a key of the keyword table, or 'other' ('' = silence) */
    classify(text, table) {
      if (!text) return '';
      const t = strip(text);
      for (const [k, words] of Object.entries(table)) if (words.some((w) => t.includes(w))) return k;
      return 'other';
    },
  };
  return api;
}
