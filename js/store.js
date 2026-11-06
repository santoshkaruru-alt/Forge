// Local-first persistence. Everything stays on this device (localStorage).
import { DEFAULT_WEEK, DEFAULT_FOCUS_WEEK, mondayOf, toISO } from './program.js';
import { LOCATIONS } from './exercises.js';

export const KEY = 'onyx.v1';

const usesPounds = () => {
  const lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
  return /-(US|LR|MM)$/i.test(lang) || /^en$/i.test(lang);
};

export const DEFAULTS = () => ({
  version: 2,
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
    goal: 5, // sessions a week
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
const OLD_FOCUS = { lower: 'legs', upper: 'upper', full: 'full', arms: 'arms' };
export function migrate(parsed) {
  if ((parsed.version || 1) >= 2) return parsed;
  const s = { ...(parsed.settings || {}) };
  if (s.tripStart && !s.programStart) s.programStart = s.tripStart;
  delete s.tripStart; delete s.tripWeeks;
  const days = {};
  for (const [d, v] of Object.entries(parsed.days || {})) {
    const nv = { ...v };
    if (nv.focus) nv.focus = OLD_FOCUS[nv.focus] || 'full';
    if (nv.type === 'recovery') nv.type = 'rest';
    days[d] = nv;
  }
  const plan = Array.isArray(parsed.plan) ? parsed.plan.map((t) => (t === 'recovery' ? 'rest' : t)) : undefined;
  return { ...parsed, version: 2, settings: s, days, plan, swaps: {} };
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
