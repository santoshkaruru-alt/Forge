// Local-first persistence. Everything stays on this device (localStorage).
import { DEFAULT_WEEK, mondayOf, toISO } from './program.js';
import { LOCATIONS } from './exercises.js';

export const KEY = 'onyx.v1';

const usesPounds = () => {
  const lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
  return /-(US|LR|MM)$/i.test(lang) || /^en$/i.test(lang);
};

export const DEFAULTS = () => ({
  version: 1,
  settings: {
    unit: usesPounds() ? 'lb' : 'kg',
    theme: 'auto',
    minutes: 45,
    location: 'hotel',
    equipment: [...LOCATIONS[1].equipment],
    cardio: LOCATIONS[1].cardio,
    speeds: { walk: 3.5, base: 6.0, push: 7.5, sprint: 9.0 }, // mph
    finisher: true,
    sound: true,
    restMain: 120,
    restAcc: 60,
    tripStart: mondayOf(toISO(new Date())),
    tripWeeks: 3,
    onboarded: false,
  },
  plan: [...DEFAULT_WEEK], // Mon..Sun session types
  days: {}, // 'YYYY-MM-DD' -> { type, focus, salt } one-off changes
  swaps: {}, // slot key -> exercise id you prefer
  sessions: [], // finished workouts
  active: null, // the workout in progress
});

let state = load();
const listeners = new Set();

function merge(parsed) {
  const base = DEFAULTS();
  return {
    ...base,
    ...parsed,
    settings: { ...base.settings, ...(parsed.settings || {}), speeds: { ...base.settings.speeds, ...(parsed.settings?.speeds || {}) } },
    plan: Array.isArray(parsed.plan) && parsed.plan.length === 7 ? parsed.plan : base.plan,
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
