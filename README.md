# Solmar Bay

![gta6-01](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/RaynaldyRyan/solmar-bay/rank.svg)
![reward](https://make.fun/badge/gta6-01/RaynaldyRyan/solmar-bay/reward.svg)

An original open-world crime game built for the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01) on make.fun.

## The game

Milo Vane came home to Solmar Bay broke. Rosa needs a driver, the harbor crew
needs a wheelman, and the Solmar Bay PD needs a reason to chase you. Steal
cars, run jobs, stay ahead of the law — and make the bay yours.

Solmar Bay is a sun-soaked modern coastal city you can explore on foot and by
car: an 8×8 road grid of pastel procedural buildings, Central Plaza with its
fountain and palms, Palma Park, the Old Harbor, a beach with a pier, a
lighthouse and a Ferris wheel, and an ocean with boats — all under a full day
cycle that opens at golden hour.

## Systems

- **Open world** — drive or walk anywhere; traffic cars follow lanes, brake
  and turn; pedestrians stroll the sidewalks and flee gunfire.
- **Wanted system (0–5 stars)** — foot cops chase and arrest (BUSTED), cop
  cars pursue and ram, a helicopter hunts you at 4+ stars. Break line of
  sight to cool down, or pay $150 at the Spray & Save garage to clear your
  wanted level and repair your car.
- **Cars** — six archetypes (Comet sports car, sedan, taxi, pickup, van,
  coupe) with arcade physics, handbrake and damage smoke. Steal any car;
  stealing an occupied one earns a wanted star.
- **Combat** — fists and pistol, hitscan with building occlusion, tracers and
  muzzle flash; rival gunmen shoot back. Health and ammo pickups around town.
- **Story** — five missions with objectives, a tall beacon and minimap diamond
  marking each target, plus repeatable courier runs for cash.
- **Feel** — third-person camera, HUD with minimap, procedural WebAudio
  (engine, sirens, gunshots, ocean), start screen, pause menu and a
  localStorage save.

## How to play

Serve the `game/` folder and open it in desktop Chrome — no network needed:

```sh
node serve.ts
# then open http://localhost:8080
```

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Mouse | Camera |
| Space | Jump / handbrake |
| Shift | Sprint |
| E | Enter / exit car |
| F | Punch / shoot |
| Q | Switch weapon |
| R | Reload |
| M | Start the next mission |
| C | Courier run |
| P | Pause |

Deterministic screenshot staging: `?shot=city_drive|police_chase|plaza_foot|start_screen&seed=1`.

## Tech

Three.js 0.147.0 (vendored UMD build under `game/vendor/`), plain ES modules,
no build step, no network requests. Source is split into one file per system
under `game/src/` — see `game/src/main.js` for the wiring.

An original game. No affiliation with Rockstar Games or Grand Theft Auto.
