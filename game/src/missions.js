// The 7 story jobs: each has a chapter, a location, staged objectives, a
// payout and a respect reward. The staged save has 3 complete, CH4 in
// progress and 3 locked — the map screen shows all seven with their states.
export const JOBS = [
  {
    id: 'ch1', chapter: 1, name: 'First Light Delivery',
    kind: 'Delivery', at: [640, -520], payout: 1200, respect: 10,
    blurb: 'Run a sealed package across the north causeway before sunrise.',
    stages: ['Pick up the package at the Strip', 'Cross the north causeway', 'Deliver to the North Shore lockup'],
  },
  {
    id: 'ch2', chapter: 2, name: 'Tail the Courier',
    kind: 'Stealth', at: [-700, 40], payout: 2400, respect: 15,
    blurb: 'Follow the courier through Little Sol without being spotted.',
    stages: ['Find the courier in Little Sol', 'Tail him — stay 30m back', 'Photograph the handoff'],
  },
  {
    id: 'ch3', chapter: 3, name: 'Midnight Getaway',
    kind: 'Escape', at: [-150, -40], payout: 3800, respect: 20,
    blurb: 'Shake a 3-star tail and reach the safehouse with the ledger.',
    stages: ['Grab the ledger from the Tower', 'Lose the 3-star tail', 'Reach the Neon Palms safehouse'],
  },
  {
    id: 'ch4', chapter: 4, name: 'The Marina Exchange',
    kind: 'Shootout', at: [700, 420], payout: 8500, respect: 30,
    blurb: 'Meet Vera at the marina, hold off the Harbor Boys, escape by car.',
    stages: ['Meet Vera at Marina Slip 7', 'Hold off the Harbor Boys', 'Take the coupe and run', 'Lose the heat at the respray'],
  },
  {
    id: 'ch5', chapter: 5, name: 'Heist at the Solmar Tower',
    kind: 'Heist', at: [-150, -40], payout: 15000, respect: 40,
    blurb: 'Crack the Tower vault in a 6-minute window before the gala ends.',
    stages: ['Enter the Tower as catering', 'Crack the vault — 6:00 on the clock', 'Exit through the parking garage'],
  },
  {
    id: 'ch6', chapter: 6, name: 'The Container Job',
    kind: 'Heist', at: [430, 490], payout: 22000, respect: 50,
    blurb: 'Lift one container from the port terminal under the cranes.',
    stages: ['Sneak past the port gate', 'Hook the marked container', 'Drive it out to the buyer'],
  },
  {
    id: 'ch7', chapter: 7, name: 'Neon Finale',
    kind: 'Finale', at: [700, -300], payout: 40000, respect: 80,
    blurb: 'One last race down Ocean Drive, then settle it with Sal at the pier.',
    stages: ['Win the Ocean Drive finale race', 'Face Sal at the Neon Pier', 'Walk away a legend'],
  },
];

export function jobById(id) {
  return JOBS.find((j) => j.id === id) || null;
}

// Mission runtime state: the active job, its stage, its timer and the
// per-stage sub-status the HUD's mission card shows.
export function createMission(save) {
  const active = save.jobActive ? jobById(save.jobActive) : null;
  return {
    active,
    stage: save.jobStage || 0,
    timer: active ? 240 : 0,
    subStatus: active ? 'In progress' : 'No active job',
    done: new Set(save.jobsDone || []),
  };
}

export function missionObjective(mission) {
  if (!mission.active) return 'Free roam — visit a job marker to start work.';
  return mission.active.stages[Math.min(mission.stage, mission.active.stages.length - 1)];
}

export function missionNext(mission) {
  if (!mission.active) return '—';
  const next = mission.stage + 1;
  if (next >= mission.active.stages.length) return 'Finish the job';
  return mission.active.stages[next];
}

// Stage timers: CH4 stage 3 (the escape) runs a 4-minute clock; finishing a
// stage pays a slice of the payout and advances the chapter.
export function updateMission(mission, state, dt) {
  if (!mission.active) return;
  if (mission.timer > 0) mission.timer -= dt;
  if (mission.timer <= 0 && mission.active.id === 'ch5') {
    mission.subStatus = 'Clock expired — the job failed';
  }
}

export function advanceStage(mission, state) {
  if (!mission.active) return;
  mission.stage += 1;
  if (mission.stage >= mission.active.stages.length) {
    state.cash += mission.active.payout;
    state.respect = Math.min(100, state.respect + mission.active.respect);
    mission.done.add(mission.active.id);
    const idx = JOBS.findIndex((j) => j.id === mission.active.id);
    const next = JOBS[idx + 1] || null;
    mission.active = next;
    mission.stage = 0;
    mission.timer = next ? 240 : 0;
    mission.subStatus = next ? 'New job available' : 'All jobs complete';
  } else {
    mission.subStatus = 'Stage complete';
  }
}

export function formatTimer(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
