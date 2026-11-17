// Solmar Bay — gta6-01 entry point (Node 22, standard library only).
//
// The game is this directory's game/ folder: plain static files a desktop
// browser loads offline (game/index.html plus its ES modules and the vendored
// three.js build under game/vendor/, zero network requests). This program
// hands the entry in: it copies game/ and screenshots/ from beside this file
// into the output directory and writes /output/dossier.json, the summary the
// judge reads, using the vendored make.fun library.
//
// The game itself: an original open-world crime game in a sun-soaked coastal
// city — drive and steal cars, run story missions, dodge the Solmar Bay PD
// under a five-star wanted system, with a day cycle, traffic, pedestrians,
// on-foot combat and a localStorage save. See game/src/main.js.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// dossier's bytes; the others refuse an entry the scorer would refuse (more
// than 4 screenshots or one over 256 KiB; more than 993 files in game/ or
// 48 MiB of game files in all, or a path under game/ over 1000 bytes).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

// A short human-readable summary of what was handed in. Decode the dossier
// with TextDecoder (never .toString() on the bytes) and verify it parses,
// then report the text size against the cap and whether any source was cut.
const shots = readdirSync(join(out, 'screenshots'))
  .filter((n) => !n.startsWith('.'))
  .sort();
const shotBytes = shots.map((n) => `${n} (${statSync(join(out, 'screenshots', n)).size} bytes)`);
console.log(`Solmar Bay handed in: ${shots.length} screenshot(s): ${shotBytes.join(', ')}`);
const dossierJson = JSON.parse(new TextDecoder().decode(dossier));
const textBytes = Buffer.byteLength(dossierJson.text, 'utf8');
const cut = dossierJson.text.includes('not shown');
console.log(`dossier.json: ${dossier.byteLength} bytes; text ${textBytes} / 163840 bytes${cut ? ' (some source cut to fit)' : ' (all source included)'}`);
