// Solmar Bay: Neon Tide — a gta6-01 entry (Node 22, standard library only).
// The game is this directory's game/ folder: plain static files a desktop
// browser loads offline (game/index.html and its ES modules, three.js
// vendored under game/vendor/, no network request). This program hands it in:
// it copies game/ and screenshots/ from beside this file to /output and
// writes /output/dossier.json, the summary the judge reads, with the
// vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

// Self-check: report the dossier's text size against the cap, decoded with
// TextDecoder (never Uint8Array.toString, which would corrupt the bytes).
// Fail loudly if the cap cut any source out of the dossier, or if the copied
// game/ or screenshots/ breach their own caps — a bad build must not pass
// silently and reach the judge incomplete.
const text = new TextDecoder().decode(dossier);
const parsed = JSON.parse(text);
const textBytes = Buffer.byteLength(parsed.text ?? '', 'utf8');
const cut = text.includes('left out');

function walk(dir) {
  let files = 0, bytes = 0;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) { const r = walk(p); files += r.files; bytes += r.bytes; }
    else { files += 1; bytes += statSync(p).size; }
  }
  return { files, bytes };
}
const gameStats = walk(join(out, 'game'));
const shotStats = walk(join(out, 'screenshots'));
console.log(`Solmar Bay: Neon Tide handed in: dossier.json ${dossier.byteLength} bytes; text ${textBytes} / 163840 bytes${cut ? ' (SOURCE CUT BY THE CAP)' : ' (all source included)'}`);
console.log(`game/: ${gameStats.files} files, ${gameStats.bytes} bytes (caps: 993 files, 50331648 bytes); screenshots/: ${shotStats.files} files, ${shotStats.bytes} bytes (caps: 4 files, 262144 bytes each)`);
let bad = false;
if (cut) { console.error('FAIL: dossier text cap cut source out of the entry'); bad = true; }
if (gameStats.files > 993) { console.error('FAIL: too many files under game/'); bad = true; }
if (gameStats.bytes > 50331648) { console.error('FAIL: game/ exceeds 48 MiB'); bad = true; }
if (shotStats.files > 4) { console.error('FAIL: more than 4 screenshots'); bad = true; }
for (const f of readdirSync(join(out, 'screenshots'))) {
  if (statSync(join(out, 'screenshots', f)).size > 262144) { console.error(`FAIL: screenshot ${f} exceeds 256 KiB`); bad = true; }
}
if (bad) process.exit(1);
