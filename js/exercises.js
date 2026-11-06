// Exercise library. Every movement lists the kit it needs, so a session can be
// built for a full gym, a hotel gym with a dumbbell rack, or a hotel room floor.

export const EQUIPMENT = [
  { id: 'barbell', name: 'Barbell & rack' },
  { id: 'machine', name: 'Machines & cables' },
  { id: 'db', name: 'Dumbbells' },
  { id: 'kb', name: 'Kettlebell' },
  { id: 'bench', name: 'Bench' },
  { id: 'band', name: 'Resistance band' },
  { id: 'bar', name: 'Pull-up bar' },
];

export const CARDIO = [
  { id: 'treadmill', name: 'Treadmill' },
  { id: 'bike', name: 'Bike' },
  { id: 'rower', name: 'Rower' },
  { id: 'run', name: 'Run outside' },
  { id: 'none', name: 'No machine' },
];

export const LOCATIONS = [
  { id: 'gym', name: 'Full gym', sub: 'Barbells, machines, dumbbells', equipment: ['barbell', 'machine', 'db', 'kb', 'bench', 'band', 'bar'], cardio: 'treadmill' },
  { id: 'hotel', name: 'Hotel gym', sub: 'Dumbbells, bench, cardio machine', equipment: ['db', 'bench'], cardio: 'treadmill' },
  { id: 'room', name: 'Room / Airbnb', sub: 'Bodyweight, a band if you packed one', equipment: [], cardio: 'none' },
  { id: 'outdoor', name: 'Park / outdoors', sub: 'Bodyweight, a bar, open space', equipment: ['bar'], cardio: 'run' },
];

/**
 * load: 'w' weighted (log weight + reps), 'bw' bodyweight reps, 't' timed seconds.
 * main: a compound that can anchor a session. uni: reps are per side.
 * base: starting reps (bw) or seconds (t) before the weekly progression.
 */
const L = [];
const x = (id, name, pattern, req, load, extra = {}) => L.push({ id, name, pattern, req, load, ...extra });

// Squat
x('back-squat', 'Back Squat', 'squat', ['barbell'], 'w', { main: true, cue: 'Brace, sit between the hips, drive the floor away.' });
x('leg-press', 'Leg Press', 'squat', ['machine'], 'w', { main: true, cue: 'Feet shoulder width, lower until hips start to tuck.' });
x('goblet-squat', 'Goblet Squat', 'squat', ['db'], 'w', { main: true, cue: 'Elbows inside knees, chest tall, pause at the bottom.' });
x('db-front-squat', 'Dumbbell Front Squat', 'squat', ['db'], 'w', { main: true, cue: 'Bells on shoulders, elbows high, knees track toes.' });
x('kb-goblet-squat', 'Kettlebell Goblet Squat', 'squat', ['kb'], 'w', { main: true, cue: 'Hold the horns, sit deep, stand tall.' });
x('tempo-squat', 'Tempo Air Squat', 'squat', [], 'bw', { main: true, base: 15, cue: '3 seconds down, 1 second pause, stand fast.' });
x('band-squat', 'Banded Squat', 'squat', ['band'], 'bw', { main: true, base: 15, cue: 'Stand on the band, handles at shoulders.' });
x('jump-squat', 'Jump Squat', 'squat', [], 'bw', { base: 10, cue: 'Land soft and quiet, reset each rep.' });

// Hinge
x('rdl', 'Romanian Deadlift', 'hinge', ['barbell'], 'w', { main: true, cue: 'Soft knees, hips back, bar close to the legs.' });
x('deadlift', 'Deadlift', 'hinge', ['barbell'], 'w', { main: true, cue: 'Bar over midfoot, push the floor, lock out with glutes.' });
x('db-rdl', 'Dumbbell RDL', 'hinge', ['db'], 'w', { main: true, cue: 'Hinge until you feel hamstrings, keep the back flat.' });
x('kb-swing', 'Kettlebell Swing', 'hinge', ['kb'], 'w', { main: true, cue: 'Hike, snap the hips, float the bell to chest height.' });
x('sl-rdl-bw', 'Single-leg RDL', 'hinge', [], 'bw', { uni: true, base: 10, cue: 'Reach long, hips square, slow on the way down.' });
x('band-good-morning', 'Banded Good Morning', 'hinge', ['band'], 'bw', { base: 15, cue: 'Band behind neck, hinge with a flat back.' });

// Lunge / single leg
x('db-reverse-lunge', 'Dumbbell Reverse Lunge', 'lunge', ['db'], 'w', { uni: true, cue: 'Step back long, front shin vertical.' });
x('db-bss', 'Bulgarian Split Squat', 'lunge', ['db', 'bench'], 'w', { uni: true, main: true, cue: 'Rear foot on bench, drop straight down.' });
x('bss-bw', 'Bulgarian Split Squat', 'lunge', [], 'bw', { uni: true, base: 10, cue: 'Rear foot on a chair or bed, drop straight down.' });
x('db-step-up', 'Dumbbell Step-up', 'lunge', ['db', 'bench'], 'w', { uni: true, cue: 'Drive through the top foot, no push off the floor.' });
x('bb-reverse-lunge', 'Barbell Reverse Lunge', 'lunge', ['barbell'], 'w', { uni: true, cue: 'Tall torso, knee kisses the floor.' });
x('walking-lunge', 'Walking Lunge', 'lunge', [], 'bw', { uni: true, base: 12, cue: 'Long steps, upright chest.' });
x('lateral-lunge', 'Lateral Lunge', 'lunge', [], 'bw', { uni: true, base: 10, cue: 'Sit into one hip, other leg straight.' });
x('db-lateral-lunge', 'Dumbbell Lateral Lunge', 'lunge', ['db'], 'w', { uni: true, cue: 'Goblet hold, sit into one hip.' });

// Hamstrings
x('leg-curl', 'Lying Leg Curl', 'ham', ['machine'], 'w', { cue: 'Squeeze at the top, 2 seconds down.' });
x('towel-curl', 'Towel Hamstring Curl', 'ham', [], 'bw', { base: 10, cue: 'Bridge up, slide heels in and out on a towel.' });
x('db-sl-rdl', 'Single-leg Dumbbell RDL', 'ham', ['db'], 'w', { uni: true, cue: 'Bell in the opposite hand, hips square.' });
x('nordic-neg', 'Nordic Curl Negative', 'ham', [], 'bw', { base: 5, cue: 'Anchor heels under a bed, lower as slowly as you can.' });

// Glutes
x('bb-hip-thrust', 'Barbell Hip Thrust', 'glute', ['barbell', 'bench'], 'w', { main: true, cue: 'Chin tucked, ribs down, pause at the top.' });
x('db-hip-thrust', 'Dumbbell Hip Thrust', 'glute', ['db', 'bench'], 'w', { cue: 'Bell on hips, drive through heels, pause at the top.' });
x('cable-kickback', 'Cable Kickback', 'glute', ['machine'], 'w', { uni: true, cue: 'Kick back and slightly out, no low-back arch.' });
x('sl-bridge', 'Single-leg Glute Bridge', 'glute', [], 'bw', { uni: true, base: 12, cue: 'Other knee to chest, squeeze hard at the top.' });
x('band-bridge', 'Banded Glute Bridge', 'glute', ['band'], 'bw', { base: 20, cue: 'Band above knees, push knees out.' });
x('frog-pump', 'Frog Pump', 'glute', [], 'bw', { base: 25, cue: 'Soles together, short fast squeezes.' });

// Quads / calves
x('leg-extension', 'Leg Extension', 'quad', ['machine'], 'w', { cue: 'Pause at the top, 2 seconds down.' });
x('wall-sit', 'Wall Sit', 'quad', [], 't', { base: 40, cue: 'Thighs parallel, back flat on the wall.' });
x('cossack', 'Cossack Squat', 'quad', [], 'bw', { uni: true, base: 8, cue: 'Wide stance, sit deep into one side.' });
x('db-calf-raise', 'Dumbbell Calf Raise', 'calf', ['db'], 'w', { cue: 'Full stretch at the bottom, pause at the top.' });
x('sl-calf-raise', 'Single-leg Calf Raise', 'calf', [], 'bw', { uni: true, base: 15, cue: 'On a step, slow and full range.' });

// Horizontal push
x('bench-press', 'Bench Press', 'push_h', ['barbell', 'bench'], 'w', { main: true, cue: 'Shoulder blades pinned, bar to lower chest.' });
x('db-bench', 'Dumbbell Bench Press', 'push_h', ['db', 'bench'], 'w', { main: true, cue: 'Elbows at 45°, press up and slightly in.' });
x('incline-db', 'Incline Dumbbell Press', 'push_h', ['db', 'bench'], 'w', { main: true, cue: 'Low incline, bells over upper chest.' });
x('db-floor-press', 'Dumbbell Floor Press', 'push_h', ['db'], 'w', { main: true, cue: 'Triceps touch the floor, pause, press.' });
x('chest-press', 'Machine Chest Press', 'push_h', ['machine'], 'w', { main: true, cue: 'Handles at mid chest, control the return.' });
x('push-up', 'Push-up', 'push_h', [], 'bw', { main: true, base: 12, cue: 'Body in one line, chest to the floor.' });
x('decline-push-up', 'Decline Push-up', 'push_h', [], 'bw', { main: true, base: 10, cue: 'Feet on the bed or a chair, full range.' });
x('band-chest-press', 'Banded Chest Press', 'push_h', ['band'], 'bw', { base: 15, cue: 'Band around your back, punch forward.' });
x('db-fly', 'Dumbbell Fly', 'push_h', ['db', 'bench'], 'w', { cue: 'Soft elbows, wide arc, squeeze at the top.' });
x('cable-fly', 'Cable Fly', 'push_h', ['machine'], 'w', { cue: 'Hug a tree, stop at mid chest.' });

// Vertical push
x('ohp', 'Overhead Press', 'push_v', ['barbell'], 'w', { main: true, cue: 'Glutes tight, bar path straight up, head through.' });
x('seated-db-press', 'Seated Dumbbell Press', 'push_v', ['db', 'bench'], 'w', { main: true, cue: 'Back on the pad, press to just short of lockout.' });
x('standing-db-press', 'Standing Dumbbell Press', 'push_v', ['db'], 'w', { main: true, cue: 'Ribs down, squeeze glutes, press overhead.' });
x('arnold-press', 'Arnold Press', 'push_v', ['db'], 'w', { cue: 'Palms in at the bottom, rotate out as you press.' });
x('machine-shoulder', 'Machine Shoulder Press', 'push_v', ['machine'], 'w', { main: true, cue: 'Handles at chin height, smooth press.' });
x('pike-push-up', 'Pike Push-up', 'push_v', [], 'bw', { main: true, base: 8, cue: 'Hips high, head travels in front of the hands.' });
x('band-ohp', 'Banded Overhead Press', 'push_v', ['band'], 'bw', { base: 15, cue: 'Stand on the band, press straight up.' });

// Horizontal pull
x('bb-row', 'Barbell Row', 'pull_h', ['barbell'], 'w', { main: true, cue: 'Hinged at 45°, pull to the belly button.' });
x('db-row', 'One-arm Dumbbell Row', 'pull_h', ['db'], 'w', { main: true, uni: true, cue: 'Brace on a bench or chair, elbow to the hip.' });
x('chest-supported-row', 'Chest-supported Row', 'pull_h', ['db', 'bench'], 'w', { main: true, cue: 'Chest on an incline bench, squeeze shoulder blades.' });
x('cable-row', 'Seated Cable Row', 'pull_h', ['machine'], 'w', { main: true, cue: 'Tall chest, pull to the stomach, pause.' });
x('renegade-row', 'Renegade Row', 'pull_h', ['db'], 'w', { cue: 'Plank on the bells, row without twisting.' });
x('band-row', 'Banded Row', 'pull_h', ['band'], 'bw', { base: 15, cue: 'Anchor the band in a door, pull to ribs.' });
x('inverted-row', 'Inverted Row', 'pull_h', ['bar'], 'bw', { main: true, base: 10, cue: 'Low bar, body straight, chest to the bar.' });
x('towel-row', 'Doorframe Towel Row', 'pull_h', [], 'bw', { main: true, base: 12, cue: 'Towel around a sturdy door handle, lean back, row.' });

// Vertical pull
x('pull-up', 'Pull-up', 'pull_v', ['bar'], 'bw', { main: true, base: 6, cue: 'Dead hang to chin over bar, no swing.' });
x('chin-up', 'Chin-up', 'pull_v', ['bar'], 'bw', { main: true, base: 6, cue: 'Palms facing you, chest to the bar.' });
x('lat-pulldown', 'Lat Pulldown', 'pull_v', ['machine'], 'w', { main: true, cue: 'Pull to the collarbone, elbows to the pockets.' });
x('db-pullover', 'Dumbbell Pullover', 'pull_v', ['db', 'bench'], 'w', { cue: 'Long arms, stretch the lats, pull back over the chest.' });
x('band-pulldown', 'Banded Lat Pulldown', 'pull_v', ['band'], 'bw', { base: 15, cue: 'Band overhead, pull elbows down to ribs.' });
x('prone-pulldown', 'Floor Lat Pulldown', 'pull_v', [], 'bw', { base: 12, cue: 'Face down, arms overhead, pull elbows to ribs, squeeze.' });

// Shoulders
x('lateral-raise', 'Lateral Raise', 'shoulder', ['db'], 'w', { cue: 'Lead with the elbows, stop at shoulder height.' });
x('rear-delt-fly', 'Rear-delt Fly', 'shoulder', ['db'], 'w', { cue: 'Hinge over, sweep the arms wide, pinkies up.' });
x('cable-lateral', 'Cable Lateral Raise', 'shoulder', ['machine'], 'w', { uni: true, cue: 'Cable behind you, smooth arc.' });
x('face-pull', 'Face Pull', 'shoulder', ['machine'], 'w', { cue: 'Rope to the eyes, thumbs back.' });
x('band-pull-apart', 'Band Pull-apart', 'shoulder', ['band'], 'bw', { base: 20, cue: 'Straight arms, pull the band to the chest.' });
x('ytw', 'Prone Y-T-W', 'shoulder', [], 'bw', { base: 8, cue: 'Face down, thumbs up, hold each letter for 1 second.' });

// Biceps
x('db-curl', 'Dumbbell Curl', 'bi', ['db'], 'w', { cue: 'Elbows pinned, full squeeze, slow down.' });
x('hammer-curl', 'Hammer Curl', 'bi', ['db'], 'w', { cue: 'Thumbs up, no swing.' });
x('bb-curl', 'Barbell Curl', 'bi', ['barbell'], 'w', { cue: 'Elbows still, curl to the chin.' });
x('cable-curl', 'Cable Curl', 'bi', ['machine'], 'w', { cue: 'Step back for constant tension.' });
x('band-curl', 'Banded Curl', 'bi', ['band'], 'bw', { base: 15, cue: 'Stand on the band, 2 seconds down.' });
x('towel-curl-iso', 'Towel Curl Hold', 'bi', [], 't', { base: 30, cue: 'Step on a towel, curl up against it as hard as you can.' });

// Triceps
x('oh-tri-ext', 'Overhead Triceps Extension', 'tri', ['db'], 'w', { cue: 'Elbows narrow, deep stretch behind the head.' });
x('skull-crusher', 'Lying Triceps Extension', 'tri', ['db'], 'w', { cue: 'Lower to the temples, elbows still.' });
x('db-kickback', 'Triceps Kickback', 'tri', ['db'], 'w', { cue: 'Upper arm parallel to the floor, lock out.' });
x('pushdown', 'Cable Pushdown', 'tri', ['machine'], 'w', { cue: 'Elbows at your sides, spread the rope.' });
x('bench-dip', 'Chair Dip', 'tri', [], 'bw', { base: 12, cue: 'Hands on a chair, elbows straight back.' });
x('diamond-push-up', 'Diamond Push-up', 'tri', [], 'bw', { base: 10, cue: 'Hands together under the chest.' });
x('band-pushdown', 'Banded Pushdown', 'tri', ['band'], 'bw', { base: 15, cue: 'Anchor high, push down, squeeze.' });

// Core
x('plank', 'Plank', 'core', [], 't', { base: 40, cue: 'Squeeze glutes, push the floor away.' });
x('side-plank', 'Side Plank', 'core', [], 't', { uni: true, base: 30, cue: 'Hips high, straight line head to heels.' });
x('dead-bug', 'Dead Bug', 'core', [], 'bw', { uni: true, base: 10, cue: 'Low back glued to the floor.' });
x('hollow-hold', 'Hollow Hold', 'core', [], 't', { base: 30, cue: 'Arms by ears, low back down, legs low.' });
x('bicycle', 'Bicycle Crunch', 'core', [], 'bw', { uni: true, base: 15, cue: 'Slow and controlled, elbow toward knee.' });
x('v-up', 'V-up', 'core', [], 'bw', { base: 12, cue: 'Reach for the toes, lower with control.' });
x('flutter', 'Flutter Kicks', 'core', [], 't', { base: 30, cue: 'Low back down, small fast kicks.' });
x('mountain-climber', 'Mountain Climber', 'core', [], 't', { base: 30, cue: 'Hips level, knees drive fast.' });
x('russian-twist', 'Dumbbell Russian Twist', 'core', ['db'], 'w', { uni: true, cue: 'Lean back, rotate from the ribs.' });
x('hanging-knee', 'Hanging Knee Raise', 'core', ['bar'], 'bw', { base: 10, cue: 'No swing, curl the pelvis up.' });
x('woodchop', 'Cable Woodchop', 'core', ['machine'], 'w', { uni: true, cue: 'Rotate through the torso, arms long.' });
x('pallof', 'Pallof Press', 'core', ['band'], 'bw', { uni: true, base: 10, cue: 'Press out and resist the rotation.' });
x('bird-dog', 'Bird Dog', 'core', [], 'bw', { uni: true, base: 10, cue: 'Reach long, hips square, pause.' });

// Power / full body
x('db-thruster', 'Dumbbell Thruster', 'power', ['db'], 'w', { cue: 'Squat and press in one smooth drive.' });
x('db-snatch', 'Dumbbell Snatch', 'power', ['db'], 'w', { uni: true, cue: 'Hinge, explode, punch the bell overhead.' });
x('man-maker', 'Man Maker', 'power', ['db'], 'w', { cue: 'Push-up, row each side, clean, press.' });
x('kb-clean-press', 'Kettlebell Clean & Press', 'power', ['kb'], 'w', { uni: true, cue: 'Clean to the rack, press, control down.' });
x('burpee', 'Burpee', 'power', [], 'bw', { base: 10, cue: 'Chest to the floor, jump and clap overhead.' });
x('squat-thrust', 'Squat Thrust', 'power', [], 'bw', { base: 12, cue: 'Hands down, jump back, jump in, stand.' });
x('db-squat-press', 'Dumbbell Squat to Press', 'power', ['db'], 'w', { cue: 'Squat, stand, then press. Keep it smooth.' });

export const EXERCISES = L;
export const EX_BY_ID = Object.fromEntries(L.map((e) => [e.id, e]));

/** The equipment that decides how loads are rounded. */
export function primaryEquip(ex) {
  for (const k of ['barbell', 'machine', 'kb', 'db']) if (ex.req.includes(k)) return k;
  return 'bw';
}

/** Can this move be done with the kit available? */
export const isAvailable = (ex, equipment) => ex.req.every((r) => equipment.includes(r));

/** Bodyweight cardio pool for Red-room style blocks when there is no machine. */
export const BW_CARDIO = ['High Knees', 'Skater Jumps', 'Burpees', 'Jumping Jacks', 'Mountain Climbers', 'Squat Jacks', 'Fast Feet', 'Tuck Jumps', 'Lateral Shuffle', 'Plank Jacks'];
