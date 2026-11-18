# Solmar Bay: Neon Tide

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/RaynaldyRyan/solmar-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/RaynaldyRyan/solmar-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game built for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01): a neon 80s Miami-style city — mainland, barrier island and port peninsula joined by two causeways — with 7 story jobs, a 5-star police AI, on-foot combat, street racing, collectibles, properties and 3 procedural radio stations. Everything is original: no Rockstar/GTA content, no assets, no network — every texture is drawn at boot from the city plan.

New to make.fun? Sign up with my referral link: https://make.fun/r/rhhrb4xy

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

Desktop Chrome. W A S D to drive/walk, mouse to aim and shoot on foot, Space for the handbrake, Shift for nitro, F to enter a car or interact, M for the full-screen city map, R for the radio, Esc to pause.

## What's in the game

- **City**: 7 named districts with distinct looks and landmarks (Solmar Tower, Neon Pier, Harbor Lighthouse, Solmar Stadium, Fountain Plaza, Calle Ocho Market, Container Terminal), 2 causeways, beach, marina docks.
- **Story**: 7 jobs with staged chapters, payouts ($1,200–$40,000) and respect rewards — delivery, stealth tailing, escape, shootout, two heists and a finale.
- **Police**: wanted 0–5, cruiser AI with PURSUIT / RAMMING / ROADBLOCK / SEARCHING states, helicopter with spotlight at 3+ stars, live dispatch feed, search-zone cooldown.
- **Systems**: 20 Sunset Tapes, 3 buyable properties with daily income, respect level, drift/near-miss scoring, nitro, street-race side job, respray garage ($500 clears heat), safehouse save, weapon dealer, 6 vehicle archetypes, 5 weapons.
- **Presentation**: time-of-day sky (sunset at 18:50, dusk at 19:45), neon signs, palm-lined Ocean Drive, canvas-drawn character portraits, dialogue, dense readable HUD with circular minimap.

## Layout

- `game/index.html` + `game/style.css` — page and HUD.
- `game/src/main.js` — boot, loop, screens (the architecture map is in its header comment).
- `game/src/city.js` — the plan, buildings, palms, signs, tapes (one `drawPlan` for ground texture, minimap and map).
- `game/src/render3d.js` — Three.js scene (merged geometry, sky keyframes, cars, heli, tracers).
- `game/src/world.js` — the simulation; `vehicles.js` physics; `police.js` AI; `missions.js` jobs; `combat.js` shooting; `radio.js` procedural stations; `hud.js` panels; `portraits.js` faces; `shots.js` the 4 screenshot scenes.
- `game/vendor/three.min.js` — Three.js r128 (MIT), the only library.

## Licence

MIT — see [LICENSE](LICENSE).
