// Session builder. Pure functions only (no DOM, no storage) so it can be tested.
//
// Modeled on a Barry's-style week: every day has a body-part focus (Arms,
// Shoulders & Abs; Legs & Abs; Chest, Back & Abs...) shared by both rooms, and you pick the room:
//   Lift Room - strength only, heavier weights, all on the floor
//   Red Room  - treadmill intervals alternating with floor strength
// Training runs in continuous 4-week cycles: Base (3x10) -> Build (4x8) ->
// Peak (4x6) -> Deload, then repeats. It works the same at home or on the road.

import { EXERCISES, EX_BY_ID, isAvailable, primaryEquip, BW_CARDIO } from './exercises.js';
import { snapKg, toKg, loadStep } from './units.js';

export const TYPES = {
  lift: { label: 'Lift Room', short: 'Lift', sub: 'Strength. Heavier weights, all on the floor.' },
  red: { label: 'Red Room', short: 'Red', sub: 'Treadmill intervals + floor strength.' },
  rest: { label: 'Rest', short: 'Rest', sub: 'Recover, walk, stretch, sleep.' },
  recovery: { label: 'Recovery', short: 'Easy', sub: 'Easy cardio + mobility.' },
};
/** The choices offered for each day. Recovery is reachable from a rest day. */
export const ROOM_IDS = ['lift', 'red', 'rest'];

export const FOCI = {
  arms: { label: 'Arms, Shoulders & Abs', short: 'Arms & Shoulders' },
  legs: { label: 'Legs & Abs', short: 'Legs' },
  upper: { label: 'Chest, Back & Abs', short: 'Chest & Back' },
  core: { label: 'Abs & Butt', short: 'Abs & Butt' },
  fullLower: { label: 'Full Body · Lower Focus', short: 'Full Body · Lower' },
  fullUpper: { label: 'Full Body · Upper Focus', short: 'Full Body · Upper' },
};
export const FOCUS_IDS = Object.keys(FOCI);

/** Monday first. Your body-part calendar; any day can be changed or swapped. */
export const DEFAULT_FOCUS_WEEK = ['arms', 'legs', 'upper', 'core', 'fullLower', 'fullUpper', 'fullLower'];
/** Monday first. Lift and Red alternate through Saturday, Sunday off. */
export const DEFAULT_WEEK = ['lift', 'red', 'lift', 'red', 'lift', 'red', 'rest'];

export const PHASES = {
  1: { week: 1, name: 'Base', note: 'Groove the movements. Leave 2 reps in the tank.', mainSets: 3, mainReps: 10, accSets: 3, accReps: 12, rir: 2, bwMul: 1, floorReps: 12, speed: 0 },
  2: { week: 2, name: 'Build', note: 'One more set on the big lifts, a little heavier.', mainSets: 4, mainReps: 8, accSets: 3, accReps: 10, rir: 2, bwMul: 1.15, floorReps: 12, speed: 0.2 },
  3: { week: 3, name: 'Peak', note: 'Heaviest week. Leave just 1 rep in the tank on the big lifts.', mainSets: 4, mainReps: 6, accSets: 3, accReps: 8, rir: 1, bwMul: 1.3, floorReps: 10, speed: 0.4 },
  4: { week: 4, name: 'Deload', note: 'Lighter week so your body catches up. Next cycle starts stronger.', mainSets: 2, mainReps: 8, accSets: 2, accReps: 12, rir: 3, bwMul: 0.8, floorReps: 12, speed: -0.3 },
};

/* ------------------------------------------------------------------ dates */

export const pad = (n) => String(n).padStart(2, '0');
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseISO = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
export const weekday = (iso) => (parseISO(iso).getDay() + 6) % 7; // Mon = 0
export const mondayOf = (iso) => addDays(iso, -weekday(iso));
export const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 864e5);

/** Where a date sits in the repeating 4-week cycle. Weeks start on Monday. */
export function cycleInfo(iso, settings) {
  const start = mondayOf(settings.programStart || iso);
  const days = daysBetween(start, iso);
  const week = days < 0 ? 1 : Math.floor(days / 7) + 1;
  const programWeek = ((week - 1) % 4) + 1;
  return { start, week, programWeek, cycle: Math.floor((week - 1) / 4) + 1, phase: PHASES[programWeek] };
}

/** The room for a date: your pick for that day, else your usual week. */
export function typeFor(iso, plan, days = {}) {
  return days[iso]?.type || plan[weekday(iso)] || 'rest';
}

/** The body-part focus for a date: your pick for that day, else the weekly calendar. */
export function focusFor(iso, focusWeek = DEFAULT_FOCUS_WEEK, days = {}) {
  const f = days[iso]?.focus || focusWeek[weekday(iso)];
  return FOCI[f] ? f : 'fullLower';
}

/* ------------------------------------------------------------------ random */

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rng(seed) {
  let a = hash(String(seed));
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (list, r) => list[Math.floor(r() * list.length)];
function weightedPick(list, weights, r) {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = r() * total;
  for (let i = 0; i < list.length; i += 1) { x -= weights[i]; if (x <= 0) return list[i]; }
  return list[list.length - 1];
}
function shuffle(list, r) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* ------------------------------------------------------------------ picking */

/** Every move that fits a slot's patterns with the kit on hand. */
export function candidatesFor(patterns, equipment) {
  return EXERCISES.filter((e) => patterns.includes(e.pattern) && isAvailable(e, equipment));
}

function chooseExercise(patterns, { equipment, used, r, main, preferred }) {
  const usedNames = new Set([...used].map((id) => EX_BY_ID[id]?.name));
  const pref = preferred && EX_BY_ID[preferred];
  if (pref && patterns.includes(pref.pattern) && isAvailable(pref, equipment) && !used.has(pref.id)) return pref;
  let list = candidatesFor(patterns, equipment).filter((e) => !used.has(e.id) && !usedNames.has(e.name));
  if (!list.length) return null;
  if (main) {
    const mains = list.filter((e) => e.main);
    if (mains.length) list = mains;
    const loaded = list.filter((e) => e.load === 'w');
    if (loaded.length) list = loaded;
  }
  const hasLoaded = list.some((e) => e.load === 'w');
  const weights = list.map((e) => (e.pattern === patterns[0] ? 2 : 1) * (hasLoaded && e.load === 'w' ? 5 : 1));
  return weightedPick(list, weights, r);
}

const round5 = (n) => Math.max(5, Math.round(n / 5) * 5);

function makeItem(ex, role, phase, settings, short = false) {
  const main = role === 'main';
  const floor = role === 'floor';
  let reps = floor ? phase.floorReps : main ? phase.mainReps : phase.accReps;
  if (ex.load === 'bw') reps = Math.max(3, Math.round((ex.base || 12) * phase.bwMul));
  if (ex.load === 't') reps = round5((ex.base || 30) * phase.bwMul);
  const sets = main ? phase.mainSets : phase.accSets;
  const rest = main ? settings.restMain : settings.restAcc;
  return {
    exId: ex.id,
    role,
    // Short sessions keep the quality but trim volume and rest.
    sets: short ? Math.min(sets, 3) : sets,
    reps,
    rir: floor ? 3 : phase.rir,
    rest: short ? Math.min(rest, main ? 90 : 45) : rest,
  };
}

/* ------------------------------------------------------------------ lift */

const LIFT_SLOTS = {
  arms: { m1: ['push_v'], m2: ['pull_v', 'pull_h'], a1: ['bi'], a2: ['tri'], a3: ['shoulder'], a4: ['shoulder', 'push_v'], a5: ['bi', 'tri'], c1: ['core'] },
  legs: { m1: ['squat'], m2: ['hinge'], a1: ['lunge'], a2: ['ham', 'hinge'], a3: ['glute'], a4: ['quad', 'lunge'], a5: ['calf', 'glute'], c1: ['core'] },
  upper: { m1: ['push_h'], m2: ['pull_h', 'pull_v'], a1: ['pull_v', 'pull_h'], a2: ['push_h'], a3: ['pull_h', 'pull_v'], a4: ['core'], a5: ['push_h', 'push_v'], c1: ['core'] },
  core: { m1: ['glute', 'hinge'], m2: ['squat', 'lunge'], a1: ['core'], a2: ['glute'], a3: ['lunge', 'ham'], a4: ['core'], a5: ['glute', 'hinge'], c1: ['core'] },
  fullLower: { m1: ['squat'], m2: ['hinge'], a1: ['push_h', 'push_v'], a2: ['lunge'], a3: ['pull_h', 'pull_v'], a4: ['glute', 'ham'], a5: ['power'], c1: ['core'] },
  fullUpper: { m1: ['push_h', 'push_v'], m2: ['pull_h', 'pull_v'], a1: ['squat', 'lunge'], a2: ['push_v', 'push_h'], a3: ['pull_v', 'pull_h'], a4: ['hinge', 'glute'], a5: ['shoulder', 'bi', 'tri'], c1: ['core'] },
};
const LIFT_LAYOUT = {
  30: [['m1'], ['m2', 'a1'], ['a2', 'c1']],
  45: [['m1'], ['m2'], ['a1', 'a2'], ['a3', 'c1']],
  60: [['m1'], ['m2'], ['a1', 'a2'], ['a3', 'a4'], ['a5', 'c1']],
};

const WARMUPS = {
  arms: ['Jumping Jacks', 'Arm Circles', 'Scap Push-ups', 'Thoracic Rotations', 'Dead Bugs'],
  legs: ['Jumping Jacks', 'Air Squats', "World's Greatest Stretch", 'Glute Bridges', 'Lateral Lunges'],
  upper: ['Jumping Jacks', 'Arm Circles', 'Inchworm to Push-up', 'Thoracic Rotations', 'Scap Push-ups'],
  core: ['Jumping Jacks', 'Glute Bridges', 'Dead Bugs', "World's Greatest Stretch", 'Air Squats'],
  fullLower: ['Jumping Jacks', 'Air Squats', "World's Greatest Stretch", 'Glute Bridges', 'Inchworm to Push-up'],
  fullUpper: ['Jumping Jacks', 'Arm Circles', 'Inchworm to Push-up', 'Air Squats', 'Scap Push-ups'],
};
const STRETCHES = ['Hamstring Stretch', 'Hip Flexor Stretch · left', 'Hip Flexor Stretch · right', "Child's Pose", 'Chest Opener', 'Figure-4 Stretch'];
const MOBILITY = ['Cat-Cow', "World's Greatest Stretch · left", "World's Greatest Stretch · right", '90/90 Hip Switches', 'Thread the Needle', 'Deep Squat Hold', 'Pigeon · left', 'Pigeon · right', 'Thoracic Rotations', "Child's Pose"];

const bucket = (minutes) => (minutes <= 35 ? 30 : minutes <= 50 ? 45 : 60);
const equipKey = (s) => [...(s.equipment || [])].sort().join('+') || 'bw';

/** A deterministic session for a date. Main lifts stay put through the cycle
 *  (so you can add weight week to week); accessories rotate weekly. */
export function buildSession({ date, type, focus, settings, swaps = {}, salt = 0 }) {
  const cyc = cycleInfo(date, settings);
  const phase = cyc.phase;
  const mins = bucket(settings.minutes || 45);
  const base = { date, type, focus, phase: phase.name, phaseNote: phase.note, programWeek: cyc.programWeek, minutes: mins };
  if (type === 'rest') return { ...base, title: 'Rest day', blocks: [], estMin: 0 };
  if (type === 'recovery') return { ...base, title: 'Active recovery', ...recoveryBlocks(settings, mins, `${date}|${salt}`) };
  if (type === 'red') return { ...base, title: `Red Room · ${FOCI[focus].label}`, ...redBlocks(date, focus, settings, phase, mins, salt, swaps) };
  return { ...base, title: `Lift Room · ${FOCI[focus].label}`, ...liftBlocks(focus, settings, phase, mins, salt, swaps, cyc.programWeek, date) };
}

function liftBlocks(focus, settings, phase, mins, salt, swaps, week, date) {
  const slots = LIFT_SLOTS[focus];
  const eq = settings.equipment || [];
  const used = new Set();
  const blocks = [];
  blocks.push({ id: 'warmup', kind: 'timed', title: 'Warm-up', segments: WARMUPS[focus].slice(0, mins === 30 ? 4 : 5).map((label) => ({ label, sec: 40 })) });
  const letters = 'ABCDEFG';
  LIFT_LAYOUT[mins].forEach((group, gi) => {
    const items = [];
    for (const slot of group) {
      const main = slot.startsWith('m');
      const seed = main ? `main|${focus}|${equipKey(settings)}|${slot}|${salt}` : `acc|${focus}|${equipKey(settings)}|${week}|${slot}|${salt}`;
      const ex = chooseExercise(slots[slot], { equipment: eq, used, r: rng(seed), main, preferred: swaps[`lift:${focus}:${slot}`] });
      if (!ex) continue;
      used.add(ex.id);
      items.push({ ...makeItem(ex, main ? 'main' : 'acc', phase, settings, mins === 30), slot, swapKey: `lift:${focus}:${slot}` });
    }
    if (!items.length) return;
    if (items.length > 1) {
      // Superset: go straight from the first move to the next, rest after the last.
      const rest = Math.max(...items.map((i) => i.rest));
      items.forEach((it, i) => { it.rest = i < items.length - 1 ? 15 : Math.min(rest, 90); });
      const sets = Math.max(...items.map((i) => i.sets));
      items.forEach((it) => { it.sets = sets; });
    }
    blocks.push({ id: letters[gi], kind: 'strength', title: letters[gi], style: items.length > 1 ? 'superset' : 'straight', items });
  });
  if (settings.finisher) blocks.push(finisher(settings, mins, phase, `${date}|${salt}`));
  blocks.push(cooldown(mins));
  // Bodyweight sessions run long (more reps); drop an accessory pair to fit,
  // never the last block, which carries the abs.
  const strength = () => blocks.filter((b) => b.kind === 'strength');
  while (estimate(blocks) > mins + 8 && strength().length > 3) blocks.splice(blocks.indexOf(strength().at(-2)), 1);
  return { blocks, estMin: estimate(blocks) };
}

function cooldown(mins) {
  return { id: 'cooldown', kind: 'timed', title: 'Cool-down', segments: STRETCHES.slice(0, mins === 30 ? 3 : 5).map((label) => ({ label, sec: 40 })) };
}

/** A short burst of cardio at the end of a Lift day. */
function finisher(settings, mins, phase, seed) {
  const rounds = { 30: 4, 45: 6, 60: 8 }[mins];
  const r = rng(`fin|${seed}`);
  const segs = [];
  for (let i = 0; i < rounds; i += 1) {
    segs.push(cardioSeg({ sec: 30, level: 'sprint', incline: 1 }, settings, phase, r));
    segs.push(cardioSeg({ sec: 30, level: 'walk', incline: 1 }, settings, phase, r));
  }
  return { id: 'finisher', kind: 'intervals', title: 'Cardio finisher', sub: `${rounds} x 30 s hard / 30 s easy`, segments: segs };
}

/* ------------------------------------------------------------------ red */

const T = (sec, level, incline = 1, d = 0) => ({ sec, level, incline, d });
export const TREAD_TEMPLATES = {
  pyramid: { name: 'Pyramid', segs: [T(60, 'base'), T(60, 'push'), T(30, 'sprint'), T(30, 'walk'), T(60, 'base'), T(90, 'push'), T(30, 'sprint'), T(30, 'walk'), T(60, 'base'), T(120, 'push'), T(45, 'sprint'), T(45, 'walk')] },
  hills: { name: 'Hill climb', segs: [T(60, 'base', 2), T(60, 'base', 4), T(60, 'base', 6), T(60, 'base', 8), T(45, 'walk'), T(60, 'push', 2), T(60, 'push', 4), T(30, 'sprint'), T(45, 'walk'), T(60, 'push', 6), T(30, 'sprint'), T(30, 'walk')] },
  sprints: { name: 'Sprint ladder', segs: [T(60, 'base'), T(30, 'sprint'), T(30, 'base'), T(30, 'sprint', 1, 0.3), T(30, 'base'), T(45, 'sprint'), T(45, 'walk'), T(60, 'base'), T(30, 'sprint'), T(30, 'base'), T(30, 'sprint', 1, 0.3), T(30, 'base'), T(45, 'sprint', 1, 0.5), T(45, 'walk')] },
  tempo: { name: 'Tempo build', segs: [T(120, 'base'), T(120, 'push'), T(60, 'base'), T(120, 'push', 1, 0.2), T(60, 'base'), T(60, 'push', 1, 0.4), T(30, 'sprint'), T(60, 'walk')] },
  rolling: { name: 'Rolling hills', segs: [T(60, 'base'), T(60, 'push', 3), T(60, 'base'), T(60, 'push', 5), T(60, 'base'), T(30, 'sprint'), T(30, 'walk')] },
};

/** Take segments in order (looping) until the block is full; end on a recovery. */
export function fillTemplate(segs, targetSec) {
  const out = [];
  let total = 0;
  for (let i = 0; i < 200; i += 1) {
    const s = segs[i % segs.length];
    if (total + s.sec > targetSec + 10) break;
    out.push({ ...s });
    total += s.sec;
  }
  const left = targetSec - total;
  if (left >= 20) out.push(T(left, 'walk'));
  else if (left > 0 && out.length) out[out.length - 1].sec += left;
  return out;
}

const LEVEL_LABEL = { walk: 'Recover', base: 'Base', push: 'Push', sprint: 'All out' };
const EFFORT = {
  bike: { walk: 'Easy spin · RPE 3', base: 'Steady · RPE 5', push: 'Hard · RPE 7, add resistance', sprint: 'All out · RPE 9' },
  rower: { walk: 'Easy paddle · 20 spm', base: 'Steady · 24 spm', push: 'Hard · 28 spm', sprint: 'All out · 32+ spm' },
  run: { walk: 'Walk it off', base: 'Easy jog · RPE 5', push: 'Strong run · RPE 7', sprint: 'Sprint · RPE 9' },
};

/** Turn a level ("push") into something to do on the machine you have. */
function cardioSeg(seg, settings, phase, r) {
  const machine = settings.cardio || 'treadmill';
  const out = { sec: seg.sec, level: seg.level, label: LEVEL_LABEL[seg.level] };
  if (machine === 'treadmill') {
    const sp = settings.speeds || {};
    const bump = seg.level === 'push' || seg.level === 'sprint' ? phase.speed : 0;
    out.mph = Math.max(1, (sp[seg.level] ?? 5) + (seg.d || 0) + bump);
    out.incline = seg.incline ?? 1;
  } else if (machine === 'none') {
    if (seg.level === 'walk') out.effort = 'Rest · shake it out';
    else if (seg.level === 'base') out.effort = 'Jog in place · RPE 5';
    else { out.move = pick(BW_CARDIO, r); out.effort = seg.level === 'sprint' ? 'Max effort' : 'Hard · RPE 7'; }
  } else {
    out.effort = EFFORT[machine][seg.level];
    if (machine === 'run' && seg.incline >= 4 && seg.level !== 'walk') out.effort += ' · uphill if you can';
  }
  return out;
}

const RED_SIZE = { 30: { warm: 180, tread: 360, rounds: 2, moves: 3 }, 45: { warm: 300, tread: 540, rounds: 3, moves: 3 }, 60: { warm: 300, tread: 720, rounds: 3, moves: 4 } };
const FLOOR_PATTERNS = {
  arms: ['bi', 'tri', 'shoulder', 'push_v', 'shoulder', 'bi'],
  legs: ['squat', 'hinge', 'lunge', 'glute', 'ham', 'quad'],
  upper: ['push_h', 'pull_h', 'pull_v', 'push_h', 'pull_h', 'push_v'],
  core: ['glute', 'core', 'hinge', 'lunge', 'core', 'glute'],
  fullLower: ['squat', 'hinge', 'lunge', 'push_h', 'glute', 'pull_h'],
  fullUpper: ['push_h', 'pull_h', 'push_v', 'squat', 'pull_v', 'lunge'],
};

function redBlocks(date, focus, settings, phase, mins, salt, swaps) {
  const size = RED_SIZE[mins];
  const r = rng(`red|${date}|${focus}|${salt}`);
  const machine = settings.cardio || 'treadmill';
  const machineName = { treadmill: 'Tread', bike: 'Bike', rower: 'Row', run: 'Run', none: 'Cardio' }[machine];
  const [t1, t2] = shuffle(Object.keys(TREAD_TEMPLATES), r);
  const warm = fillTemplate([T(60, 'walk'), T(120, 'base', 1, -1), T(60, 'base'), T(30, 'push'), T(30, 'walk')], size.warm).map((s) => cardioSeg(s, settings, phase, r));
  const tread = (key, n) => ({ id: `cardio${n}`, kind: 'intervals', title: `${machineName} ${n}`, sub: TREAD_TEMPLATES[key].name, segments: fillTemplate(TREAD_TEMPLATES[key].segs, size.tread).map((s) => cardioSeg(s, settings, phase, r)) });
  const used = new Set();
  const patterns = shuffle(FLOOR_PATTERNS[focus], r);
  // Floor work is dumbbells, a bench, bands and bodyweight; skip barbells and machines if there are dumbbells.
  const all = settings.equipment || [];
  const floorKit = all.includes('db') || all.includes('kb') ? all.filter((e) => e !== 'barbell' && e !== 'machine') : all;
  const floor = (n) => {
    const items = [];
    const mine = patterns.slice((n - 1) * (size.moves - 1)).concat(patterns).slice(0, size.moves - 1);
    [...mine.map((p) => [p]), ['core']].forEach((pats, i) => {
      const key = `red:${focus}:f${n}${i}`;
      const ex = chooseExercise(pats, { equipment: floorKit, used, r, main: false, preferred: swaps[key] });
      if (!ex) return;
      used.add(ex.id);
      items.push({ ...makeItem(ex, 'floor', phase, settings), sets: size.rounds, rest: 15, slot: `f${n}${i}`, swapKey: key });
    });
    if (items.length) items[items.length - 1].rest = 45;
    return { id: `floor${n}`, kind: 'strength', style: 'circuit', title: `Floor ${n}`, sub: `${size.rounds} rounds, move to move`, items };
  };
  const blocks = [
    { id: 'warmup', kind: 'intervals', title: 'Warm-up', sub: machine === 'none' ? 'Get the heart rate up' : `Easy on the ${machine === 'run' ? 'road' : machine}`, segments: warm },
    tread(t1, 1), floor(1), tread(t2, 2), floor(2),
    cooldown(mins === 30 ? 30 : 45),
  ];
  return { blocks, estMin: estimate(blocks) };
}

/* ------------------------------------------------------------------ recovery */

function recoveryBlocks(settings, mins, seed) {
  const r = rng(`rec|${seed}`);
  const machine = settings.cardio || 'treadmill';
  const easySec = Math.max(15, mins - 15) * 60;
  let easy;
  if (machine === 'treadmill') easy = { sec: easySec, level: 'walk', label: 'Incline walk', mph: settings.speeds?.walk ?? 3.3, incline: 8, effort: 'Conversational pace' };
  else if (machine === 'none') easy = { sec: easySec, level: 'base', label: 'Easy walk', effort: 'Outside if you can. Conversational pace.' };
  else easy = { sec: easySec, level: 'base', label: 'Zone 2', effort: `${{ bike: 'Easy ride', rower: 'Easy row', run: 'Easy jog or brisk walk' }[machine]} · you can still talk` };
  const flow = shuffle(MOBILITY.slice(0, -1), r).slice(0, 7).concat("Child's Pose").map((label) => ({ label, sec: 60 }));
  const blocks = [
    { id: 'easy', kind: 'intervals', title: 'Easy cardio', sub: 'Zone 2, keep it light', segments: [easy] },
    { id: 'mobility', kind: 'timed', title: 'Mobility flow', segments: flow },
  ];
  return { blocks, estMin: estimate(blocks) };
}

/* ------------------------------------------------------------------ estimates */

function itemSeconds(it) {
  const ex = EX_BY_ID[it.exId];
  const work = ex.load === 't' ? it.reps : it.reps * 3;
  return it.sets * (work * (ex.uni ? 2 : 1) + it.rest);
}
export function estimate(blocks) {
  let s = 0;
  for (const b of blocks) {
    if (b.kind === 'strength') s += b.items.reduce((a, it) => a + itemSeconds(it), 0);
    else s += b.segments.reduce((a, x) => a + x.sec, 0);
    s += 30; // moving between blocks
  }
  return Math.round(s / 60);
}

export const blockSeconds = (b) => (b.segments || []).reduce((a, x) => a + x.sec, 0);

/* ------------------------------------------------------------------ swaps */

/** Other moves for the same slot with the kit on hand. */
export function alternatives(item, block, focus, type, equipment) {
  let patterns;
  if (type === 'lift') patterns = LIFT_SLOTS[focus][item.slot];
  else patterns = [EX_BY_ID[item.exId].pattern];
  const taken = new Set(block.items.map((i) => i.exId));
  return candidatesFor(patterns, equipment).filter((e) => e.id === item.exId || !taken.has(e.id));
}

/* ------------------------------------------------------------------ loads */

const e1rm = (w, reps) => w * (1 + reps / 30); // Epley

/** Last time you did this exercise: { date, sets, targetReps, rir }. */
export function lastPerformance(history, exId, beforeDate) {
  const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date) || (b.endedAt || 0) - (a.endedAt || 0));
  for (const s of sorted) {
    if (beforeDate && s.date > beforeDate) continue;
    const e = (s.entries || []).find((x) => x.exId === exId && x.sets.some((y) => y.reps > 0));
    if (e) return { date: s.date, ...e, sets: e.sets.filter((y) => y.reps > 0) };
  }
  return null;
}

/**
 * Suggested working weight (kg) for an item, from what you lifted last time.
 * Uses an estimated max (with the reps you had left in the tank) to translate
 * between rep schemes, then adds a step if you hit every rep last time.
 */
export function suggestLoad(history, item, unit, beforeDate) {
  const ex = EX_BY_ID[item.exId];
  if (!ex || ex.load !== 'w') return null;
  const last = lastPerformance(history, item.exId, beforeDate);
  if (!last) return null;
  const sets = last.sets.filter((s) => s.w > 0);
  if (!sets.length) return null;
  const rir = last.rir ?? 2;
  const top = Math.max(...sets.map((s) => s.w));
  const est = Math.max(...sets.map((s) => e1rm(s.w, s.reps + rir)));
  const allHit = sets.length >= (last.targetSets || sets.length) && sets.every((s) => s.reps >= (last.targetReps || s.reps));
  const equip = primaryEquip(ex);
  const step = toKg(loadStep(unit, equip), unit);
  let kg = snapKg(est / (1 + (item.reps + item.rir) / 30), unit, equip);
  // Same scheme as last time and every rep hit: add a step. Other schemes trust the estimate.
  if (allHit && item.reps === last.targetReps && item.rir === rir && kg <= top + 1e-6) kg = snapKg(top + step, unit, equip);
  if (!allHit && kg > top) kg = snapKg(top, unit, equip);
  return { kg, lastKg: top, lastReps: Math.max(...sets.map((s) => s.reps)), date: last.date, up: kg > top + 1e-6, down: kg < top - 1e-6 };
}

/* ------------------------------------------------------------------ stats */

export function sessionVolume(s) {
  let v = 0;
  for (const e of s.entries || []) for (const x of e.sets) if (x.w > 0) v += x.w * x.reps;
  return v;
}

/** Best estimated 1-rep max per weighted exercise. */
export function personalBests(history) {
  const best = new Map();
  for (const s of history) {
    for (const e of s.entries || []) {
      const ex = EX_BY_ID[e.exId];
      if (!ex || ex.load !== 'w') continue;
      for (const x of e.sets) {
        if (!(x.w > 0 && x.reps > 0)) continue;
        const est = x.reps === 1 ? x.w : e1rm(x.w, Math.min(x.reps, 12));
        const cur = best.get(e.exId);
        if (!cur || est > cur.est) best.set(e.exId, { exId: e.exId, est, w: x.w, reps: x.reps, date: s.date });
      }
    }
  }
  return [...best.values()].sort((a, b) => b.est - a.est);
}

/** Exercises in a finished session that beat every earlier session. */
export function newBests(history, session) {
  const before = history.filter((s) => s.id !== session.id && s.date <= session.date);
  const prior = new Map(personalBests(before).map((b) => [b.exId, b.est]));
  return personalBests([session]).filter((b) => prior.has(b.exId) && b.est > prior.get(b.exId) + 1e-6);
}

