// Local-first persistence. Everything stays on this device (localStorage).
import { DEFAULT_WEEK, DEFAULT_FOCUS_WEEK, mondayOf, toISO } from './program.js';
import { LOCATIONS } from './exercises.js';

export const KEY = 'onyx.v1';

const usesPounds = () => {
  const lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
  return /-(US|LR|MM)$/i.test(lang) || /^en$/i.test(lang);
};

export const DEFAULTS = () => ({
  version: 4,
  settings: {
    unit: usesPounds() ? 'lb' : 'kg',
    theme: 'auto',
    minutes: 45,
    location: 'gym',
    equipment: [...LOCATIONS[0].equipment],
    cardio: LOCATIONS[0].cardio,
    speeds: { walk: 3.5, base: 6.0, push: 7.5, sprint: 9.0 }, // mph
    finisher: true,
    sound: true,
    restMain: 120,
    restAcc: 60,
    dbOnly: true, // dumbbells and bodyweight only, like the studio floor
    goal: DEFAULT_WEEK.filter((t) => t !== 'rest').length, // sessions a week
    programStart: mondayOf(toISO(new Date())), // week 1 of the current 4-week cycle
    onboarded: false,
  },
  plan: [...DEFAULT_WEEK], // Mon..Sun room: lift | red | rest
  focusWeek: [...DEFAULT_FOCUS_WEEK], // Mon..Sun body-part focus
  days: {}, // 'YYYY-MM-DD' -> { type, focus, salt } picks for a single day
  swaps: {}, // slot key -> exercise id you prefer
  sessions: [], // finished workouts
  active: null, // the workout in progress
});

// Version 1 used trip dates, a recovery day in the plan and four focus names.
// Version 2 had one Full Body focus and weekends off.
const V1_FOCUS = { lower: 'legs', upper: 'upper', full: 'full', arms: 'arms' };
const V2_WEEK = ['lift', 'red', 'lift', 'red', 'lift', 'rest', 'rest'];
const fullV3 = (f) => (f === 'full' ? 'fullLower' : f);

export function migrate(parsed) {
  let out = parsed;
  if ((out.version || 1) < 2) {
    const s = { ...(out.settings || {}) };
    if (s.tripStart && !s.programStart) s.programStart = s.tripStart;
    delete s.tripStart; delete s.tripWeeks;
    const days = {};
    for (const [d, v] of Object.entries(out.days || {})) {
      const nv = { ...v };
      if (nv.focus) nv.focus = V1_FOCUS[nv.focus] || 'full';
      if (nv.type === 'recovery') nv.type = 'rest';
      days[d] = nv;
    }
    const plan = Array.isArray(out.plan) ? out.plan.map((t) => (t === 'recovery' ? 'rest' : t)) : undefined;
    out = { ...out, version: 2, settings: s, days, plan, swaps: {} };
  }
  if (out.version < 3) {
    // New body-part calendar for every week; your single-day changes are kept.
    const s = { ...(out.settings || {}) };
    const wasDefault = !Array.isArray(out.plan) || out.plan.join() === V2_WEEK.join();
    const plan = wasDefault ? [...DEFAULT_WEEK] : out.plan;
    if (wasDefault && (s.goal == null || s.goal === 5)) s.goal = DEFAULT_WEEK.filter((t) => t !== 'rest').length;
    const days = {};
    for (const [d, v] of Object.entries(out.days || {})) days[d] = v.focus ? { ...v, focus: fullV3(v.focus) } : v;
    const sessions = (out.sessions || []).map((x) => (x.focus === 'full' ? { ...x, focus: 'fullLower' } : x));
    out = { ...out, version: 3, settings: s, plan, focusWeek: [...DEFAULT_FOCUS_WEEK], days, sessions };
  }
  if (out.version < 4) {
    // Studio style: dumbbells and bodyweight only, on by default.
    out = { ...out, version: 4, settings: { ...(out.settings || {}), dbOnly: true } };
  }
  return out;
}

let state = load();
const listeners = new Set();

function merge(raw) {
  const parsed = migrate(raw);
  const base = DEFAULTS();
  return {
    ...base,
    ...parsed,
    settings: { ...base.settings, ...(parsed.settings || {}), speeds: { ...base.settings.speeds, ...(parsed.settings?.speeds || {}) } },
    plan: Array.isArray(parsed.plan) && parsed.plan.length === 7 ? parsed.plan : base.plan,
    focusWeek: Array.isArray(parsed.focusWeek) && parsed.focusWeek.length === 7 ? parsed.focusWeek : base.focusWeek,
    days: parsed.days || {},
    swaps: parsed.swaps || {},
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? merge(JSON.parse(raw)) : DEFAULTS();
  } catch {
    return DEFAULTS();
  }
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (err) { console.warn('Could not save', err); }
  listeners.forEach((fn) => fn(state));
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const store = {
  get state() { return state; },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  /** Mutate state in a callback, then persist once. */
  update(fn) { fn(state); save(); },
  /** Save without notifying (used while typing reps so inputs keep focus). */
  quietSave() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} },
  exportJSON() { return JSON.stringify({ app: 'onyx', exportedAt: new Date().toISOString(), ...state }, null, 2); },
  importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || !('settings' in parsed)) throw new Error('Not an Onyx backup');
    state = merge(parsed);
    save();
  },
  reset() { state = DEFAULTS(); save(); },
};
