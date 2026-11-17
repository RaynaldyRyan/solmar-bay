![make.fun](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/RaynaldyRyan/solmar-bay/rank.svg)
![reward](https://make.fun/badge/gta6-01/RaynaldyRyan/solmar-bay/reward.svg)

# Solmar Bay

An original open-world crime game built for the [make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01). Everything here is original — its own city, characters, vehicles and story. No Rockstar assets, names or storylines.

You are Milo Vane, a driver new in town with $500 and a borrowed reputation. Solmar Bay is a sun-soaked modern coastal city: an 8×8 road grid of pastel blocks, Central Plaza with its fountain, Palma Park, the Old Harbor, a beach with a pier, a lighthouse and a Ferris wheel, and an ocean full of boats. A full day cycle starts at golden hour.

## What you can do

- **Explore on foot or by car** — third-person movement with sprint and jump, plus 6 car archetypes (sedan, coupe, sport, SUV, pickup, taxi) with arcade physics, handbrake drifts and damage smoke. Steal any car — taking an occupied one earns a wanted star and its driver flees.
- **Live streets** — traffic cars that follow lanes, turn at intersections and brake for you; pedestrians who stroll the sidewalks and flee gunfire.
- **Wanted system (0–5 stars)** — foot cops chase and arrest (get BUSTED), interceptor cars pursue and ram, and a helicopter with a spotlight joins at 4 stars. Break line of sight to cool the heat, or pay $150 at the Spray & Save garage to clear it and repair your car.
- **Combat** — fists and a pistol with hitscan shooting, tracers, muzzle flashes and building occlusion. Rival gunmen shoot back.
- **A story** — 5 missions (First Fare, The Solmar Job, Heat Wave, Pier Pressure, Grand Finale) with objectives marked by a tall beacon and a minimap diamond, plus repeatable courier runs that pay $120.
- **Polish** — HUD with stars, money, clock, health, weapon/ammo, speed and a live canvas minimap; start screen, pause menu, localStorage save, procedural WebAudio (engine, siren, gunshots, ocean), health/ammo pickups.

## How to play

Serve the game locally and open it in desktop Chrome:

```
node serve.ts
# then open http://localhost:8080
```

| Key | Action |
| --- | --- |
| WASD | Drive / walk |
| Mouse | Look (click the game to capture the mouse) |
| Left click | Shoot / punch |
| E | Enter / exit car |
| Space | Handbrake (in car) / jump (on foot) |
| Shift | Sprint |
| Q | Switch weapon (fists / pistol) |
| M | Start next mission |
| C | Courier run |
| Esc / P | Pause |

Screenshot staging is deterministic: `?shot=cover&seed=1`, `?shot=chase&seed=1`, `?shot=plaza&seed=1`, `?shot=menu&seed=1`.

## Structure

`game/src/` holds one module per system: `config.js` (tuning + mission data), `city.js` (world geometry + collision), `daycycle.js` (sun/sky), `vehicles.js` (car meshes + driving physics), `player.js` (character + camera), `traffic.js`, `pedestrians.js`, `police.js` (wanted system), `combat.js`, `missions.js`, `pickups.js`, `effects.js` (particles), `hud.js` (HUD + minimap), `audio.js` (procedural sound), `input.js`, `save.js`, `shots.js` (screenshot staging), `main.js` (game loop + states). Three.js 0.147.0 is vendored under `game/vendor/`.
