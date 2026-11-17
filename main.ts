// Solmar Bay — make.fun gta6-01 entrypoint (Node 22, standard library only).
//
// The game is this directory's game/ folder: plain static files a desktop
// browser loads offline — game/index.html plus its ES modules and a vendored
// three.js build under game/vendor/, with zero network requests. This program
// hands it in: it copies game/ and screenshots/ from beside this file to
// /output and writes /output/dossier.json, the summary the judge reads, using
// the vendored make.fun library.
//
// The game itself is a complete open-world crime game: a sun-soaked coastal
// city (Solmar Bay) explorable on foot and by car, with traffic, pedestrians,
// a 5-star wanted system and police who chase, ram and arrest, fists-and-pistol
// combat, rival gunmen, a 5-mission story plus repeatable courier runs, a
// minimap HUD, a day cycle, procedural audio, and a localStorage save.
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

// Summary for the builder: dossier bytes plus a real recursive count of the
// game files and bytes, so a too-big entry is obvious at a glance.
function treeSize(dir) {
  let files = 0;
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = treeSize(p);
      files += sub.files;
      bytes += sub.bytes;
    } else {
      files += 1;
      bytes += statSync(p).size;
    }
  }
  return { files, bytes };
}
const gameTree = treeSize(join(out, 'game'));
const shotFiles = readdirSync(join(out, 'screenshots')).filter((f) => /\.(png|jpe?g)$/i.test(f));
console.log(`Solmar Bay dossier written: ${dossier.byteLength} bytes to ${join(out, 'dossier.json')}`);
console.log(`game/: ${gameTree.files} files, ${gameTree.bytes} bytes; screenshots: ${shotFiles.length} (${shotFiles.join(', ')})`);
