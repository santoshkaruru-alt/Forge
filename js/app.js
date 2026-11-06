import { store, uid } from './store.js';
import { icon } from './icons.js';
import { EX_BY_ID, LOCATIONS, EQUIPMENT, CARDIO } from './exercises.js';
import {
  TYPES, ROOM_IDS, FOCI, FOCUS_IDS, PHASES, buildSession, cycleInfo, typeFor, focusFor,
  toISO, parseISO, addDays, mondayOf, weekday, blockSeconds, alternatives, suggestLoad, lastPerformance,
  sessionVolume, personalBests, newBests,
} from './program.js';
import { toKg, fromKg, fmtWeight, fmtSpeed, speedUnit, toMph, fromMph, trimNum } from './units.js';
import { beep, unlockAudio, keepAwake, Countdown, setSound } from './timer.js';

/* ------------------------------------------------------------------ helpers */

const $ = (s, r = document) => r.querySelector(s);
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const st = () => store.state;
const S = () => store.state.settings;
const U = () => S().unit;
const todayISO = () => toISO(new Date());
const wt = (kg) => fmtWeight(kg, U());
const unitLabel = () => (U() === 'lb' ? 'lb' : 'kg');
const clock = (sec) => { sec = Math.max(0, Math.ceil(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
const minutes = (sec) => { const m = Math.round(sec / 60); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
const bigNum = (n) => (n >= 10000 ? `${trimNum(n / 1000, 1)}k` : Math.round(n).toLocaleString());
const dayName = (iso, style = 'short') => parseISO(iso).toLocaleDateString(undefined, { weekday: style });
const dateLabel = (iso) => parseISO(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const shortDate = (iso) => parseISO(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const ROOM_ICON = { lift: 'dumbbell', red: 'flame', rest: 'moon', recovery: 'moon' };
const LOC_ICON = { gym: 'dumbbell', hotel: 'pin', room: 'moon', outdoor: 'sun' };
const focusLabel = (f) => FOCI[f]?.label || 'Full Body';

const ui = { tab: 'today', date: todayISO(), workout: false, collapsed: {}, month: todayISO().slice(0, 7) };

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.id);
  toast.id = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ------------------------------------------------------------------ theme */

const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches;
const isDark = () => S().theme === 'dark' || (S().theme === 'auto' && systemDark());
function applyTheme() {
  const t = S().theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  const m = document.createElement('meta');
  m.name = 'theme-color';
  m.content = isDark() ? '#08080d' : '#f3f4f9';
  document.head.appendChild(m);
}
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => { applyTheme(); render(); });

/* ------------------------------------------------------------------ plan data */

const typeOf = (d) => typeFor(d, st().plan, st().days);
const focusOf = (d) => focusFor(d, st().focusWeek, st().days);
function planFor(date, type = typeOf(date)) {
  return buildSession({ date, type, focus: focusOf(date), settings: S(), swaps: st().swaps, salt: st().days[date]?.salt || 0 });
}
const sessionsOn = (date) => st().sessions.filter((x) => x.date === date);
const workoutsOn = (date) => sessionsOn(date).filter((x) => x.type === 'lift' || x.type === 'red');
const exName = (id) => EX_BY_ID[id]?.name || id;

function setRoom(date, type) {
  store.update((s) => {
    const d = { ...(s.days[date] || {}) };
    if (type === s.plan[weekday(date)]) delete d.type; else d.type = type;
    if (Object.keys(d).length) s.days[date] = d; else delete s.days[date];
  });
}

function targetText(it) {
  const ex = EX_BY_ID[it.exId];
  const reps = ex.load === 't' ? `${it.reps} sec` : `${it.reps}${ex.uni ? ' each side' : ''}`;
  return `${it.sets} × ${reps}`;
}
function segDetail(seg) {
  if (seg.mph) return `${fmtSpeed(seg.mph, U())} ${speedUnit(U())} · ${seg.incline}% incline`;
  return seg.effort || '';
}
const segTitle = (seg) => seg.move || seg.label;
const rirText = (n) => (n === 1 ? 'leave 1 rep in the tank' : `leave ${n} reps in the tank`);

/* ------------------------------------------------------------------ shared bits */

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function topbar(title, eyebrow) {
  const dark = isDark();
  return `<header class="topbar">
    <div class="grow"><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1></div>
    <button class="icon-btn" data-action="theme-toggle" aria-label="Switch to ${dark ? 'light' : 'dark'} mode" title="${dark ? 'Light' : 'Dark'} mode">${icon(dark ? 'sun' : 'moon', 18)}</button>
  </header>`;
}

function roomToggle(date, current, size = '') {
  return `<div class="room-toggle ${size}" role="radiogroup" aria-label="Workout for ${dateLabel(date)}">${ROOM_IDS.map((t) => `<button role="radio" aria-checked="${current === t}" class="rt t-${t} ${current === t ? 'on' : ''}" data-action="room" data-date="${date}" data-v="${t}">${icon(ROOM_ICON[t], size ? 14 : 16)}<span>${size ? TYPES[t].short : TYPES[t].label}</span></button>`).join('')}</div>`;
}

function locGrid(sheet = '') {
  return `<div class="loc-grid">${LOCATIONS.map((l) => `<button class="loc ${S().location === l.id ? 'on' : ''}" data-action="set-location" data-v="${l.id}" ${sheet ? `data-sheet="${sheet}"` : ''}>${icon(LOC_ICON[l.id], 18)}<b>${esc(l.name)}</b></button>`).join('')}</div>`;
}

/* ------------------------------------------------------------------ today */

function weekStrip() {
  const mon = mondayOf(ui.date);
  const today = todayISO();
  const cells = [];
  for (let i = 0; i < 7; i += 1) {
    const d = addDays(mon, i);
    const type = typeOf(d);
    const done = workoutsOn(d)[0];
    cells.push(`<button class="day t-${done ? done.type : type} ${d === ui.date ? 'sel' : ''} ${d === today ? 'today' : ''} ${done ? 'done' : ''}" data-action="pick-date" data-date="${d}" aria-label="${dateLabel(d)}: ${TYPES[type].label}${done ? ', done' : ''}">
      <span class="dw">${dayName(d, 'narrow')}</span><span class="dn">${parseISO(d).getDate()}</span><span class="dot">${done ? icon('check', 10) : ''}</span>
    </button>`);
  }
  return `<div class="week-nav">
    <button class="icon-btn sm ghost" data-action="shift-week" data-by="-7" aria-label="Previous week">${icon('chevL', 16)}</button>
    <div class="week-strip">${cells.join('')}</div>
    <button class="icon-btn sm ghost" data-action="shift-week" data-by="7" aria-label="Next week">${icon('chevR', 16)}</button>
  </div>`;
}

function previewList(plan) {
  return `<ul class="preview">${plan.blocks.map((b) => {
    if (b.kind === 'strength') {
      return `<li class="pv ${b.style}"><span class="pv-tag">${esc(b.title.replace('Floor ', 'F'))}</span><div class="pv-items">${b.items.map((it) => {
        const sug = suggestLoad(st().sessions, it, U(), plan.date);
        return `<div class="pv-item"><span class="pv-name">${esc(exName(it.exId))}</span><span class="pv-meta num">${targetText(it)}${sug ? ` · <b>${wt(sug.kg)} ${unitLabel()}</b>` : ''}</span></div>`;
      }).join('')}</div></li>`;
    }
    const cardio = b.kind === 'intervals' && b.id !== 'warmup';
    return `<li class="pv timed ${cardio ? 'cardio' : ''}"><span class="pv-tag">${icon(cardio ? 'bolt' : 'clock', 14)}</span><div class="pv-items"><div class="pv-item"><span class="pv-name">${esc(b.title)}${b.sub ? `<small>${esc(b.sub)}</small>` : ''}</span><span class="pv-meta num">${minutes(blockSeconds(b))}</span></div></div></li>`;
  }).join('')}</ul>`;
}

function renderToday() {
  const date = ui.date;
  const isToday = date === todayISO();
  const type = typeOf(date);
  const focus = focusOf(date);
  const done = workoutsOn(date);
  const cyc = cycleInfo(date, S());
  const active = st().active;
  const loc = LOCATIONS.find((l) => l.id === S().location);

  let html = topbar(isToday ? greeting() : dayName(date, 'long'), isToday ? `Today · ${dateLabel(date)}` : dateLabel(date));
  html += weekStrip();

  // Hero: the day's focus, the room toggle, one big button.
  const isRest = type === 'rest';
  const plan = isRest ? null : planFor(date);
  let cta;
  if (active) {
    cta = `<button class="hero-cta" data-action="open-workout">${icon('play', 16)} Resume ${esc(active.plan.title.split(' · ')[0])}</button>`;
  } else if (done.length) {
    cta = `<div class="hero-done">${icon('check', 18)}<span><b>Done</b> · ${esc(done.map((x) => (x.class ? 'Class' : minutes(x.durationSec || 0))).join(', '))}</span></div>
      ${isRest ? '' : `<button class="hero-cta ghost" data-action="start">Train again</button>`}`;
  } else if (isRest) {
    cta = `<button class="hero-cta ghost" data-action="start-recovery">${icon('play', 16)} Optional: 30-min recovery</button>`;
  } else {
    cta = `<button class="hero-cta" data-action="start">${icon('play', 16)} Start ${TYPES[type].label}</button>`;
  }
  const whose = isToday ? "Today's" : `${dayName(date, 'long')}'s`;
  html += `<section class="hero t-${type}">
    <div class="hero-top"><span class="eyebrow">${isRest ? 'Rest day' : `${whose} focus`}</span>
      ${isRest ? '' : `<button class="hero-chip" data-action="focus-sheet" data-date="${date}">Change ${icon('chevD', 12)}</button>`}</div>
    <h2 class="hero-title">${isRest ? 'Recharge' : esc(focusLabel(focus))}</h2>
    ${roomToggle(date, type)}
    <p class="hero-sub">${esc(TYPES[type].sub)}</p>
    ${isRest ? '' : `<div class="hero-meta num"><span>${icon('clock', 14)} ~${plan.estMin} min</span><span>${icon('bolt', 14)} Week ${cyc.programWeek} · ${esc(cyc.phase.name)}</span><span>${icon('pin', 14)} ${esc(loc ? loc.name : 'Custom kit')}</span></div>`}
    ${cta}
  </section>`;

  if (active && active.date !== date) html += `<p class="note">You have a workout in progress from ${dateLabel(active.date)}.</p>`;

  if (!isRest) {
    html += `<section class="card">
      <div class="card-head"><h2>What's in it</h2><button class="text-btn" data-action="shuffle">${icon('shuffle', 14)} Shuffle</button></div>
      ${previewList(plan)}
      <p class="phase-note">${icon('info', 14)} <span>${esc(plan.phaseNote)}</span></p>
    </section>`;
  } else {
    html += `<section class="card tips"><div class="card-head"><h2>Make the most of it</h2></div>
      <ul class="tip-list"><li>${icon('check', 14)} Walk 20 to 30 minutes, outside if you can</li><li>${icon('check', 14)} 10 minutes of stretching or mobility</li><li>${icon('check', 14)} Hydrate and get to bed early</li></ul>
      <p class="muted small">Feel like training? Switch to Lift Room or Red Room above.</p></section>`;
  }

  html += `<section class="card">
    <div class="card-head"><h2>Training at</h2><button class="text-btn" data-action="goto" data-tab="settings">Edit equipment</button></div>
    ${locGrid()}
    <p class="muted small">${esc(loc ? loc.sub : 'Your own equipment mix')}. Workouts adapt automatically.</p>
  </section>`;

  if (!isRest && !done.length) html += `<button class="row-link" data-action="log-class">${icon('ticket', 18)}<span><b>Took a class at the studio?</b><small>Log it and it counts toward your week</small></span>${icon('chevR', 16)}</button>`;
  if (done.length) html += `<section class="card"><div class="card-head"><h2>Logged</h2></div>${done.map(historyRow).join('')}</section>`;
  return html;
}

/* ------------------------------------------------------------------ week */

function renderWeek() {
  const mon = mondayOf(ui.date);
  const today = todayISO();
  const cyc = cycleInfo(mon, S());
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const types = days.map(typeOf);
  const doneCount = days.filter((d) => workoutsOn(d).length).length;
  const isThisWeek = mon === mondayOf(today);
  const differs = days.some((d, i) => types[i] !== st().plan[i] || focusOf(d) !== st().focusWeek[i]);

  let html = topbar(isThisWeek ? 'This week' : `Week of ${shortDate(mon)}`, `Week ${cyc.programWeek} of 4 · ${cyc.phase.name}`);
  html += `<div class="week-head">
    <button class="icon-btn sm" data-action="shift-week" data-by="-7" aria-label="Previous week">${icon('chevL', 16)}</button>
    <div class="wh-mid"><b class="num">${shortDate(mon)} to ${shortDate(addDays(mon, 6))}</b><small class="muted num">${types.filter((t) => t === 'lift').length} Lift · ${types.filter((t) => t === 'red').length} Red · ${doneCount} of ${S().goal} done</small></div>
    <button class="icon-btn sm" data-action="shift-week" data-by="7" aria-label="Next week">${icon('chevR', 16)}</button>
  </div>
  <div class="goal-bar"><i style="width:${Math.min(100, (doneCount / S().goal) * 100)}%"></i></div>
  <p class="muted small center">Choose Lift Room or Red Room for each day. Tap a day to see its workout.</p>`;

  html += days.map((d, i) => {
    const type = types[i];
    const done = workoutsOn(d)[0];
    const focus = focusOf(d);
    const est = type === 'rest' ? '' : `~${planFor(d).estMin} min`;
    let sub;
    if (done) sub = `${icon('check', 12)} Done · ${esc(done.class ? 'Class' : minutes(done.durationSec || 0))}`;
    else if (type === 'rest') sub = d === today ? 'Today · Recharge' : 'Recharge';
    else sub = `${d === today ? 'Today · ' : ''}${TYPES[type].label} · ${est}`;
    return `<div class="day-card t-${type} ${d === today ? 'is-today' : ''} ${done ? 'is-done' : ''}">
      <button class="dc-main" data-action="goto-date" data-date="${d}">
        <span class="dc-day"><small>${dayName(d)}</small><b class="num">${parseISO(d).getDate()}</b></span>
        <span class="dc-body"><b>${type === 'rest' ? 'Rest day' : esc(focusLabel(focus))}</b><small>${sub}</small></span>
        ${icon('chevR', 16)}
      </button>
      <div class="dc-foot">${roomToggle(d, type, 'sm')}${type === 'rest' ? '' : `<button class="text-btn sm" data-action="focus-sheet" data-date="${d}">Focus ${icon('chevD', 12)}</button>`}</div>
    </div>`;
  }).join('');

  html += `<section class="card usual">
    <div class="card-head"><h2>Your usual week</h2>${differs ? '' : `<span class="pill">${icon('check', 12)} This week matches</span>`}</div>
    <p class="muted small">Every new week starts from this. Changes above only affect that one day${differs ? '. Like this week better? Save it as your usual.' : '.'}</p>
    <div class="usual-row">${st().plan.map((t, i) => `<span class="u-day t-${t}"><small>${'MTWTFSS'[i]}</small>${icon(ROOM_ICON[t], 14)}</span>`).join('')}</div>
    <div class="actions row">
      ${differs ? `<button class="btn primary sm" data-action="save-usual">Save this week as usual</button>` : ''}
      <button class="btn sm" data-action="reset-usual">Reset to 3 Lift + 2 Red</button>
    </div>
  </section>`;
  return html;
}

/* ------------------------------------------------------------------ progress */

function weekCount(mon) {
  return st().sessions.filter((x) => (x.type === 'lift' || x.type === 'red') && x.date >= mon && x.date <= addDays(mon, 6)).length;
}
function streak() {
  const goal = S().goal;
  let mon = mondayOf(todayISO());
  let n = weekCount(mon) >= goal ? 1 : 0;
  for (let i = 0; i < 104; i += 1) {
    mon = addDays(mon, -7);
    if (weekCount(mon) >= goal) n += 1; else break;
  }
  return n;
}

function renderProgress() {
  const s = st();
  const today = todayISO();
  const mon = mondayOf(today);
  const month = ui.month;
  const inMonth = s.sessions.filter((x) => x.date.startsWith(month));
  const vol = inMonth.reduce((a, x) => a + sessionVolume(x), 0);
  const lifts = inMonth.filter((x) => x.type === 'lift').length;
  const reds = inMonth.filter((x) => x.type === 'red').length;
  const monthName = parseISO(`${month}-01`).toLocaleDateString(undefined, { month: 'long', year: month.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric' });

  let html = topbar('Progress', 'Your training');
  html += `<div class="stats">
    <div class="stat s-red"><span class="k">This week</span><span class="v num">${weekCount(mon)}<small>/ ${S().goal}</small></span></div>
    <div class="stat s-lift"><span class="k">Week streak</span><span class="v num">${streak()}<small>${icon('flame', 14)}</small></span></div>
    <div class="stat"><span class="k">${esc(monthName)}</span><span class="v num">${inMonth.length}<small>sessions</small></span></div>
    <div class="stat"><span class="k">Lifted</span><span class="v num">${bigNum(fromKg(vol, U()))}<small>${unitLabel()}</small></span></div>
  </div>`;

  // Month calendar
  const start = mondayOf(`${month}-01`);
  const [y, m] = month.split('-').map(Number);
  const last = toISO(new Date(y, m, 0));
  let cells = '';
  for (let d = start; d <= last || weekday(d) !== 0; d = addDays(d, 1)) {
    const done = workoutsOn(d)[0];
    const type = typeOf(d);
    const future = d > today;
    const cls = done ? `done t-${done.type}` : future && type !== 'rest' ? `plan t-${type}` : '';
    cells += `<button class="cal ${d.startsWith(month) ? '' : 'out'} ${cls} ${d === today ? 'today' : ''}" data-action="goto-date" data-date="${d}" aria-label="${dateLabel(d)}">${parseISO(d).getDate()}</button>`;
  }
  html += `<section class="card">
    <div class="card-head"><div class="month-nav"><button class="icon-btn sm ghost" data-action="month" data-by="-1" aria-label="Previous month">${icon('chevL', 16)}</button><h2>${esc(monthName)}</h2><button class="icon-btn sm ghost" data-action="month" data-by="1" aria-label="Next month">${icon('chevR', 16)}</button></div></div>
    <div class="cal-head">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<span>${d}</span>`).join('')}</div>
    <div class="cal-grid">${cells}</div>
    <div class="legend"><span><i class="key t-lift"></i>Lift Room · ${lifts}</span><span><i class="key t-red"></i>Red Room · ${reds}</span><span><i class="key planned"></i>Planned</span></div>
  </section>`;

  const bars = [];
  for (let i = 7; i >= 0; i -= 1) {
    const w = addDays(mon, -7 * i);
    const list = s.sessions.filter((x) => mondayOf(x.date) === w);
    bars.push({ m: w, v: fromKg(list.reduce((a, x) => a + sessionVolume(x), 0), U()), n: list.length });
  }
  html += `<section class="card"><div class="card-head"><h2>Weekly volume</h2><span class="faint small">${unitLabel()} lifted</span></div>${barChart(bars)}</section>`;

  const pbs = personalBests(s.sessions).slice(0, 8);
  html += `<section class="card"><div class="card-head"><h2>Personal bests</h2><span class="faint small">est. 1-rep max</span></div>
    ${pbs.length ? `<div class="pbs">${pbs.map((p, i) => `<button class="pb" data-action="exercise" data-id="${p.exId}"><span class="pb-rank num">${i + 1}</span><span class="grow"><b>${esc(exName(p.exId))}</b><small class="faint num">${wt(p.w)} ${unitLabel()} × ${p.reps} · ${shortDate(p.date)}</small></span><span class="pb-v num">${wt(p.est)}<small>${unitLabel()}</small></span></button>`).join('')}</div>` : `<p class="muted small">Log a few weighted sets and your bests show up here.</p>`}
  </section>`;

  const hist = [...s.sessions].sort((a, b) => b.date.localeCompare(a.date) || (b.endedAt || 0) - (a.endedAt || 0));
  html += `<section class="card"><div class="card-head"><h2>History</h2><span class="faint small">${hist.length}</span></div>
    ${hist.length ? hist.slice(0, 40).map(historyRow).join('') : `<p class="muted small">Finished workouts land here.</p>`}</section>`;
  return html;
}

function barChart(bars) {
  const W = 320, H = 130, pad = 18;
  const max = Math.max(1, ...bars.map((b) => b.v));
  const bw = (W - 8) / bars.length;
  const cur = mondayOf(todayISO());
  const rects = bars.map((b, i) => {
    const h = b.v > 0 ? Math.max(4, (b.v / max) * (H - pad - 16)) : 3;
    const x = 4 + i * bw + bw * 0.16;
    const y = H - pad - h;
    const lab = parseISO(b.m).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
    return `<rect class="bar ${b.m === cur ? 'on' : ''}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.68).toFixed(1)}" height="${h.toFixed(1)}" rx="6"><title>${lab}: ${Math.round(b.v).toLocaleString()} ${unitLabel()}, ${b.n} sessions</title></rect>
      ${b.v > 0 ? `<text class="val" x="${(x + bw * 0.34).toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="middle">${bigNum(b.v)}</text>` : ''}
      <text class="axis" x="${(x + bw * 0.34).toFixed(1)}" y="${H - 4}" text-anchor="middle">${lab}</text>`;
  }).join('');
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Volume per week, last 8 weeks"><defs><linearGradient id="gbar" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff1f4b"/><stop offset="1" stop-color="#ff8a1f"/></linearGradient><linearGradient id="gbar2" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#4357ff"/><stop offset="1" stop-color="#9b5cff"/></linearGradient></defs>${rects}</svg></div>`;
}

function historyRow(x) {
  const vol = sessionVolume(x);
  const meta = [x.class ? 'Class' : null, x.durationSec ? minutes(x.durationSec) : null, vol ? `${bigNum(fromKg(vol, U()))} ${unitLabel()}` : null, x.rpe].filter(Boolean).join(' · ');
  return `<button class="h-row" data-action="history" data-id="${x.id}">
    <span class="h-badge t-${x.type}">${icon(ROOM_ICON[x.type] || 'check', 16)}</span>
    <span class="h-main"><b>${esc(x.title)}</b><small class="faint num">${dateLabel(x.date)}${meta ? ` · ${esc(meta)}` : ''}</small></span>
    ${icon('chevR', 16)}
  </button>`;
}

/* ------------------------------------------------------------------ settings */

function stepper(key, label) {
  return `<div class="stepper"><button data-action="step" data-key="${key}" data-by="-1" aria-label="Less">${icon('minus', 16)}</button><span class="num">${esc(label)}</span><button data-action="step" data-key="${key}" data-by="1" aria-label="More">${icon('plus', 16)}</button></div>`;
}
const toggle = (key, on) => `<button class="switch ${on ? 'on' : ''}" role="switch" aria-checked="${on}" data-action="toggle" data-key="${key}"><i></i></button>`;
const unitSeg = (sheet = '') => `<div class="seg"><button data-action="unit" data-v="lb" ${sheet ? `data-sheet="${sheet}"` : ''} class="${U() === 'lb' ? 'on' : ''}">lb · mph</button><button data-action="unit" data-v="kg" ${sheet ? `data-sheet="${sheet}"` : ''} class="${U() === 'kg' ? 'on' : ''}">kg · km/h</button></div>`;

function renderSettings() {
  const s = S();
  const su = speedUnit(U());
  const cyc = cycleInfo(todayISO(), s);
  let html = topbar('Settings', 'Make it yours');
  html += `<section class="card list">
    <div class="set-row"><span><b>Units</b><small>Weights and treadmill speeds</small></span>${unitSeg()}</div>
    <div class="set-row"><span><b>Appearance</b></span><div class="seg">${['auto', 'light', 'dark'].map((t) => `<button data-action="theme" data-v="${t}" class="${s.theme === t ? 'on' : ''}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div></div>
  </section>`;

  html += `<h3 class="section-title">Program</h3>
  <section class="card list">
    <div class="set-row"><span><b>Weekly goal</b><small>Workouts per week</small></span>${stepper('goal', `${s.goal} a week`)}</div>
    <div class="set-row"><span><b>Session length</b></span><div class="seg">${[30, 45, 60].map((m) => `<button data-action="minutes" data-v="${m}" class="${s.minutes === m ? 'on' : ''}">${m}m</button>`).join('')}</div></div>
    <div class="set-col"><b>4-week cycle</b><small class="muted">You're in week ${cyc.programWeek}: ${esc(cyc.phase.name)}. Weights go up through weeks 1 to 3, then a lighter week.</small>
      <div class="phases">${[1, 2, 3, 4].map((w) => `<div class="phase ${cyc.programWeek === w ? 'now' : ''}"><small>Week ${w}</small><b>${PHASES[w].name}</b><small class="num">${PHASES[w].mainSets} × ${PHASES[w].mainReps}</small></div>`).join('')}</div>
      <button class="btn sm" data-action="restart-cycle">Restart at week 1</button></div>
  </section>`;

  html += `<h3 class="section-title">Where you train</h3>
  <section class="card list">
    ${LOCATIONS.map((l) => `<button class="set-row radio ${s.location === l.id ? 'on' : ''}" data-action="set-location" data-v="${l.id}"><span><b>${esc(l.name)}</b><small>${esc(l.sub)}</small></span><i class="dot"></i></button>`).join('')}
    <div class="set-col"><b>Equipment</b><div class="chips wrap">${EQUIPMENT.map((e) => `<button class="chip ${s.equipment.includes(e.id) ? 'on' : ''}" data-action="equip" data-v="${e.id}">${esc(e.name)}</button>`).join('')}</div></div>
    <div class="set-col"><b>Cardio</b><small class="muted">Used for Red Room intervals</small><div class="chips wrap">${CARDIO.map((c) => `<button class="chip ${s.cardio === c.id ? 'on' : ''}" data-action="cardio" data-v="${c.id}">${esc(c.name)}</button>`).join('')}</div></div>
  </section>`;

  html += `<h3 class="section-title">Treadmill speeds</h3>
  <section class="card list">
    <p class="muted small pad">Red Room intervals use these. Push and All out creep up a little each week.</p>
    ${[['walk', 'Recover', 'Walk'], ['base', 'Base', 'Comfortable jog'], ['push', 'Push', 'Hard but steady'], ['sprint', 'All out', 'Short sprints']].map(([k, l, sub]) => `<div class="set-row"><span><b><i class="lvl lvl-${k}"></i>${l}</b><small>${sub}</small></span><div class="stepper"><button data-action="speed" data-k="${k}" data-by="-1" aria-label="Slower">${icon('minus', 16)}</button><span class="num">${fmtSpeed(s.speeds[k], U())} ${su}</span><button data-action="speed" data-k="${k}" data-by="1" aria-label="Faster">${icon('plus', 16)}</button></div></div>`).join('')}
  </section>`;

  html += `<h3 class="section-title">Workout</h3>
  <section class="card list">
    <div class="set-row"><span><b>Cardio finisher</b><small>Short intervals to end Lift Room days</small></span>${toggle('finisher', s.finisher)}</div>
    <div class="set-row"><span><b>Rest, big lifts</b></span>${stepper('restMain', clock(s.restMain))}</div>
    <div class="set-row"><span><b>Rest, other moves</b></span>${stepper('restAcc', clock(s.restAcc))}</div>
    <div class="set-row"><span><b>Sounds</b><small>Timer beeps. Vibrates where supported.</small></span>${toggle('sound', s.sound)}</div>
  </section>`;

  html += `<h3 class="section-title">Your data</h3>
  <section class="card list">
    <button class="set-row" data-action="export"><span><b>Back up</b><small>Save everything to a file</small></span>${icon('download', 18)}</button>
    <button class="set-row" data-action="import"><span><b>Restore from backup</b></span>${icon('upload', 18)}</button>
    <button class="set-row danger" data-action="erase"><span><b>Erase everything</b></span>${icon('trash', 18)}</button>
  </section>
  <p class="footnote">Your data stays on this device. Add Onyx to your home screen and it works offline.</p>`;
  return html;
}

/* ------------------------------------------------------------------ workout */

const logKey = (b, i) => `${b.id}:${i}`;

function progressOf(active) {
  let total = 0, done = 0;
  for (const b of active.plan.blocks) {
    if (b.kind !== 'strength') continue;
    b.items.forEach((it, i) => {
      total += it.sets;
      done += (active.log[logKey(b, i)] || []).filter((x) => x?.done).length;
    });
  }
  return { total, done };
}

function blockComplete(a, b) {
  if (b.kind !== 'strength') return !!a.blocksDone[b.id];
  return b.items.every((it, i) => (a.log[logKey(b, i)] || []).filter((x) => x?.done).length >= it.sets);
}

function startWorkout(type) {
  unlockAudio();
  const plan = planFor(ui.date, type);
  store.update((s) => { s.active = { id: uid(), date: ui.date, startedAt: Date.now(), plan, log: {}, blocksDone: {} }; });
  openWorkout();
}

function openWorkout() { ui.workout = true; keepAwake(true); render(); window.scrollTo(0, 0); }
function closeWorkout() { ui.workout = false; keepAwake(false); stopRest(); render(); }

function setRow(b, i, it, k, ex, sug) {
  const log = st().active.log[logKey(b, i)] || [];
  const row = log[k] || {};
  const prev = log.slice(0, k).reverse().find((x) => x?.w);
  const wKg = row.w ?? prev?.w ?? sug?.kg ?? null;
  const reps = row.reps ?? it.reps;
  const key = logKey(b, i);
  return `<div class="set ${row.done ? 'done' : ''}">
    <span class="set-n num">${k + 1}</span>
    ${ex.load === 'w' ? `<label class="inp"><input type="number" inputmode="decimal" step="any" min="0" placeholder="0" value="${wKg != null ? wt(wKg) : ''}" data-field="w" data-key="${key}" data-k="${k}" aria-label="Weight in ${unitLabel()}, ${b.style === 'circuit' ? 'round' : 'set'} ${k + 1}"><span>${unitLabel()}</span></label>` : `<span class="inp bw">${ex.load === 't' ? 'Hold' : 'Bodyweight'}</span>`}
    <label class="inp"><input type="number" inputmode="numeric" min="0" value="${reps}" data-field="reps" data-key="${key}" data-k="${k}" aria-label="${ex.load === 't' ? 'Seconds' : 'Reps'}, set ${k + 1}"><span>${ex.load === 't' ? 'sec' : 'reps'}</span></label>
    <button class="tick" data-action="tick" data-key="${key}" data-k="${k}" aria-pressed="${!!row.done}" aria-label="${b.style === 'circuit' ? 'Round' : 'Set'} ${k + 1} done">${icon('check', 20)}</button>
  </div>`;
}

const blockLabel = (b) => (b.kind === 'strength' && b.style !== 'circuit' ? `Block ${b.title}` : b.title);

function renderWorkout() {
  const a = st().active;
  const p = progressOf(a);
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
  const current = a.plan.blocks.find((b) => !blockComplete(a, b));
  let html = `<div class="wk t-${a.plan.type}"><header class="wk-top">
    <button class="text-btn back" data-action="close-workout">${icon('back', 18)} Back</button>
    <div class="wk-title"><b>${esc(a.plan.title.split(' · ')[0])}</b><small class="num"><span id="elapsed">${clock((Date.now() - a.startedAt) / 1000)}</span> · ${esc(focusLabel(a.plan.focus))}</small></div>
    <div class="seg mini"><button data-action="unit" data-v="lb" class="${U() === 'lb' ? 'on' : ''}">lb</button><button data-action="unit" data-v="kg" class="${U() === 'kg' ? 'on' : ''}">kg</button></div>
  </header>
  <div class="wk-progress"><div class="wk-bar"><i style="width:${pct}%"></i></div><small class="num">${p.done} of ${p.total} sets</small></div>
  <nav class="steps" aria-label="Workout steps">${a.plan.blocks.map((b) => `<button class="step ${blockComplete(a, b) ? 'done' : ''} ${current === b ? 'cur' : ''}" data-action="jump" data-id="${b.id}">${blockComplete(a, b) ? icon('check', 12) : ''}${esc(blockLabel(b))}</button>`).join('')}</nav>`;

  for (const b of a.plan.blocks) {
    const doneBlock = blockComplete(a, b);
    const isCur = current === b;
    if (b.kind !== 'strength') {
      const secs = blockSeconds(b);
      const open = b.id in ui.collapsed ? !ui.collapsed[b.id] : b.segments.length <= 6;
      const cardio = b.kind === 'intervals' && b.id !== 'warmup';
      html += `<section class="card wk-block ${cardio ? 'cardio' : 'timed'} ${doneBlock ? 'complete' : ''} ${isCur ? 'current' : ''}" id="blk-${b.id}">
        <div class="wk-bhead">
          <span class="wk-tag">${icon(cardio ? 'bolt' : 'clock', 18)}</span>
          <div class="grow"><b>${esc(b.title)}</b><small class="muted num">${minutes(secs)}${b.sub ? ` · ${esc(b.sub)}` : ''}</small></div>
          ${doneBlock ? `<span class="pill">${icon('check', 12)} Done</span>` : ''}
        </div>
        ${open ? `<ol class="segs">${b.segments.map((sg) => `<li class="lvl-${sg.level || 'none'}"><span class="num">${clock(sg.sec)}</span><b>${esc(segTitle(sg))}</b><small class="muted">${esc(segDetail(sg))}</small></li>`).join('')}</ol>` : ''}
        <div class="actions row">
          <button class="btn ${doneBlock ? '' : 'primary'}" data-action="run-timer" data-id="${b.id}">${icon('play', 16)} ${doneBlock ? 'Run again' : 'Start timer'}</button>
          <button class="text-btn" data-action="collapse" data-id="${b.id}" data-open="${open ? 1 : 0}">${open ? 'Hide' : 'Show'} steps</button>
          <button class="text-btn" data-action="block-done" data-id="${b.id}">${doneBlock ? 'Undo' : 'Mark done'}</button>
        </div>
      </section>`;
      continue;
    }
    const note = b.style === 'circuit' ? `${b.items[0].sets} rounds · go move to move, rest after the last` : b.style === 'superset' ? 'Superset · alternate the moves, rest after each pair' : 'Straight sets · rest between sets';
    html += `<section class="card wk-block strength ${doneBlock ? 'complete' : ''} ${isCur ? 'current' : ''}" id="blk-${b.id}">
      <div class="wk-bhead"><span class="wk-tag letter">${esc(b.title.replace('Floor ', 'F'))}</span><div class="grow"><b>${esc(blockLabel(b))}</b><small class="muted">${esc(note)}</small></div>${doneBlock ? `<span class="pill">${icon('check', 12)} Done</span>` : ''}</div>`;
    b.items.forEach((it, i) => {
      const ex = EX_BY_ID[it.exId];
      const sug = suggestLoad(st().sessions.filter((x) => x.id !== a.id), it, U(), a.date);
      const last = lastPerformance(st().sessions, it.exId, a.date);
      const lastTxt = last ? last.sets.map((x) => (x.w ? `${wt(x.w)}×${x.reps}` : `${x.reps}`)).join(', ') : '';
      let hint = '';
      if (sug) hint = `<p class="hint num"><span class="try">Try ${wt(sug.kg)} ${unitLabel()}${sug.up ? ' ↑' : sug.down ? ' ↓' : ''}</span> Last time: ${esc(lastTxt)}</p>`;
      else if (lastTxt) hint = `<p class="hint num">Last time: ${esc(lastTxt)}</p>`;
      else if (ex.load === 'w') hint = `<p class="hint">First time? Pick a weight you could lift about ${it.reps + it.rir} times.</p>`;
      html += `<div class="ex">
        <div class="ex-head"><div class="grow"><b>${esc(ex.name)}</b><small class="muted num">${targetText(it)}${ex.load === 'w' ? ` · ${rirText(it.rir)}` : ''}</small></div></div>
        ${hint}
        <div class="sets">${Array.from({ length: it.sets }, (_, k) => setRow(b, i, it, k, ex, sug)).join('')}</div>
        <div class="ex-tools"><button class="text-btn sm" data-action="ex-info" data-b="${b.id}" data-i="${i}">${icon('info', 14)} How to</button><button class="text-btn sm" data-action="swap" data-b="${b.id}" data-i="${i}">${icon('swap', 14)} Swap</button><span class="faint small num">Rest ${clock(it.rest)}</span></div>
      </div>`;
    });
    html += `</section>`;
  }

  html += `<div class="finish">
    <button class="btn primary big" data-action="finish">${icon('check', 18)} Finish workout</button>
    <button class="text-btn center" data-action="discard">Discard workout</button>
  </div></div>`;
  return html;
}

function readRow(key, k) {
  const w = document.querySelector(`input[data-field="w"][data-key="${key}"][data-k="${k}"]`);
  const r = document.querySelector(`input[data-field="reps"][data-key="${key}"][data-k="${k}"]`);
  const wv = w && w.value !== '' ? toKg(parseFloat(w.value), U()) : null;
  const rv = r && r.value !== '' ? parseInt(r.value, 10) : null;
  return { w: Number.isFinite(wv) ? wv : null, reps: Number.isFinite(rv) ? rv : null };
}

function itemByKey(key) {
  const [bid, idx] = key.split(':');
  const b = st().active.plan.blocks.find((x) => x.id === bid);
  return { b, i: Number(idx), it: b.items[Number(idx)] };
}

/** What comes after this set: same move (straight sets) or the next move in the round. */
function nextAfter(b, i, k) {
  if (b.style === 'straight') {
    if (k + 1 < b.items[i].sets) return `${exName(b.items[i].exId)} · set ${k + 2}`;
  } else if (i + 1 < b.items.length) return `${exName(b.items[i + 1].exId)} · set ${k + 1}`;
  else if (k + 1 < b.items[0].sets) return `${exName(b.items[0].exId)} · round ${k + 2}`;
  const blocks = st().active.plan.blocks;
  const nb = blocks[blocks.indexOf(b) + 1];
  return nb ? `${nb.kind === 'strength' ? exName(nb.items[0].exId) : nb.title}` : 'Finish';
}

function tick(key, k) {
  unlockAudio();
  const { b, i, it } = itemByKey(key);
  const vals = readRow(key, k);
  let nowDone = false;
  store.update((s) => {
    const log = (s.active.log[key] = s.active.log[key] || []);
    const row = (log[k] = { ...(log[k] || {}), ...vals });
    row.done = !row.done;
    if (row.reps == null) row.reps = it.reps;
    nowDone = row.done;
  });
  render();
  if (nowDone && it.rest > 0) startRest(it.rest, nextAfter(b, i, k));
  else if (nowDone) stopRest();
}

/* ------------------------------------------------------------------ rest timer */

const rest = { cd: null, next: '' };
function startRest(sec, next) {
  rest.next = next;
  rest.cd?.stop();
  rest.cd = new Countdown({
    onTick: (r) => paintRest(r),
    onEnd: () => { beep('go'); paintRest(0, true); setTimeout(() => { if (!rest.cd?.running) hideRest(); }, 1500); },
  });
  rest.cd.start(sec);
  const el = $('#restbar');
  el.className = `restbar t-${st().active?.plan.type || 'red'}`;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('show'));
}
function paintRest(r, go) {
  $('#restbar').innerHTML = `<div class="rb-main"><span class="rb-k">${go ? 'Go!' : 'Rest'}</span><span class="rb-t num">${go ? icon('bolt', 24) : clock(r)}</span></div>
    <div class="rb-next"><small>Up next</small><b>${esc(rest.next)}</b></div>
    <div class="rb-btns"><button data-action="rest-add" data-by="-15" aria-label="15 seconds less">−15</button><button data-action="rest-add" data-by="15" aria-label="15 seconds more">+15</button><button data-action="rest-skip" aria-label="Skip rest">Skip</button></div>`;
}
function hideRest() { const el = $('#restbar'); el.classList.remove('show'); setTimeout(() => { if (!el.classList.contains('show')) el.hidden = true; }, 250); }
function stopRest() { rest.cd?.stop(); rest.cd = null; hideRest(); }

/* ------------------------------------------------------------------ interval timer */

const tm = { block: null, idx: -1, cd: null };
function runTimer(blockId) {
  unlockAudio();
  stopRest();
  tm.block = st().active.plan.blocks.find((x) => x.id === blockId);
  tm.idx = -1;
  tm.cd?.stop();
  tm.cd = new Countdown({ onTick: paintTimer, onEnd: () => gotoSeg(tm.idx + 1) });
  $('#timer').hidden = false;
  document.body.classList.add('no-scroll');
  tm.cd.start(5); // get ready
  paintTimer(5);
}
function currentSeg() { return tm.idx < 0 ? { label: 'Get ready', sec: 5, level: 'ready', effort: tm.block.segments[0] ? `First: ${segTitle(tm.block.segments[0])}` : '' } : tm.block.segments[tm.idx]; }
function gotoSeg(i) {
  if (i >= tm.block.segments.length) {
    beep('done');
    const id = tm.block.id;
    store.update((s) => { if (s.active) s.active.blocksDone[id] = true; });
    closeTimer();
    toast(`${tm.block.title} done`);
    render();
    return;
  }
  tm.idx = Math.max(0, i);
  beep('go');
  tm.cd.stop();
  tm.cd.start(tm.block.segments[tm.idx].sec);
}
function paintTimer(r) {
  const seg = currentSeg();
  const segs = tm.block.segments;
  const left = r + segs.slice(tm.idx + 1).reduce((a, x) => a + x.sec, 0);
  const next = segs[tm.idx + 1];
  const pct = seg.sec ? (1 - r / seg.sec) * 100 : 0;
  const label = seg.move ? seg.label : ({ walk: 'Easy', base: 'Steady', push: 'Push it', sprint: 'Everything you have' }[seg.level] || '');
  $('#timer').className = `timer lvl-${seg.level || 'none'}`;
  $('#timer').innerHTML = `<div class="tm-inner">
    <div class="tm-top"><button class="icon-btn glass" data-action="timer-close" aria-label="Close timer">${icon('x', 20)}</button>
      <div class="tm-meta"><b>${esc(tm.block.title)}</b><small class="num">${tm.idx < 0 ? 'Starting' : `${tm.idx + 1} of ${segs.length}`} · ${clock(left)} left</small></div><span style="width:44px"></span></div>
    <div class="tm-center">
      <div class="tm-label">${esc(label)}</div>
      <div class="tm-name">${esc(segTitle(seg))}</div>
      <div class="tm-clock num">${clock(r)}</div>
      ${seg.mph ? `<div class="tm-big num"><span>${fmtSpeed(seg.mph, U())}<small>${speedUnit(U())}</small></span><span>${seg.incline}<small>% incline</small></span></div>` : ''}
      <div class="tm-detail">${esc(seg.mph ? seg.effort || '' : segDetail(seg))}</div>
    </div>
    <div class="tm-bar"><i style="width:${pct.toFixed(1)}%"></i></div>
    <div class="tm-next">${next ? `<small>Next</small> <b>${esc(segTitle(next))}</b> <span class="num">${clock(next.sec)}${next.mph ? ` · ${fmtSpeed(next.mph, U())} ${speedUnit(U())} · ${next.incline}%` : ''}</span>` : '<small>Last one. Finish strong.</small>'}</div>
    <div class="tm-ctrl">
      <button class="icon-btn glass lg" data-action="timer-prev" aria-label="Previous">${icon('prev', 22)}</button>
      <button class="play" data-action="timer-pause" aria-label="${tm.cd?.running ? 'Pause' : 'Play'}">${icon(tm.cd?.running ? 'pause' : 'play', 30)}</button>
      <button class="icon-btn glass lg" data-action="timer-next" aria-label="Next">${icon('next', 22)}</button>
    </div>
  </div>`;
}
function closeTimer() { tm.cd?.stop(); $('#timer').hidden = true; document.body.classList.remove('no-scroll'); }

/* ------------------------------------------------------------------ finish */

function finishWorkout() {
  const a = st().active;
  const entries = [];
  for (const b of a.plan.blocks) {
    if (b.kind !== 'strength') continue;
    b.items.forEach((it, i) => {
      const ex = EX_BY_ID[it.exId];
      const sets = (a.log[logKey(b, i)] || []).filter((x) => x?.done).map((x) => ({ w: ex.load === 'w' ? x.w || 0 : 0, reps: x.reps || 0 }));
      if (sets.length) entries.push({ exId: it.exId, sets, targetReps: it.reps, targetSets: it.sets, rir: it.rir, block: b.id });
    });
  }
  const endedAt = Date.now();
  const session = {
    id: a.id, date: a.date, type: a.plan.type, focus: a.plan.focus, title: a.plan.title, phase: a.plan.phase,
    startedAt: a.startedAt, endedAt, durationSec: Math.round((endedAt - a.startedAt) / 1000),
    entries, blocksDone: Object.keys(a.blocksDone), rpe: null,
  };
  const prs = newBests(st().sessions, session);
  store.update((s) => { s.sessions.push(session); s.active = null; });
  closeWorkout();
  ui.tab = 'today';
  ui.date = session.date;
  render();
  summarySheet(session, prs);
}

function summarySheet(x, prs = []) {
  const vol = sessionVolume(x);
  const sets = (x.entries || []).reduce((a, e) => a + e.sets.length, 0);
  openSheet(`<div class="sum t-${x.type}">
    <div class="sum-badge">${icon('check', 34)}</div>
    <h2>Workout complete</h2>
    <p class="muted">${esc(x.title)}</p>
    <div class="stats three">
      <div class="stat"><span class="k">Time</span><span class="v num">${minutes(x.durationSec)}</span></div>
      <div class="stat"><span class="k">Sets</span><span class="v num">${sets}</span></div>
      <div class="stat"><span class="k">Lifted</span><span class="v num">${bigNum(fromKg(vol, U()))}<small>${unitLabel()}</small></span></div>
    </div>
    ${prs.length ? `<div class="prs">${prs.map((p) => `<div class="pr">${icon('trophy', 16)} <b>New best: ${esc(exName(p.exId))}</b> <span class="num">${wt(p.w)} ${unitLabel()} × ${p.reps}</span></div>`).join('')}</div>` : ''}
    <p class="small muted">How did it feel?</p>
    <div class="seg full">${['Easy', 'Solid', 'Hard', 'Max'].map((r) => `<button data-action="rpe" data-id="${x.id}" data-v="${r}" class="${x.rpe === r ? 'on' : ''}">${r}</button>`).join('')}</div>
    <button class="btn primary big" data-action="close-sheet">Done</button>
  </div>`);
}

/* ------------------------------------------------------------------ sheets */

let sheetKind = '';
function openSheet(html, kind = '') {
  sheetKind = kind;
  const root = $('#sheet-root');
  root.innerHTML = `<div class="scrim" data-action="close-sheet"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grabber"></div>${html}</div>`;
  requestAnimationFrame(() => root.classList.add('open'));
}
function closeSheet() {
  sheetKind = '';
  const root = $('#sheet-root');
  root.classList.remove('open');
  setTimeout(() => { if (!root.classList.contains('open')) root.innerHTML = ''; }, 260);
}

function focusSheet(date) {
  const cur = focusOf(date);
  openSheet(`<h2>Body-part focus</h2><p class="muted small">${dateLabel(date)}. The focus is the same whether you pick Lift Room or Red Room.</p>
    <div class="list">${FOCUS_IDS.map((f) => `<button class="set-row radio ${cur === f ? 'on' : ''}" data-action="pick-focus" data-date="${date}" data-v="${f}"><span><b>${esc(FOCI[f].label)}</b></span><i class="dot"></i></button>`).join('')}</div>
    <label class="check-row"><input type="checkbox" id="focus-every"> Use this every ${esc(dayName(date, 'long'))}</label>`);
}

function swapSheet(bid, i) {
  const a = st().active;
  const b = a.plan.blocks.find((x) => x.id === bid);
  const it = b.items[i];
  const alts = alternatives(it, b, a.plan.focus, a.plan.type, S().equipment);
  openSheet(`<h2>Swap exercise</h2><p class="muted small">Same kind of movement, with the equipment you have. Your pick is remembered.</p>
    <div class="list">${alts.map((e) => `<button class="set-row radio ${e.id === it.exId ? 'on' : ''}" data-action="do-swap" data-b="${bid}" data-i="${i}" data-v="${e.id}"><span><b>${esc(e.name)}</b><small>${esc(e.cue || '')}</small></span><i class="dot"></i></button>`).join('')}</div>`);
}

function infoSheet(exId) {
  const ex = EX_BY_ID[exId];
  const hist = st().sessions.filter((s) => (s.entries || []).some((e) => e.exId === exId)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const q = encodeURIComponent(`${ex.name} exercise form`);
  openSheet(`<h2>${esc(ex.name)}</h2>
    <p class="cue">${esc(ex.cue || '')}</p>
    <p class="muted small">${ex.req.length ? `Needs: ${ex.req.map((r) => EQUIPMENT.find((e) => e.id === r)?.name).join(', ')}` : 'No equipment needed'}${ex.uni ? ' · Do each side' : ''}</p>
    <a class="btn" href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener">${icon('video', 16)} Watch a demo</a>
    ${hist.length ? `<h3 class="section-title">Recent</h3><div class="list">${hist.map((s) => { const e = s.entries.find((x) => x.exId === exId); return `<div class="set-row"><span><b>${dateLabel(s.date)}</b></span><span class="muted num">${e.sets.map((x) => (x.w ? `${wt(x.w)}×${x.reps}` : x.reps)).join(', ')}</span></div>`; }).join('')}</div>` : '<p class="faint small">No history yet.</p>'}`);
}

function historySheet(id) {
  const x = st().sessions.find((s) => s.id === id);
  if (!x) return;
  const vol = sessionVolume(x);
  openSheet(`<h2>${esc(x.title)}</h2>
    <p class="muted num">${dateLabel(x.date)}${x.durationSec ? ` · ${minutes(x.durationSec)}` : ''}${vol ? ` · ${bigNum(fromKg(vol, U()))} ${unitLabel()}` : ''}${x.rpe ? ` · Felt ${esc(x.rpe).toLowerCase()}` : ''}</p>
    ${x.class ? '<p>Logged as a studio class.</p>' : ''}
    ${(x.entries || []).length ? `<div class="list">${x.entries.map((e) => `<button class="set-row" data-action="exercise" data-id="${e.exId}"><span><b>${esc(exName(e.exId))}</b></span><span class="muted num">${e.sets.map((s) => (s.w ? `${wt(s.w)}×${s.reps}` : s.reps)).join(', ')}</span></button>`).join('')}</div>` : x.class ? '' : '<p class="faint">No sets logged.</p>'}
    <div class="actions"><button class="btn danger" data-action="delete-session" data-id="${x.id}">${icon('trash', 16)} Delete</button></div>`);
}

function classSheet() {
  const type = typeOf(ui.date) === 'red' ? 'red' : 'lift';
  openSheet(`<h2>Log a studio class</h2><p class="muted small">${dateLabel(ui.date)} · ${esc(focusLabel(focusOf(ui.date)))}. It counts toward your weekly goal.</p>
    <div class="room-toggle" id="class-type">${['lift', 'red'].map((t) => `<button class="rt t-${t} ${type === t ? 'on' : ''}" data-action="class-type" data-v="${t}">${icon(ROOM_ICON[t], 16)}<span>${TYPES[t].label}</span></button>`).join('')}</div>
    <div class="field-row"><label>Minutes</label><div class="stepper"><button data-action="class-min" data-by="-5" aria-label="Less">${icon('minus', 16)}</button><span class="num" id="class-min">50</span><button data-action="class-min" data-by="5" aria-label="More">${icon('plus', 16)}</button></div></div>
    <button class="btn primary big" data-action="save-class">Log class</button>`);
}

function welcomeSheet() {
  openSheet(`<div class="welcome">
    <div class="wordmark">ONYX</div>
    <h2>Your studio week, anywhere</h2>
    <p class="muted">Every day has a body-part focus, like Arms & Abs or Butt & Legs. You pick the room:</p>
    <div class="rooms">
      <div class="room-card t-lift">${icon('dumbbell', 22)}<b>Lift Room</b><small>Strength. Heavier weights, all on the floor.</small></div>
      <div class="room-card t-red">${icon('flame', 22)}<b>Red Room</b><small>Treadmill intervals with floor strength.</small></div>
    </div>
    <p class="small muted label">Units</p>
    ${unitSeg('welcome')}
    <p class="small muted label">Where do you usually train?</p>
    ${locGrid('welcome')}
    <p class="small muted">Travelling? Switch where you're training any day from the Today screen.</p>
    <button class="btn primary big" data-action="welcome-done">Let's go</button>
  </div>`, 'welcome');
}

/* ------------------------------------------------------------------ render */

const TABS = { today: renderToday, week: renderWeek, progress: renderProgress, settings: renderSettings };

let lastScreen = '';
function render() {
  setSound(S().sound);
  const view = $('#view');
  const inWorkout = ui.workout && st().active;
  const screen = inWorkout ? 'workout' : ui.tab;
  view.classList.toggle('animate', screen !== lastScreen);
  lastScreen = screen;
  document.body.classList.toggle('in-workout', !!inWorkout);
  view.innerHTML = inWorkout ? renderWorkout() : TABS[ui.tab]();
  document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-current', !inWorkout && t.dataset.tab === ui.tab ? 'page' : 'false'));
}

/* ------------------------------------------------------------------ actions */

function matchLocation(s) {
  const set = new Set(s.settings.equipment);
  const m = LOCATIONS.find((l) => l.equipment.length === set.size && l.equipment.every((x) => set.has(x)) && l.cardio === s.settings.cardio);
  s.settings.location = m ? m.id : 'custom';
}

const actions = {
  unit: (el) => { store.update((s) => { s.settings.unit = el.dataset.v; }); render(); if (el.dataset.sheet === 'welcome') welcomeSheet(); },
  'theme-toggle': () => { store.update((s) => { s.settings.theme = isDark() ? 'light' : 'dark'; }); applyTheme(); render(); },
  theme: (el) => { store.update((s) => { s.settings.theme = el.dataset.v; }); applyTheme(); render(); },
  minutes: (el) => { store.update((s) => { s.settings.minutes = Number(el.dataset.v); }); render(); },
  goto: (el) => { ui.tab = el.dataset.tab; render(); window.scrollTo(0, 0); },
  'pick-date': (el) => { ui.date = el.dataset.date; render(); },
  'goto-date': (el) => { ui.date = el.dataset.date; ui.tab = 'today'; render(); window.scrollTo(0, 0); },
  'shift-week': (el) => { ui.date = addDays(ui.date, Number(el.dataset.by)); render(); },
  month: (el) => { const [y, m] = ui.month.split('-').map(Number); ui.month = toISO(new Date(y, m - 1 + Number(el.dataset.by), 1)).slice(0, 7); render(); },
  room: (el) => { setRoom(el.dataset.date, el.dataset.v); render(); },
  'focus-sheet': (el) => focusSheet(el.dataset.date),
  'pick-focus': (el) => {
    const { date, v } = el.dataset;
    const every = $('#focus-every')?.checked;
    store.update((s) => {
      if (every) {
        s.focusWeek[weekday(date)] = v;
        const d = { ...(s.days[date] || {}) };
        delete d.focus;
        if (Object.keys(d).length) s.days[date] = d; else delete s.days[date];
      } else {
        s.days[date] = { ...(s.days[date] || {}), focus: v };
      }
    });
    closeSheet(); render(); toast(every ? `Every ${dayName(date, 'long')}: ${FOCI[v].label}` : FOCI[v].label);
  },
  shuffle: () => { store.update((s) => { const d = (s.days[ui.date] = { ...(s.days[ui.date] || {}) }); d.salt = (d.salt || 0) + 1; }); render(); toast('New exercises'); },
  'set-location': (el) => {
    const loc = LOCATIONS.find((l) => l.id === el.dataset.v);
    store.update((s) => { s.settings.location = loc.id; s.settings.equipment = [...loc.equipment]; s.settings.cardio = loc.cardio; });
    render();
    if (el.dataset.sheet === 'welcome') welcomeSheet(); else toast(`Training at: ${loc.name}`);
  },
  equip: (el) => {
    store.update((s) => {
      const set = new Set(s.settings.equipment);
      if (set.has(el.dataset.v)) set.delete(el.dataset.v); else set.add(el.dataset.v);
      s.settings.equipment = EQUIPMENT.map((e) => e.id).filter((id) => set.has(id));
      matchLocation(s);
    });
    render();
  },
  cardio: (el) => { store.update((s) => { s.settings.cardio = el.dataset.v; matchLocation(s); }); render(); },
  start: () => startWorkout(),
  'start-recovery': () => startWorkout('recovery'),
  'open-workout': () => openWorkout(),
  'close-workout': () => closeWorkout(),
  jump: (el) => { const t = document.getElementById(`blk-${el.dataset.id}`); if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 150, behavior: 'smooth' }); },
  'log-class': () => classSheet(),
  'class-type': (el) => { document.querySelectorAll('#class-type button').forEach((b) => b.classList.toggle('on', b === el)); },
  'class-min': (el) => { const n = $('#class-min'); n.textContent = Math.max(10, Math.min(120, Number(n.textContent) + Number(el.dataset.by))); },
  'save-class': () => {
    const type = $('#class-type .on')?.dataset.v || 'lift';
    const mins = Number($('#class-min').textContent);
    const focus = focusOf(ui.date);
    store.update((s) => { s.sessions.push({ id: uid(), date: ui.date, type, focus, title: `${TYPES[type].label} · ${FOCI[focus].label}`, class: true, durationSec: mins * 60, endedAt: Date.now(), entries: [] }); });
    closeSheet(); render(); toast('Class logged');
  },
  tick: (el) => tick(el.dataset.key, Number(el.dataset.k)),
  'block-done': (el) => { store.update((s) => { const d = s.active.blocksDone; if (d[el.dataset.id]) delete d[el.dataset.id]; else d[el.dataset.id] = true; }); render(); },
  collapse: (el) => { ui.collapsed[el.dataset.id] = el.dataset.open === '1'; render(); },
  'run-timer': (el) => runTimer(el.dataset.id),
  'timer-close': () => closeTimer(),
  'timer-pause': () => { if (tm.cd.running) tm.cd.pause(); else tm.cd.resume(); paintTimer(tm.cd.remaining()); },
  'timer-next': () => gotoSeg(tm.idx + 1),
  'timer-prev': () => { if (tm.idx > 0) gotoSeg(tm.idx - 1); else { tm.cd.stop(); tm.cd.start(currentSeg().sec); } },
  'rest-add': (el) => rest.cd?.add(Number(el.dataset.by)),
  'rest-skip': () => stopRest(),
  swap: (el) => swapSheet(el.dataset.b, Number(el.dataset.i)),
  'do-swap': (el) => {
    const { b: bid, i, v } = el.dataset;
    store.update((s) => {
      const b = s.active.plan.blocks.find((x) => x.id === bid);
      const it = b.items[Number(i)];
      if (it.exId === v) return;
      it.exId = v;
      const ex = EX_BY_ID[v];
      const ph = PHASES[s.active.plan.programWeek];
      // Keep targets sensible when switching between weighted and bodyweight moves.
      if (ex.load === 'bw') it.reps = Math.max(3, Math.round((ex.base || 12) * ph.bwMul));
      else if (ex.load === 't') it.reps = Math.max(5, Math.round(((ex.base || 30) * ph.bwMul) / 5) * 5);
      else it.reps = it.role === 'main' ? ph.mainReps : it.role === 'floor' ? ph.floorReps : ph.accReps;
      delete s.active.log[`${bid}:${i}`];
      if (it.swapKey) s.swaps[it.swapKey] = v;
    });
    closeSheet(); render();
  },
  'ex-info': (el) => { const b = st().active.plan.blocks.find((x) => x.id === el.dataset.b); infoSheet(b.items[Number(el.dataset.i)].exId); },
  exercise: (el) => infoSheet(el.dataset.id),
  history: (el) => historySheet(el.dataset.id),
  'delete-session': (el) => {
    if (!confirm('Delete this workout?')) return;
    store.update((s) => { s.sessions = s.sessions.filter((x) => x.id !== el.dataset.id); });
    closeSheet(); render(); toast('Deleted');
  },
  finish: () => {
    const p = progressOf(st().active);
    if (p.done === 0 && !Object.keys(st().active.blocksDone).length && !confirm('Nothing logged yet. Finish anyway?')) return;
    finishWorkout();
  },
  discard: () => {
    if (!confirm('Discard this workout? Logged sets will be lost.')) return;
    store.update((s) => { s.active = null; });
    closeWorkout(); toast('Workout discarded');
  },
  rpe: (el) => {
    store.update((s) => { const x = s.sessions.find((y) => y.id === el.dataset.id); if (x) x.rpe = el.dataset.v; });
    el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el));
    render();
  },
  'close-sheet': () => { if (sheetKind === 'welcome') actions['welcome-done'](); else closeSheet(); },
  'save-usual': () => {
    const mon = mondayOf(ui.date);
    store.update((s) => {
      const picks = Array.from({ length: 7 }, (_, i) => addDays(mon, i)).map((d) => [d, typeFor(d, s.plan, s.days), focusFor(d, s.focusWeek, s.days)]);
      picks.forEach(([d, t, f], i) => {
        s.plan[i] = t;
        s.focusWeek[i] = f;
        if (s.days[d]) { delete s.days[d].type; delete s.days[d].focus; if (!Object.keys(s.days[d]).length) delete s.days[d]; }
      });
    });
    render(); toast('Saved as your usual week');
  },
  'reset-usual': () => { store.update((s) => { s.plan = ['lift', 'red', 'lift', 'red', 'lift', 'rest', 'rest']; }); render(); toast('Usual week: 3 Lift + 2 Red'); },
  'restart-cycle': () => { store.update((s) => { s.settings.programStart = mondayOf(todayISO()); }); render(); toast('Back to week 1: Base'); },
  step: (el) => {
    const by = Number(el.dataset.by);
    const k = el.dataset.key;
    store.update((s) => {
      if (k === 'goal') s.settings.goal = Math.max(1, Math.min(7, s.settings.goal + by));
      if (k === 'restMain') s.settings.restMain = Math.max(30, Math.min(300, s.settings.restMain + by * 15));
      if (k === 'restAcc') s.settings.restAcc = Math.max(15, Math.min(180, s.settings.restAcc + by * 15));
    });
    render();
  },
  speed: (el) => {
    store.update((s) => {
      const k = el.dataset.k;
      const step = U() === 'lb' ? 0.1 : 0.2;
      const shown = Math.round((fromMph(s.settings.speeds[k], U()) + Number(el.dataset.by) * step) * 10) / 10;
      s.settings.speeds[k] = Math.max(1, Math.min(15, toMph(shown, U())));
    });
    render();
  },
  toggle: (el) => { store.update((s) => { s.settings[el.dataset.key] = !s.settings[el.dataset.key]; }); render(); },
  export: () => {
    const blob = new Blob([store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `onyx-backup-${todayISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  import: () => $('#file-input').click(),
  erase: () => {
    if (!confirm('Erase all workouts and settings on this device?')) return;
    store.reset(); applyTheme(); ui.date = todayISO(); render(); toast('Erased');
  },
  'welcome-done': () => { store.update((s) => { s.settings.onboarded = true; }); closeSheet(); render(); },
};

document.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (tab) {
    // Tapping Today while on Today jumps back to the current date.
    if (tab.dataset.tab === 'today' && ui.tab === 'today' && !ui.workout) ui.date = todayISO();
    if (tab.dataset.tab === 'progress') ui.month = todayISO().slice(0, 7);
    ui.workout = false;
    stopRest();
    ui.tab = tab.dataset.tab;
    render();
    window.scrollTo(0, 0);
    return;
  }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = actions[el.dataset.action];
  if (fn) { e.preventDefault(); fn(el, e); }
});

// Typing a weight or reps: save quietly so the keyboard stays up.
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.field && st().active) {
    const { key, k } = el.dataset;
    const vals = readRow(key, Number(k));
    const log = (st().active.log[key] = st().active.log[key] || []);
    log[Number(k)] = { ...(log[Number(k)] || {}), ...vals };
    store.quietSave();
  }
});

$('#file-input').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try { store.importJSON(await f.text()); applyTheme(); render(); toast('Restored'); } catch (err) { toast(err.message || 'Could not read that file'); }
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (!$('#timer').hidden) closeTimer(); else actions['close-sheet'](); } });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ui.workout) keepAwake(true); });
setInterval(() => { const el = $('#elapsed'); if (el && st().active) el.textContent = clock((Date.now() - st().active.startedAt) / 1000); }, 1000);

/* ------------------------------------------------------------------ boot */

const TAB_NAME = { today: 'Today', week: 'Week', progress: 'Progress', settings: 'Settings' };
document.querySelectorAll('.tab').forEach((t) => { t.innerHTML = `${icon(t.dataset.tab, 22)}<span>${TAB_NAME[t.dataset.tab]}</span>`; });
applyTheme();
render();
if (!S().onboarded) welcomeSheet();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
