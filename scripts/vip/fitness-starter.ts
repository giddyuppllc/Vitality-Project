/**
 * OPTIONAL starter exercises for the clubhouse exercise library — FOR JAMES /
 * THE COACHING TEAM TO REVIEW BEFORE ANY PRODUCTION RUN.
 *
 * Standard, generic gym movements with short, factual how-to steps. No
 * programs, no claims, no compound or medical content. Videos and images are
 * left empty for the coaches to add (any YouTube/Vimeo link works).
 */

export interface StarterExercise {
  slug: string
  name: string
  muscleGroups: string[]
  equipment: string[]
  measure: 'WEIGHT_REPS' | 'REPS' | 'TIME'
  instructions: string
}

export const STARTER_EXERCISES: StarterExercise[] = [
  {
    slug: 'back-squat',
    name: 'Back Squat',
    muscleGroups: ['Quads', 'Glutes', 'Core'],
    equipment: ['Barbell', 'Rack'],
    measure: 'WEIGHT_REPS',
    instructions:
      '1. Set the bar at mid-chest height and rest it across your upper back.\n2. Stand with feet about shoulder width, toes turned out slightly.\n3. Brace your trunk, then sit down between your hips until your thighs are at least parallel.\n4. Drive up through the whole foot, keeping your chest up and knees tracking over your toes.',
  },
  {
    slug: 'goblet-squat',
    name: 'Goblet Squat',
    muscleGroups: ['Quads', 'Glutes'],
    equipment: ['Dumbbell', 'Kettlebell'],
    measure: 'WEIGHT_REPS',
    instructions:
      '1. Hold one dumbbell or kettlebell at your chest, elbows pointing down.\n2. Squat down between your heels, keeping the weight close and your chest tall.\n3. Pause at the bottom, then stand up by pushing the floor away.',
  },
  {
    slug: 'romanian-deadlift',
    name: 'Romanian Deadlift',
    muscleGroups: ['Hamstrings', 'Glutes', 'Back'],
    equipment: ['Barbell', 'Dumbbell'],
    measure: 'WEIGHT_REPS',
    instructions:
      '1. Stand tall holding the weight in front of your thighs.\n2. With a soft bend in the knees, push your hips back and slide the weight down your legs.\n3. Keep your back flat; stop when you feel a strong stretch in the hamstrings.\n4. Squeeze your glutes to return to standing.',
  },
  {
    slug: 'conventional-deadlift',
    name: 'Deadlift',
    muscleGroups: ['Hamstrings', 'Glutes', 'Back'],
    equipment: ['Barbell'],
    measure: 'WEIGHT_REPS',
    instructions:
      '1. Stand with the bar over mid-foot, feet about hip width.\n2. Hinge down and grip the bar just outside your legs.\n3. Pull your chest up and your back flat, take the slack out of the bar.\n4. Push the floor away and stand tall, keeping the bar close. Lower it under control.',
  },
  {
    slug: 'bench-press',
    name: 'Bench Press',
    muscleGroups: ['Chest', 'Triceps', 'Shoulders'],
    equipment: ['Barbell', 'Bench'],
    measure: 'WEIGHT_REPS',
    instructions:
      '1. Lie on the bench with eyes under the bar and feet flat.\n2. Grip slightly wider than shoulder width and set your shoulder blades back and down.\n3. Lower the bar to your mid-chest with elbows at roughly 45 degrees.\n4. Press back up over your shoulders. Use a spotter or safety arms for heavy sets.',
  },
  {
    slug: 'dumbbell-bench-press',
    name: 'Dumbbell Bench Press',
    muscleGroups: ['Chest', 'Triceps', 'Shoulders'],
    equipment: ['Dumbbell', 'Bench'],
    measure: 'WEIGHT_REPS',
    instructions:
      '1. Lie back with a dumbbell in each hand over your chest.\n2. Lower them to the sides of your chest, elbows slightly tucked.\n3. Press up until your arms are straight without clanking the dumbbells together.',
  },
  {
    slug: 'overhead-press',
    name: 'Overhead Press',
    muscleGroups: ['Shoulders', 'Triceps', 'Core'],
    equipment: ['Barbell'],
    measure: 'WEIGHT_REPS',
    instructions:
      '1. Start with the bar on the front of your shoulders, grip just outside shoulder width.\n2. Squeeze your glutes and brace your trunk.\n3. Press the bar straight up, moving your head back slightly so the bar passes your face.\n4. Finish with the bar over the middle of your head and lower under control.',
  },
  {
    slug: 'push-up',
    name: 'Push-up',
    muscleGroups: ['Chest', 'Triceps', 'Core'],
    equipment: ['Bodyweight'],
    measure: 'REPS',
    instructions:
      '1. Hands slightly wider than shoulders, body in one straight line from head to heels.\n2. Lower your chest toward the floor with elbows at roughly 45 degrees.\n3. Push back up without letting your hips sag. Elevate your hands on a bench to make it easier.',
  },
  {
    slug: 'pull-up',
    name: 'Pull-up',
    muscleGroups: ['Back', 'Biceps'],
    equipment: ['Pull-up Bar'],
    measure: 'REPS',
    instructions:
      '1. Hang from the bar with an overhand grip a little wider than your shoulders.\n2. Pull your shoulder blades down, then pull until your chin clears the bar.\n3. Lower all the way down under control. Use a band or the assisted machine to build up.',
  },
  {
    slug: 'lat-pulldown',
    name: 'Lat Pulldown',
    muscleGroups: ['Back', 'Biceps'],
    equipment: ['Cable Machine'],
    measure: 'WEIGHT_REPS',
    instructions:
      '1. Sit with thighs under the pads and grip the bar a little wider than your shoulders.\n2. Lean back slightly and pull the bar to your upper chest, leading with your elbows.\n3. Let it rise slowly until your arms are straight.',
  },
  {
    slug: 'bent-over-row',
    name: 'Bent-over Row',
    muscleGroups: ['Back', 'Biceps'],
    equipment: ['Barbell', 'Dumbbell'],
    measure: 'WEIGHT_REPS',
    instructions:
      '1. Hinge forward with a flat back until your torso is at roughly 45 degrees.\n2. Pull the weight toward your lower ribs, squeezing your shoulder blades together.\n3. Lower it until your arms are straight, keeping your back still.',
  },
  {
    slug: 'seated-cable-row',
    name: 'Seated Cable Row',
    muscleGroups: ['Back', 'Biceps'],
    equipment: ['Cable Machine'],
    measure: 'WEIGHT_REPS',
    instructions:
      '1. Sit tall with a slight bend in the knees and hold the handle with arms straight.\n2. Pull the handle to your stomach, keeping your chest up.\n3. Return slowly, letting your shoulders reach forward at the end.',
  },
  {
    slug: 'walking-lunge',
    name: 'Walking Lunge',
    muscleGroups: ['Quads', 'Glutes'],
    equipment: ['Bodyweight', 'Dumbbell'],
    measure: 'REPS',
    instructions:
      '1. Step forward into a long stride and lower until both knees are bent to about 90 degrees.\n2. Push through the front foot to bring the back leg through into the next step.\n3. Count each leg as one rep. Hold dumbbells at your sides to add load.',
  },
  {
    slug: 'hip-thrust',
    name: 'Hip Thrust',
    muscleGroups: ['Glutes', 'Hamstrings'],
    equipment: ['Barbell', 'Bench'],
    measure: 'WEIGHT_REPS',
    instructions:
      '1. Sit with your upper back against a bench and the bar (padded) across your hips.\n2. Plant your feet so your shins are vertical at the top.\n3. Drive your hips up until your body is level from shoulders to knees, squeeze, then lower.',
  },
  {
    slug: 'leg-press',
    name: 'Leg Press',
    muscleGroups: ['Quads', 'Glutes'],
    equipment: ['Machine'],
    measure: 'WEIGHT_REPS',
    instructions:
      '1. Sit back in the machine with feet shoulder width on the platform.\n2. Release the safeties and lower the platform until your knees are bent to about 90 degrees.\n3. Press back up without locking your knees hard at the top.',
  },
  {
    slug: 'dumbbell-curl',
    name: 'Dumbbell Curl',
    muscleGroups: ['Biceps'],
    equipment: ['Dumbbell'],
    measure: 'WEIGHT_REPS',
    instructions: '1. Stand tall with a dumbbell in each hand, palms forward.\n2. Curl the weights up without swinging your elbows forward.\n3. Lower slowly all the way down.',
  },
  {
    slug: 'triceps-pushdown',
    name: 'Triceps Pushdown',
    muscleGroups: ['Triceps'],
    equipment: ['Cable Machine'],
    measure: 'WEIGHT_REPS',
    instructions: '1. Face the cable with elbows pinned to your sides.\n2. Push the handle down until your arms are straight.\n3. Let it rise until your forearms are just above parallel, keeping elbows still.',
  },
  {
    slug: 'plank',
    name: 'Plank',
    muscleGroups: ['Core'],
    equipment: ['Bodyweight'],
    measure: 'TIME',
    instructions: '1. Forearms on the floor, elbows under shoulders, legs straight.\n2. Squeeze your glutes and brace as if about to be poked in the stomach.\n3. Hold a straight line from head to heels; stop when your hips start to sag.',
  },
  {
    slug: 'side-plank',
    name: 'Side Plank',
    muscleGroups: ['Core'],
    equipment: ['Bodyweight'],
    measure: 'TIME',
    instructions: '1. Lie on your side with your elbow under your shoulder and feet stacked.\n2. Lift your hips so your body forms a straight line.\n3. Hold, then switch sides. Log each side as its own set.',
  },
  {
    slug: 'farmers-carry',
    name: "Farmer's Carry",
    muscleGroups: ['Grip', 'Core', 'Shoulders'],
    equipment: ['Dumbbell', 'Kettlebell'],
    measure: 'TIME',
    instructions: '1. Pick up a heavy weight in each hand with a neutral grip.\n2. Stand tall, shoulders down, and walk with short, controlled steps.\n3. Log the time you carried before setting the weights down.',
  },
  {
    slug: 'kettlebell-swing',
    name: 'Kettlebell Swing',
    muscleGroups: ['Glutes', 'Hamstrings', 'Core'],
    equipment: ['Kettlebell'],
    measure: 'WEIGHT_REPS',
    instructions:
      '1. Stand with the kettlebell a foot in front of you, hinge and grip it with both hands.\n2. Hike it back between your legs, then snap your hips forward to float it to chest height.\n3. Let it fall back into the next hinge. The power comes from the hips, not the arms.',
  },
  {
    slug: 'rowing-machine',
    name: 'Rowing Machine',
    muscleGroups: ['Conditioning', 'Back', 'Legs'],
    equipment: ['Rower'],
    measure: 'TIME',
    instructions: '1. Push with the legs first, then lean back slightly, then pull the handle to your lower ribs.\n2. Return in reverse: arms, body, then legs.\n3. Log each interval or steady piece as one timed set.',
  },
]
