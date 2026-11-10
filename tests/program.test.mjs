import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSession, cycleInfo, typeFor, focusFor, DEFAULT_WEEK, DEFAULT_FOCUS_WEEK, FOCUS_IDS, FOCI, fillTemplate, TREAD_TEMPLATES,
  suggestLoad, personalBests, newBests, alternatives, estimate,
} from '../js/program.js';
import { EX_BY_ID, EXERCISES, LOCATIONS, isAvailable } from '../js/exercises.js';
import { toKg, fromKg, fmtWeight, snapKg, fmtSpeed, toMph } from '../js/units.js';

const base = {
  minutes: 45, equipment: ['db', 'bench'], cardio: 'treadmill',
  speeds: { walk: 3.5, base: 6, push: 7.5, sprint: 9 },
  restMain: 120, restAcc: 60, finisher: true, programStart: '2026-11-09',
};
const loc = (id) => LOCATIONS.find((l) => l.id === id);
const withLoc = (id, extra = {}) => ({ ...base, equipment: loc(id).equipment, cardio: loc(id).cardio, ...extra });
const strengthItems = (s) => s.blocks.filter((b) => b.kind === 'strength').flatMap((b) => b.items);

test('default week: your body-part calendar, Lift and Red alternating, Sunday off', () => {
  assert.equal(DEFAULT_WEEK.filter((t) => t === 'lift').length, 3);
  assert.equal(DEFAULT_WEEK.filter((t) => t === 'red').length, 3);
  // 2026-11-09 is a Monday.
  const week = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'];
  assert.deepEqual(week.map((d) => typeFor(d, DEFAULT_WEEK)), ['lift', 'red', 'lift', 'red', 'lift', 'red', 'rest']);
  assert.deepEqual(week.slice(0, 6).map((d) => FOCI[focusFor(d)].label), ['Arms, Shoulders & Abs', 'Legs & Abs', 'Chest, Back & Abs', 'Abs & Butt', 'Full Body · Lower Focus', 'Full Body · Upper Focus']);
});

test('the day focus is shared by both rooms; a one-off pick wins', () => {
  const days = { '2026-11-09': { type: 'red', focus: 'legs' } };
  assert.equal(typeFor('2026-11-09', DEFAULT_WEEK, days), 'red');
  assert.equal(focusFor('2026-11-09', DEFAULT_FOCUS_WEEK, days), 'legs');
  assert.equal(focusFor('2026-11-16', DEFAULT_FOCUS_WEEK, days), 'arms', 'next Monday is back to the usual');
  assert.equal(focusFor('2026-11-09', DEFAULT_FOCUS_WEEK, { '2026-11-09': { focus: 'bogus' } }), 'fullLower');
});

test('the 4-week cycle repeats forever: Base, Build, Peak, Deload', () => {
  const s = { programStart: '2026-11-09' };
  assert.equal(cycleInfo('2026-11-09', s).phase.name, 'Base');
  assert.equal(cycleInfo('2026-11-17', s).phase.name, 'Build');
  assert.equal(cycleInfo('2026-11-29', s).phase.name, 'Peak');
  assert.equal(cycleInfo('2026-11-30', s).phase.name, 'Deload');
  assert.equal(cycleInfo('2026-12-07', s).phase.name, 'Base');
  assert.equal(cycleInfo('2026-12-07', s).cycle, 2);
  assert.equal(cycleInfo('2026-11-01', s).programWeek, 1, 'dates before the start count as week 1');
  // A mid-week start still lines weeks up with Monday.
  assert.equal(cycleInfo('2026-11-16', { programStart: '2026-11-12' }).programWeek, 2);
});

test('every session only uses equipment you have', () => {
  for (const l of LOCATIONS) {
    for (const type of ['lift', 'red']) {
      for (const focus of FOCUS_IDS) {
        for (const minutes of [30, 45, 60]) {
          const s = buildSession({ date: '2026-11-18', type, focus, settings: withLoc(l.id, { minutes }) });
          const items = strengthItems(s);
          assert.ok(items.length >= 4, `${l.id} ${type} ${focus} ${minutes}: only ${items.length} moves`);
          for (const it of items) assert.ok(isAvailable(EX_BY_ID[it.exId], l.equipment), `${it.exId} needs ${EX_BY_ID[it.exId].req} at ${l.id}`);
          const ids = items.map((i) => i.exId);
          assert.equal(new Set(ids).size, ids.length, 'no repeated exercise in a session');
        }
      }
    }
  }
});

test('session length roughly matches the setting', () => {
  for (const l of LOCATIONS) {
    for (const minutes of [30, 45, 60]) {
      for (const type of ['lift', 'red']) {
        const s = buildSession({ date: '2026-11-25', type, focus: 'legs', settings: withLoc(l.id, { minutes }) });
        assert.ok(s.estMin >= minutes - 12 && s.estMin <= minutes + 12, `${l.id} ${type} ${minutes}: ${s.estMin} min`);
      }
    }
  }
});

test('the same day always builds the same workout, shuffle changes it', () => {
  const a = buildSession({ date: '2026-11-11', type: 'lift', focus: 'legs', settings: withLoc('gym') });
  const b = buildSession({ date: '2026-11-11', type: 'lift', focus: 'legs', settings: withLoc('gym') });
  assert.deepEqual(a, b);
  const shuffled = [1, 2, 3, 4].map((salt) => strengthItems(buildSession({ date: '2026-11-11', type: 'lift', focus: 'legs', settings: withLoc('gym'), salt })).map((i) => i.exId).join());
  assert.ok(shuffled.some((x) => x !== strengthItems(a).map((i) => i.exId).join()));
});

test('main lifts stay the same across the trip, reps drop as weight climbs', () => {
  const wk = (date) => buildSession({ date, type: 'lift', focus: 'upper', settings: withLoc('gym') });
  const w1 = wk('2026-11-09'), w2 = wk('2026-11-16'), w3 = wk('2026-11-23');
  const main = (s) => strengthItems(s).filter((i) => i.role === 'main');
  assert.deepEqual(main(w1).map((i) => i.exId), main(w3).map((i) => i.exId));
  assert.deepEqual([w1, w2, w3].map((s) => `${main(s)[0].sets}x${main(s)[0].reps}`), ['3x10', '4x8', '4x6']);
  assert.ok(main(w1).every((i) => EX_BY_ID[i.exId].load === 'w'), 'gym main lifts are loaded');
});

test('Red days alternate cardio and floor blocks', () => {
  const s = buildSession({ date: '2026-11-10', type: 'red', focus: 'legs', settings: base });
  assert.deepEqual(s.blocks.map((b) => b.id), ['warmup', 'cardio1', 'floor1', 'cardio2', 'floor2', 'cooldown']);
  const tread = s.blocks.find((b) => b.id === 'cardio1');
  assert.ok(tread.segments.every((x) => x.mph > 0 && x.incline >= 0));
  const floor = s.blocks.find((b) => b.id === 'floor1');
  assert.equal(EX_BY_ID[floor.items.at(-1).exId].pattern, 'core', 'floor blocks end with core');
});

test('Red days work without a treadmill', () => {
  for (const cardio of ['bike', 'rower', 'run', 'none']) {
    const s = buildSession({ date: '2026-11-10', type: 'red', focus: 'upper', settings: { ...base, cardio } });
    const segs = s.blocks.find((b) => b.id === 'cardio1').segments;
    assert.ok(segs.every((x) => !x.mph && (x.effort || x.move)), cardio);
  }
});

test('treadmill speeds climb a little each week', () => {
  const sprint = (date) => Math.max(...buildSession({ date, type: 'red', focus: 'legs', settings: base }).blocks.filter((b) => b.kind === 'intervals').flatMap((b) => b.segments).filter((x) => x.level === 'sprint').map((x) => x.mph));
  assert.ok(sprint('2026-11-24') > sprint('2026-11-10'));
});

test('templates fill the block exactly', () => {
  for (const t of Object.values(TREAD_TEMPLATES)) {
    for (const target of [360, 540, 720]) {
      const segs = fillTemplate(t.segs, target);
      assert.equal(segs.reduce((a, x) => a + x.sec, 0), target, `${t.name} ${target}`);
    }
  }
});

test('recovery and rest days', () => {
  const r = buildSession({ date: '2026-11-14', type: 'recovery', focus: 'fullLower', settings: base });
  assert.deepEqual(r.blocks.map((b) => b.id), ['easy', 'mobility']);
  assert.equal(buildSession({ date: '2026-11-15', type: 'rest', focus: 'fullLower', settings: base }).blocks.length, 0);
});

test('finisher can be turned off', () => {
  const on = buildSession({ date: '2026-11-09', type: 'lift', focus: 'upper', settings: base });
  const off = buildSession({ date: '2026-11-09', type: 'lift', focus: 'upper', settings: { ...base, finisher: false } });
  assert.ok(on.blocks.some((b) => b.id === 'finisher'));
  assert.ok(!off.blocks.some((b) => b.id === 'finisher'));
});

test('swap alternatives share the movement and fit the kit', () => {
  const s = buildSession({ date: '2026-11-09', type: 'lift', focus: 'upper', settings: base });
  const block = s.blocks.find((b) => b.kind === 'strength');
  const alts = alternatives(block.items[0], block, 'upper', 'lift', base.equipment);
  assert.ok(alts.length > 1);
  assert.ok(alts.every((e) => e.pattern === 'push_h' && isAvailable(e, base.equipment)));
});

test('a remembered swap is used next time', () => {
  const s = buildSession({ date: '2026-11-09', type: 'lift', focus: 'upper', settings: base, swaps: { 'lift:upper:m1': 'push-up' } });
  assert.equal(strengthItems(s)[0].exId, 'push-up');
});

/* ---------------------------------------------------------------- loads */

const session = (date, exId, sets, targetReps, rir = 2) => ({ id: date + exId, date, entries: [{ exId, sets, targetReps, targetSets: sets.length, rir }] });
const lb = (n) => toKg(n, 'lb');

test('adds a step after hitting every rep', () => {
  const hist = [session('2026-11-09', 'goblet-squat', [{ w: lb(50), reps: 10 }, { w: lb(50), reps: 10 }, { w: lb(50), reps: 10 }], 10)];
  const sug = suggestLoad(hist, { exId: 'goblet-squat', reps: 10, rir: 2 }, 'lb');
  assert.equal(fmtWeight(sug.kg, 'lb'), '55');
  assert.equal(sug.up, true);
});

test('holds the weight after missing reps', () => {
  const hist = [session('2026-11-09', 'goblet-squat', [{ w: lb(50), reps: 10 }, { w: lb(50), reps: 8 }, { w: lb(50), reps: 7 }], 10)];
  const sug = suggestLoad(hist, { exId: 'goblet-squat', reps: 10, rir: 2 }, 'lb');
  assert.ok(Number(fmtWeight(sug.kg, 'lb')) <= 50);
});

test('goes heavier when the reps drop for the next phase', () => {
  const hist = [session('2026-11-09', 'bench-press', [{ w: lb(135), reps: 10 }, { w: lb(135), reps: 10 }, { w: lb(135), reps: 10 }], 10)];
  const sug = suggestLoad(hist, { exId: 'bench-press', reps: 6, rir: 1 }, 'lb');
  const shown = Number(fmtWeight(sug.kg, 'lb'));
  assert.ok(shown >= 155 && shown <= 170, `got ${shown}`);
  assert.equal(shown % 5, 0);
});

test('suggestions snap to kg plates and dumbbells', () => {
  const hist = [session('2026-11-09', 'goblet-squat', [{ w: 21, reps: 10 }, { w: 21, reps: 10 }, { w: 21, reps: 10 }], 10)];
  const sug = suggestLoad(hist, { exId: 'goblet-squat', reps: 10, rir: 2 }, 'kg');
  assert.equal(sug.kg % 2, 0);
  assert.ok(sug.kg > 21);
  assert.equal(suggestLoad([], { exId: 'goblet-squat', reps: 10, rir: 2 }, 'kg'), null);
  assert.equal(suggestLoad(hist, { exId: 'push-up', reps: 10, rir: 2 }, 'kg'), null, 'no load for bodyweight moves');
});

test('personal bests and new bests', () => {
  const a = session('2026-11-09', 'bench-press', [{ w: 60, reps: 8 }], 8);
  const b = session('2026-11-16', 'bench-press', [{ w: 65, reps: 8 }], 8);
  assert.equal(personalBests([a, b])[0].w, 65);
  assert.equal(newBests([a], b).length, 1);
  assert.equal(newBests([a], a).length, 0, 'first session sets no record to beat');
});

/* ---------------------------------------------------------------- units */

test('pounds and kilograms round-trip', () => {
  assert.equal(fmtWeight(toKg(135, 'lb'), 'lb'), '135');
  assert.equal(fmtWeight(toKg(20, 'kg'), 'lb'), '44.1');
  assert.equal(fmtWeight(lb(45), 'kg'), '20.4');
  assert.equal(Math.round(fromKg(100, 'lb')), 220);
  assert.equal(fmtWeight(snapKg(lb(52), 'lb', 'db'), 'lb'), '50');
  assert.equal(snapKg(23, 'kg', 'db'), 24);
  assert.equal(snapKg(61, 'kg', 'barbell'), 60);
});

test('speeds follow the unit', () => {
  assert.equal(fmtSpeed(6, 'lb'), '6.0');
  assert.equal(fmtSpeed(6, 'kg'), '9.7');
  assert.equal(fmtSpeed(toMph(10, 'kg'), 'kg'), '10.0');
});

test('every exercise is well formed', () => {
  const patterns = new Set(['squat', 'hinge', 'lunge', 'ham', 'glute', 'quad', 'calf', 'push_h', 'push_v', 'pull_h', 'pull_v', 'shoulder', 'bi', 'tri', 'core', 'power']);
  for (const e of EXERCISES) {
    assert.ok(patterns.has(e.pattern), e.id);
    assert.ok(['w', 'bw', 't'].includes(e.load), e.id);
    if (e.load !== 'w') assert.ok(e.base > 0, `${e.id} needs a base`);
    assert.ok(e.cue, `${e.id} needs a cue`);
  }
  assert.equal(new Set(EXERCISES.map((e) => e.id)).size, EXERCISES.length);
  assert.ok(estimate([]) === 0);
});

test('data from the first version carries over', async () => {
  const { migrate } = await import('../js/store.js');
  const old = { settings: { tripStart: '2026-11-02', tripWeeks: 3, unit: 'kg' }, plan: ['lift', 'red', 'lift', 'red', 'lift', 'recovery', 'rest'], days: { '2026-11-05': { type: 'recovery', focus: 'lower' } }, sessions: [{ id: 'a' }] };
  const m = migrate(old);
  assert.equal(m.version, 4);
  assert.equal(m.settings.dbOnly, true);
  assert.equal(m.settings.programStart, '2026-11-02');
  assert.equal(m.settings.tripWeeks, undefined);
  assert.equal(m.settings.unit, 'kg');
  assert.deepEqual(m.plan, DEFAULT_WEEK, 'an untouched default week moves to the new default');
  assert.deepEqual(m.days['2026-11-05'], { type: 'rest', focus: 'legs' });
  assert.equal(m.sessions.length, 1);
});

test('Red Room floor work sticks to dumbbells, benches, bands and bodyweight', () => {
  for (const focus of FOCUS_IDS) {
    for (const date of ['2026-11-10', '2026-11-12', '2026-11-19']) {
      const s = buildSession({ date, type: 'red', focus, settings: withLoc('gym') });
      for (const it of strengthItems(s)) {
        const req = EX_BY_ID[it.exId].req;
        assert.ok(!req.includes('barbell') && !req.includes('machine'), `${focus} ${date}: ${it.exId}`);
      }
    }
  }
});

test('a lighter circuit after a heavy lift day does not jump the weight', () => {
  const hist = [session('2026-11-09', 'goblet-squat', [{ w: lb(55), reps: 8 }, { w: lb(55), reps: 8 }, { w: lb(55), reps: 8 }], 8, 1)];
  const sug = suggestLoad(hist, { exId: 'goblet-squat', reps: 10, rir: 3 }, 'lb');
  assert.ok(Number(fmtWeight(sug.kg, 'lb')) <= 55, `got ${fmtWeight(sug.kg, 'lb')}`);
});

test('every exercise has an animation that solves cleanly', async () => {
  const { hasAnim, geometryFor, animForName } = await import('../js/anim.js');
  const pts = (g) => [g.H, g.S, g.head, ...g.arm.flat(), ...g.leg.flat(), ...g.toe];
  for (const e of EXERCISES) {
    assert.ok(hasAnim(e.id), `${e.id} has no animation`);
    const { frames, total } = geometryFor(e.id);
    assert.ok(frames >= 2 && total > 0, e.id);
    for (let i = 0; i < frames; i += 1) {
      const g = geometryFor(e.id, { frame: i });
      for (const p of pts(g)) {
        assert.ok(Number.isFinite(p[0]) && Number.isFinite(p[1]), `${e.id} frame ${i}: NaN`);
        assert.ok(p[0] > -20 && p[0] < 220 && p[1] > -20 && p[1] < 175, `${e.id} frame ${i}: point off scene ${p.map(Math.round)}`);
      }
      // Bones keep their length (IK never stretches a limb).
      for (const [root, joint, end, a, b] of [[g.sA[0], ...g.arm[0], 25, 23], [g.hA[0], ...g.leg[0], 33, 31]]) {
        assert.ok(Math.abs(Math.hypot(joint[0] - root[0], joint[1] - root[1]) - a) < 0.5, `${e.id}: bone length`);
        assert.ok(Math.abs(Math.hypot(end[0] - joint[0], end[1] - joint[1]) - b) < 0.5, `${e.id}: bone length`);
      }
    }
    // Mid-transition samples stay finite too.
    for (const ms of [137, 611, 1234, 2777]) assert.ok(Number.isFinite(geometryFor(e.id, { ms }).H[0]), e.id);
  }
  for (const n of ['Jumping Jacks', 'Air Squats', 'High Knees', 'Burpees', 'Mountain Climbers']) assert.ok(animForName(n), n);
  assert.equal(animForName("Child's Pose"), null);
});

test('planted feet stay planted through a squat', async () => {
  const { geometryFor } = await import('../js/anim.js');
  const a = geometryFor('goblet-squat', { frame: 0 });
  for (const ms of [200, 900, 1500, 2100]) {
    const g = geometryFor('goblet-squat', { ms });
    assert.ok(Math.hypot(g.leg[0][1][0] - a.leg[0][1][0], g.leg[0][1][1] - a.leg[0][1][1]) < 0.5, `ankle moved at ${ms}ms`);
  }
});

test('version 2 data moves to the new calendar and keeps single-day changes', async () => {
  const { migrate } = await import('../js/store.js');
  const v2 = { version: 2, settings: { goal: 5 }, plan: ['lift', 'red', 'lift', 'red', 'lift', 'rest', 'rest'], focusWeek: ['arms', 'legs', 'upper', 'core', 'full', 'legs', 'full'], days: { '2026-11-12': { type: 'lift', focus: 'full' } }, sessions: [{ id: 'a', focus: 'full' }] };
  const m = migrate(v2);
  assert.deepEqual(m.plan, DEFAULT_WEEK);
  assert.deepEqual(m.focusWeek, DEFAULT_FOCUS_WEEK);
  assert.equal(m.settings.goal, 6);
  assert.deepEqual(m.days['2026-11-12'], { type: 'lift', focus: 'fullLower' });
  assert.equal(m.sessions[0].focus, 'fullLower');
  const custom = migrate({ ...v2, plan: ['lift', 'lift', 'red', 'rest', 'lift', 'red', 'rest'] });
  assert.deepEqual(custom.plan, ['lift', 'lift', 'red', 'rest', 'lift', 'red', 'rest']);
  assert.equal(custom.settings.goal, 5);
});

test('abs are in every Lift and Red session, even trimmed bodyweight ones', () => {
  for (const l of LOCATIONS) {
    for (const focus of FOCUS_IDS) {
      for (const minutes of [30, 45, 60]) {
        for (const type of ['lift', 'red']) {
          const s = buildSession({ date: '2026-11-18', type, focus, settings: withLoc(l.id, { minutes }) });
          assert.ok(strengthItems(s).some((i) => EX_BY_ID[i.exId].pattern === 'core'), `${l.id} ${type} ${focus} ${minutes}`);
        }
      }
    }
  }
});

test('full body days lean the way they say', () => {
  const lower = new Set(['squat', 'hinge', 'lunge', 'glute', 'ham', 'quad', 'calf']);
  const upper = new Set(['push_h', 'push_v', 'pull_h', 'pull_v', 'shoulder', 'bi', 'tri']);
  const count = (focus, set) => strengthItems(buildSession({ date: '2026-11-13', type: 'lift', focus, settings: withLoc('gym', { minutes: 60 }) })).filter((i) => set.has(EX_BY_ID[i.exId].pattern)).length;
  assert.ok(count('fullLower', lower) > count('fullLower', upper));
  assert.ok(count('fullUpper', upper) > count('fullUpper', lower));
  const main = (focus) => strengthItems(buildSession({ date: '2026-11-13', type: 'lift', focus, settings: withLoc('gym') })).filter((i) => i.role === 'main').map((i) => EX_BY_ID[i.exId].pattern);
  assert.ok(main('fullLower').every((p) => lower.has(p)));
  assert.ok(main('fullUpper').every((p) => upper.has(p)));
});

test('dumbbells & bodyweight only: no barbells, machines, kettlebells, bands or bars', () => {
  const allowed = new Set(['db', 'bench']);
  const seen = new Set();
  for (const l of LOCATIONS) {
    for (const focus of FOCUS_IDS) {
      for (const type of ['lift', 'red']) {
        for (const date of ['2026-11-09', '2026-11-18', '2026-11-25']) {
          const s = buildSession({ date, type, focus, settings: withLoc(l.id, { dbOnly: true, minutes: 60 }) });
          const items = strengthItems(s);
          assert.ok(items.length >= 5, `${l.id} ${type} ${focus}: ${items.length}`);
          for (const it of items) {
            const ex = EX_BY_ID[it.exId];
            assert.ok(ex.req.every((r) => allowed.has(r)), `${l.id} ${type} ${focus}: ${it.exId} needs ${ex.req}`);
            if (l.id === 'gym') seen.add(it.exId);
          }
        }
      }
    }
  }
  // Plenty of dumbbell work to rotate through at a full gym.
  assert.ok([...seen].filter((id) => EX_BY_ID[id].req.includes('db')).length >= 25, `only ${seen.size} moves`);
});

test('dumbbell-only main lifts are loaded with dumbbells', () => {
  for (const focus of FOCUS_IDS) {
    const s = buildSession({ date: '2026-11-09', type: 'lift', focus, settings: withLoc('gym', { dbOnly: true }) });
    for (const it of strengthItems(s).filter((i) => i.role === 'main')) assert.ok(EX_BY_ID[it.exId].req.includes('db'), `${focus}: ${it.exId}`);
  }
});

test('swap choices respect dumbbells & bodyweight only', async () => {
  const { kitFor } = await import('../js/program.js');
  const settings = withLoc('gym', { dbOnly: true });
  const s = buildSession({ date: '2026-11-11', type: 'lift', focus: 'upper', settings });
  for (const b of s.blocks.filter((x) => x.kind === 'strength')) {
    for (const it of b.items) {
      for (const e of alternatives(it, b, 'upper', 'lift', kitFor(settings))) assert.ok(e.req.every((r) => r === 'db' || r === 'bench'), e.id);
    }
  }
  assert.deepEqual(kitFor({ equipment: ['barbell', 'db', 'bench', 'band'], dbOnly: false }), ['barbell', 'db', 'bench', 'band']);
});
