// Emotion vocabulary, arranged like the Mood Meter (Yale RULER): pleasantness × energy.
// Each word: [word, short definition, pleasantness 1–5, energy 1–5] (magnitudes within its zone).
// Precise words + definitions train emotional granularity; naming them is affect labelling.

export const ZONES = {
  hu: { name: 'Unpleasant · high energy', short: 'Tense', sample: 'Stressed, angry, anxious…', color: 'var(--q-red)', p: -1, e: 1 },
  hp: { name: 'Pleasant · high energy', short: 'Charged', sample: 'Excited, happy, inspired…', color: 'var(--q-yellow)', p: 1, e: 1 },
  lu: { name: 'Unpleasant · low energy', short: 'Low', sample: 'Sad, tired, lonely…', color: 'var(--q-blue)', p: -1, e: -1 },
  lp: { name: 'Pleasant · low energy', short: 'Calm', sample: 'Calm, content, grateful…', color: 'var(--q-green)', p: 1, e: -1 },
};
// grid order on screen: energy on top, pleasant on the right
export const ZONE_ORDER = ['hu', 'hp', 'lu', 'lp'];

export const FAMILIES = [
  { zone: 'hu', name: 'Anger', words: [
    ['irritated', 'Mildly bothered by something small and repeated', 2, 2],
    ['annoyed', 'Bothered; something is getting on your nerves', 2, 2],
    ['frustrated', 'Blocked from something you want or expect', 3, 3],
    ['impatient', 'Wanting things to happen sooner than they are', 2, 3],
    ['resentful', 'Lingering anger about being treated unfairly', 4, 2],
    ['bitter', 'Hardened, sour anger after a hurt or loss', 4, 2],
    ['indignant', 'Angry at something you see as unjust', 3, 4],
    ['defensive', 'Guarding yourself against criticism or attack', 3, 3],
    ['hostile', 'Unfriendly and ready for conflict', 4, 4],
    ['furious', 'Intense, hot anger', 5, 5],
    ['enraged', 'Anger so strong it is hard to contain', 5, 5],
  ] },
  { zone: 'hu', name: 'Fear & worry', words: [
    ['uneasy', 'A vague sense that something is off', 2, 2],
    ['nervous', 'Jittery about something coming up', 2, 3],
    ['worried', 'Your mind keeps going back to what could go wrong', 3, 3],
    ['anxious', 'Uneasy anticipation of a threat that may or may not come', 3, 4],
    ['tense', 'Tight and braced in body or mind', 3, 3],
    ['restless', 'Unable to settle or stay still', 2, 4],
    ['on edge', 'Easily startled or set off', 3, 4],
    ['pressured', 'Pushed by expectations or deadlines', 3, 4],
    ['stressed', 'Demands feel bigger than your resources right now', 3, 4],
    ['overwhelmed', 'More than you can handle at once', 4, 4],
    ['scared', 'Afraid of a specific danger', 4, 4],
    ['panicked', 'Sudden, intense fear that floods thinking', 5, 5],
  ] },
  { zone: 'hu', name: 'Self-conscious', words: [
    ['awkward', 'Unsure how to act; out of step', 2, 2],
    ['self-conscious', 'Overly aware of how others see you', 2, 3],
    ['embarrassed', 'Exposed after a slip in front of others', 3, 3],
    ['insecure', 'Doubting you are enough or that you belong', 3, 2],
    ['jealous', 'Afraid of losing someone or something to another person', 4, 4],
    ['envious', 'Wanting what someone else has', 3, 3],
    ['humiliated', 'Painfully lowered in front of others', 5, 4],
  ] },
  { zone: 'hu', name: 'Aversion & shock', words: [
    ['disgusted', 'Repelled by something offensive or gross', 4, 3],
    ['contemptuous', 'Looking down on someone as beneath you', 3, 3],
    ['conflicted', 'Pulled in two directions at once', 2, 3],
    ['confused', 'Unable to make sense of what is happening', 2, 2],
    ['shocked', 'Jolted by something unexpected and bad', 4, 5],
    ['agitated', 'Stirred up, unsettled and on the move inside', 3, 4],
  ] },
  { zone: 'hp', name: 'Joy', words: [
    ['pleased', 'Quietly glad about how something went', 2, 2],
    ['cheerful', 'Light, upbeat and friendly', 3, 3],
    ['happy', 'Glad and good', 3, 3],
    ['delighted', 'Very pleased, with a spark of surprise', 4, 4],
    ['joyful', 'Full of warm, bright happiness', 4, 4],
    ['amused', 'Finding something funny', 3, 3],
    ['playful', 'Light-hearted and up for fun', 3, 4],
    ['elated', 'Lifted high by good news or success', 5, 5],
    ['ecstatic', 'Overflowing with joy', 5, 5],
  ] },
  { zone: 'hp', name: 'Drive', words: [
    ['motivated', 'Moved to act toward a goal', 3, 3],
    ['determined', 'Set on doing something despite obstacles', 3, 4],
    ['focused', 'Attention gathered on one thing', 3, 3],
    ['productive', 'Getting meaningful things done', 3, 3],
    ['energized', 'Full of usable energy', 3, 4],
    ['eager', 'Keen to start or to get something', 3, 4],
    ['enthusiastic', 'Excited interest that wants to share itself', 4, 4],
    ['excited', 'Charged up about something good coming', 4, 5],
    ['inspired', 'Filled with new ideas or a sense of possibility', 4, 4],
    ['empowered', 'Feeling able to act and make a difference', 4, 4],
    ['triumphant', 'Victorious after effort', 5, 5],
  ] },
  { zone: 'hp', name: 'Confidence', words: [
    ['confident', 'Trusting your ability to handle this', 3, 3],
    ['proud', 'Pleased with what you did or who you are', 4, 3],
    ['bold', 'Ready to take a risk', 3, 4],
    ['hopeful', 'Expecting something good to come', 3, 2],
    ['optimistic', 'Seeing the likely outcome as good', 3, 3],
    ['alive', 'Vivid and fully present', 4, 4],
  ] },
  { zone: 'hp', name: 'Wonder', words: [
    ['curious', 'Wanting to know or explore more', 2, 3],
    ['interested', 'Your attention is drawn and held', 2, 2],
    ['fascinated', 'Completely absorbed by something', 3, 4],
    ['surprised', 'Caught off guard in a good way', 3, 4],
    ['amazed', 'Struck by something remarkable', 4, 4],
    ['awed', 'Small before something vast or beautiful', 4, 3],
  ] },
  { zone: 'hp', name: 'Desire & connection', words: [
    ['flirty', 'Playfully drawn to someone', 3, 3],
    ['attracted', 'Pulled toward someone', 3, 3],
    ['aroused', 'Sexually or physically stirred', 3, 4],
    ['lustful', 'Strong sexual desire', 3, 5],
    ['passionate', 'Intense feeling for someone or something', 4, 5],
    ['adoring', 'Full of warm admiration and love', 4, 3],
  ] },
  { zone: 'lu', name: 'Sadness', words: [
    ['down', 'A little low; spark dimmed', 2, 2],
    ['disappointed', 'Something fell short of what you hoped', 2, 2],
    ['sad', 'Heavy-hearted about a loss or letdown', 3, 2],
    ['melancholy', 'A soft, lingering sadness', 3, 1],
    ['wistful', 'Gently longing for something past or out of reach', 2, 1],
    ['nostalgic', 'Bittersweet warmth for the past', 1, 1],
    ['hurt', 'Wounded by what someone said or did', 3, 2],
    ['heartbroken', 'Deep pain after losing love or hope', 5, 2],
    ['grieving', 'Mourning a loss', 5, 1],
  ] },
  { zone: 'lu', name: 'Disconnection', words: [
    ['lonely', 'Wanting connection you are not getting', 3, 2],
    ['left out', 'Not included when others are', 3, 2],
    ['rejected', 'Pushed away or not chosen', 4, 2],
    ['misunderstood', 'Not seen for who you are or what you meant', 3, 2],
    ['invisible', 'Unnoticed, as if you do not count', 3, 1],
    ['disconnected', 'Cut off from others or yourself', 3, 1],
    ['homesick', 'Missing home or familiar people', 2, 1],
  ] },
  { zone: 'lu', name: 'Depletion', words: [
    ['tired', 'Low on energy', 1, 1],
    ['drained', 'Emptied out by people or demands', 2, 1],
    ['exhausted', 'Completely out of energy', 3, 1],
    ['burned out', 'Worn down by long, unrelenting stress', 4, 1],
    ['bored', 'Unengaged; wanting stimulation', 1, 2],
    ['apathetic', 'Not caring either way', 2, 1],
    ['numb', 'Feeling little or nothing', 3, 1],
    ['empty', 'A hollow absence of feeling or meaning', 4, 1],
  ] },
  { zone: 'lu', name: 'Self-blame', words: [
    ['regretful', 'Wishing you had acted differently', 2, 2],
    ['guilty', 'You acted against your own values', 3, 2],
    ['remorseful', 'Deep regret for harm you caused', 4, 2],
    ['ashamed', 'Feeling that you are bad, not just what you did', 4, 1],
    ['inadequate', 'Not good enough for what is asked', 3, 2],
  ] },
  { zone: 'lu', name: 'Powerlessness', words: [
    ['discouraged', 'Losing confidence after setbacks', 2, 2],
    ['resigned', 'Accepting something bad as unchangeable', 2, 1],
    ['stuck', 'Unable to move forward', 3, 2],
    ['helpless', 'Unable to help yourself or change things', 4, 1],
    ['powerless', 'Without influence over what happens', 4, 2],
    ['hopeless', 'Believing things will not get better', 5, 1],
    ['despairing', 'Complete loss of hope', 5, 1],
  ] },
  { zone: 'lp', name: 'Peace', words: [
    ['calm', 'Settled and steady', 3, 2],
    ['relaxed', 'Free of tension', 3, 1],
    ['at ease', 'Comfortable with yourself and the situation', 3, 2],
    ['peaceful', 'Quiet and undisturbed inside', 4, 1],
    ['serene', 'Deeply calm and clear', 4, 1],
    ['mellow', 'Easygoing and soft', 2, 1],
    ['carefree', 'Without worries for now', 3, 2],
    ['sleepy', 'Pleasantly ready for rest', 1, 1],
    ['rested', 'Restored after sleep or a break', 3, 2],
    ['relieved', 'A weight lifted after worry or strain', 3, 2],
  ] },
  { zone: 'lp', name: 'Contentment', words: [
    ['content', 'Satisfied with how things are', 3, 2],
    ['satisfied', 'Your needs or efforts paid off', 3, 2],
    ['fulfilled', 'Living in line with what matters to you', 4, 2],
    ['comfortable', 'Physically and emotionally at ease', 2, 1],
    ['cozy', 'Warm, safe and snug', 3, 1],
    ['grounded', 'Rooted and stable in yourself', 3, 2],
    ['balanced', 'Things are in proportion', 3, 2],
    ['reflective', 'Thoughtfully looking inward', 2, 1],
  ] },
  { zone: 'lp', name: 'Warmth', words: [
    ['grateful', 'Thankful for something received', 4, 2],
    ['appreciated', 'Seen and valued by others', 3, 2],
    ['loved', 'Cared for and held in someone’s heart', 4, 2],
    ['loving', 'Warm care flowing toward someone', 4, 2],
    ['tender', 'Soft, gentle affection', 3, 1],
    ['connected', 'Close and in tune with someone', 4, 2],
    ['safe', 'Protected; no threat around', 3, 1],
    ['accepted', 'Welcomed as you are', 3, 2],
    ['compassionate', 'Moved to ease someone’s suffering, including your own', 3, 2],
  ] },
];

// word -> { word, def, zone, family, x, y } with x/y on −5..5 (pleasantness, energy)
export const VOCAB = new Map();
for (const f of FAMILIES) for (const [word, def, p, e] of f.words) {
  const z = ZONES[f.zone];
  VOCAB.set(word, { word, def, zone: f.zone, family: f.name, x: z.p * p, y: z.e * e });
}

// Words that, at strong intensity, deserve a gentle check that support is near
export const HEAVY = new Set(['hopeless', 'despairing', 'empty', 'helpless', 'numb', 'ashamed', 'heartbroken', 'grieving']);

export const NEEDS = ['Rest', 'Movement', 'Food', 'Water', 'Sunlight', 'Connection', 'Space', 'Comfort', 'Play', 'Focus', 'To express it', 'Nothing'];

// One small, evidence-informed next step per zone
export const NEXT_STEP = {
  hu: { title: 'Settle the body first', text: 'Try a physiological sigh: two short inhales through the nose, one long exhale through the mouth. Repeat three times, then ask what is in your control right now.' },
  lu: { title: 'One tiny, kind action', text: 'Low states lift through small actions, not waiting. Pick one: a glass of water, five minutes outside, a stretch, or a message to someone you like.' },
  hp: { title: 'Use the energy', text: 'Point this energy at something that matters, like your One Thing, or share the good news with someone.' },
  lp: { title: 'Savor it', text: 'Take twenty seconds to notice where you feel this in your body. Savoring pleasant moments helps them last and come back more easily.' },
};
