# Onyx: training on the road

Onyx keeps your strength and cardio routine going when you are away from your
usual studio. It is built around a Barry's-style week: **3 Lift days**
(all-floor strength) and **2 Red days** (treadmill intervals alternating with
floor strength), and every session adapts to wherever you are: a full gym, a
hotel gym with a dumbbell rack, or the floor of a hotel room.

Everything runs on your device. No account, no tracking, works offline once
added to your home screen.

| Today | Workout | Interval timer | Progress |
|---|---|---|---|
| ![Today](docs/screen-today.png) | ![Workout](docs/screen-workout.png) | ![Timer](docs/screen-timer.png) | ![Progress](docs/screen-progress.png) |

## Features

- **Lift or Red, any day.** Your default week is Mon Lift, Tue Red, Wed Lift,
  Thu Red, Fri Lift, Sat easy, Sun off. Change the default in **Plan**, or tap
  Lift / Red / Recover / Rest on **Today** to switch a single day.
- **Body-part focus** like the studio: Upper (chest, back, shoulders), Lower
  (butt and legs), Full body, Arms and abs. It rotates through the week on its
  own and you can pick a different one any day.
- **Adapts to your kit.** Pick Full gym, Hotel gym, Room / Airbnb or Park, then
  fine-tune the equipment (barbell, machines, dumbbells, kettlebell, bench,
  band, pull-up bar) and cardio (treadmill, bike, rower, run outside or none).
  About 100 exercises, each tagged with what it needs.
- **Red room intervals** on the treadmill with speeds and inclines from your own
  Base / Push / All out speeds (pyramids, hill climbs, sprint ladders, tempo
  builds). No treadmill? The same blocks become bike, rower, outdoor run or
  bodyweight cardio.
- **Built for a 3-week trip.** Week 1 Base (3 x 10), week 2 Build (4 x 8), week 3
  Peak (4 x 6). Main lifts stay the same for the whole trip so you can add
  weight; accessories rotate weekly. Longer trips get a lighter deload every
  4th week.
- **Smart weight suggestions** from what you lifted last time. Hit every rep and
  it adds 5 lb (or 2-2.5 kg); when the reps drop for the next phase it works out
  the heavier weight for you.
- **Workout mode** with set logging, an automatic rest timer that shows what is
  next, supersets and circuits, swap any exercise (it remembers your pick), form
  cues and a demo link, and a full-screen interval timer with beeps and big
  speed / incline numbers. The screen stays awake while you train.
- **Cardio finisher** (optional) at the end of Lift days.
- **Took a class instead?** Log it in one tap and it counts toward your week.
- **Progress**: sessions this week, a trip calendar, weekly volume, personal
  bests (estimated 1-rep max) and full history.
- **lb / kg toggle** (speeds switch to mph / km/h with it), right on the header
  and mid-workout.
- **Monochrome design** with Auto, Light and Dark modes.
- Back up and restore your data as a file.

## Run it

It is a static site with no build step.

```bash
npm start          # from the repository root, then open http://localhost:8080/fit/
npm test           # includes the Onyx program and unit tests
```

### Put it on your phone

Turn on GitHub Pages for this repository (Settings → Pages → Deploy from a
branch, `/ (root)`), then open `https://<your-user>.github.io/<repo>/fit/` on
your phone.

- **iPhone**: Safari → Share → **Add to Home Screen**.
- **Android**: Chrome → menu → **Install app**.

## How it works

```
fit/index.html        app shell
fit/css/styles.css    monochrome design tokens (light + dark), components
fit/js/app.js         screens, workout mode, rest and interval timers
fit/js/program.js     session builder, phases, load suggestions, stats (pure, unit-tested)
fit/js/exercises.js   exercise library, equipment, locations
fit/js/units.js       lb / kg and mph / km/h helpers (pure, unit-tested)
fit/js/store.js       local-first storage, backup / restore
fit/js/timer.js       beeps, vibration, screen wake lock, countdown
fit/sw.js             offline cache, scoped to fit/
tests/fit-program.test.mjs
```

Sessions are generated from the date, so the same day always shows the same
workout until you shuffle it. Data is saved in this browser only, so use
**Settings → Back up** now and then.
