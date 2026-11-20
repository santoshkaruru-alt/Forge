# Forge: your studio week, anywhere

Forge gives you a Barry's-style week of strength and cardio, at home or on the
road. Every day has a **body-part focus** (Arms, Shoulders & Abs; Legs & Abs;
Chest, Back & Abs; Abs & Butt; Full Body with a lower or upper focus), and you
choose the room:

- **Lift Room**: strength. Heavier weights, lower reps, all on the floor.
- **Red Room**: treadmill intervals alternating with floor strength circuits.

Workouts adapt to wherever you are: your usual gym, a hotel gym, a hotel room
floor or a park. Everything runs on your device, no account, works offline.

| Today | Week | Workout | Station timer | How to | Treadmill timer | Progress |
|---|---|---|---|---|---|---|
| ![Today](docs/screen-today.png) | ![Week](docs/screen-week.png) | ![Workout](docs/screen-workout.png) | ![Station timer](docs/screen-station.png) | ![How to](docs/screen-howto.png) | ![Timer](docs/screen-timer.png) | ![Progress](docs/screen-progress.png) |

## How it's laid out

Four tabs:

- **Today**: the day's focus, a big **Lift Room / Red Room / Rest** switch and
  one Start button. Below it: what's in the workout, where you're training (tap
  to switch when you travel), and a one-tap way to log a studio class instead.
- **Week**: all seven days, each with its own Lift / Red / Rest switch, and
  **Change** to pick a different focus or swap with another day.
  Changes apply to that day only; **Save this week as usual** makes it your
  default for every week.
- **Progress**: workouts this week against your goal, week streak, a month
  calendar colored by room, weekly volume, personal bests and history.
- **Settings**: lb / kg (mph / km/h), light / dark / auto, weekly goal, session
  length, the 4-week cycle, equipment, treadmill speeds, rest timers, backup.

## The program

- **Default week**:

  | Day | Focus | Room |
  |---|---|---|
  | Mon | Arms & Shoulders, with abs | Lift |
  | Tue | Legs, with abs | Red |
  | Wed | Chest & Back, with abs | Lift |
  | Thu | Abs & Butt | Red |
  | Fri | Full Body, lower focus | Lift |
  | Sat | Full Body, upper focus | Red |
  | Sun | Rest | |

  Everything is swappable: flip any day between Lift Room, Red Room and Rest,
  change its focus once or every week, or **swap two days** (room and focus
  trade places for that week). Abs are built into every session (a core move
  in the last Lift block, and every Red Room floor circuit ends on core).
- **Dumbbells & bodyweight only** (on by default), like the studio floor: every
  exercise uses dumbbells, a bench or just your body (push-ups, planks, lunges).
  Even at a full gym it skips barbells, machines, cables, kettlebells, bands and
  pull-up bars. Turn it off in Settings → Where you train to use them.
- **Timed stations, like a class**: every floor move is **50 seconds on, 25
  seconds rest**, a round is 3 to 5 moves, and there is a **1-minute water
  break** between rounds. Rest and water break can be changed in Settings.
- **4-week cycles, all year**: Base, Build and Peak get a little heavier each
  week (the target reps drop from about 10 to 8 to 6 on the main lifts), then a
  lighter Deload week runs 40 seconds on. Main lifts stay the same through a
  cycle so you can add weight; other moves rotate weekly.
- **Red Room** (about 50 min): warm-up, Tread 1 (12 min), Floor 1 (4 moves x 2
  rounds, the last move is abs), Tread 2 (10 min), Floor 2 (4 moves x 2
  rounds), cool-down. Treadmill blocks use
  your own Recover / Base / Push / All out speeds (pyramids, hill climbs,
  sprint ladders, tempo builds) and get a little faster each week. No treadmill?
  The same blocks become bike, rower, outdoor run or bodyweight cardio.
- **Lift Room** (about 50 min): warm-up, Blocks A, B and C (3 moves x 3
  rounds each, heavier weights and a slower tempo), an abs finisher (4 moves),
  an optional cardio finisher, cool-down. The first two moves of Block A are
  the main lifts.
- **Session length** 30, 50 or 60 minutes adds or removes rounds and moves.
- **Weight suggestions** from your last session: hit every rep and it adds 5 lb
  (2 to 2.5 kg); when the reps change it works out the right weight.

## Exercise animations

Every exercise (all 107) has its own animation showing the movement, drawn in
the app's colors with the equipment it uses: dumbbells, barbell, kettlebell,
bench, cable machine, band, pull-up bar, wall or door.

- In a workout, each exercise has a moving thumbnail. Tap it (or **How to**) for
  a large player with **Slow** and **Normal** speed; tap the player to pause.
- In **Swap**, every option shows its animation so you can compare moves.
- On Today, tap any exercise in "What's in it" to watch it before you start.
- The interval timer plays the move for warm-ups and bodyweight cardio
  (jumping jacks, high knees, burpees, mountain climbers and more).
- With Reduce Motion turned on in your phone settings, animations step between
  positions instead of moving smoothly.

They are built from a small posable figure: each motion is a few keyframes, and
knees and elbows are solved with inverse kinematics so feet stay planted and
hands stay on the floor, bar or bench. Everything works offline.

## Workout mode

Step chips at the top show where you are and jump to any block. Tap **Start
stations** on a floor block and the timer runs it like a class: a 50-second
countdown with the move's animation, the weight to use and the reps to aim
for (one-sided moves beep halfway to switch sides), then a 25-second rest
showing what's next, and a 1-minute water break between rounds. Each move is
logged as you finish it; adjust the weight or reps during the rest. You can
also log rounds by hand on the block card. Swap any exercise
(it remembers), see form cues and a demo link, and run a full-screen interval
timer whose color tells you the effort: blue for easy, purple for base, orange
for push, red for all out. The screen stays awake while you train.

## Run it

It is a static site with no build step.

```bash
npm start          # then open http://localhost:8080/
npm test           # program and unit tests (Node 18+)
```

### Put it on your phone

Turn on GitHub Pages for this repository (Settings → Pages → Deploy from a
branch, `main`, `/ (root)`), then after a minute or two open
**https://santoshkaruru-alt.github.io/Forge/** on your phone.

- **iPhone**: Safari → Share → **Add to Home Screen**.
- **Android**: Chrome → menu → **Install app**.

## Code

```
index.html            app shell
css/styles.css        design tokens (light + dark), Lift blue / Red red-orange
js/app.js             screens, workout mode, rest and interval timers
js/program.js         weekly plan, session builder, cycles, load suggestions (pure, unit-tested)
js/exercises.js       exercise library, equipment, locations
js/units.js           lb / kg and mph / km/h helpers (pure, unit-tested)
js/store.js           local-first storage, migration, backup / restore
js/timer.js           beeps, vibration, screen wake lock, countdown
js/anim.js            exercise animations: posable figure, keyframes, IK, props
sw.js                 offline cache
tests/program.test.mjs
```

Sessions are generated from the date, so a day always shows the same workout
until you shuffle it. Data is saved in this browser only, so use
**Settings → Back up** now and then.
