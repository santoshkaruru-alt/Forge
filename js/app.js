import { store, uid } from './store.js';
import { icon } from './icons.js';
import { EX_BY_ID, LOCATIONS, EQUIPMENT, CARDIO } from './exercises.js';
import {
  TYPES, TYPE_IDS, FOCI, FOCUS_IDS, DEFAULT_WEEK, PHASES, buildSession, tripInfo, typeFor, focusFor,
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
const SHORT = { lift: 'Lift', red: 'Red', recovery: 'Easy', rest: 'Off' };
const GLYPH = { lift: 'L', red: 'R', recovery: 'E', rest: '' };

const ui = { tab: 'today', date: todayISO(), workout: false, collapsed: {} };

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.id);
  toast.id = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ------------------------------------------------------------------ theme */

function systemDark() { return window.matchMedia?.('(prefers-color-scheme: dark)').matches; }
function isDark() { return S().theme === 'dark' || (S().theme === 'auto' && systemDark()); }
function applyTheme() {
  const t = S().theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  const m = document.createElement('meta');
  m.name = 'theme-color';
  m.content = isDark() ? '#000000' : '#f2f2f2';
  document.head.appendChild(m);
}
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => { applyTheme(); render(); });

/* ------------------------------------------------------------------ plan data */

function planFor(date) {
  const s = st();
  const type = typeFor(date, s.plan, s.days);
  const focus = focusFor(date, s.plan, s.days) || 'full';
  return buildSession({ date, type, focus, settings: S(), swaps: s.swaps, salt: s.days[date]?.salt || 0 });
}
const sessionsOn = (date) => st().sessions.filter((x) => x.date === date);
const exName = (id) => EX_BY_ID[id]?.name || id;

function targetText(it) {
  const ex = EX_BY_ID[it.exId];
  const reps = ex.load === 't' ? `${it.reps} s` : `${it.reps}${ex.uni ? '/side' : ''}`;
  return `${it.sets} × ${reps}`;
}
function segDetail(seg) {
  if (seg.mph) return `${fmtSpeed(seg.mph, U())} ${speedUnit(U())} · ${seg.incline}% incline${seg.effort ? ` · ${seg.effort}` : ''}`;
  if (seg.move) return seg.effort;
  return seg.effort || '';
}
const segTitle = (seg) => seg.move || seg.label;

/* ------------------------------------------------------------------ shared bits */

function topbar(title, eyebrow) {
  const dark = isDark();
  return `<header class="topbar">
    <div><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1></div>
    <div class="top-actions">
      <div class="seg mini" role="group" aria-label="Units">
        <button data-action="unit" data-v="lb" class="${U() === 'lb' ? 'on' : ''}">lb</button><button data-action="unit" data-v="kg" class="${U() === 'kg' ? 'on' : ''}">kg</button>
      </div>
      <button class="icon-btn" data-action="theme-toggle" aria-label="Switch to ${dark ? 'light' : 'dark'} mode">${icon(dark ? 'sun' : 'moon', 18)}</button>
    </div>
  </header>`;
}

function tripLine(date) {
  const t = tripInfo(date, S());
  if (t.before) return `Trip starts ${dateLabel(t.start)}`;
  if (t.inTrip) return `Week ${t.week} of ${t.totalWeeks} · ${t.phase.name} · Day ${t.day}`;
  return `Week ${t.week} · ${t.phase.name}`;
}

/* ------------------------------------------------------------------ today */

function weekStrip() {
  const mon = mondayOf(ui.date);
  const today = todayISO();
  const s = st();
  const cells = [];
  for (let i = 0; i < 7; i += 1) {
    const d = addDays(mon, i);
    const type = typeFor(d, s.plan, s.days);
    const done = sessionsOn(d).length > 0;
    cells.push(`<button class="day ${d === ui.date ? 'sel' : ''} ${d === today ? 'today' : ''} ${done ? 'done' : ''} t-${type}" data-action="pick-date" data-date="${d}" aria-label="${dateLabel(d)}, ${TYPES[type].long}${done ? ', done' : ''}">
      <span class="dw">${dayName(d, 'narrow')}</span><span class="dn">${parseISO(d).getDate()}</span><span class="dt">${done ? icon('check', 12) : GLYPH[type] || '·'}</span>
    </button>`);
  }
  return `<div class="week-nav">
    <button class="icon-btn sm" data-action="shift-week" data-by="-7" aria-label="Previous week">${icon('chevL', 16)}</button>
    <div class="week-strip">${cells.join('')}</div>
    <button class="icon-btn sm" data-action="shift-week" data-by="7" aria-label="Next week">${icon('chevR', 16)}</button>
  </div>`;
}

function previewBlocks(plan) {
  return plan.blocks.map((b) => {
    if (b.kind === 'strength') {
      return `<li class="pv-block"><span class="pv-tag">${esc(b.title.replace('Floor ', 'F'))}</span><div class="pv-items">${b.items.map((it) => {
        const sug = suggestLoad(st().sessions, it, U(), plan.date);
        return `<div class="pv-item"><span class="pv-name">${esc(exName(it.exId))}</span><span class="pv-meta num">${targetText(it)}${sug ? ` · ${wt(sug.kg)} ${unitLabel()}` : ''}</span></div>`;
      }).join('')}</div></li>`;
    }
    return `<li class="pv-block timed"><span class="pv-tag">${icon(b.kind === 'intervals' ? 'bolt' : 'clock', 14)}</span><div class="pv-items"><div class="pv-item"><span class="pv-name">${esc(b.title)}${b.sub ? `<small>${esc(b.sub)}</small>` : ''}</span><span class="pv-meta num">${minutes(blockSeconds(b))}</span></div></div></li>`;
  }).join('');
}

function locationChip() {
  const loc = LOCATIONS.find((l) => l.id === S().location);
  const cardio = CARDIO.find((c) => c.id === S().cardio);
  return `<button class="chip loc" data-action="location">${icon('pin', 14)} ${esc(loc ? loc.name : 'Custom kit')} · ${esc(cardio?.name || '')} ${icon('chevD', 14)}</button>`;
}

function renderToday() {
  const date = ui.date;
  const s = st();
  const plan = planFor(date);
  const done = sessionsOn(date);
  const isToday = date === todayISO();
  const active = s.active;
  const eyebrow = isToday ? `Today · ${dateLabel(date)}` : dateLabel(date);
  let html = topbar(isToday ? 'Today' : dayName(date, 'long'), eyebrow);
  html += `<p class="trip-line">${esc(tripLine(date))}</p>`;
  html += weekStrip();

  if (active) {
    const p = progressOf(active);
    html += `<button class="card resume" data-action="open-workout">
      <div><div class="eyebrow">In progress</div><b>${esc(active.plan.title)}</b><small class="num">${p.done}/${p.total} sets · started ${new Date(active.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small></div>
      <span class="btn primary sm">Resume</span>
    </button>`;
  }

  const type = plan.type;
  html += `<section class="card session">
    <div class="seg full" role="group" aria-label="Session type">${TYPE_IDS.map((t) => `<button data-action="set-type" data-v="${t}" class="${type === t ? 'on' : ''}">${TYPES[t].label}</button>`).join('')}</div>`;

  if (type === 'lift' || type === 'red') {
    html += `<div class="chips focus">${FOCUS_IDS.map((f) => `<button class="chip ${plan.focus === f ? 'on' : ''}" data-action="set-focus" data-v="${f}">${FOCI[f].label}</button>`).join('')}</div>`;
  }

  if (type === 'rest') {
    html += `<div class="rest-card">
      <div class="big-glyph">${icon('moon', 28)}</div>
      <h2>Rest day</h2>
      <p class="muted">Recovery is where strength is built. Get a walk in, stretch, hydrate and sleep well. Want to train anyway? Pick Lift, Red or Recover above.</p>
    </div>`;
  } else {
    html += `<div class="session-head">
      <div><h2>${esc(TYPES[type].long)}${plan.focus && type !== 'recovery' ? ` <span class="dim">· ${esc(FOCI[plan.focus].sub)}</span>` : ''}</h2>
      <p class="muted num">~${plan.estMin} min · ${esc(plan.phase)}${type === 'lift' ? ` · ${PHASES[plan.programWeek].mainSets} × ${PHASES[plan.programWeek].mainReps} main lifts` : ''}</p></div>
      <button class="icon-btn" data-action="shuffle" aria-label="Shuffle exercises" title="Shuffle exercises">${icon('shuffle', 18)}</button>
    </div>
    ${locationChip()}
    <ul class="preview">${previewBlocks(plan)}</ul>
    <p class="phase-note">${esc(plan.phaseNote)}</p>
    <div class="actions">
      ${active ? `<button class="btn primary" data-action="open-workout">${icon('play', 16)} Resume workout</button>` : `<button class="btn primary" data-action="start">${icon('play', 16)} Start workout</button>`}
      ${type === 'lift' || type === 'red' ? `<button class="btn ghost" data-action="log-class">${icon('ticket', 16)} Took a class instead</button>` : ''}
    </div>`;
  }
  html += `</section>`;

  if (done.length) {
    html += `<section class="card"><div class="card-head"><h2>Done ${isToday ? 'today' : 'this day'}</h2></div>${done.map(historyRow).join('')}</section>`;
  }
  return html;
}

/* ------------------------------------------------------------------ plan */

function renderPlan() {
  const s = st();
  const counts = TYPE_IDS.map((t) => [t, s.plan.filter((x) => x === t).length]).filter(([, n]) => n);
  const t = tripInfo(todayISO(), S());
  let html = topbar('Plan', 'Your week');
  html += `<section class="card">
    <div class="card-head"><h2>Weekly routine</h2><button class="link" data-action="reset-week">Reset</button></div>
    <p class="muted small">Your default week. Tap Today to change a single day without touching this.</p>
    <div class="week-rows">${s.plan.map((type, i) => `<div class="week-row"><span class="wd">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}</span>
      <div class="seg compact">${TYPE_IDS.map((x) => `<button data-action="plan-day" data-i="${i}" data-v="${x}" class="${type === x ? 'on' : ''}">${SHORT[x]}</button>`).join('')}</div></div>`).join('')}</div>
    <p class="count-line num">${counts.map(([k, n]) => `${n} ${TYPES[k].label}`).join(' · ')}</p>
  </section>`;

  const weeks = [];
  for (let w = 1; w <= S().tripWeeks; w += 1) weeks.push(PHASES[((w - 1) % 4) + 1]);
  html += `<section class="card">
    <div class="card-head"><h2>Trip</h2><span class="faint small">${t.inTrip ? `Week ${t.week} now` : t.before ? 'Upcoming' : 'Finished'}</span></div>
    <div class="field-row"><label for="trip-start">Starts</label><input id="trip-start" type="date" value="${esc(S().tripStart)}" data-change="trip-start"></div>
    <div class="field-row"><label>Length</label>${stepper('tripWeeks', `${S().tripWeeks} wk`)}</div>
    <div class="phases">${weeks.map((p, i) => `<div class="phase ${t.inTrip && t.week === i + 1 ? 'now' : ''}"><span class="faint">Wk ${i + 1}</span><b>${p.name}</b><small class="num">${p.mainSets}×${p.mainReps}</small></div>`).join('')}</div>
    <p class="muted small">Main lifts stay the same through the trip so you can add weight each week. Accessories rotate weekly. Every 4th week is a lighter deload.</p>
  </section>`;

  const today = todayISO();
  html += `<section class="card"><div class="card-head"><h2>Next 7 days</h2></div><div class="upcoming">${Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i);
    const type = typeFor(d, s.plan, s.days);
    const focus = focusFor(d, s.plan, s.days);
    const done = sessionsOn(d).length > 0;
    return `<button class="up-row" data-action="goto-date" data-date="${d}">
      <span class="up-day"><b>${i === 0 ? 'Today' : dayName(d)}</b><small class="faint">${parseISO(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small></span>
      <span class="up-type"><span class="badge t-${type}">${TYPES[type].label}</span>${focus ? `<span class="muted">${FOCI[focus].label}</span>` : ''}</span>
      <span class="faint">${done ? icon('check', 16) : icon('chevR', 16)}</span>
    </button>`;
  }).join('')}</div></section>`;
  return html;
}

/* ------------------------------------------------------------------ progress */

function renderProgress() {
  const s = st();
  const today = todayISO();
  const t = tripInfo(today, S());
  const mon = mondayOf(today);
  const thisWeek = s.sessions.filter((x) => x.date >= mon && x.date <= addDays(mon, 6));
  const planned = s.plan.filter((x) => x === 'lift' || x === 'red').length;
  const tripEnd = addDays(t.start, S().tripWeeks * 7 - 1);
  const tripSessions = s.sessions.filter((x) => x.date >= t.start && x.date <= tripEnd);
  const totalSec = tripSessions.reduce((a, x) => a + (x.durationSec || 0), 0);
  const vol = tripSessions.reduce((a, x) => a + sessionVolume(x), 0);

  let html = topbar('Progress', 'Your training');
  html += `<div class="stats">
    <div class="stat"><span class="k">This week</span><span class="v num">${thisWeek.filter((x) => x.type === 'lift' || x.type === 'red').length}<small>/${planned}</small></span></div>
    <div class="stat"><span class="k">Trip sessions</span><span class="v num">${tripSessions.length}</span></div>
    <div class="stat"><span class="k">Time</span><span class="v num">${totalSec < 3600 ? `${Math.round(totalSec / 60)}<small>min</small>` : `${Math.round((totalSec / 3600) * 10) / 10}<small>h</small>`}</span></div>
    <div class="stat"><span class="k">Volume</span><span class="v num">${bigNum(fromKg(vol, U()))}<small>${unitLabel()}</small></span></div>
  </div>`;

  // Trip calendar
  const start = mondayOf(t.start);
  const weeks = Math.ceil((parseISO(tripEnd) - parseISO(start)) / 864e5 / 7 + 0.01);
  let grid = '';
  for (let w = 0; w < weeks; w += 1) {
    grid += `<div class="cal-row"><span class="cal-wk faint">W${w + 1}</span>`;
    for (let i = 0; i < 7; i += 1) {
      const d = addDays(start, w * 7 + i);
      const inTrip = d >= t.start && d <= tripEnd;
      const type = typeFor(d, s.plan, s.days);
      const done = sessionsOn(d);
      const doneType = done[0]?.type;
      const missed = !done.length && d < today && (type === 'lift' || type === 'red');
      grid += `<button class="cal ${inTrip ? '' : 'out'} ${done.length ? `done d-${doneType}` : ''} ${missed ? 'missed' : ''} ${d === today ? 'today' : ''}" data-action="goto-date" data-date="${d}" aria-label="${dateLabel(d)}"><span>${done.length ? GLYPH[doneType] || icon('check', 12) : GLYPH[type]}</span></button>`;
    }
    grid += '</div>';
  }
  html += `<section class="card"><div class="card-head"><h2>Trip calendar</h2><span class="faint small num">${dateLabel(t.start)} → ${dateLabel(tripEnd)}</span></div>
    <div class="cal-head"><span></span>${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<span>${d}</span>`).join('')}</div>
    <div class="cal-grid">${grid}</div>
    <div class="legend"><span><i class="key done-lift"></i>Lift</span><span><i class="key done-red"></i>Red</span><span><i class="key planned"></i>Planned</span><span><i class="key missed"></i>Missed</span></div>
  </section>`;

  // Weekly volume chart
  const bars = [];
  for (let i = 7; i >= 0; i -= 1) {
    const m = addDays(mon, -7 * i);
    const list = s.sessions.filter((x) => mondayOf(x.date) === m);
    bars.push({ m, v: fromKg(list.reduce((a, x) => a + sessionVolume(x), 0), U()), n: list.length });
  }
  html += `<section class="card"><div class="card-head"><h2>Weekly volume</h2><span class="faint small">${unitLabel()} lifted</span></div>${barChart(bars)}</section>`;

  const pbs = personalBests(s.sessions).slice(0, 8);
  html += `<section class="card"><div class="card-head"><h2>Personal bests</h2><span class="faint small">est. 1-rep max</span></div>
    ${pbs.length ? `<div class="pbs">${pbs.map((p) => `<button class="pb" data-action="exercise" data-id="${p.exId}"><span><b>${esc(exName(p.exId))}</b><small class="faint num">${wt(p.w)} ${unitLabel()} × ${p.reps} · ${dateLabel(p.date)}</small></span><span class="pb-v num">${wt(p.est)}<small>${unitLabel()}</small></span></button>`).join('')}</div>` : `<p class="muted small">Log a few weighted sets and your bests show up here.</p>`}
  </section>`;

  const hist = [...s.sessions].sort((a, b) => b.date.localeCompare(a.date) || (b.endedAt || 0) - (a.endedAt || 0));
  html += `<section class="card"><div class="card-head"><h2>History</h2><span class="faint small">${hist.length}</span></div>
    ${hist.length ? hist.slice(0, 40).map(historyRow).join('') : `<p class="muted small">Finished workouts land here.</p>`}</section>`;
  return html;
}

function barChart(bars) {
  const W = 320, H = 120, pad = 18;
  const max = Math.max(1, ...bars.map((b) => b.v));
  const bw = (W - 8) / bars.length;
  const cur = mondayOf(todayISO());
  const rects = bars.map((b, i) => {
    const h = b.v > 0 ? Math.max(3, (b.v / max) * (H - pad - 14)) : 2;
    const x = 4 + i * bw + bw * 0.18;
    const y = H - pad - h;
    const lab = parseISO(b.m).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
    return `<rect class="bar ${b.m === cur ? 'on' : ''}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${h.toFixed(1)}" rx="3"><title>${lab}: ${Math.round(b.v).toLocaleString()} ${unitLabel()}, ${b.n} sessions</title></rect>
      ${b.v > 0 ? `<text class="val" x="${(x + bw * 0.32).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle">${bigNum(b.v)}</text>` : ''}
      <text class="axis" x="${(x + bw * 0.32).toFixed(1)}" y="${H - 4}" text-anchor="middle">${lab}</text>`;
  }).join('');
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Volume per week, last 8 weeks"><line class="base" x1="0" x2="${W}" y1="${H - pad}" y2="${H - pad}"/>${rects}</svg></div>`;
}

function historyRow(x) {
  const vol = sessionVolume(x);
  const meta = [x.class ? 'Class' : null, x.durationSec ? minutes(x.durationSec) : null, vol ? `${bigNum(fromKg(vol, U()))} ${unitLabel()}` : null, x.rpe ? x.rpe : null].filter(Boolean).join(' · ');
  return `<button class="h-row" data-action="history" data-id="${x.id}">
    <span class="h-badge t-${x.type}"><span>${GLYPH[x.type] || icon('check', 12)}</span></span>
    <span class="h-main"><b>${esc(x.title)}</b><small class="faint num">${dateLabel(x.date)}${meta ? ` · ${esc(meta)}` : ''}</small></span>
    ${icon('chevR', 16)}
  </button>`;
}

/* ------------------------------------------------------------------ settings */

function stepper(key, label) {
  return `<div class="stepper"><button data-action="step" data-key="${key}" data-by="-1" aria-label="Less">${icon('minus', 16)}</button><span class="num">${esc(label)}</span><button data-action="step" data-key="${key}" data-by="1" aria-label="More">${icon('plus', 16)}</button></div>`;
}
function toggle(key, on) {
  return `<button class="switch ${on ? 'on' : ''}" role="switch" aria-checked="${on}" data-action="toggle" data-key="${key}"><i></i></button>`;
}

function renderSettings() {
  const s = S();
  const su = speedUnit(U());
  let html = topbar('Settings', 'Make it yours');
  html += `<section class="card list">
    <div class="set-row"><span><b>Units</b><small>Weights and treadmill speeds</small></span>
      <div class="seg"><button data-action="unit" data-v="lb" class="${U() === 'lb' ? 'on' : ''}">lb · mph</button><button data-action="unit" data-v="kg" class="${U() === 'kg' ? 'on' : ''}">kg · km/h</button></div></div>
    <div class="set-row"><span><b>Appearance</b></span>
      <div class="seg">${['auto', 'light', 'dark'].map((t) => `<button data-action="theme" data-v="${t}" class="${s.theme === t ? 'on' : ''}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div></div>
    <div class="set-row"><span><b>Session length</b><small>Lift and Red days</small></span>
      <div class="seg">${[30, 45, 60].map((m) => `<button data-action="minutes" data-v="${m}" class="${s.minutes === m ? 'on' : ''}">${m}</button>`).join('')}</div></div>
  </section>`;

  html += `<h3 class="section-title">Where you're training</h3>
  <section class="card list">
    ${LOCATIONS.map((l) => `<button class="set-row radio ${s.location === l.id ? 'on' : ''}" data-action="set-location" data-v="${l.id}"><span><b>${esc(l.name)}</b><small>${esc(l.sub)}</small></span><i class="dot"></i></button>`).join('')}
    <div class="set-col"><b>Equipment on hand</b><div class="chips wrap">${EQUIPMENT.map((e) => `<button class="chip ${s.equipment.includes(e.id) ? 'on' : ''}" data-action="equip" data-v="${e.id}">${esc(e.name)}</button>`).join('')}</div></div>
    <div class="set-col"><b>Cardio</b><div class="chips wrap">${CARDIO.map((c) => `<button class="chip ${s.cardio === c.id ? 'on' : ''}" data-action="cardio" data-v="${c.id}">${esc(c.name)}</button>`).join('')}</div></div>
  </section>`;

  html += `<h3 class="section-title">Treadmill speeds</h3>
  <section class="card list">
    <p class="muted small pad">Red room intervals use these. Push and All out creep up a little each week.</p>
    ${[['walk', 'Recover', 'Walk'], ['base', 'Base', 'Comfortable jog'], ['push', 'Push', 'Hard but steady'], ['sprint', 'All out', 'Short sprints']].map(([k, l, sub]) => `<div class="set-row"><span><b>${l}</b><small>${sub}</small></span><div class="stepper"><button data-action="speed" data-k="${k}" data-by="-1" aria-label="Slower">${icon('minus', 16)}</button><span class="num">${fmtSpeed(s.speeds[k], U())} ${su}</span><button data-action="speed" data-k="${k}" data-by="1" aria-label="Faster">${icon('plus', 16)}</button></div></div>`).join('')}
  </section>`;

  html += `<h3 class="section-title">Workout</h3>
  <section class="card list">
    <div class="set-row"><span><b>Cardio finisher</b><small>Short intervals at the end of Lift days</small></span>${toggle('finisher', s.finisher)}</div>
    <div class="set-row"><span><b>Rest, main lifts</b></span>${stepper('restMain', clock(s.restMain))}</div>
    <div class="set-row"><span><b>Rest, accessories</b></span>${stepper('restAcc', clock(s.restAcc))}</div>
    <div class="set-row"><span><b>Sounds</b><small>Beeps for timers. Vibrates where supported.</small></span>${toggle('sound', s.sound)}</div>
  </section>`;

  html += `<h3 class="section-title">Your data</h3>
  <section class="card list">
    <button class="set-row" data-action="export"><span><b>Back up</b><small>Save everything to a file</small></span>${icon('download', 18)}</button>
    <button class="set-row" data-action="import"><span><b>Restore from backup</b></span>${icon('upload', 18)}</button>
    <button class="set-row danger" data-action="erase"><span><b>Erase everything</b></span>${icon('trash', 18)}</button>
  </section>
  <p class="footnote">Onyx keeps your data on this device only. Add it to your home screen and it works offline.</p>`;
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

function startWorkout() {
  unlockAudio();
  const plan = planFor(ui.date);
  store.update((s) => { s.active = { id: uid(), date: ui.date, startedAt: Date.now(), plan, log: {}, blocksDone: {} }; });
  openWorkout();
}

function openWorkout() {
  ui.workout = true;
  keepAwake(true);
  render();
  window.scrollTo(0, 0);
}

function closeWorkout() {
  ui.workout = false;
  keepAwake(false);
  stopRest();
  render();
}

function setRow(b, i, it, k, ex, sug) {
  const log = st().active.log[logKey(b, i)] || [];
  const row = log[k] || {};
  const prev = log.slice(0, k).reverse().find((x) => x?.w);
  const wKg = row.w ?? prev?.w ?? sug?.kg ?? null;
  const reps = row.reps ?? it.reps;
  const weighted = ex.load === 'w';
  return `<div class="set ${row.done ? 'done' : ''}">
    <span class="set-n num">${k + 1}</span>
    ${weighted ? `<label class="inp"><input type="number" inputmode="decimal" step="any" min="0" placeholder="–" value="${wKg != null ? wt(wKg) : ''}" data-field="w" data-key="${logKey(b, i)}" data-k="${k}" aria-label="Weight in ${unitLabel()}, set ${k + 1}"><span>${unitLabel()}</span></label>` : `<span class="inp bw">${ex.load === 't' ? 'Hold' : 'Bodyweight'}</span>`}
    <label class="inp"><input type="number" inputmode="numeric" min="0" value="${reps}" data-field="reps" data-key="${logKey(b, i)}" data-k="${k}" aria-label="${ex.load === 't' ? 'Seconds' : 'Reps'}, set ${k + 1}"><span>${ex.load === 't' ? 's' : 'reps'}</span></label>
    <button class="tick" data-action="tick" data-key="${logKey(b, i)}" data-k="${k}" aria-pressed="${!!row.done}" aria-label="Set ${k + 1} done">${icon('check', 18)}</button>
  </div>`;
}

function renderWorkout() {
  const a = st().active;
  const p = progressOf(a);
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
  let html = `<header class="wk-top">
    <button class="icon-btn" data-action="close-workout" aria-label="Minimize workout">${icon('chevD', 20)}</button>
    <div class="wk-title"><b>${esc(a.plan.title)}</b><small class="num"><span id="elapsed">${clock((Date.now() - a.startedAt) / 1000)}</span> · ${p.done}/${p.total} sets</small></div>
    <div class="seg mini"><button data-action="unit" data-v="lb" class="${U() === 'lb' ? 'on' : ''}">lb</button><button data-action="unit" data-v="kg" class="${U() === 'kg' ? 'on' : ''}">kg</button></div>
  </header>
  <div class="wk-bar"><i style="width:${pct}%"></i></div>`;

  for (const b of a.plan.blocks) {
    const doneBlock = !!a.blocksDone[b.id];
    if (b.kind !== 'strength') {
      const secs = blockSeconds(b);
      // Long interval lists start folded; the timer shows them one at a time anyway.
      const open = b.id in ui.collapsed ? !ui.collapsed[b.id] : b.segments.length <= 6;
      html += `<section class="card wk-block ${doneBlock ? 'complete' : ''}">
        <div class="wk-bhead">
          <span class="wk-tag">${icon(b.kind === 'intervals' ? 'bolt' : 'clock', 16)}</span>
          <div class="grow"><b>${esc(b.title)}</b><small class="muted num">${minutes(secs)}${b.sub ? ` · ${esc(b.sub)}` : ''}</small></div>
          <button class="icon-btn sm" data-action="block-done" data-id="${b.id}" aria-pressed="${doneBlock}" aria-label="Mark ${esc(b.title)} done">${icon('check', 16)}</button>
        </div>
        ${open ? `<ol class="segs">${b.segments.map((sg) => `<li><span class="num">${clock(sg.sec)}</span><b>${esc(segTitle(sg))}</b><small class="muted">${esc(segDetail(sg))}</small></li>`).join('')}</ol>` : ''}
        <div class="actions row"><button class="btn ${doneBlock ? '' : 'primary'}" data-action="run-timer" data-id="${b.id}">${icon('timer', 16)} ${doneBlock ? 'Run again' : 'Start timer'}</button>
        <button class="btn ghost sm" data-action="collapse" data-id="${b.id}">${open ? 'Hide' : 'Show'} steps</button></div>
      </section>`;
      continue;
    }
    const label = b.style === 'circuit' ? `${b.title} · Circuit` : b.style === 'superset' ? `${b.title} · Superset` : b.title;
    const note = b.style === 'circuit' ? (b.sub || '') : b.style === 'superset' ? 'Alternate moves, rest after each pair' : 'Straight sets';
    html += `<section class="card wk-block">
      <div class="wk-bhead"><span class="wk-tag letter">${esc(b.title.replace('Floor ', 'F'))}</span><div class="grow"><b>${esc(label)}</b><small class="muted">${esc(note)}</small></div></div>`;
    b.items.forEach((it, i) => {
      const ex = EX_BY_ID[it.exId];
      const sug = suggestLoad(st().sessions.filter((x) => x.id !== a.id), it, U(), a.date);
      const last = lastPerformance(st().sessions, it.exId, a.date);
      const lastTxt = last ? last.sets.map((x) => (x.w ? `${wt(x.w)}×${x.reps}` : `${x.reps}`)).join(', ') : '';
      html += `<div class="ex">
        <div class="ex-head">
          <div class="grow"><b>${b.items.length > 1 ? `<span class="faint">${esc(b.title.replace('Floor ', 'F'))}${i + 1}</span> ` : ''}${esc(ex.name)}</b>
          <small class="muted num">${targetText(it)}${it.rir != null && ex.load === 'w' ? ` · ${it.rir} in reserve` : ''} · rest ${clock(it.rest)}</small></div>
          <button class="icon-btn sm" data-action="ex-info" data-b="${b.id}" data-i="${i}" aria-label="How to do ${esc(ex.name)}">${icon('info', 16)}</button>
          <button class="icon-btn sm" data-action="swap" data-b="${b.id}" data-i="${i}" aria-label="Swap ${esc(ex.name)}">${icon('swap', 16)}</button>
        </div>
        ${sug || lastTxt ? `<p class="hint num">${lastTxt ? `Last: ${esc(lastTxt)}` : ''}${sug ? `${lastTxt ? ' · ' : ''}<b>Try ${wt(sug.kg)} ${unitLabel()}</b>${sug.up ? ' ↑' : sug.down ? ' ↓' : ''}` : ''}</p>` : ex.load === 'w' ? `<p class="hint">Pick a weight you could lift for ${it.reps + it.rir} reps.</p>` : ''}
        <div class="sets">${Array.from({ length: it.sets }, (_, k) => setRow(b, i, it, k, ex, sug)).join('')}</div>
      </div>`;
    });
    html += `</section>`;
  }

  html += `<div class="finish">
    <button class="btn primary big" data-action="finish">${icon('check', 18)} Finish workout</button>
    <button class="btn ghost" data-action="discard">Discard</button>
  </div>`;
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
  if (nowDone && it.rest === 0) stopRest();
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
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('show'));
}
function paintRest(r, go) {
  const el = $('#restbar');
  el.innerHTML = `<div class="rb-main"><span class="rb-k">${go ? 'Go' : 'Rest'}</span><span class="rb-t num">${go ? icon('bolt', 22) : clock(r)}</span></div>
    <div class="rb-next"><small class="faint">Next</small><b>${esc(rest.next)}</b></div>
    <div class="rb-btns"><button data-action="rest-add" data-by="-15" aria-label="15 seconds less">−15</button><button data-action="rest-add" data-by="15" aria-label="15 seconds more">+15</button><button data-action="rest-skip" aria-label="Skip rest">${icon('x', 16)}</button></div>`;
}
function hideRest() { const el = $('#restbar'); el.classList.remove('show'); setTimeout(() => { el.hidden = true; }, 250); }
function stopRest() { rest.cd?.stop(); rest.cd = null; hideRest(); }

/* ------------------------------------------------------------------ interval timer */

const tm = { block: null, idx: -1, cd: null };
function runTimer(blockId) {
  unlockAudio();
  stopRest();
  const b = st().active.plan.blocks.find((x) => x.id === blockId);
  tm.block = b;
  tm.idx = -1;
  tm.cd?.stop();
  tm.cd = new Countdown({ onTick: paintTimer, onEnd: () => gotoSeg(tm.idx + 1) });
  $('#timer').hidden = false;
  document.body.classList.add('no-scroll');
  tm.cd.start(5); // get ready
  paintTimer(5);
}
function currentSeg() { return tm.idx < 0 ? { label: 'Get ready', sec: 5, effort: tm.block.segments[0] ? `First up: ${segTitle(tm.block.segments[0])}` : '' } : tm.block.segments[tm.idx]; }
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
  $('#timer').innerHTML = `<div class="tm-inner lvl-${seg.level || 'none'}">
    <div class="tm-top"><button class="icon-btn" data-action="timer-close" aria-label="Close timer">${icon('x', 20)}</button>
      <div class="tm-meta"><b>${esc(tm.block.title)}</b><small class="num">${tm.idx < 0 ? 'Starting' : `${tm.idx + 1} / ${segs.length}`} · ${clock(left)} left</small></div><span style="width:40px"></span></div>
    <div class="tm-center">
      <div class="tm-label">${esc(seg.move ? seg.label : '')}</div>
      <div class="tm-name">${esc(segTitle(seg))}</div>
      <div class="tm-clock num">${clock(r)}</div>
      ${seg.mph ? `<div class="tm-big num"><span>${fmtSpeed(seg.mph, U())}<small>${speedUnit(U())}</small></span><span>${seg.incline}<small>% incline</small></span></div>` : ''}
      <div class="tm-detail">${esc(seg.mph ? seg.effort || '' : segDetail(seg))}</div>
    </div>
    <div class="tm-bar"><i style="width:${pct.toFixed(1)}%"></i></div>
    <div class="tm-next">${next ? `<small class="faint">Next</small> <b>${esc(segTitle(next))}</b> <span class="faint num">${clock(next.sec)}${next.mph ? ` · ${fmtSpeed(next.mph, U())} ${speedUnit(U())} · ${next.incline}%` : ''}</span>` : '<small class="faint">Last one</small>'}</div>
    <div class="tm-ctrl">
      <button class="icon-btn lg" data-action="timer-prev" aria-label="Previous">${icon('prev', 22)}</button>
      <button class="play" data-action="timer-pause" aria-label="${tm.cd?.running ? 'Pause' : 'Play'}">${icon(tm.cd?.running ? 'pause' : 'play', 30)}</button>
      <button class="icon-btn lg" data-action="timer-next" aria-label="Next">${icon('next', 22)}</button>
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
  render();
  summarySheet(session, prs);
}

function summarySheet(x, prs = []) {
  const vol = sessionVolume(x);
  const sets = (x.entries || []).reduce((a, e) => a + e.sets.length, 0);
  openSheet(`<div class="sum">
    <div class="sum-badge">${icon('check', 30)}</div>
    <h2>Nice work</h2>
    <p class="muted">${esc(x.title)}</p>
    <div class="stats three">
      <div class="stat"><span class="k">Time</span><span class="v num">${minutes(x.durationSec)}</span></div>
      <div class="stat"><span class="k">Sets</span><span class="v num">${sets}</span></div>
      <div class="stat"><span class="k">Volume</span><span class="v num">${bigNum(fromKg(vol, U()))}<small>${unitLabel()}</small></span></div>
    </div>
    ${prs.length ? `<div class="prs">${prs.map((p) => `<div class="pr">${icon('trophy', 16)} <b>${esc(exName(p.exId))}</b> <span class="num">${wt(p.w)} ${unitLabel()} × ${p.reps}</span></div>`).join('')}</div>` : ''}
    <p class="small muted">How did it feel?</p>
    <div class="seg full">${['Easy', 'Solid', 'Hard', 'Max'].map((r) => `<button data-action="rpe" data-id="${x.id}" data-v="${r}" class="${x.rpe === r ? 'on' : ''}">${r}</button>`).join('')}</div>
    <button class="btn primary big" data-action="close-sheet">Done</button>
  </div>`);
}

/* ------------------------------------------------------------------ sheets */

function openSheet(html) {
  const root = $('#sheet-root');
  root.innerHTML = `<div class="scrim" data-action="close-sheet"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grabber"></div>${html}</div>`;
  requestAnimationFrame(() => root.classList.add('open'));
}
function closeSheet() {
  const root = $('#sheet-root');
  root.classList.remove('open');
  setTimeout(() => { if (!root.classList.contains('open')) root.innerHTML = ''; }, 260);
}

function locationSheet() {
  const s = S();
  openSheet(`<h2>Where are you training?</h2><p class="muted small">Exercises adapt to the kit you have. Fine-tune equipment in Settings.</p>
    <div class="list">${LOCATIONS.map((l) => `<button class="set-row radio ${s.location === l.id ? 'on' : ''}" data-action="set-location" data-v="${l.id}" data-close="1"><span><b>${esc(l.name)}</b><small>${esc(l.sub)}</small></span><i class="dot"></i></button>`).join('')}</div>
    <p class="small muted" style="margin-top:14px">Cardio</p>
    <div class="chips wrap">${CARDIO.map((c) => `<button class="chip ${s.cardio === c.id ? 'on' : ''}" data-action="cardio" data-v="${c.id}" data-sheet="loc">${esc(c.name)}</button>`).join('')}</div>`);
}

function swapSheet(bid, i) {
  const a = st().active;
  const b = a.plan.blocks.find((x) => x.id === bid);
  const it = b.items[i];
  const alts = alternatives(it, b, a.plan.focus, a.plan.type, S().equipment);
  openSheet(`<h2>Swap exercise</h2><p class="muted small">Same movement, with the kit you have. Onyx remembers your pick for next time.</p>
    <div class="list">${alts.map((e) => `<button class="set-row radio ${e.id === it.exId ? 'on' : ''}" data-action="do-swap" data-b="${bid}" data-i="${i}" data-v="${e.id}"><span><b>${esc(e.name)}</b><small>${esc(e.cue || '')}</small></span><i class="dot"></i></button>`).join('')}</div>`);
}

function infoSheet(exId) {
  const ex = EX_BY_ID[exId];
  const hist = st().sessions.filter((s) => (s.entries || []).some((e) => e.exId === exId)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const q = encodeURIComponent(`${ex.name} exercise form`);
  openSheet(`<h2>${esc(ex.name)}</h2>
    <p>${esc(ex.cue || '')}</p>
    <p class="muted small">${ex.req.length ? `Needs: ${ex.req.map((r) => EQUIPMENT.find((e) => e.id === r)?.name).join(', ')}` : 'No equipment needed'}${ex.uni ? ' · Each side' : ''}</p>
    <a class="btn ghost" href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener">${icon('video', 16)} Watch a demo</a>
    ${hist.length ? `<h3 class="section-title">Recent</h3><div class="list">${hist.map((s) => { const e = s.entries.find((x) => x.exId === exId); return `<div class="set-row"><span><b>${dateLabel(s.date)}</b></span><span class="muted num">${e.sets.map((x) => (x.w ? `${wt(x.w)}×${x.reps}` : x.reps)).join(', ')}</span></div>`; }).join('')}</div>` : '<p class="faint small">No history yet.</p>'}`);
}

function historySheet(id) {
  const x = st().sessions.find((s) => s.id === id);
  if (!x) return;
  const vol = sessionVolume(x);
  openSheet(`<h2>${esc(x.title)}</h2>
    <p class="muted num">${dateLabel(x.date)}${x.durationSec ? ` · ${minutes(x.durationSec)}` : ''}${vol ? ` · ${bigNum(fromKg(vol, U()))} ${unitLabel()}` : ''}${x.rpe ? ` · Felt ${esc(x.rpe).toLowerCase()}` : ''}</p>
    ${x.class ? '<p>Logged as a class.</p>' : ''}
    ${(x.entries || []).length ? `<div class="list">${x.entries.map((e) => `<button class="set-row" data-action="exercise" data-id="${e.exId}"><span><b>${esc(exName(e.exId))}</b></span><span class="muted num">${e.sets.map((s) => (s.w ? `${wt(s.w)}×${s.reps}` : s.reps)).join(', ')}</span></button>`).join('')}</div>` : x.class ? '' : '<p class="faint">No sets logged.</p>'}
    <div class="actions"><button class="btn danger" data-action="delete-session" data-id="${x.id}">${icon('trash', 16)} Delete</button></div>`);
}

function classSheet() {
  const type = typeFor(ui.date, st().plan, st().days);
  openSheet(`<h2>Took a class?</h2><p class="muted small">Found a studio near your hotel? Log the class and it counts toward your week.</p>
    <div class="seg full" id="class-type">${['lift', 'red'].map((t) => `<button data-action="class-type" data-v="${t}" class="${type === t ? 'on' : ''}">${TYPES[t].long}</button>`).join('')}</div>
    <div class="field-row"><label>Minutes</label><div class="stepper"><button data-action="class-min" data-by="-5">${icon('minus', 16)}</button><span class="num" id="class-min">50</span><button data-action="class-min" data-by="5">${icon('plus', 16)}</button></div></div>
    <button class="btn primary big" data-action="save-class">Log class</button>`);
}

function welcomeSheet() {
  const s = S();
  openSheet(`<div class="welcome">
    <div class="wordmark">ONYX</div>
    <h2>Training on the road</h2>
    <p class="muted">Lift and Red days, built around wherever you are. A few quick choices and you're set. All of this can be changed later.</p>
    <p class="small muted">Units</p>
    <div class="seg full"><button data-action="unit" data-v="lb" data-sheet="welcome" class="${s.unit === 'lb' ? 'on' : ''}">lb · mph</button><button data-action="unit" data-v="kg" data-sheet="welcome" class="${s.unit === 'kg' ? 'on' : ''}">kg · km/h</button></div>
    <p class="small muted">Where will you train most?</p>
    <div class="list">${LOCATIONS.map((l) => `<button class="set-row radio ${s.location === l.id ? 'on' : ''}" data-action="set-location" data-v="${l.id}" data-sheet="welcome"><span><b>${esc(l.name)}</b><small>${esc(l.sub)}</small></span><i class="dot"></i></button>`).join('')}</div>
    <p class="small muted">Session length</p>
    <div class="seg full">${[30, 45, 60].map((m) => `<button data-action="minutes" data-v="${m}" data-sheet="welcome" class="${s.minutes === m ? 'on' : ''}">${m} min</button>`).join('')}</div>
    <div class="field-row"><label for="w-start">Trip starts</label><input id="w-start" type="date" value="${esc(s.tripStart)}" data-change="trip-start"></div>
    <div class="field-row"><label>Length</label>${stepper('tripWeeks', `${s.tripWeeks} wk`).replace(/data-action="step"/g, 'data-action="step" data-sheet="welcome"')}</div>
    <button class="btn primary big" data-action="welcome-done">Let's go</button>
  </div>`);
}

/* ------------------------------------------------------------------ render */

const TABS = { today: renderToday, plan: renderPlan, progress: renderProgress, settings: renderSettings };

let lastScreen = '';
function render() {
  setSound(S().sound);
  const view = $('#view');
  const inWorkout = ui.workout && st().active;
  const screen = inWorkout ? 'workout' : ui.tab;
  // Only animate when the screen changes, not on every re-render (ticking a set).
  view.classList.toggle('animate', screen !== lastScreen);
  lastScreen = screen;
  document.body.classList.toggle('in-workout', !!inWorkout);
  view.innerHTML = inWorkout ? renderWorkout() : TABS[ui.tab]();
  document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-current', t.dataset.tab === ui.tab ? 'page' : 'false'));
}

function rerenderSheet(which) {
  if (which === 'welcome') welcomeSheet();
  else if (which === 'loc') locationSheet();
}

/* ------------------------------------------------------------------ actions */

const actions = {
  unit: (el) => { store.update((s) => { s.settings.unit = el.dataset.v; }); render(); rerenderSheet(el.dataset.sheet); if (tm.cd && !$('#timer').hidden) paintTimer(tm.cd.remaining()); },
  'theme-toggle': () => { store.update((s) => { s.settings.theme = isDark() ? 'light' : 'dark'; }); applyTheme(); render(); },
  theme: (el) => { store.update((s) => { s.settings.theme = el.dataset.v; }); applyTheme(); render(); },
  minutes: (el) => { store.update((s) => { s.settings.minutes = Number(el.dataset.v); }); render(); rerenderSheet(el.dataset.sheet); },
  goto: (el) => { ui.tab = el.dataset.tab; render(); window.scrollTo(0, 0); },
  'pick-date': (el) => { ui.date = el.dataset.date; render(); },
  'goto-date': (el) => { ui.date = el.dataset.date; ui.tab = 'today'; render(); window.scrollTo(0, 0); },
  'shift-week': (el) => { ui.date = addDays(ui.date, Number(el.dataset.by)); render(); },
  'set-type': (el) => {
    const type = el.dataset.v;
    store.update((s) => {
      const d = { ...(s.days[ui.date] || {}) };
      delete d.focus;
      if (type === s.plan[weekday(ui.date)]) delete d.type; else d.type = type;
      if (Object.keys(d).length) s.days[ui.date] = d; else delete s.days[ui.date];
    });
    render();
  },
  'set-focus': (el) => { store.update((s) => { s.days[ui.date] = { ...(s.days[ui.date] || {}), focus: el.dataset.v }; }); render(); },
  shuffle: () => { store.update((s) => { const d = (s.days[ui.date] = { ...(s.days[ui.date] || {}) }); d.salt = (d.salt || 0) + 1; }); render(); toast('New exercises'); },
  location: () => locationSheet(),
  'set-location': (el) => {
    const loc = LOCATIONS.find((l) => l.id === el.dataset.v);
    store.update((s) => { s.settings.location = loc.id; s.settings.equipment = [...loc.equipment]; s.settings.cardio = loc.cardio; });
    render();
    if (el.dataset.close) { closeSheet(); toast(`Training at: ${loc.name}`); } else rerenderSheet(el.dataset.sheet);
  },
  equip: (el) => {
    store.update((s) => {
      const set = new Set(s.settings.equipment);
      if (set.has(el.dataset.v)) set.delete(el.dataset.v); else set.add(el.dataset.v);
      s.settings.equipment = EQUIPMENT.map((e) => e.id).filter((id) => set.has(id));
      const match = LOCATIONS.find((l) => l.equipment.length === set.size && l.equipment.every((x) => set.has(x)) && l.cardio === s.settings.cardio);
      s.settings.location = match ? match.id : 'custom';
    });
    render();
  },
  cardio: (el) => {
    store.update((s) => {
      s.settings.cardio = el.dataset.v;
      const set = new Set(s.settings.equipment);
      const match = LOCATIONS.find((l) => l.equipment.length === set.size && l.equipment.every((x) => set.has(x)) && l.cardio === s.settings.cardio);
      s.settings.location = match ? match.id : 'custom';
    });
    render(); rerenderSheet(el.dataset.sheet);
  },
  start: () => startWorkout(),
  'open-workout': () => openWorkout(),
  'close-workout': () => closeWorkout(),
  'log-class': () => classSheet(),
  'class-type': (el) => { document.querySelectorAll('#class-type button').forEach((b) => b.classList.toggle('on', b === el)); },
  'class-min': (el) => { const n = $('#class-min'); n.textContent = Math.max(10, Math.min(120, Number(n.textContent) + Number(el.dataset.by))); },
  'save-class': () => {
    const type = $('#class-type .on')?.dataset.v || 'lift';
    const mins = Number($('#class-min').textContent);
    const focus = focusFor(ui.date, st().plan, st().days);
    store.update((s) => { s.sessions.push({ id: uid(), date: ui.date, type, focus, title: `${TYPES[type].long} class`, class: true, durationSec: mins * 60, endedAt: Date.now(), entries: [] }); });
    closeSheet(); render(); toast('Class logged');
  },
  tick: (el) => tick(el.dataset.key, Number(el.dataset.k)),
  'block-done': (el) => { store.update((s) => { const d = s.active.blocksDone; if (d[el.dataset.id]) delete d[el.dataset.id]; else d[el.dataset.id] = true; }); render(); },
  collapse: (el) => { ui.collapsed[el.dataset.id] = el.textContent.trim().startsWith('Hide'); render(); },
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
      const fresh = st().active.plan;
      // Keep targets sensible when switching between weighted and bodyweight moves.
      if (ex.load === 'bw') it.reps = Math.max(3, Math.round((ex.base || 12) * (PHASES[fresh.programWeek].bwMul)));
      else if (ex.load === 't') it.reps = Math.max(5, Math.round(((ex.base || 30) * PHASES[fresh.programWeek].bwMul) / 5) * 5);
      else it.reps = it.role === 'main' ? PHASES[fresh.programWeek].mainReps : it.role === 'floor' ? PHASES[fresh.programWeek].floorReps : PHASES[fresh.programWeek].accReps;
      delete s.active.log[`${bid}:${i}`];
      if (it.swapKey) s.swaps[it.swapKey] = v;
    });
    closeSheet(); render();
  },
  'ex-info': (el) => { const a = st().active; const b = a.plan.blocks.find((x) => x.id === el.dataset.b); infoSheet(b.items[Number(el.dataset.i)].exId); },
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
  'close-sheet': () => closeSheet(),
  'plan-day': (el) => { store.update((s) => { s.plan[Number(el.dataset.i)] = el.dataset.v; }); render(); },
  'reset-week': () => { store.update((s) => { s.plan = [...DEFAULT_WEEK]; }); render(); toast('Back to 3 Lift + 2 Red'); },
  step: (el) => {
    const by = Number(el.dataset.by);
    const k = el.dataset.key;
    store.update((s) => {
      if (k === 'tripWeeks') s.settings.tripWeeks = Math.max(1, Math.min(12, s.settings.tripWeeks + by));
      if (k === 'restMain') s.settings.restMain = Math.max(30, Math.min(300, s.settings.restMain + by * 15));
      if (k === 'restAcc') s.settings.restAcc = Math.max(15, Math.min(180, s.settings.restAcc + by * 15));
    });
    render(); rerenderSheet(el.dataset.sheet);
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
    ui.workout = false;
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
  if (el.dataset.change === 'trip-start' && el.value) {
    store.update((s) => { s.settings.tripStart = el.value; });
    render();
    if ($('.welcome')) welcomeSheet();
    return;
  }
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

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (!$('#timer').hidden) closeTimer(); else closeSheet(); } });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ui.workout) keepAwake(true); });

setInterval(() => { const el = $('#elapsed'); if (el && st().active) el.textContent = clock((Date.now() - st().active.startedAt) / 1000); }, 1000);

/* ------------------------------------------------------------------ boot */

document.querySelectorAll('.tab').forEach((t) => {
  const names = { today: 'Today', plan: 'Plan', progress: 'Progress', settings: 'Settings' };
  t.innerHTML = `${icon(t.dataset.tab, 22)}<span>${names[t.dataset.tab]}</span>`;
});
applyTheme();
render();
if (!S().onboarded) welcomeSheet();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
