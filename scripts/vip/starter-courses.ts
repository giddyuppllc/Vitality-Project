/**
 * Classroom starter courses (original, 09-29). General wellness education —
 * training, nutrition, sleep, recovery and habits. No product, dosing or
 * medical-treatment content. Tier gating (assumption, admin-editable):
 * Orientation = every level, Foundations = Plus and up, Reset = Premium Stacks.
 */

export interface StarterLesson {
  title: string
  body: string
}
export interface StarterModule {
  title: string
  lessons: StarterLesson[]
}
export interface StarterCourse {
  slug: string
  title: string
  summary: string
  minTier: 'CLUB' | 'PLUS' | 'PREMIUM'
  sortOrder: number
  modules: StarterModule[]
}

const orientation: StarterCourse = {
  slug: 'clubhouse-orientation',
  title: 'Clubhouse Orientation',
  summary: 'Your first ten minutes: how the Clubhouse works, how to get great answers, and a weekly rhythm that sticks.',
  minTier: 'CLUB',
  sortOrder: 0,
  modules: [
    {
      title: 'Welcome in',
      lessons: [
        {
          title: 'How the Clubhouse works',
          body: `# Five rooms, one goal

The Clubhouse has five parts. Each one does a single job well.

- **Community** — the feed. Post check-ins, questions and wins. Filter by space (Training Lab, Fuel & Nutrition, Sleep & Recovery and more) to find the conversation you want.
- **Classroom** — structured courses in short lessons. Tick a lesson complete and your progress saves.
- **Events** — live sessions every month. RSVP and we remind you a day before and an hour before.
- **Members** — the directory. Find people training for the same things you are.
- **Rewards** — your store credit. It lands on the 1st and applies at vitalityproject.global checkout.

# The one habit that makes it work

Show up once a week. Members who post a weekly check-in get more answers, more encouragement and more momentum than members who only read.

**Your action:** open the Community tab and read the pinned welcome post.`,
        },
        {
          title: 'Set up your profile in two minutes',
          body: `# Why it matters

A photo and a line about your goals turn a username into a training partner. Members answer people they recognise.

# The two-minute setup

1. Open **Me** (or your avatar) and choose **Change photo**.
2. Set a display name — first name and last initial works well.
3. Write a three-line bio using this template:

- What I am training for: *e.g. my first half marathon in April*
- What I am working on: *e.g. getting to bed by 10:30 on weeknights*
- Ask me about: *e.g. kettlebells, meal prep for a family of five*

4. Scroll to **Email from the Clubhouse** and choose what lands in your inbox.

**Your action:** finish your profile, then tick this lesson complete.`,
        },
        {
          title: 'Your first week, step by step',
          body: `# Day by day

- **Day 1** — Profile done. Introduce yourself in Introductions.
- **Day 2** — Finish this Orientation course.
- **Day 3** — RSVP to the next live session on the Events page.
- **Day 4** — Read three posts in a space you care about and reply to one.
- **Day 5** — Write down one 90-day goal (lesson "Setting a 90-day goal" shows you how).
- **Day 6** — Post your first weekly check-in in Wins & Check-ins.
- **Day 7** — Rest. Notice how the week felt.

# What good looks like

By the end of week one you have a face, a goal, a first check-in and a date on your calendar. That is a strong start — everything else builds on it.

**Your action:** put Day 6 in your calendar right now.`,
        },
      ],
    },
    {
      title: 'Getting the most out of it',
      lessons: [
        {
          title: 'How to ask a question that gets a great answer',
          body: `# Context is the whole game

"What should I eat?" gets a shrug. "I train at 6 am, I am hungry by 10 and I want to hold muscle while losing 10 lb — what should breakfast look like?" gets a plan.

# The four-part question

1. **Goal** — what you want and by when.
2. **Current** — what you do now (numbers help: sleep hours, training days, steps).
3. **Tried** — what you have already tested and what happened.
4. **Ask** — the one specific thing you want help with.

# Where to post

- Training form or programming → **Training Lab**
- Food and hydration → **Fuel & Nutrition**
- Sleep and rest → **Sleep & Recovery**
- Something for Kevin's live session → **Ask the Coaches**

Medical questions belong with your own healthcare provider, who knows your history.

**Your action:** draft one question using the four parts.`,
        },
        {
          title: 'Live sessions: how to prepare and what to bring',
          body: `# The monthly rhythm

- **Live Q&A with Kevin** — every month, open to every level.
- **New Member Kickoff** — every month, perfect for your first few weeks.
- **Premium Stacks Roundtable** — a small-group call for Premium Stacks members.

Times show in your own time zone on the Events page. RSVP and you get an email a day before and an hour before.

# Bring three things

1. **One question**, written using the four-part format.
2. **Your numbers** — last week's sleep average, training days and one win.
3. **A notebook.** The best idea you hear is only useful if you write it down.

# After the call

Post your one takeaway in Wins & Check-ins. Saying it out loud is how it becomes a habit.

**Your action:** RSVP to the next session.`,
        },
        {
          title: 'Your monthly rewards, explained',
          body: `# How it lands

On the 1st of every month, your membership deposits store credit into your Vitality account. The Rewards tab shows your balance, each month's deposit and when it is good through.

# How to spend it

Shop at vitalityproject.global. At checkout — card or Zelle — your credit comes off the order total, shipping and tax included. If an order is cancelled, the credit returns to your balance.

# How long it lasts

Each month's credit is good for twelve months from the day it lands, so there is no rush. Use it when it suits you.

# Your member pricing

Your level's member discount applies to the price first; your credit then covers what is left.

**Your action:** open the Rewards tab and check your balance.`,
        },
      ],
    },
    {
      title: 'Build your rhythm',
      lessons: [
        {
          title: 'The weekly check-in',
          body: `# Five lines, once a week

Post this in **Wins & Check-ins** every week — same day, same time:

- **Training:** sessions done / planned
- **Sleep:** average hours, best night
- **Fuel:** one thing that went well
- **Win:** the moment you are proud of
- **Focus:** the one thing you will do better next week

# Why it works

Writing it down turns a vague week into data. Posting it adds a little healthy accountability. Reading other members' check-ins shows you what is possible.

# Keep it light

A check-in takes three minutes. Missed a week? Post the next one anyway. Consistency beats perfection every time.

**Your action:** choose your check-in day and post the first one.`,
        },
        {
          title: 'Setting a 90-day goal you will actually keep',
          body: `# Pick one outcome

Ninety days is long enough to change something real and short enough to stay focused. Choose **one** outcome, for example:

- Deadlift bodyweight for five clean reps
- Average seven and a half hours of sleep on weeknights
- Walk 8,000 steps a day, five days a week

# Turn it into weekly actions

An outcome is where you are going; actions are what you do on Tuesday. Write the two or three weekly actions that make the outcome inevitable.

# Make it visible

Add your goal to your profile bio and mention it in your next check-in. People can only cheer for goals they know about.

# Review every four weeks

At weeks 4, 8 and 12, ask: what is working, what is not, what is one adjustment? Then keep going.

**Your action:** write your 90-day goal and your weekly actions.`,
        },
      ],
    },
  ],
}

const foundations: StarterCourse = {
  slug: 'foundations',
  title: 'Foundations: Sleep, Training, Fuel',
  summary: 'The three pillars that move every other number. Practical, research-informed habits you can start tonight.',
  minTier: 'PLUS',
  sortOrder: 1,
  modules: [
    {
      title: 'Sleep',
      lessons: [
        {
          title: 'Why sleep is your first performance lever',
          body: `# The foundation under the foundation

Sleep is when your body consolidates training, your brain files the day, and appetite and mood reset. Most adults do best with seven to nine hours. Consistency matters as much as quantity.

# Three signs sleep is holding you back

- Training feels harder than the numbers say it should.
- Cravings spike in the afternoon.
- You need caffeine to feel normal, not just to feel sharp.

# The simplest upgrade

Pick a **fixed wake time** and keep it seven days a week, weekends included. A steady wake time anchors your body clock, and bedtime tends to follow.

**Your action:** set one wake time for the next 14 days and log how you feel each morning (1–5).`,
        },
        {
          title: 'Build a 45-minute wind-down',
          body: `# Three 15-minute blocks

**Block 1 — Close the day (T-45).** Write tomorrow's top three tasks. Lay out training clothes. Your brain lets go of what is written down.

**Block 2 — Lower the lights (T-30).** Dim overhead lights, switch to lamps, put the phone on a charger outside the bedroom or across the room.

**Block 3 — Cool and calm (T-15).** A warm shower, light stretching or a few pages of a paper book. Keep the bedroom cool, dark and quiet.

# Make it automatic

Set a daily alarm labelled "wind-down" at T-45. Repeat the same order every night until it runs on autopilot.

**Your action:** run the routine five nights this week and post how it went in Sleep & Recovery.`,
        },
        {
          title: 'Light, caffeine and timing',
          body: `# Morning light

Get outside within an hour of waking for 10 minutes — longer on cloudy days. Daylight helps set your body clock so sleepiness arrives on time at night.

# Evening light

Keep evenings dim. Bright overhead light and screens late at night push your clock later.

# Caffeine

Caffeine lingers for hours. A useful rule for most people: last coffee **eight to ten hours before bed**. If bedtime is 10:30 pm, finish by 1:00 pm.

# Meals and training

A large meal right before bed or a very hard session late in the evening can make it harder to fall asleep. Aim to finish dinner two to three hours before bed.

**Your action:** set your personal caffeine cut-off and keep it for two weeks.`,
        },
        {
          title: 'Reading your sleep data without obsessing',
          body: `# Useful numbers

If you wear a tracker, watch three things over **weekly averages**, not single nights:

- Total sleep time
- Consistency of bed and wake times
- Resting heart rate trend

# Numbers to hold lightly

Sleep-stage estimates vary night to night and between devices. Use them as a curiosity, not a verdict.

# The best metric is still you

Rate each morning 1–5: energy, mood, training readiness. When your ratings and your averages both improve, you are on the right track.

# When to change something

Change one variable at a time and give it two weeks: wake time, caffeine cut-off, wind-down, bedroom temperature.

**Your action:** start a simple weekly sleep log — average hours plus your morning ratings.`,
        },
      ],
    },
    {
      title: 'Training',
      lessons: [
        {
          title: 'The minimum effective week',
          body: `# The template

- **2–3 strength sessions** (full body, 45 minutes)
- **2 easy cardio sessions** (30–45 minutes at a conversational pace)
- **Daily movement** (a step target you can hit on a busy day)
- **1 full rest day**

# Why this works

Strength builds and keeps muscle. Easy cardio builds your aerobic engine. Daily movement keeps everything ticking between sessions. Rest is where adaptation happens.

# Fit it to your life

Busy week? Two strength sessions and your steps still count as a win. Consistency across months beats a heroic week followed by nothing.

**Your action:** put this week's sessions in your calendar like appointments.`,
        },
        {
          title: 'Progressive overload made simple',
          body: `# The principle

To keep improving, ask a little more of your body over time — more reps, more weight, more sets or better control.

# The double-progression method

1. Pick a rep range, for example **8–12**.
2. Start with a weight you can lift for 8 good reps.
3. Each session, try to add a rep.
4. When you hit 12 reps on every set, add the smallest weight step and start again at 8.

# Leave reps in the tank

Finish most sets feeling you could do one to three more good reps. Quality reps build strength; grinding ugly reps builds fatigue.

# Track it

Write every session down: exercise, weight, reps. Your log is your coach between check-ins.

**Your action:** choose three main lifts and log them for the next four weeks.`,
        },
        {
          title: 'Easy cardio and why the easy work matters',
          body: `# Conversational pace

Easy cardio means you can speak in full sentences. It can feel almost too easy — that is the point.

# What it builds

A bigger aerobic base helps you recover between sets, handle harder sessions and enjoy everyday activity — hikes, stairs, chasing kids.

# How to do it

- 2 sessions a week, 30–45 minutes
- Walk uphill, cycle, row, swim or jog — whatever you enjoy
- Keep the pace steady; if you cannot talk, slow down

# Pair it

Easy cardio stacks well with podcasts, a friend or the audiobook you keep meaning to finish.

**Your action:** schedule two easy sessions this week and do the talk test in each.`,
        },
        {
          title: 'Mobility in ten minutes',
          body: `# A daily reset

Run this short routine after training or on waking. Move slowly and breathe through the nose.

1. **Cat–cow** — 8 slow reps
2. **World's greatest stretch** — 4 per side
3. **90/90 hip switches** — 8 per side
4. **Thoracic rotations on all fours** — 6 per side
5. **Deep squat hold** — 45 seconds, hold a support if needed
6. **Doorway chest stretch** — 30 seconds per side

# Guidelines

Move within a comfortable range. Mobility should feel like opening up, never like forcing a position.

**Your action:** do the routine five days this week and note which move felt best.`,
        },
      ],
    },
    {
      title: 'Fuel',
      lessons: [
        {
          title: 'Protein first',
          body: `# Why protein leads

Protein supports muscle repair and keeps you full. Active adults commonly aim for roughly **1.2–2.0 grams per kilogram of bodyweight per day**, spread across meals. Your own needs may differ — a registered dietitian can personalise it.

# Make it easy

- Build every meal around a palm-to-two-palms portion of protein.
- Aim for three or four protein feedings a day.
- Keep easy options on hand: eggs, Greek yogurt, cottage cheese, chicken, fish, tofu, beans and lentils.

# A quick daily check

Count your protein portions, not grams. Three to four good portions a day is a strong start for most people.

**Your action:** for the next week, make sure every meal has a clear protein source.`,
        },
        {
          title: 'Build a performance plate',
          body: `# The plate

- **Half** — vegetables and fruit, as many colours as you can
- **Quarter** — protein
- **Quarter** — smart carbohydrates (potatoes, rice, oats, whole grains, beans)
- **A thumb** — healthy fats (olive oil, avocado, nuts)

# Adjust for training days

On harder training days, add a little more carbohydrate. On rest days, lean more on vegetables and protein.

# The 80/20 approach

Eat this way most of the time and enjoy the rest. Sustainable beats perfect.

**Your action:** photograph your lunch for five days and compare each plate with the template. Share your best one in Fuel & Nutrition.`,
        },
        {
          title: 'Hydration and electrolytes, without the hype',
          body: `# Simple targets

- Start the day with a large glass of water.
- Drink with every meal.
- Keep a bottle within reach while you work.
- Pale-yellow urine is a practical everyday check.

# Training days

Longer or sweatier sessions call for more fluid. For long sessions in the heat, many people feel better with some sodium alongside water — salty food works well too.

# Coffee and tea

They count toward your fluid intake for most people. Just keep your caffeine cut-off in mind for sleep.

**Your action:** carry a water bottle for a week and note any change in energy through the afternoon.`,
        },
        {
          title: 'Meal prep in 60 minutes a week',
          body: `# The Sunday hour

1. **Minutes 0–10** — Oven on. Tray of vegetables and a tray of potatoes or squash in.
2. **Minutes 10–25** — Cook a big batch of protein: chicken thighs, ground turkey, salmon or tofu.
3. **Minutes 25–40** — Pot of rice, quinoa or lentils. Boil a dozen eggs.
4. **Minutes 40–55** — Portion into containers: protein + carb + vegetables.
5. **Minutes 55–60** — Wash up and write the week's plan on the fridge.

# Keep it interesting

Same base, different sauces: salsa, pesto, teriyaki, tahini-lemon. Variety comes from flavour, not from cooking more.

**Your action:** run your first prep hour this weekend and post a photo.`,
        },
      ],
    },
  ],
}

const reset: StarterCourse = {
  slug: 'performance-reset',
  title: 'The 12-Week Performance Reset',
  summary: 'Three progressive four-week blocks, a simple habit scorecard and planned recovery. Built so you finish stronger than you started.',
  minTier: 'PREMIUM',
  sortOrder: 2,
  modules: [
    {
      title: 'Before you start',
      lessons: [
        {
          title: 'How the Reset works',
          body: `# Twelve weeks, three blocks

- **Block 1 — Build (weeks 1–4):** full-body strength three times a week, an easy-cardio base and your sleep routine.
- **Block 2 — Strength (weeks 5–8):** four-day upper/lower split, heavier work, fuel to match.
- **Block 3 — Perform (weeks 9–12):** intervals, heavier doubles and a retest.

Each block ends with a lighter **deload** week built in, so you recover and come back stronger.

# Your weekly commitment

Three to four training sessions, two easy cardio sessions, your daily scorecard and one check-in in the Premium Stacks Roundtable or Wins & Check-ins.

# Before you begin

If you have a medical condition, an injury or have been inactive for a while, check in with your healthcare provider before starting a new training program.

**Your action:** choose your start date — ideally a Monday — and put all twelve weeks in your calendar.`,
        },
        {
          title: 'Baseline week: measure what matters',
          body: `# Record these before week 1

**Recovery**
- Resting heart rate (average of three mornings)
- Average sleep hours over seven nights

**Movement**
- Average daily steps over seven days
- Time for a brisk 1-mile walk or run

**Strength** (choose what you can do with good form)
- Goblet squat: max reps with a moderate weight
- Push-ups: max reps with a straight body line
- Dead hang: max seconds

**Body**
- Waist measurement at the navel
- Front, side and back photos in the same light

# Why a baseline

At week 12 you retest the same way. Real before-and-after numbers make progress visible — and motivating.

**Your action:** fill in the baseline in your notes app and keep it private or share it in the Roundtable.`,
        },
        {
          title: 'Your habit scorecard',
          body: `# Five boxes a day

Tick each one you complete:

1. **Train or move** — your planned session or your step target
2. **Protein at every meal**
3. **Water bottle finished** by mid-afternoon
4. **Wind-down started** on time
5. **Ten minutes outside** in daylight

# Scoring

Five boxes, seven days: 35 points a week. Aim for **28+** (80%). A perfect week is not the goal; a steady one is.

# Review on Sunday

Look at which box you missed most. That box is next week's single focus.

**Your action:** set up your scorecard — a notes app, a paper grid on the fridge or a habit tracker — and start tomorrow.`,
        },
      ],
    },
    {
      title: 'Block 1 — Build (weeks 1–4)',
      lessons: [
        {
          title: 'The Build block plan',
          body: `# Three full-body sessions a week

Mon / Wed / Fri (or any three non-consecutive days):

1. Goblet squat — 3 × 8–12
2. Dumbbell Romanian deadlift — 3 × 8–12
3. Push-up or dumbbell bench press — 3 × 8–12
4. One-arm dumbbell row — 3 × 8–12 per side
5. Split squat — 2 × 8–10 per side
6. Plank — 3 × 30–45 seconds

Rest 60–90 seconds between sets. Use double progression: add reps until you hit the top of the range, then add weight.

# Week 4 is a deload

Keep the exercises, cut the sets in half and use the same weights. Arrive at Block 2 fresh.

**Your action:** log every set of week 1, then aim to beat one number each session.`,
        },
        {
          title: 'Building your aerobic base',
          body: `# Two easy sessions a week

30 minutes each in weeks 1–2, 40 minutes in week 3, back to 30 in the deload week.

# Keep it conversational

If you use a heart-rate monitor, stay at a pace where talking is comfortable. Without one, use the talk test.

# Choose your mode

Brisk incline walk, bike, rower, swim or easy jog. Pick the one you will actually do. Outdoors counts double for mood and daylight.

# Stack the habit

Easy cardio in the morning also ticks your "ten minutes outside" box on the scorecard.

**Your action:** schedule both sessions for weeks 1–4 now.`,
        },
        {
          title: 'Week 4 check-in and deload',
          body: `# Check in

Answer these in the Roundtable or in Wins & Check-ins:

1. Scorecard average for weeks 1–3
2. One lift that improved, and by how much
3. Sleep average compared with your baseline
4. The box you missed most — and your plan for it

# Deload well

- Half the sets, same weights
- Keep your easy cardio short and genuinely easy
- Extra sleep if you can get it
- Spend ten minutes on the mobility routine daily

# Why deloads work

Lighter weeks let your body absorb the work of the last three. You come back to Block 2 ready to push.

**Your action:** post your week 4 check-in.`,
        },
      ],
    },
    {
      title: 'Block 2 — Strength (weeks 5–8)',
      lessons: [
        {
          title: 'Upper / lower, four days',
          body: `# The split

**Upper A** — Bench press or dumbbell press 4 × 6–8 · Row 4 × 8–10 · Overhead press 3 × 8–10 · Pull-up or pulldown 3 × 8–10 · Curls + triceps 2 × 12

**Lower A** — Squat variation 4 × 6–8 · Romanian deadlift 3 × 8–10 · Walking lunge 3 × 10 per side · Calf raise 3 × 12 · Side plank 3 × 30 s

**Upper B / Lower B** — same patterns, swap variations: incline press, chest-supported row, trap-bar deadlift, step-ups.

# Schedule

Mon Upper A · Tue Lower A · Thu Upper B · Fri Lower B. Easy cardio on Wednesday and Saturday.

# Week 8 is a deload

Half the sets, same weights.

**Your action:** set up your log for the new split and record week 5 starting weights.`,
        },
        {
          title: 'Pushing intensity with good judgement (RPE)',
          body: `# Rate of perceived exertion

Rate every hard set from 1 to 10, where 10 means you could not do another rep:

- **RPE 7** — three reps left in the tank
- **RPE 8** — two reps left
- **RPE 9** — one rep left

# Block 2 targets

Main lifts at **RPE 7–8**, accessories at **RPE 8**. Save RPE 9 for the final set of the week on a lift you feel great on.

# Signals to back off

Form breaking down, sharp pain, or a session where everything feels heavy after a poor night's sleep. On those days, drop a set or reduce the weight 10% and call it a win.

**Your action:** add an RPE column to your training log this week.`,
        },
        {
          title: 'Fuelling harder training',
          body: `# More work, more fuel

Four strength days plus easy cardio is a real step up. Most people train better with:

- **Protein** at every meal, as in Foundations
- **Carbohydrate before training** — a banana, oats or rice two to three hours before, or a small snack one hour before
- **A post-training meal** within a couple of hours: protein plus carbohydrate

# Watch the trends

If strength stalls and sleep and energy dip, look at food first. Under-eating is a common reason progress stalls in a harder block.

# Keep the plate

Half plants, quarter protein, quarter smart carbohydrate — with a bigger carb quarter on heavy days.

**Your action:** plan your pre- and post-training meals for the four lifting days.`,
        },
      ],
    },
    {
      title: 'Block 3 — Perform (weeks 9–12)',
      lessons: [
        {
          title: 'The Perform block',
          body: `# What changes

- Main lifts move to **heavier doubles and triples** at RPE 8 (e.g. 5 × 3), keeping your accessories.
- One easy cardio session becomes **intervals**: after a 10-minute warm-up, 6 × 1 minute hard / 2 minutes easy, then cool down.
- The other stays easy and conversational.

# Weekly layout

Mon Upper · Tue Lower · Wed Intervals · Thu Upper · Fri Lower · Sat Easy cardio · Sun Rest

# Recovery is part of the plan

Protect your wind-down and your scorecard. The harder the training, the more the basics matter.

# Week 11 is a lighter week

Cut volume by half so you arrive at retest week fresh.

**Your action:** book your week 12 retest day in your calendar now.`,
        },
        {
          title: 'Retest and compare',
          body: `# Retest exactly like the baseline

Same time of day, same order, same equipment, same form standards:

- Resting heart rate and seven-day sleep average
- Seven-day step average and your 1-mile time
- Goblet squat reps, push-up reps, dead-hang time
- Waist measurement and photos

# Read the results

Put baseline and week 12 side by side. Celebrate every improvement — and notice the numbers that held steady during a demanding block, which is also a win.

# Share it

Post your before-and-after numbers in the Premium Stacks Roundtable or Wins & Check-ins. Your results show the next member what is possible.

**Your action:** complete your retest and post your comparison.`,
        },
        {
          title: 'Life after the Reset',
          body: `# Keep most of the gains with far less effort

Once you have built a base, a lighter maintenance week keeps most of it:

- **2 strength sessions** — full body, main lifts at RPE 7–8
- **1–2 easy cardio sessions**
- **Daily steps**, your wind-down and protein at every meal

# Plan your next 90 days

Pick a new single outcome using the Orientation lesson on 90-day goals. Some members run the Reset again with heavier baselines; others train for an event.

# Stay in the room

Keep posting your weekly check-in. The Clubhouse is where the next level starts.

**Your action:** write your maintenance week and your next 90-day goal.`,
        },
      ],
    },
  ],
}

export const COURSES: StarterCourse[] = [orientation, foundations, reset]
