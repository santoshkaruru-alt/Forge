// Exercise animations: a posable figure drawn in SVG.
//
// Each motion is a few keyframes. A keyframe places the hips, tilts the torso
// and says where the feet and hands should be (in the 200 x 160 scene, floor at
// y = 150, figure facing right). Knees and elbows are solved with two-bone
// inverse kinematics, so feet stay planted and hands stay on the bar or floor
// while the body moves. Props (dumbbells, barbell, bench, cables, bands...)
// follow the hands or sit in the scene.

const L = { torso: 44, neck: 16, head: 9, ua: 25, fa: 23, th: 33, sh: 31, ft: 9 };
const FLOOR = 150;
const rad = (d) => (d * Math.PI) / 180;
const dir = (deg) => [Math.sin(rad(deg)), Math.cos(rad(deg))];
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = (v) => Math.hypot(v[0], v[1]);
const norm = (v) => { const l = len(v) || 1; return [v[0] / l, v[1] / l]; };
const lerp = (a, b, t) => a + (b - a) * t;
const lerp2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const ease = (t) => 0.5 - Math.cos(Math.PI * t) / 2;

/** Two-bone IK: joint and end for a limb from root toward target, bending toward hint. */
function ik(root, target, a, b, hint) {
  const v = sub(target, root);
  const dist = len(v);
  const d = Math.min(Math.max(dist, Math.abs(a - b) + 0.01), a + b - 0.01);
  const base = Math.atan2(v[1], v[0]);
  const off = Math.acos(Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d))));
  const j1 = [root[0] + a * Math.cos(base + off), root[1] + a * Math.sin(base + off)];
  const j2 = [root[0] + a * Math.cos(base - off), root[1] + a * Math.sin(base - off)];
  const mid = lerp2(root, target, 0.5);
  const score = (j) => (j[0] - mid[0]) * hint[0] + (j[1] - mid[1]) * hint[1];
  const joint = score(j1) >= score(j2) ? j1 : j2;
  const end = add(joint, norm(sub(target, joint)), b);
  return [joint, end];
}

/* ------------------------------------------------------------------ poses */

const SIDE = { hip: [100, 84], torso: 180, feet: [[103, 146], [97, 146]], hands: [{ s: [3, 46] }, { s: [-1, 46] }], knee: [[1, 0], [1, 0]], elbow: [[-0.3, 1], [-0.3, 1]], toe: [90, 90] };
const FRONT = { hip: [100, 84], torso: 180, feet: [[93, 146], [107, 146]], hands: [{ s: [-13, 46] }, { s: [13, 46] }], knee: [[-1, 0], [1, 0]], elbow: [[-1, 0.3], [1, 0.3]], toe: [-90, 90] };
const P = (o = {}) => ({ ...SIDE, ...o });
const F = (o = {}) => ({ ...FRONT, ...o });
const S = (x, y) => ({ s: [x, y] });
const both = (h) => [h, h];
const pair = (a, b) => [a, b];

/* Hand positions relative to the shoulder */
const HANG = [S(3, 46), S(-1, 46)];
const HIPS = [S(6, 40), S(-2, 40)]; // hands on hips
const CHEST = [S(14, 16), S(12, 16)]; // goblet hold
const RACK = [S(9, -1), S(7, -1)]; // weights at the shoulders
const OVER = [S(3, -47), S(1, -47)]; // locked out overhead
const FWD = [S(46, 6), S(44, 6)]; // arms straight out front

/* ------------------------------------------------------------------ props */
// Static: bench, box, bar, wall, door, poly, line. Dynamic: db, bb, kb, band, cable, towel, pad, grip, sled.
const bench = (x, y, w, h = FLOOR - y) => ({ t: 'bench', x, y, w, h });

/* ------------------------------------------------------------------ motions */

const T = {
  squat(v) {
    const hands = { goblet: CHEST, kb: CHEST, back: [S(-6, 0), S(-8, 0)], front: RACK, band: RACK, air: FWD, tempo: FWD }[v] || FWD;
    const elbow = v === 'back' ? both([-0.6, 1]) : v === 'front' || v === 'band' ? both([1, 0.7]) : SIDE.elbow;
    const props = { goblet: [{ t: 'db', at: 'hc' }], kb: [{ t: 'kb', at: 'hc' }], back: [{ t: 'bb', at: 's', off: [-5, 3], r: 9 }], front: [{ t: 'db', at: 'h1' }, { t: 'db', at: 'h2', far: 1 }], band: [{ t: 'band', from: 'a1', to: 'hc' }] }[v] || [];
    const feet = [[106, 146], [100, 146]];
    const slow = v === 'tempo' ? 2600 : 1200;
    return { props, frames: [[P({ feet, hands, elbow }), slow, 300], [P({ hip: [84, 116], torso: 148, feet, hands, elbow }), 900, 200]] };
  },
  sumo() {
    const feet = [[70, 146], [130, 146]];
    const elbow = [[-0.3, 1], [0.3, 1]];
    return {
      view: 'front', props: [{ t: 'db', at: 'hc' }],
      frames: [[F({ hip: [100, 90], feet, hands: [[97, 114], [103, 114]], elbow }), 1200, 250], [F({ hip: [100, 112], feet, hands: [[97, 136], [103, 136]], elbow }), 900, 200]],
    };
  },
  jumpsquat() {
    const feet = [[104, 146], [98, 146]];
    const stand = P({ feet, hands: HANG });
    const low = P({ hip: [86, 114], torso: 150, feet, hands: [S(-20, 40), S(-22, 40)] });
    const air = P({ hip: [100, 70], feet: [[104, 132], [98, 132]], toe: [20, 20], hands: [S(32, -26), S(30, -26)] });
    return { frames: [[stand, 500, 150], [low, 260, 0], [air, 300, 60], [low, 500, 100]] };
  },
  legpress() {
    const base = { hip: [70, 118], torso: 220, head: 210, hands: [[82, 124], [80, 124]], knee: both([0.3, -1]), toe: [150, 150] };
    return {
      props: [{ t: 'poly', pts: [[44, 124], [92, 124], [92, 132], [44, 132]] }, { t: 'line', pts: [[66, 126], [36, 88]], w: 8 }, { t: 'sled', at: 'a1', ang: 40 }],
      frames: [[P({ ...base, feet: [[122, 84], [118, 84]] }), 1200, 250], [P({ ...base, feet: [[100, 100], [96, 100]] }), 900, 150]],
    };
  },
  hinge(v) {
    const feet = [[104, 146], [98, 146]];
    const top = { rdl: HANG, dl: HANG, db: HANG, gm: [S(-6, 0), S(-8, 0)] }[v];
    const props = { rdl: [{ t: 'bb', at: 'hc' }], dl: [{ t: 'bb', at: 'hc' }], db: [{ t: 'db', at: 'h1' }, { t: 'db', at: 'h2', far: 1 }], gm: [{ t: 'band', from: 'a1', to: 's' }] }[v];
    const elbow = v === 'gm' ? both([-0.6, 1]) : SIDE.elbow;
    const low = v === 'dl' ? P({ hip: [88, 110], torso: 116, feet, hands: top, elbow }) : P({ hip: [86, 90], torso: v === 'gm' ? 100 : 107, feet, hands: top, elbow });
    return { props, frames: [[P({ feet, hands: top, elbow }), 1300, 250], [low, 1000, 200]] };
  },
  kbswing() {
    const feet = [[110, 146], [96, 146]];
    return {
      props: [{ t: 'kb', at: 'hc' }],
      frames: [[P({ hip: [86, 96], torso: 122, feet, hands: [S(-14, 44), S(-16, 44)] }), 420, 60], [P({ hip: [100, 84], torso: 184, feet, hands: [S(44, 6), S(42, 6)] }), 480, 120]],
    };
  },
  slrdl(v) {
    const props = v === 'db' ? [{ t: 'db', at: 'h1' }] : [];
    return {
      props,
      frames: [[P({ feet: [[102, 146], [94, 140]], toe: [90, 40], hands: HANG }), 1300, 250], [P({ hip: [94, 88], torso: 96, feet: [[102, 146], [34, 92]], toe: [90, 0], hands: [S(0, 46), S(0, 46)] }), 1000, 200]],
    };
  },
  revlunge(v) {
    const hands = v === 'bb' ? [S(-6, 0), S(-8, 0)] : v === 'bw' ? HIPS : HANG;
    const elbow = v === 'bb' ? both([-0.6, 1]) : v === 'bw' ? both([-1, 0]) : SIDE.elbow;
    const props = { db: [{ t: 'db', at: 'h1' }, { t: 'db', at: 'h2', far: 1 }], bb: [{ t: 'bb', at: 's', off: [-5, 3], r: 9 }] }[v] || [];
    const stand = P({ feet: [[102, 146], [98, 146]], hands, elbow });
    const b = P({ hip: [88, 112], torso: 176, feet: [[106, 146], [62, 140]], knee: [[1, 0], [0, 1]], toe: [90, 50], hands, elbow });
    const c = P({ hip: [88, 112], torso: 176, feet: [[62, 140], [106, 146]], knee: [[0, 1], [1, 0]], toe: [50, 90], hands, elbow });
    return { props, frames: [[stand, 1000, 150], [b, 900, 150], [stand, 1000, 150], [c, 900, 150]] };
  },
  bss(v) {
    const hands = v === 'db' ? HANG : HIPS;
    const elbow = v === 'db' ? SIDE.elbow : both([-1, 0]);
    const base = { feet: [[110, 146], [62, 110]], knee: [[1, 0], [0, 1]], toe: [90, -60], hands, elbow };
    return {
      props: [bench(30, 116, 44), ...(v === 'db' ? [{ t: 'db', at: 'h1' }, { t: 'db', at: 'h2', far: 1 }] : [])],
      frames: [[P({ ...base, hip: [96, 92], torso: 178 }), 1100, 250], [P({ ...base, hip: [92, 114], torso: 172 }), 900, 200]],
    };
  },
  stepup() {
    return {
      props: [bench(108, 114, 46), { t: 'db', at: 'h1' }, { t: 'db', at: 'h2', far: 1 }],
      frames: [[P({ hip: [92, 98], torso: 172, feet: [[124, 110], [90, 146]], hands: HANG }), 1000, 200], [P({ hip: [118, 66], torso: 180, feet: [[124, 110], [114, 96]], hands: HANG }), 900, 250]],
    };
  },
  latlunge(v) {
    const deep = v === 'cossack';
    const feet = deep ? [[58, 146], [142, 146]] : [[66, 146], [134, 146]];
    const hands = v === 'db' ? [S(-4, 18), S(4, 18)] : [S(-4, 20), S(4, 20)];
    const elbow = [[-1, 0.5], [1, 0.5]];
    const y = deep ? 124 : 114;
    const props = v === 'db' ? [{ t: 'db', at: 'hc' }] : [];
    return {
      view: 'front', props,
      frames: [
        [F({ hip: [100, 92], feet, hands, elbow }), 900, 150],
        [F({ hip: [78, y], torso: 188, feet, hands, elbow, knee: [[-1, 0], [1, 0]] }), 900, 150],
        [F({ hip: [100, 92], feet, hands, elbow }), 900, 150],
        [F({ hip: [122, y], torso: 172, feet, hands, elbow, knee: [[-1, 0], [1, 0]] }), 900, 150],
      ],
    };
  },
  legcurl() {
    const base = { hip: [96, 106], torso: 90, head: 96, hands: [[150, 114], [148, 114]], knee: both([0, 1]) };
    return {
      props: [bench(56, 112, 100), { t: 'pad', at: 'a1' }],
      frames: [[P({ ...base, feet: [[34, 108], [30, 108]], toe: [0, 0] }), 900, 200], [P({ ...base, feet: [[66, 74], [62, 74]], toe: [-90, -90] }), 1200, 150]],
    };
  },
  towelcurl() {
    const base = { torso: -75, head: -95, hands: [[100, 146], [98, 146]], knee: both([0, -1]), elbow: both([0, 1]), toe: [160, 160] };
    return {
      props: [{ t: 'towel', at: 'a1' }],
      frames: [[P({ ...base, hip: [98, 124], feet: [[150, 146], [146, 146]] }), 1100, 150], [P({ ...base, hip: [96, 116], feet: [[122, 146], [118, 146]] }), 1100, 150]],
    };
  },
  nordic() {
    const base = { feet: [[72, 146], [68, 146]], knee: both([0, 1]), toe: [-90, -90] };
    return {
      frames: [[P({ ...base, hip: [104, 113], torso: 180, hands: [[116, 86], [114, 86]], elbow: both([0, 1]) }), 2200, 150], [P({ ...base, hip: [129, 125], torso: 130, hands: [[178, 144], [176, 144]], elbow: both([-1, 0]) }), 900, 250]],
    };
  },
  bridge(v) {
    const far = v === 'sl' ? [114, 100] : [122, 146];
    const props = v === 'band' ? [{ t: 'ring', at: 'k1' }] : v === 'db' ? [{ t: 'db', at: 'hip', off: [0, -9] }] : [];
    const base = { head: -95, hands: [[100, 146], [98, 146]], elbow: both([0, 1]), knee: both([0, -1]) };
    return {
      props,
      frames: [[P({ ...base, hip: [100, 134], torso: -80, feet: [[126, 146], far] }), 700, 150], [P({ ...base, hip: [94, 116], torso: -55, feet: [[126, 146], far] }), 900, 300]],
    };
  },
  hipthrust(v) {
    const base = { feet: [[126, 146], [122, 146]], knee: both([0, -1]), hands: [[100, 108], [98, 108]], elbow: both([0, -1]) };
    return {
      props: [bench(20, 112, 48), v === 'db' ? { t: 'db', at: 'hip', off: [0, -9] } : { t: 'bb', at: 'hip', off: [0, -11] }],
      frames: [[P({ ...base, hip: [92, 136], torso: -125, head: -125 }), 800, 150], [P({ ...base, hip: [102, 100], torso: -80, head: -80 }), 1000, 350]],
    };
  },
  kickback() {
    const base = { hip: [100, 86], torso: 165, hands: [[134, 70], [132, 70]] };
    return {
      props: [{ t: 'cable', from: 'a2', to: [166, 140] }],
      frames: [[P({ ...base, feet: [[102, 146], [96, 146]] }), 800, 150], [P({ ...base, feet: [[102, 146], [50, 116]], toe: [90, 0] }), 900, 250]],
    };
  },
  legext() {
    const base = { hip: [86, 112], torso: 186, hands: [[88, 124], [86, 124]], elbow: both([0, 1]) };
    return {
      props: [{ t: 'poly', pts: [[66, 118], [116, 118], [116, 126], [66, 126]] }, { t: 'line', pts: [[70, 120], [74, 66]], w: 8 }, { t: 'pad', at: 'a1' }],
      frames: [[P({ ...base, feet: [[122, 143], [118, 143]] }), 900, 150], [P({ ...base, feet: [[148, 102], [144, 102]], toe: [160, 160] }), 1100, 300]],
    };
  },
  wallsit() {
    const base = { torso: 180, feet: [[108, 146], [104, 146]], hands: [[98, 108], [96, 108]], elbow: both([0, 1]) };
    return { props: [{ t: 'wall', x: 58 }], frames: [[P({ ...base, hip: [74, 112] }), 1600, 200], [P({ ...base, hip: [74, 115] }), 1600, 200]] };
  },
  calf(v) {
    const far = v === 'sl' ? [92, 130] : [97, 146];
    const props = v === 'db' ? [{ t: 'db', at: 'h1' }, { t: 'db', at: 'h2', far: 1 }] : [];
    return {
      props,
      frames: [[P({ feet: [[103, 146], far], hands: HANG }), 700, 150], [P({ hip: [100, 77], feet: [[103, 139], v === 'sl' ? [92, 124] : [97, 139]], toe: [40, 40], hands: HANG }), 900, 300]],
    };
  },
  benchpress(v) {
    const base = { hip: [118, 106], torso: -90, head: -90, feet: [[150, 146], [146, 146]], knee: both([0, -1]) };
    const props = [bench(40, 112, 100), ...(v === 'bb' ? [{ t: 'bb', at: 'hc' }] : [{ t: 'db', at: 'h1' }, { t: 'db', at: 'h2', far: 1 }])];
    if (v === 'fly') return { props, frames: [[P({ ...base, hands: [[78, 56], [76, 56]] }), 1300, 200], [P({ ...base, hands: [[36, 104], [112, 104]], elbow: both([0, 1]) }), 1100, 200]] };
    if (v === 'pullover') return { props: [bench(40, 112, 100), { t: 'db', at: 'hc' }], frames: [[P({ ...base, hands: [[78, 58], [76, 58]] }), 1400, 200], [P({ ...base, hands: [[30, 110], [28, 110]], elbow: both([0, -1]) }), 1100, 200]] };
    return { props, frames: [[P({ ...base, hands: [[78, 56], [76, 56]] }), 1200, 200], [P({ ...base, hands: [[80, 94], [78, 94]], elbow: both([0, 1]) }), 900, 150]] };
  },
  floorpress(v) {
    const base = { hip: [118, 140], torso: -90, head: -90, feet: [[140, 146], [136, 146]], knee: both([0, -1]), elbow: both([0, 1]) };
    if (v === 'pullover') {
      return { props: [{ t: 'db', at: 'hc' }], frames: [[P({ ...base, hands: [[78, 92], [76, 92]] }), 1400, 150], [P({ ...base, hands: [[26, 136], [24, 136]], elbow: both([0, -1]) }), 1100, 200]] };
    }
    if (v === 'skull') {
      return { props: [{ t: 'db', at: 'h1' }, { t: 'db', at: 'h2', far: 1 }], frames: [[P({ ...base, hands: [[78, 92], [76, 92]] }), 1200, 150], [P({ ...base, hands: [[58, 118], [56, 118]], elbow: both([0.3, -1]) }), 900, 150]] };
    }
    return { props: [{ t: 'db', at: 'h1' }, { t: 'db', at: 'h2', far: 1 }], frames: [[P({ ...base, hands: [[78, 92], [76, 92]] }), 1200, 150], [P({ ...base, hands: [[80, 124], [78, 124]] }), 900, 250]] };
  },
  incline() {
    const base = { hip: [112, 108], torso: 232, head: 232, feet: [[150, 146], [146, 146]], knee: both([0, -1]) };
    return {
      props: [{ t: 'line', pts: [[120, 116], [58, 68]], w: 8 }, { t: 'line', pts: [[118, 117], [146, 117]], w: 8 }, { t: 'line', pts: [[124, 118], [124, 150]], w: 5 }, { t: 'db', at: 'h1' }, { t: 'db', at: 'h2', far: 1 }],
      frames: [[P({ ...base, hands: [[82, 32], [80, 32]] }), 1200, 200], [P({ ...base, hands: [[86, 72], [84, 72]] }), 900, 150]],
    };
  },
  chestpress() {
    const base = { hip: [80, 112], torso: 182, feet: [[118, 146], [114, 146]] };
    return {
      props: [{ t: 'poly', pts: [[60, 118], [104, 118], [104, 126], [60, 126]] }, { t: 'line', pts: [[66, 120], [68, 56]], w: 8 }, { t: 'grip', at: 'hc', vertical: 1 }],
      frames: [[P({ ...base, hands: [[100, 72], [98, 72]], elbow: both([-1, 0.2]) }), 1100, 150], [P({ ...base, hands: [[124, 70], [122, 70]] }), 900, 250]],
    };
  },
  pushup(v) {
    const decline = v === 'decline';
    const feet = decline ? [[12, 104], [10, 104]] : [[14, 138], [12, 138]];
    const hands = [[122, 146], [120, 146]];
    const up = decline ? P({ hip: [80, 100], torso: 93, feet, hands, toe: [10, 10] }) : P({ hip: [78, 112], torso: 112, feet, hands, toe: [10, 10] });
    const down = decline ? P({ hip: [80, 110], torso: 77, feet, hands, toe: [10, 10], elbow: both([-1, -0.2]) }) : P({ hip: [80, 126], torso: 95, feet, hands, toe: [10, 10], elbow: both([-1, -0.2]) });
    return { props: decline ? [bench(8, 112, 40)] : [], frames: [[up, 1000, 150], [down, 800, 150]] };
  },
  bandpress() {
    return {
      props: [{ t: 'band', from: 'hc', to: 's', off: [-12, 6] }],
      frames: [[P({ hands: [S(16, 20), S(14, 20)], elbow: both([-1, 0.2]) }), 800, 150], [P({ hands: [S(46, 18), S(44, 18)] }), 900, 250]],
    };
  },
  cablefly() {
    return {
      view: 'front',
      props: [{ t: 'cable', from: 'h1', to: [12, 22] }, { t: 'cable', from: 'h2', to: [188, 22] }],
      frames: [[F({ feet: [[92, 146], [108, 146]], hands: [[46, 50], [154, 50]], elbow: [[0, 1], [0, 1]] }), 1100, 150], [F({ feet: [[92, 146], [108, 146]], hands: [[96, 74], [104, 74]], elbow: [[-1, 0.4], [1, 0.4]] }), 1000, 250]],
    };
  },
  press(v) {
    const seated = v === 'seated' || v === 'machine';
    const base = seated ? { hip: [98, 106], torso: 180, feet: [[134, 146], [130, 146]] } : { feet: [[104, 146], [98, 146]] };
    const props = { bb: [{ t: 'bb', at: 'hc' }], band: [{ t: 'band', from: 'a1', to: 'hc' }], machine: [{ t: 'grip', at: 'hc', vertical: 1 }] }[v] || [{ t: 'db', at: 'h1' }, { t: 'db', at: 'h2', far: 1 }];
    if (seated) props.unshift(v === 'machine' ? { t: 'line', pts: [[88, 112], [86, 48]], w: 8 } : bench(72, 110, 52));
    if (v === 'machine') props.unshift({ t: 'poly', pts: [[78, 110], [124, 110], [124, 118], [78, 118]] });
    return { props, frames: [[P({ ...base, hands: RACK, elbow: both([0.3, 1]) }), 900, 200], [P({ ...base, hands: OVER }), 1100, 150]] };
  },
  pike() {
    const base = { hands: [[130, 146], [128, 146]], feet: [[74, 146], [72, 146]], toe: [20, 20] };
    return { frames: [[P({ ...base, hip: [92, 84], torso: 69, head: 60 }), 1100, 150], [P({ ...base, hip: [98, 94], torso: 48, head: 40, elbow: both([-1, 0]) }), 900, 150]] };
  },
  row(v) {
    const feet = [[104, 146], [98, 146]];
    const props = { bb: [{ t: 'bb', at: 'hc' }], db: [{ t: 'db', at: 'h1' }, { t: 'db', at: 'h2', far: 1 }] }[v];
    return { props, frames: [[P({ hip: [88, 98], torso: 115, feet, hands: [S(2, 46), S(0, 46)] }), 1000, 150], [P({ hip: [88, 98], torso: 115, feet, hands: [S(-10, 24), S(-12, 24)], elbow: both([-0.6, -1]) }), 800, 250]] };
  },
  onearmrow() {
    const base = { hip: [86, 96], torso: 110, feet: [[100, 146], [70, 146]] };
    return {
      props: [bench(118, 100, 56), { t: 'db', at: 'h1' }],
      frames: [[P({ ...base, hands: [S(0, 46), [146, 100]], elbow: [[-0.3, 1], [0, 1]] }), 1000, 150], [P({ ...base, hands: [S(-12, 20), [146, 100]], elbow: [[-0.5, -1], [0, 1]] }), 800, 250]],
    };
  },
  csrow() {
    const base = { hip: [92, 100], torso: 130, feet: [[72, 146], [70, 146]], toe: [20, 20] };
    return {
      props: [{ t: 'line', pts: [[98, 112], [142, 78]], w: 8 }, { t: 'line', pts: [[116, 100], [116, 150]], w: 5 }, { t: 'db', at: 'h1' }, { t: 'db', at: 'h2', far: 1 }],
      frames: [[P({ ...base, hands: [S(0, 46), S(-2, 46)] }), 1000, 150], [P({ ...base, hands: [S(-12, 22), S(-14, 22)], elbow: both([-0.6, -1]) }), 800, 250]],
    };
  },
  cablerow() {
    const base = { hip: [64, 126], feet: [[124, 124], [120, 124]], toe: [150, 150] };
    return {
      props: [{ t: 'poly', pts: [[40, 132], [90, 132], [90, 140], [40, 140]] }, { t: 'line', pts: [[130, 108], [130, 140]], w: 5 }, { t: 'cable', from: 'hc', to: [186, 104] }, { t: 'grip', at: 'hc', vertical: 1 }],
      frames: [[P({ ...base, torso: 162, hands: [[118, 100], [116, 100]] }), 1000, 150], [P({ ...base, torso: 192, hands: [[86, 102], [84, 102]], elbow: both([-1, 0]) }), 800, 250]],
    };
  },
  renegade() {
    const base = { hip: [78, 112], torso: 112, feet: [[14, 138], [6, 138]], toe: [10, 10] };
    return {
      props: [{ t: 'db', at: 'h1' }, { t: 'db', at: 'h2', far: 1 }],
      frames: [[P({ ...base, hands: [[122, 142], [120, 142]] }), 800, 150], [P({ ...base, hands: [[110, 114], [120, 142]], elbow: [[-0.5, -1], [-0.3, 1]] }), 700, 200]],
    };
  },
  bandrow() {
    const feet = [[108, 146], [92, 146]];
    return {
      props: [{ t: 'band', from: 'hc', to: [184, 72] }, { t: 'line', pts: [[188, 20], [188, 150]], w: 6 }],
      frames: [[P({ feet, hands: [S(44, 10), S(42, 10)] }), 900, 150], [P({ feet, hands: [S(10, 26), S(8, 26)], elbow: both([-1, 0]) }), 700, 250]],
    };
  },
  invrow() {
    const base = { feet: [[14, 144], [12, 144]], toe: [160, 160], hands: [[118, 80], [116, 80]] };
    return {
      props: [{ t: 'bar', x: 118, y: 80, w: 50, posts: 1 }],
      frames: [[P({ ...base, hip: [77, 133], torso: 100 }), 1000, 150], [P({ ...base, hip: [72, 117], torso: 115, elbow: both([-1, 0.2]) }), 800, 250]],
    };
  },
  towelrow() {
    const feet = [[124, 146], [120, 146]];
    return {
      props: [{ t: 'door', x: 166 }, { t: 'towel', from: 'hc', to: [166, 78] }],
      frames: [[P({ hip: [92, 104], torso: 200, feet, hands: [[128, 76], [126, 76]] }), 1000, 150], [P({ hip: [104, 100], torso: 188, feet, hands: [[126, 72], [124, 72]], elbow: both([-1, 0]) }), 800, 250]],
    };
  },
  pullup(v) {
    const hands = [[102, 8], [98, 8]];
    return {
      noFloor: true,
      props: [{ t: 'bar', x: 100, y: 8, w: 70 }],
      frames: [[P({ hip: [100, 104], feet: [[100, 160], [98, 160]], toe: [20, 20], hands }), 1100, 200], [P({ hip: [100, 68], feet: [[100, 126], [98, 126]], toe: [20, 20], hands, elbow: both(v === 'chin' ? [0.5, 1] : [0, 1]) }), 900, 300]],
    };
  },
  pulldown(v) {
    const seated = v !== 'band';
    const base = seated ? { hip: [100, 112], torso: 176, feet: [[134, 146], [130, 146]] } : { feet: [[106, 146], [96, 146]] };
    const hy = seated ? 22 : -2;
    return {
      props: [...(seated ? [{ t: 'poly', pts: [[80, 118], [120, 118], [120, 126], [80, 126]] }] : []), v === 'band' ? { t: 'band', from: 'hc', to: [104, 0] } : { t: 'cable', from: 'hc', to: [104, 0] }, ...(seated ? [{ t: 'grip', at: 'hc' }] : [])],
      frames: [[P({ ...base, hands: [[104, hy], [100, hy]] }), 1000, 150], [P({ ...base, hands: [[110, hy + 32], [106, hy + 32]], elbow: both([0, 1]) }), 800, 250]],
    };
  },
  pronepull() {
    const base = { hip: [70, 140], torso: 90, head: 86, feet: [[2, 146], [0, 146]], knee: both([0, 1]), toe: [0, 0] };
    return { frames: [[P({ ...base, hands: [[160, 138], [158, 138]] }), 900, 150], [P({ ...base, hands: [[122, 130], [120, 130]], elbow: both([-1, 0.4]) }), 900, 300]] };
  },
  latraise(v) {
    const cable = v === 'cable';
    const hands0 = cable ? [[86, 88], [118, 84]] : [[86, 88], [114, 88]];
    const hands1 = cable ? [[44, 46], [118, 84]] : [[44, 46], [156, 46]];
    const elbow = [[0, 1], [0, 1]];
    const props = cable ? [{ t: 'cable', from: 'h1', to: [150, 146] }] : [{ t: 'db', at: 'h1' }, { t: 'db', at: 'h2' }];
    return { view: 'front', props, frames: [[F({ hands: hands0, elbow }), 1000, 150], [F({ hands: hands1, elbow }), 1000, 250]] };
  },
  reardelt() {
    const base = { hip: [88, 92], torso: 105, feet: [[104, 146], [98, 146]] };
    return {
      props: [{ t: 'db', at: 'h1' }, { t: 'db', at: 'h2', far: 1 }],
      frames: [[P({ ...base, hands: [S(2, 44), S(0, 44)] }), 1000, 150], [P({ ...base, hands: [S(-34, 14), S(-36, 14)], elbow: both([0, 1]) }), 900, 250]],
    };
  },
  uprow() {
    const feet = [[104, 146], [98, 146]];
    return { props: [{ t: 'db', at: 'h1' }, { t: 'db', at: 'h2', far: 1 }], frames: [[P({ feet, hands: [S(6, 44), S(4, 44)] }), 900, 150], [P({ feet, hands: [S(10, 8), S(8, 8)], elbow: both([-0.2, -1]) }), 900, 250]] };
  },
  frontraise() {
    const feet = [[104, 146], [98, 146]];
    return { props: [{ t: 'db', at: 'h1' }, { t: 'db', at: 'h2', far: 1 }], frames: [[P({ feet, hands: [S(6, 46), S(4, 46)] }), 1000, 150], [P({ feet, hands: [S(47, 0), S(45, 0)], elbow: both([0, 1]) }), 1000, 250]] };
  },
  crunch() {
    const base = { hip: [100, 140], feet: [[126, 146], [122, 146]], knee: both([0, -1]), hands: [S(10, -8), S(8, -8)], elbow: both([1, 1]) };
    return { props: [{ t: 'db', at: 'hc' }], frames: [[P({ ...base, torso: -88, head: -92 }), 900, 150], [P({ ...base, torso: -125, head: -135 }), 800, 250]] };
  },
  facepull() {
    const feet = [[110, 146], [92, 146]];
    return {
      props: [{ t: 'cable', from: 'hc', to: [180, 34] }],
      frames: [[P({ feet, hands: [S(44, 4), S(42, 4)] }), 900, 150], [P({ feet, hands: [S(12, -10), S(10, -10)], elbow: both([-0.4, -1]) }), 800, 250]],
    };
  },
  pullapart() {
    return {
      view: 'front', props: [{ t: 'band', from: 'h1', to: 'h2' }],
      frames: [[F({ hands: [[86, 62], [114, 62]], elbow: [[-1, 1], [1, 1]] }), 900, 150], [F({ hands: [[46, 44], [154, 44]] }), 800, 250]],
    };
  },
  ytw() {
    const base = { hip: [70, 140], feet: [[2, 146], [0, 146]], knee: both([0, 1]), toe: [0, 0] };
    return { frames: [[P({ ...base, torso: 90, head: 86, hands: [[156, 140], [154, 140]] }), 900, 150], [P({ ...base, torso: 84, head: 78, hands: [[150, 116], [148, 116]] }), 900, 400]] };
  },
  curl(v) {
    const feet = v === 'towel' ? [[116, 146], [98, 146]] : SIDE.feet;
    const props = { db: [{ t: 'db', at: 'h1' }, { t: 'db', at: 'h2', far: 1 }], bb: [{ t: 'bb', at: 'hc' }], cable: [{ t: 'cable', from: 'hc', to: [150, 146] }], band: [{ t: 'band', from: 'a1', to: 'hc' }], towel: [{ t: 'towel', from: 'hc', to: 'a1' }] }[v];
    const elbow = both([-0.15, 1]);
    if (v === 'towel') return { props, frames: [[P({ feet, hands: [S(16, 30), S(14, 30)], elbow }), 1500, 300], [P({ feet, hands: [S(16, 27), S(14, 27)], elbow }), 1500, 300]] };
    return { props, frames: [[P({ feet, hands: [S(6, 46), S(2, 46)], elbow }), 900, 150], [P({ feet, hands: [S(16, 6), S(12, 6)], elbow }), 1100, 200]] };
  },
  ohext() {
    return {
      props: [{ t: 'db', at: 'hc' }],
      frames: [[P({ feet: [[104, 146], [98, 146]], hands: [S(4, -48), S(2, -48)], elbow: both([0.3, -1]) }), 1100, 150], [P({ feet: [[104, 146], [98, 146]], hands: [S(-12, -14), S(-14, -14)], elbow: both([0.3, -1]) }), 900, 200]],
    };
  },
  kickbacktri() {
    const base = { hip: [88, 94], torso: 110, feet: [[104, 146], [96, 146]] };
    return {
      props: [{ t: 'db', at: 'h1' }],
      frames: [[P({ ...base, hands: [S(-6, 22), S(2, 40)], elbow: [[-1, -0.6], [-0.3, 1]] }), 800, 150], [P({ ...base, hands: [S(-46, -8), S(2, 40)], elbow: [[-1, -0.6], [-0.3, 1]] }), 700, 300]],
    };
  },
  pushdown(v) {
    const feet = [[106, 146], [96, 146]];
    return {
      props: [v === 'band' ? { t: 'band', from: 'hc', to: [140, 4] } : { t: 'cable', from: 'hc', to: [140, 4] }],
      frames: [[P({ feet, hands: [S(18, 18), S(16, 18)], elbow: both([0, 1]) }), 800, 150], [P({ feet, hands: [S(12, 44), S(10, 44)] }), 800, 250]],
    };
  },
  dip() {
    const hands = [[90, 106], [88, 106]];
    return {
      props: [bench(50, 106, 42)],
      frames: [[P({ hip: [96, 108], torso: 180, hands, feet: [[146, 146], [144, 146]], toe: [160, 160], knee: both([0, -1]) }), 1000, 150], [P({ hip: [98, 130], torso: 180, hands, feet: [[146, 146], [144, 146]], toe: [160, 160], knee: both([0, -1]), elbow: both([-1, 0]) }), 800, 200]],
    };
  },
  plank() {
    const base = { torso: 95, hands: [[142, 146], [140, 146]], elbow: both([0, 1]), feet: [[8, 140], [6, 140]], toe: [10, 10] };
    return { frames: [[P({ ...base, hip: [76, 126] }), 1500, 200], [P({ ...base, hip: [76, 123] }), 1500, 200]] };
  },
  sideplank() {
    const base = { feet: [[30, 140], [26, 146]], knee: both([0, 1]), elbow: [[0, -1], [0, 1]], toe: [-80, -80] };
    return {
      view: 'front',
      frames: [[F({ ...base, hip: [100, 134], torso: 106, hands: [[144, 60], [162, 146]] }), 1200, 150], [F({ ...base, hip: [100, 124], torso: 110, hands: [[142, 54], [162, 146]] }), 1200, 400]],
    };
  },
  deadbug() {
    const base = { hip: [102, 140], torso: -90, head: -96, knee: both([0, -1]), elbow: both([1, 0]) };
    const up = [[60, 92], [58, 92]];
    const legsIn = [[126, 112], [124, 112]];
    return {
      frames: [
        [P({ ...base, hands: up, feet: legsIn }), 900, 150],
        [P({ ...base, hands: [[14, 136], [58, 92]], feet: [[126, 112], [164, 138]], knee: [[0, -1], [0, -1]] }), 900, 150],
        [P({ ...base, hands: up, feet: legsIn }), 900, 150],
        [P({ ...base, hands: [[60, 92], [14, 136]], feet: [[164, 138], [124, 112]] }), 900, 150],
      ],
    };
  },
  hollow() {
    const base = { hip: [100, 140], head: -110 };
    return { frames: [[P({ ...base, torso: -108, hands: [[14, 112], [12, 112]], feet: [[160, 124], [158, 124]], toe: [150, 150] }), 1400, 150], [P({ ...base, torso: -104, hands: [[14, 116], [12, 116]], feet: [[160, 128], [158, 128]], toe: [150, 150] }), 1400, 150]] };
  },
  bicycle() {
    const base = { hip: [100, 140], torso: -118, head: -122, hands: [S(-12, -10), S(-14, -10)], elbow: both([0.5, -1]), knee: both([0, -1]), toe: [150, 150] };
    return { frames: [[P({ ...base, feet: [[118, 104], [160, 128]] }), 600, 100], [P({ ...base, feet: [[160, 128], [118, 104]] }), 600, 100]] };
  },
  vup() {
    return {
      frames: [
        [P({ hip: [100, 140], torso: -90, head: -90, hands: [[12, 138], [10, 138]], feet: [[162, 144], [160, 144]], toe: [180, 180] }), 700, 200],
        [P({ hip: [100, 140], torso: -140, head: -150, hands: [[124, 64], [122, 64]], feet: [[136, 84], [134, 84]], toe: [150, 150] }), 800, 250],
      ],
    };
  },
  flutter() {
    const base = { hip: [100, 140], torso: -100, head: -105, hands: [[96, 146], [94, 146]], elbow: both([0, 1]), toe: [150, 150] };
    return { frames: [[P({ ...base, feet: [[162, 122], [162, 136]] }), 320, 0], [P({ ...base, feet: [[162, 136], [162, 122]] }), 320, 0]] };
  },
  climber() {
    const base = { hip: [80, 104], torso: 102, hands: [[122, 146], [120, 146]], toe: [10, 10], knee: both([1, 1]) };
    return { frames: [[P({ ...base, feet: [[30, 138], [98, 130]] }), 260, 30], [P({ ...base, feet: [[98, 130], [30, 138]] }), 260, 30]] };
  },
  twist() {
    const base = { hip: [100, 140], torso: 212, head: 200, feet: [[146, 122], [142, 122]], knee: both([0, -1]), toe: [150, 150] };
    return { props: [{ t: 'db', at: 'hc' }], frames: [[P({ ...base, hands: [[114, 120], [112, 120]] }), 700, 120], [P({ ...base, hands: [[92, 134], [90, 134]] }), 700, 120]] };
  },
  hangknee() {
    const hands = [[102, 6], [98, 6]];
    return {
      noFloor: true,
      props: [{ t: 'bar', x: 100, y: 6, w: 70 }],
      frames: [[P({ hip: [100, 98], feet: [[100, 156], [98, 156]], toe: [20, 20], hands }), 1000, 150], [P({ hip: [98, 96], torso: 186, feet: [[126, 98], [124, 98]], knee: both([1, -0.3]), toe: [60, 60], hands }), 800, 250]],
    };
  },
  woodchop(v) {
    const feet = [[76, 146], [124, 146]];
    return {
      view: 'front', props: [v === 'db' ? { t: 'db', at: 'hc' } : { t: 'cable', from: 'hc', to: [192, 14] }],
      frames: [[F({ hip: [100, 86], torso: 172, feet, hands: [[146, 36], [142, 40]], elbow: [[0, 1], [0, 1]] }), 900, 150], [F({ hip: [96, 96], torso: 194, feet, hands: [[60, 122], [64, 124]], elbow: [[0, 1], [0, 1]] }), 800, 250]],
    };
  },
  pallof() {
    const feet = [[108, 146], [92, 146]];
    return {
      props: [{ t: 'band', from: 'hc', to: [12, 64] }, { t: 'line', pts: [[8, 20], [8, 150]], w: 6 }],
      frames: [[P({ feet, hands: [S(16, 22), S(14, 22)], elbow: both([-1, 0.4]) }), 900, 150], [P({ feet, hands: [S(46, 22), S(44, 22)] }), 900, 500]],
    };
  },
  birddog() {
    const base = { hip: [80, 100], torso: 92, knee: both([0, 1]), toe: [-90, -90] };
    const hands = [[124, 146], [122, 146]];
    const feet = [[46, 146], [44, 146]];
    return {
      frames: [
        [P({ ...base, hands, feet }), 900, 150],
        [P({ ...base, hands: [[170, 94], [122, 146]], feet: [[46, 146], [18, 100]], knee: [[0, 1], [0, -1]] }), 900, 350],
        [P({ ...base, hands, feet }), 900, 150],
        [P({ ...base, hands: [[124, 146], [168, 94]], feet: [[18, 100], [44, 146]], knee: [[0, -1], [0, 1]] }), 900, 350],
      ],
    };
  },
  thruster(v) {
    const feet = [[106, 146], [100, 146]];
    const props = v === 'kb' ? [{ t: 'kb', at: 'h1' }] : [{ t: 'db', at: 'h1' }, { t: 'db', at: 'h2', far: 1 }];
    const rack = P({ feet, hands: RACK, elbow: both([1, 0.7]) });
    const low = P({ hip: [84, 116], torso: 148, feet, hands: RACK, elbow: both([1, 0.7]) });
    const top = P({ feet, hands: OVER });
    if (v === 'squatpress') return { props, frames: [[rack, 1000, 100], [low, 900, 100], [rack, 900, 100], [top, 900, 200]] };
    return { props, frames: [[low, 600, 50], [top, 700, 150]] };
  },
  snatch() {
    const feet = [[108, 146], [96, 146]];
    return {
      props: [{ t: 'db', at: 'h1' }],
      frames: [[P({ hip: [86, 108], torso: 125, feet, hands: [S(0, 46), S(-2, 40)] }), 500, 100], [P({ feet, hands: [S(3, -47), S(-4, 44)] }), 700, 300]],
    };
  },
  cleanpress() {
    const feet = [[106, 146], [98, 146]];
    return {
      props: [{ t: 'kb', at: 'h1' }],
      frames: [[P({ feet, hands: [S(3, 46), S(-1, 46)] }), 500, 150], [P({ feet, hands: [S(10, 0), S(-1, 46)], elbow: [[0.3, 1], [-0.3, 1]] }), 800, 200], [P({ feet, hands: [S(3, -47), S(-1, 46)] }), 900, 300]],
    };
  },
  burpee(v) {
    const stand = P({ feet: [[104, 146], [98, 146]], hands: HANG });
    const squat = P({ hip: [94, 118], torso: 140, feet: [[104, 146], [98, 146]], hands: [[128, 146], [126, 146]] });
    const plank = P({ hip: [78, 112], torso: 112, feet: [[14, 138], [12, 138]], hands: [[122, 146], [120, 146]], toe: [10, 10] });
    const jump = P({ hip: [100, 72], feet: [[104, 134], [98, 134]], toe: [20, 20], hands: [S(30, -28), S(28, -28)] });
    if (v === 'thrust') return { frames: [[stand, 450, 100], [squat, 300, 50], [plank, 350, 100], [squat, 350, 50]] };
    if (v === 'manmaker') {
      const db = [{ t: 'db', at: 'h1' }, { t: 'db', at: 'h2', far: 1 }];
      const row = P({ hip: [78, 112], torso: 112, feet: [[14, 138], [6, 138]], hands: [[110, 114], [120, 146]], toe: [10, 10], elbow: [[-0.5, -1], [-0.3, 1]] });
      const rack = P({ feet: [[104, 146], [98, 146]], hands: RACK, elbow: both([1, 0.7]) });
      return { props: db, frames: [[plank, 500, 100], [row, 500, 100], [plank, 400, 0], [squat, 500, 100], [rack, 600, 100], [P({ feet: [[104, 146], [98, 146]], hands: OVER }), 700, 200], [rack, 600, 100]] };
    }
    return { frames: [[stand, 400, 100], [squat, 300, 50], [plank, 300, 100], [squat, 300, 50], [jump, 350, 80]] };
  },

  /* warm-ups and bodyweight cardio */
  jacks() {
    return { view: 'front', frames: [[F({ feet: [[94, 146], [106, 146]] }), 280, 40], [F({ hip: [100, 88], feet: [[72, 146], [128, 146]], hands: [S(-30, -40), S(30, -40)] }), 280, 40]] };
  },
  squatjack() {
    return { view: 'front', frames: [[F({ feet: [[94, 146], [106, 146]], hands: [S(-4, 20), S(4, 20)], elbow: [[-1, 0.5], [1, 0.5]] }), 320, 40], [F({ hip: [100, 110], feet: [[68, 146], [132, 146]], hands: [S(-4, 20), S(4, 20)], elbow: [[-1, 0.5], [1, 0.5]] }), 320, 60]] };
  },
  highknees() {
    const base = { hip: [100, 82] };
    return {
      frames: [
        [P({ ...base, feet: [[114, 108], [98, 144]], toe: [60, 40], hands: [S(-14, 30), S(18, 14)], elbow: [[-1, 0.5], [-0.2, 1]] }), 220, 20],
        [P({ ...base, feet: [[102, 144], [112, 108]], toe: [40, 60], hands: [S(18, 14), S(-14, 30)], elbow: [[-0.2, 1], [-1, 0.5]] }), 220, 20],
      ],
    };
  },
  skater() {
    return {
      view: 'front',
      frames: [
        [F({ hip: [74, 100], torso: 190, feet: [[72, 146], [94, 134]], knee: [[-1, 0], [1, 0]], hands: [S(30, 30), S(30, 40)] }), 380, 60],
        [F({ hip: [126, 100], torso: 170, feet: [[106, 134], [128, 146]], knee: [[-1, 0], [1, 0]], hands: [S(-30, 40), S(-30, 30)] }), 380, 60],
      ],
    };
  },
  tuck() {
    const stand = P({ feet: [[104, 146], [98, 146]], hands: HANG });
    const low = P({ hip: [90, 108], torso: 160, feet: [[104, 146], [98, 146]], hands: [S(-16, 40), S(-18, 40)] });
    const air = P({ hip: [100, 70], feet: [[112, 108], [108, 108]], knee: both([1, -1]), toe: [40, 40], hands: [S(24, 30), S(22, 30)] });
    return { frames: [[stand, 300, 50], [low, 220, 0], [air, 300, 40], [low, 300, 50]] };
  },
  fastfeet() {
    const base = { hip: [96, 92], torso: 170, hands: [S(16, 26), S(12, 26)], elbow: both([-0.5, 1]), toe: [60, 60] };
    return { frames: [[P({ ...base, feet: [[106, 140], [94, 146]] }), 120, 0], [P({ ...base, feet: [[106, 146], [94, 140]] }), 120, 0]] };
  },
  shuffle() {
    const f = (x) => F({ hip: [x, 100], feet: [[x - 26, 146], [x + 26, 146]], hands: [S(-6, 22), S(6, 22)], elbow: [[-1, 0.5], [1, 0.5]] });
    return { view: 'front', frames: [[f(78), 400, 80], [f(122), 400, 80]] };
  },
  inchworm() {
    const stand = P({ feet: [[90, 146], [86, 146]], hands: HANG });
    const fold = P({ hip: [84, 82], torso: 40, head: 30, feet: [[90, 146], [86, 146]], hands: [[118, 146], [116, 146]] });
    const walk = P({ hip: [80, 98], torso: 80, feet: [[60, 140], [58, 140]], hands: [[126, 146], [124, 146]], toe: [10, 10] });
    const plank = P({ hip: [78, 112], torso: 112, feet: [[14, 138], [12, 138]], hands: [[122, 146], [120, 146]], toe: [10, 10] });
    return { frames: [[stand, 900, 100], [fold, 700, 100], [walk, 700, 100], [plank, 700, 300], [walk, 700, 100], [fold, 900, 100]] };
  },
  armcircles() {
    return {
      view: 'front',
      frames: [
        [F({ hands: [[48, 30], [152, 30]] }), 260, 0],
        [F({ hands: [[44, 42], [156, 42]] }), 260, 0],
        [F({ hands: [[48, 54], [152, 54]] }), 260, 0],
        [F({ hands: [[52, 42], [148, 42]] }), 260, 0],
      ],
    };
  },
  scappush() {
    const base = { torso: 112, feet: [[14, 138], [12, 138]], hands: [[122, 146], [120, 146]], toe: [10, 10] };
    return { frames: [[P({ ...base, hip: [78, 112] }), 600, 100], [P({ ...base, hip: [78, 115], torso: 110 }), 600, 100]] };
  },
};

/* ------------------------------------------------------------------ mapping */

const EX = {
  'back-squat': ['squat', 'back'], 'leg-press': ['legpress'], 'goblet-squat': ['squat', 'goblet'], 'db-front-squat': ['squat', 'front'],
  'kb-goblet-squat': ['squat', 'kb'], 'tempo-squat': ['squat', 'tempo'], 'band-squat': ['squat', 'band'], 'jump-squat': ['jumpsquat'],
  rdl: ['hinge', 'rdl'], deadlift: ['hinge', 'dl'], 'db-rdl': ['hinge', 'db'], 'kb-swing': ['kbswing'], 'sl-rdl-bw': ['slrdl', 'bw'],
  'band-good-morning': ['hinge', 'gm'], 'db-reverse-lunge': ['revlunge', 'db'], 'db-bss': ['bss', 'db'], 'bss-bw': ['bss', 'bw'],
  'db-step-up': ['stepup'], 'bb-reverse-lunge': ['revlunge', 'bb'], 'walking-lunge': ['revlunge', 'bw'], 'lateral-lunge': ['latlunge'],
  'db-lateral-lunge': ['latlunge', 'db'], 'leg-curl': ['legcurl'], 'towel-curl': ['towelcurl'], 'db-sl-rdl': ['slrdl', 'db'],
  'nordic-neg': ['nordic'], 'bb-hip-thrust': ['hipthrust', 'bb'], 'db-hip-thrust': ['hipthrust', 'db'], 'cable-kickback': ['kickback'],
  'sl-bridge': ['bridge', 'sl'], 'band-bridge': ['bridge', 'band'], 'frog-pump': ['bridge'], 'leg-extension': ['legext'],
  'wall-sit': ['wallsit'], cossack: ['latlunge', 'cossack'], 'db-calf-raise': ['calf', 'db'], 'sl-calf-raise': ['calf', 'sl'],
  'bench-press': ['benchpress', 'bb'], 'db-bench': ['benchpress', 'db'], 'incline-db': ['incline'], 'db-floor-press': ['floorpress'],
  'chest-press': ['chestpress'], 'push-up': ['pushup'], 'decline-push-up': ['pushup', 'decline'], 'band-chest-press': ['bandpress'],
  'db-fly': ['benchpress', 'fly'], 'cable-fly': ['cablefly'], ohp: ['press', 'bb'], 'seated-db-press': ['press', 'seated'],
  'standing-db-press': ['press', 'db'], 'arnold-press': ['press', 'db'], 'machine-shoulder': ['press', 'machine'], 'pike-push-up': ['pike'],
  'band-ohp': ['press', 'band'], 'bb-row': ['row', 'bb'], 'db-row': ['onearmrow'], 'chest-supported-row': ['csrow'], 'cable-row': ['cablerow'],
  'renegade-row': ['renegade'], 'band-row': ['bandrow'], 'inverted-row': ['invrow'], 'towel-row': ['towelrow'], 'pull-up': ['pullup'],
  'chin-up': ['pullup', 'chin'], 'lat-pulldown': ['pulldown'], 'db-pullover': ['benchpress', 'pullover'], 'band-pulldown': ['pulldown', 'band'],
  'prone-pulldown': ['pronepull'], 'lateral-raise': ['latraise'], 'rear-delt-fly': ['reardelt'], 'cable-lateral': ['latraise', 'cable'],
  'face-pull': ['facepull'], 'band-pull-apart': ['pullapart'], ytw: ['ytw'], 'db-curl': ['curl', 'db'], 'hammer-curl': ['curl', 'db'],
  'bb-curl': ['curl', 'bb'], 'cable-curl': ['curl', 'cable'], 'band-curl': ['curl', 'band'], 'towel-curl-iso': ['curl', 'towel'],
  'oh-tri-ext': ['ohext'], 'skull-crusher': ['floorpress', 'skull'], 'db-kickback': ['kickbacktri'], pushdown: ['pushdown'],
  'bench-dip': ['dip'], 'diamond-push-up': ['pushup'], 'band-pushdown': ['pushdown', 'band'], plank: ['plank'], 'side-plank': ['sideplank'],
  'dead-bug': ['deadbug'], 'hollow-hold': ['hollow'], bicycle: ['bicycle'], 'v-up': ['vup'], flutter: ['flutter'],
  'mountain-climber': ['climber'], 'russian-twist': ['twist'], 'hanging-knee': ['hangknee'], woodchop: ['woodchop'], pallof: ['pallof'],
  'bird-dog': ['birddog'], 'db-sumo-squat': ['sumo'], 'db-glute-bridge': ['bridge', 'db'], 'db-floor-pullover': ['floorpress', 'pullover'],
  'db-front-raise': ['frontraise'], 'db-upright-row': ['uprow'], 'db-woodchop': ['woodchop', 'db'], 'db-crunch': ['crunch'], 'db-thruster': ['thruster'], 'db-snatch': ['snatch'], 'man-maker': ['burpee', 'manmaker'],
  'kb-clean-press': ['cleanpress'], burpee: ['burpee'], 'squat-thrust': ['burpee', 'thrust'], 'db-squat-press': ['thruster', 'squatpress'],
};

/** Warm-up and cardio moves named in timed blocks. */
const NAMED = {
  'jumping jacks': ['jacks'], 'air squats': ['squat', 'air'], 'glute bridges': ['bridge'], 'lateral lunges': ['latlunge'],
  'dead bugs': ['deadbug'], 'inchworm to push-up': ['inchworm'], 'arm circles': ['armcircles'], 'scap push-ups': ['scappush'],
  'high knees': ['highknees'], burpees: ['burpee'], 'mountain climbers': ['climber'], 'squat jacks': ['squatjack'],
  'skater jumps': ['skater'], 'fast feet': ['fastfeet'], 'tuck jumps': ['tuck'], 'lateral shuffle': ['shuffle'],
};

export const hasAnim = (exId) => !!EX[exId];
export const animForName = (name) => NAMED[String(name || '').toLowerCase()] || null;
export const ANIMATED_IDS = Object.keys(EX);

/* ------------------------------------------------------------------ build + solve */

function compile(spec) {
  const [key, v] = spec;
  const tpl = T[key](v);
  const view = tpl.view || 'side';
  // Resolve shoulder-relative hands to scene coordinates for each keyframe.
  const frames = tpl.frames.map(([pose, move, hold]) => {
    const p = { ...pose, head: pose.head ?? pose.torso };
    const sh = add(p.hip, dir(p.torso), L.torso);
    p.hands = p.hands.map((h) => (Array.isArray(h) ? h : add(sh, h.s)));
    return { p, move, hold };
  });
  const total = frames.reduce((a, f) => a + f.move + f.hold, 0);
  const c = { view, props: tpl.props || [], frames, total, noFloor: !!tpl.noFloor };
  c.box = frameBox(c);
  return c;
}

/** A 5:4 view box that fits the whole motion and its props, so the figure fills the frame. */
function frameBox(c) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const take = (p, r = 0) => { x0 = Math.min(x0, p[0] - r); y0 = Math.min(y0, p[1] - r); x1 = Math.max(x1, p[0] + r); y1 = Math.max(y1, p[1] + r); };
  const n = c.frames.length;
  for (let i = 0; i < n; i += 1) {
    for (const t of [0, 0.5]) {
      const p = t ? mix(c.frames[i].p, c.frames[(i + 1) % n].p, t) : c.frames[i].p;
      const g = solve(p, c.view);
      take(g.head, L.head + 2);
      [g.H, g.S, ...g.arm.flat(), ...g.leg.flat(), ...g.toe].forEach((q) => take(q, 5));
      if (c.props.some((pr) => pr.t === 'bb' || pr.t === 'db' || pr.t === 'kb')) g.arm.forEach((a) => take(a[1], 13));
    }
  }
  for (const pr of c.props) {
    if (pr.t === 'bench') { take([pr.x, pr.y]); take([pr.x + pr.w, FLOOR]); }
    if (pr.t === 'bar') { take([pr.x - pr.w / 2, pr.y - 3]); take([pr.x + pr.w / 2, pr.y + 3]); }
    if (pr.t === 'wall') { take([pr.x - 8, y0]); }
    if (pr.t === 'door') { take([pr.x + 12, y0]); }
    if (pr.t === 'poly' || pr.t === 'line') pr.pts.forEach((q) => take(q, 4));
    if (Array.isArray(pr.to)) take(pr.to, 5);
  }
  if (!c.noFloor) y1 = Math.max(y1, FLOOR + 3);
  const pad = 8;
  x0 -= pad; y0 -= pad; x1 += pad; y1 += c.noFloor ? pad : 4;
  let w = x1 - x0, h = y1 - y0;
  // Never zoom in so far that a small motion looks huge.
  if (w < 110) { x0 -= (110 - w) / 2; w = 110; }
  if (w / h > 1.25) { const nh = w / 1.25; y0 -= (nh - h) * (c.noFloor ? 0.5 : 1); h = nh; } else { const nw = h * 1.25; x0 -= (nw - w) / 2; w = nw; }
  return [x0, y0, w, h].map((v) => Math.round(v * 10) / 10);
}

function mix(a, b, t) {
  return {
    hip: lerp2(a.hip, b.hip, t), torso: lerp(a.torso, b.torso, t), head: lerp(a.head, b.head, t),
    feet: [lerp2(a.feet[0], b.feet[0], t), lerp2(a.feet[1], b.feet[1], t)],
    hands: [lerp2(a.hands[0], b.hands[0], t), lerp2(a.hands[1], b.hands[1], t)],
    knee: [lerp2(a.knee[0], b.knee[0], t), lerp2(a.knee[1], b.knee[1], t)],
    elbow: [lerp2(a.elbow[0], b.elbow[0], t), lerp2(a.elbow[1], b.elbow[1], t)],
    toe: [lerp(a.toe[0], b.toe[0], t), lerp(a.toe[1], b.toe[1], t)],
  };
}

function sample(c, ms) {
  let t = ms % c.total;
  const n = c.frames.length;
  for (let i = 0; i < n; i += 1) {
    const f = c.frames[i];
    if (t < f.hold) return f.p;
    t -= f.hold;
    if (t < f.move) return mix(f.p, c.frames[(i + 1) % n].p, ease(t / f.move));
    t -= f.move;
  }
  return c.frames[0].p;
}

function solve(p, view) {
  const H = p.hip;
  const S = add(H, dir(p.torso), L.torso);
  const head = add(S, dir(p.head), L.neck);
  let sA = [S, S];
  let hA = [H, H];
  if (view === 'front') {
    // Limb 0 sits on the viewer's left when standing upright.
    const d = dir(p.torso);
    const q = [d[1], -d[0]];
    sA = [add(S, q, 10), add(S, q, -10)];
    hA = [add(H, q, 7), add(H, q, -7)];
  }
  const arm = [0, 1].map((i) => ik(sA[i], p.hands[i], L.ua, L.fa, p.elbow[i]));
  const leg = [0, 1].map((i) => ik(hA[i], p.feet[i], L.th, L.sh, p.knee[i]));
  const toe = [0, 1].map((i) => add(leg[i][1], dir(p.toe[i]), view === 'front' ? 6 : L.ft));
  return { H, S, head, sA, hA, arm, leg, toe };
}

/* ------------------------------------------------------------------ draw */

const NS = 'http://www.w3.org/2000/svg';
const f1 = (n) => Math.round(n * 10) / 10;
const pt = (p) => `${f1(p[0])} ${f1(p[1])}`;
const path = (...pts) => `M${pts.map(pt).join('L')}`;
let uid = 0;

function points(g) {
  return {
    h1: g.arm[0][1], h2: g.arm[1][1], hc: lerp2(g.arm[0][1], g.arm[1][1], 0.5), e1: g.arm[0][0], e2: g.arm[1][0],
    s: g.S, hip: g.H, k1: g.leg[0][0], k2: g.leg[1][0], a1: g.leg[0][1], a2: g.leg[1][1], t1: g.toe[0],
  };
}

function staticProp(pr) {
  switch (pr.t) {
    case 'bench': return `<rect class="pr-fill" x="${pr.x}" y="${pr.y}" width="${pr.w}" height="7" rx="3"/><rect class="pr-fill" x="${pr.x + 5}" y="${pr.y + 6}" width="5" height="${pr.h - 6}"/><rect class="pr-fill" x="${pr.x + pr.w - 10}" y="${pr.y + 6}" width="5" height="${pr.h - 6}"/>`;
    case 'bar': return `<line class="pr-bar" x1="${pr.x - pr.w / 2}" y1="${pr.y}" x2="${pr.x + pr.w / 2}" y2="${pr.y}"/>${pr.posts ? `<line class="pr-post" x1="${pr.x - pr.w / 2}" y1="${pr.y}" x2="${pr.x - pr.w / 2}" y2="${FLOOR}"/><line class="pr-post" x1="${pr.x + pr.w / 2}" y1="${pr.y}" x2="${pr.x + pr.w / 2}" y2="${FLOOR}"/>` : ''}`;
    case 'wall': return `<rect class="pr-fill" x="${pr.x - 8}" y="12" width="8" height="${FLOOR - 12}"/>`;
    case 'door': return `<rect class="pr-fill" x="${pr.x}" y="14" width="12" height="${FLOOR - 14}" rx="2"/><circle class="pr-dark" cx="${pr.x + 3}" cy="80" r="2.5"/>`;
    case 'poly': return `<polygon class="pr-fill" points="${pr.pts.map(pt).join(' ')}"/>`;
    case 'line': return `<line class="pr-line" stroke-width="${pr.w || 6}" x1="${pr.pts[0][0]}" y1="${pr.pts[0][1]}" x2="${pr.pts[1][0]}" y2="${pr.pts[1][1]}"/>`;
    default: return '';
  }
}

function dynProp(pr, P, g) {
  const at = (k) => (Array.isArray(k) ? k : P[k]);
  const p = pr.at ? add(at(pr.at), pr.off || [0, 0]) : null;
  switch (pr.t) {
    case 'db': {
      const fore = norm(sub(g.arm[0][1], g.arm[0][0]));
      const v = [-fore[1], fore[0]];
      const a = add(p, v, -6), b = add(p, v, 6);
      return `<g class="${pr.far ? 'far' : ''}"><line class="pr-handle" x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}"/><line class="pr-plate" x1="${f1(a[0] - fore[0] * 4.5)}" y1="${f1(a[1] - fore[1] * 4.5)}" x2="${f1(a[0] + fore[0] * 4.5)}" y2="${f1(a[1] + fore[1] * 4.5)}"/><line class="pr-plate" x1="${f1(b[0] - fore[0] * 4.5)}" y1="${f1(b[1] - fore[1] * 4.5)}" x2="${f1(b[0] + fore[0] * 4.5)}" y2="${f1(b[1] + fore[1] * 4.5)}"/></g>`;
    }
    case 'bb': return `<circle class="pr-plate-c" cx="${f1(p[0])}" cy="${f1(p[1])}" r="${pr.r || 11}"/><circle class="pr-dark" cx="${f1(p[0])}" cy="${f1(p[1])}" r="2.6"/>`;
    case 'kb': return `<path class="pr-kb-h" d="M${f1(p[0] - 4)} ${f1(p[1] + 3)}Q${f1(p[0])} ${f1(p[1] - 5)} ${f1(p[0] + 4)} ${f1(p[1] + 3)}"/><circle class="pr-dark" cx="${f1(p[0])}" cy="${f1(p[1] + 8)}" r="6.5"/>`;
    case 'band': { const a = at(pr.from), b = add(at(pr.to), pr.off || [0, 0]); return `<line class="pr-band" x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}"/>`; }
    case 'towel': {
      if (pr.at) return `<line class="pr-towel" x1="${f1(p[0] - 8)}" y1="${FLOOR - 1.5}" x2="${f1(p[0] + 8)}" y2="${FLOOR - 1.5}"/>`;
      const a = at(pr.from), b = at(pr.to);
      return `<line class="pr-towel" x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}"/>`;
    }
    case 'cable': {
      const a = at(pr.from), b = pr.to;
      return `<rect class="pr-fill" x="${b[0] - 4}" y="${Math.min(b[1], 10)}" width="8" height="${FLOOR - Math.min(b[1], 10)}" rx="2"/><line class="pr-cable" x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${b[0]}" y2="${b[1]}"/><circle class="pr-dark" cx="${b[0]}" cy="${b[1]}" r="3"/>`;
    }
    case 'pad': return `<circle class="pr-pad" cx="${f1(p[0])}" cy="${f1(p[1])}" r="5"/>`;
    case 'ring': return `<circle class="pr-band-c" cx="${f1(p[0])}" cy="${f1(p[1])}" r="5"/>`;
    case 'grip': return pr.vertical ? `<line class="pr-handle" x1="${f1(p[0])}" y1="${f1(p[1] - 7)}" x2="${f1(p[0])}" y2="${f1(p[1] + 7)}"/>` : `<line class="pr-handle" x1="${f1(p[0] - 20)}" y1="${f1(p[1])}" x2="${f1(p[0] + 20)}" y2="${f1(p[1])}"/>`;
    case 'sled': {
      const d = dir(pr.ang + 90);
      const a = add(p, d, -22), b = add(p, d, 22);
      return `<line class="pr-handle" stroke-width="6" x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}"/>`;
    }
    default: return '';
  }
}

function render(a, pose) {
  const g = solve(pose, a.c.view);
  const P = points(g);
  const e = a.el;
  e.torso.setAttribute('d', a.c.view === 'front' ? `${path(g.H, g.S)}${path(g.sA[0], g.sA[1])}${path(g.hA[0], g.hA[1])}` : path(g.H, g.S));
  e.head.setAttribute('cx', f1(g.head[0]));
  e.head.setAttribute('cy', f1(g.head[1]));
  for (let i = 0; i < 2; i += 1) {
    e.arm[i].setAttribute('d', path(g.sA[i], g.arm[i][0], g.arm[i][1]));
    e.leg[i].setAttribute('d', path(g.hA[i], g.leg[i][0], g.leg[i][1], g.toe[i]));
  }
  e.props.innerHTML = a.c.props.map((pr) => dynProp(pr, P, g)).join('');
}

const live = new Set();
let raf = 0;
const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function loop(now) {
  raf = 0;
  for (const a of live) {
    if (!a.svg.isConnected) { live.delete(a); continue; }
    if (a.paused) continue;
    const ms = now - a.t0;
    if (reduced()) {
      // Flip between keyframes instead of moving smoothly.
      const i = Math.floor(ms / 1600) % a.c.frames.length;
      if (i !== a.lastI) { a.lastI = i; render(a, a.c.frames[i].p); }
    } else {
      render(a, sample(a.c, ms * a.speed));
    }
  }
  if (live.size) raf = requestAnimationFrame(loop);
}

/**
 * Put an animation in `host`. `spec` is an exercise id or a [motion, variant] pair.
 * Options: frame (draw that keyframe and stay still), speed (playback rate),
 * restart (start from the top; by default every animation runs on one shared
 * clock, so re-rendering a screen never makes them jump).
 * Returns the SVG, or null when there is no animation for it.
 */
export function mountAnim(host, spec, opts = {}) {
  const s = typeof spec === 'string' ? EX[spec] : spec;
  if (!s || !T[s[0]]) return null;
  const c = compile(s);
  const id = `ag${uid += 1}`;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', c.box.join(' '));
  svg.setAttribute('class', 'anim');
  svg.setAttribute('role', 'img');
  svg.innerHTML = `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="40" y1="0" x2="160" y2="160"><stop offset="0" class="ag1"/><stop offset="1" class="ag2"/></linearGradient></defs>
    ${c.noFloor ? '' : `<line class="floor" x1="-400" y1="${FLOOR + 1}" x2="600" y2="${FLOOR + 1}"/>`}
    <g class="statics">${c.props.map(staticProp).join('')}</g>
    <g class="far"><path class="limb arm" data-p="arm1"/><path class="limb leg" data-p="leg1"/></g>
    <path class="limb trunk" data-p="torso"/>
    <circle class="headc" r="${L.head}" fill="url(#${id})"/>
    <g class="props"></g>
    <path class="limb leg" data-p="leg0"/><path class="limb arm" data-p="arm0"/>`;
  svg.querySelectorAll('.limb').forEach((n) => n.setAttribute('stroke', `url(#${id})`));
  const q = (k) => svg.querySelector(`[data-p="${k}"]`);
  const a = { svg, c, t0: opts.restart ? performance.now() : 0, speed: opts.speed || 1, lastI: -1, paused: false, el: { torso: q('torso'), head: svg.querySelector('.headc'), arm: [q('arm0'), q('arm1')], leg: [q('leg0'), q('leg1')], props: svg.querySelector('.props') } };
  svg.anim = a;
  host.appendChild(svg);
  render(a, c.frames[Math.min(opts.frame ?? 0, c.frames.length - 1)].p);
  if (opts.frame == null) {
    live.add(a);
    if (!raf) raf = requestAnimationFrame(loop);
  }
  return svg;
}

/** Pause or resume an animation; returns true when it is now paused. */
export function toggleAnim(svg) {
  const a = svg?.anim;
  if (!a) return false;
  if (a.paused) {
    a.t0 = performance.now() - a.pausedAt;
    a.paused = false;
    live.add(a);
    if (!raf) raf = requestAnimationFrame(loop);
  } else {
    a.pausedAt = performance.now() - a.t0;
    a.paused = true;
  }
  return a.paused;
}

/** Change playback speed without a jump. */
export function setAnimSpeed(svg, speed) {
  const a = svg?.anim;
  if (!a) return;
  const now = performance.now();
  const pos = (now - a.t0) * a.speed;
  a.speed = speed;
  a.t0 = now - pos / speed;
}

/** For tests: solved joint positions for an exercise at a keyframe or a time. */
export function geometryFor(spec, { frame, ms } = {}) {
  const s = typeof spec === 'string' ? EX[spec] : spec;
  const c = compile(s);
  const p = ms != null ? sample(c, ms) : c.frames[frame ?? 0].p;
  return { ...solve(p, c.view), frames: c.frames.length, total: c.total };
}
