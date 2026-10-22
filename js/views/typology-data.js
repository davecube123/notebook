// Content for the Personality tab: definitions, guided tests and "how to relate" advice.
// Sources are listed in the tab itself (typology.js).

// ---------- Big Five ----------
// ---------- Big Five ----------
export const TRAITS = [
  { k: 'O', name: 'Openness', what: 'Curiosity, imagination, and appetite for new ideas, art and experiences.',
    high: 'curious, imaginative, unconventional; loves ideas, art and novelty', low: 'practical and down-to-earth; prefers the familiar and proven',
    look: 'Easy to read from what they talk about, read, watch and try. Others often judge it as well as people judge themselves.' },
  { k: 'C', name: 'Conscientiousness', what: 'Organisation, reliability, self-discipline and planning.',
    high: 'organised, punctual, follows through, plans ahead', low: 'spontaneous and flexible; messy, late or leaves things unfinished',
    look: 'Watch punctuality, how they keep small promises, and the state of their space and work.' },
  { k: 'E', name: 'Extraversion', what: 'Energy from people and activity: talkativeness, assertiveness, enthusiasm.',
    high: 'outgoing, talkative, energised by groups, quick to speak up', low: 'reserved, quieter, recharges alone, thinks before speaking',
    look: 'The easiest trait to judge, even after a short meeting.' },
  { k: 'A', name: 'Agreeableness', what: 'Warmth, trust, cooperation and consideration for others.',
    high: 'kind, accommodating, trusting; avoids conflict', low: 'blunt, sceptical, competitive; comfortable with conflict',
    look: 'Watch how they treat people who can do nothing for them, and how they handle disagreement.' },
  { k: 'N', name: 'Emotional sensitivity', alt: 'Neuroticism', what: 'How strongly they react to stress: worry, moodiness, feeling things hard.',
    high: 'worries, moody, stress hits hard and lingers', low: 'calm, even-tempered, bounces back quickly',
    look: 'The hardest to see from outside, because people hide inner distress. Rate it after you have seen them under pressure.' },
];
export const LEVEL = ['', 'Very low', 'Low', 'Average', 'High', 'Very high'];

// earlier versions stored 0–100 sliders
export const traitsOf = p => {
  if (p.traits) return p.traits;
  const old = p.big5 || {};
  return Object.fromEntries(Object.entries(old).filter(([, v]) => v != null).map(([k, v]) => [k, Math.min(5, Math.max(1, Math.round(v / 25) + 1))]));
};

// ---------- Keirsey temperament (Please Understand Me II) ----------
export const TEMPERAMENTS = {
  SP: { name: 'Artisan', words: 'Concrete', tools: 'Utilitarian', core: 'Freedom to act and to make an impact. Lives in the moment; excels at tactics, reading a situation and improvising.', needs: 'freedom, stimulation, skilful action', stress: 'boredom, rules for their own sake, being tied down' },
  SJ: { name: 'Guardian', words: 'Concrete', tools: 'Cooperative', core: 'Security and belonging. Values duty, responsibility and tradition; excels at logistics, getting the right things to the right place.', needs: 'membership, responsibility, stability', stress: 'chaos, rule-breaking, people not pulling their weight' },
  NF: { name: 'Idealist', words: 'Abstract', tools: 'Cooperative', core: 'Meaning, identity and authentic connection. Excels at diplomacy, helping people grow and get along.', needs: 'significance, being truly known, harmony', stress: 'insincerity, conflict, feeling unseen' },
  NT: { name: 'Rational', words: 'Abstract', tools: 'Utilitarian', core: 'Mastery and understanding. Values logic and competence; excels at strategy, analysis and long-range planning.', needs: 'competence, autonomy, knowledge', stress: 'incompetence, illogic, being controlled' },
};
// [code, temperament, role (directive/informative), variant name, one-liner]
export const VARIANTS = [
  ['ESTP', 'SP', 'Operator', 'Promoter', 'Bold, persuasive deal-maker who thrives on action and risk.'],
  ['ISTP', 'SP', 'Operator', 'Crafter', 'Cool, hands-on master of tools and machines; acts fast when it counts.'],
  ['ESFP', 'SP', 'Entertainer', 'Performer', 'Warm, playful entertainer who lights up the room.'],
  ['ISFP', 'SP', 'Entertainer', 'Composer', 'Quiet artist tuned to the senses; expresses through craft, music or art.'],
  ['ESTJ', 'SJ', 'Administrator', 'Supervisor', 'Organises people and makes sure the rules are followed.'],
  ['ISTJ', 'SJ', 'Administrator', 'Inspector', 'Thorough and careful; checks that things are done properly and on time.'],
  ['ESFJ', 'SJ', 'Conservator', 'Provider', 'Hospitable social glue who takes care of everyone’s needs.'],
  ['ISFJ', 'SJ', 'Conservator', 'Protector', 'Loyal, quiet helper who shields and serves others.'],
  ['ENFJ', 'NF', 'Mentor', 'Teacher', 'Inspires and develops people; leads groups toward growth.'],
  ['INFJ', 'NF', 'Mentor', 'Counselor', 'Insightful guide who helps individuals find their path.'],
  ['ENFP', 'NF', 'Advocate', 'Champion', 'Enthusiastic messenger of causes, people and possibilities.'],
  ['INFP', 'NF', 'Advocate', 'Healer', 'Gentle idealist who seeks inner harmony and to mend what is broken.'],
  ['ENTJ', 'NT', 'Coordinator', 'Fieldmarshal', 'Mobilises people and resources toward long-range goals.'],
  ['INTJ', 'NT', 'Coordinator', 'Mastermind', 'Strategic planner who designs systems and contingencies.'],
  ['ENTP', 'NT', 'Engineer', 'Inventor', 'Ingenious improviser of new devices, ideas and solutions.'],
  ['INTP', 'NT', 'Engineer', 'Architect', 'Designs theories, models and structures; seeks logical coherence.'],
];
export const DIRECTIVE = ['Operator', 'Administrator', 'Mentor', 'Coordinator'];
// Keirsey's own questions: words, tools, directive/informative role, expressive/reserved
export const QUESTIONS = [
  { id: 'words', q: 'When they talk, what do they mostly talk about?', why: 'Keirsey’s first split: “words” reveal whether attention goes to the observable world or to ideas.',
    a: ['concrete', 'Concrete', 'Things, people, events, practical facts: what happened, who did what, what to do next.'],
    b: ['abstract', 'Abstract', 'Ideas, theories, possibilities, meanings: what it means, what could be, why.'] },
  { id: 'tools', q: 'When they go after what they want, what comes first?', why: 'The second split: “tools”, how they choose the means to an end.',
    a: ['cooperative', 'Cooperative', 'Doing it the right, accepted way: agreements, rules, what others will approve of.'],
    b: ['utilitarian', 'Utilitarian', 'Doing what works, even if it is unconventional or not approved.'] },
  { id: 'role', q: 'With others, do they tend to direct or to inform?', why: 'Splits each temperament into two roles.',
    a: ['directive', 'Directive', 'Takes charge: tells people what to do, decides, gives instructions.'],
    b: ['informative', 'Informative', 'Offers information and options; lets others decide; responds rather than commands.'] },
  { id: 'social', q: 'Are they more expressive or reserved?', why: 'Splits each role into its two variants (E or I).',
    a: ['expressive', 'Expressive', 'Outgoing, speaks up readily, energised by groups.'],
    b: ['reserved', 'Reserved', 'Holds back and observes first, energised by time alone.'] },
];
export function resolveKeirsey(ans) {
  if (Object.keys(ans).length < 4) return null;
  const temp = ans.words === 'concrete' ? (ans.tools === 'cooperative' ? 'SJ' : 'SP') : (ans.tools === 'cooperative' ? 'NF' : 'NT');
  const roles = [...new Set(VARIANTS.filter(v => v[1] === temp).map(v => v[2]))];
  const role = roles.find(r => DIRECTIVE.includes(r) === (ans.role === 'directive'));
  return VARIANTS.find(v => v[1] === temp && v[2] === role && v[0].startsWith(ans.social === 'expressive' ? 'E' : 'I'));
}
export const keirseyOf = p => VARIANTS.find(v => v[0] === (p.keirsey || p.fields?.mbti)) || null;

// ---------- Enneagram: core desire, core fear, passion ----------
export const ENNEA = [
  [1, 'Reformer', 'To be good, to have integrity and to be balanced', 'Being corrupt, evil or defective', 'Anger', 'Resentment held in check; constant irritation that things are not as they should be.'],
  [2, 'Helper', 'To feel loved', 'Being unwanted or unworthy of love', 'Pride', 'Seeing oneself as indispensable; meeting others’ needs while denying one’s own.'],
  [3, 'Achiever', 'To feel valuable and worthwhile', 'Being worthless', 'Deceit', 'Vanity: shaping an image to impress and becoming the role instead of oneself.'],
  [4, 'Individualist', 'To find themselves and their significance', 'Having no identity or personal significance', 'Envy', 'Feeling something essential is missing that others seem to have.'],
  [5, 'Investigator', 'To be capable and competent', 'Being useless, helpless or incapable', 'Avarice', 'Hoarding time, energy, knowledge and privacy; withdrawing to conserve.'],
  [6, 'Loyalist', 'To have security and support', 'Being without support and guidance', 'Fear', 'Anxiety and doubt; scanning for threats and testing who can be trusted.'],
  [7, 'Enthusiast', 'To be satisfied and content', 'Being deprived and in pain', 'Gluttony', 'Craving more experiences and stimulation to stay ahead of pain or boredom.'],
  [8, 'Challenger', 'To protect themselves and control their own life', 'Being harmed or controlled by others', 'Lust', 'Intensity and excess; pushing hard against limits and people.'],
  [9, 'Peacemaker', 'Inner stability and peace of mind', 'Loss and separation', 'Sloth', 'Self-forgetting: numbing out and going along to avoid disturbance.'],
];
export const ENNEA_PARTS = [['desire', 'Core desire', 2, 'What they are ultimately chasing.'], ['fear', 'Core fear', 3, 'What they are ultimately running from.'], ['passion', 'Passion (“sin”)', 4, 'The emotional habit that takes over when they lose themselves.']];
export const enneaOf = p => {
  if (p.enneagram) return p.enneagram;
  const n = parseInt(p.fields?.enneagram, 10);
  return n ? { desire: n, fear: n, passion: n } : {};
};
export function enneaVerdict(e) {
  const picks = ENNEA_PARTS.map(([k]) => e[k]).filter(Boolean);
  if (!picks.length) return '';
  const counts = picks.reduce((m, n) => m.set(n, (m.get(n) || 0) + 1), new Map());
  const [n, c] = [...counts].sort((a, b) => b[1] - a[1])[0];
  const name = ENNEA[n - 1][1];
  if (c === 3) return `All three point to <b>Type ${n}, the ${name}</b>.`;
  if (c === 2) return `Leans <b>Type ${n}, the ${name}</b> (2 of 3 match).`;
  return picks.length === 1 ? `So far: Type ${n}, the ${name}.` : 'Mixed signals. Keep observing; core fear is usually the most telling.';
}


// ---------- Defense mechanisms: DSM-IV Defensive Functioning Scale ----------
export const DEFENSE_LEVELS = [
  { id: 'adaptive', name: 'High adaptive (healthy)', tone: 'good', items: [
    ['anticipation', 'Anticipation', 'Thinking ahead realistically about difficulties and how they will feel.', 'Rehearses a hard conversation before having it.'],
    ['affiliation', 'Affiliation', 'Turning to others for help and support.', 'Calls a friend when things go wrong instead of going it alone.'],
    ['altruism', 'Altruism', 'Meeting their own needs by genuinely helping others.', 'Volunteers after a loss and finds it steadies them.'],
    ['humor', 'Humour', 'Finding the funny side of something painful without dodging it.', 'Jokes about their breakup while still talking honestly about it.'],
    ['self-assertion', 'Self-assertion', 'Saying what they feel and think directly, without coercion.', '“I felt hurt when you cancelled.”'],
    ['self-observation', 'Self-observation', 'Reflecting on their own feelings and reactions.', '“I think I snapped because I was already stressed.”'],
    ['sublimation', 'Sublimation', 'Channelling difficult impulses into acceptable outlets.', 'Turns anger into training, or pain into art.'],
    ['suppression', 'Suppression', 'Consciously setting a worry aside to deal with later.', 'Parks a worry to get through a meeting, then comes back to it.'],
  ] },
  { id: 'inhibition', name: 'Mental inhibitions', tone: 'mild', items: [
    ['displacement', 'Displacement', 'Redirecting feelings from the real target to a safer one.', 'Angry at the boss, snaps at their partner.'],
    ['dissociation', 'Dissociation', 'Disconnecting from feelings, memory or surroundings under stress.', 'Goes blank or “not there” during conflict.'],
    ['intellectualization', 'Intellectualisation', 'Talking about feelings in abstract, analytical terms instead of feeling them.', 'Explains their grief with statistics.'],
    ['isolation', 'Isolation of affect', 'Recounting painful events with no feeling attached.', 'Describes a trauma flatly, as if it happened to someone else.'],
    ['reaction-formation', 'Reaction formation', 'Acting the opposite of what they feel.', 'Overly sweet to someone they resent.'],
    ['repression', 'Repression', 'Keeping disturbing wishes or memories out of awareness.', '“I honestly don’t remember that.”'],
    ['undoing', 'Undoing', 'Doing something to symbolically cancel an earlier act.', 'Showers someone with gifts after a cruel remark.'],
  ] },
  { id: 'minor', name: 'Minor image-distorting', tone: 'mid', items: [
    ['idealization', 'Idealisation', 'Seeing someone as all-good or perfect.', 'A new friend or partner can do no wrong.'],
    ['devaluation', 'Devaluation', 'Seeing others (or themselves) as worthless to manage disappointment.', '“They were never that great anyway.”'],
    ['omnipotence', 'Omnipotence', 'Acting superior or all-powerful to cover vulnerability.', 'Brags or takes over when they feel small.'],
  ] },
  { id: 'disavowal', name: 'Disavowal', tone: 'mid', items: [
    ['denial', 'Denial', 'Refusing to acknowledge an obvious painful reality.', '“I don’t have a drinking problem.”'],
    ['projection', 'Projection', 'Attributing their own unacceptable feelings to others.', 'Accuses you of being angry when they are.'],
    ['rationalization', 'Rationalisation', 'Explaining behaviour with reassuring but untrue reasons.', '“I only cheated because they neglected me.”'],
  ] },
  { id: 'major', name: 'Major image-distorting', tone: 'low', items: [
    ['splitting', 'Splitting', 'Seeing self or others as all-good or all-bad, flipping between extremes.', 'Adores you one day, despises you the next.'],
    ['projective-identification', 'Projective identification', 'Projecting a feeling onto someone, then provoking them until they act it out.', 'Convinced you will leave, pushes until you nearly do.'],
  ] },
  { id: 'action', name: 'Action level', tone: 'low', items: [
    ['acting-out', 'Acting out', 'Handling feelings through impulsive action instead of reflection.', 'Drinks, storms out or picks a fight when upset.'],
    ['passive-aggression', 'Passive aggression', 'Expressing hostility indirectly.', 'Lateness, sulking, “forgetting”, sarcasm.'],
    ['help-rejecting', 'Help-rejecting complaining', 'Asking for help, then rejecting every suggestion.', '“Yes, but…” to every idea.'],
    ['withdrawal', 'Apathetic withdrawal', 'Shutting down and disengaging.', 'Goes silent and stops trying.'],
  ] },
];
export const DEFENSE = new Map(DEFENSE_LEVELS.flatMap(l => l.items.map(([k, n, d, ex]) => [k, { k, name: n, def: d, ex, level: l }])));
// ---------- How to relate ----------
// [do, don't]
export const TRAIT_RELATE = {
  O: { hi: ['Bring new ideas, places and books; talk about possibilities and meaning.', 'Bore them with the same routine or wave off unusual ideas.'],
       lo: ['Be concrete and practical; suggest proven plans and familiar places.', 'Push abstract theory or constant novelty, or mock their tastes as conventional.'] },
  C: { hi: ['Be on time, keep small promises and give notice when plans change.', 'Flake, change plans last minute or leave shared work half-done.'],
       lo: ['Keep plans flexible, send a reminder, and own the logistics when it matters.', 'Read lateness as disrespect by default, or micromanage them.'] },
  E: { hi: ['Invite them out, think out loud together and reply with energy.', 'Leave them in long silences, or take their talkativeness as dominance.'],
       lo: ['Meet one-on-one in quieter places; give them time to think; texting is fine.', 'Put them on the spot in a group, or take quietness as coldness.'] },
  A: { hi: ['Be warm and appreciative; ask what they want, because they may not say.', 'Take advantage of their accommodation, or assume silence means agreement.'],
       lo: ['Be direct, argue on the merits, and don’t take bluntness personally.', 'Hint, guilt-trip or expect diplomacy.'] },
  N: { hi: ['Reassure, be predictable, reply promptly and name problems calmly.', 'Leave things ambiguous, joke about their worries or go silent after a conflict.'],
       lo: ['Share real concerns openly; they can take it.', 'Mistake their calm for not caring, or expect them to match your worry.'] },
};
export const TEMP_RELATE = {
  SP: ['Keep it fun, active and spontaneous; show rather than lecture; give them freedom.', 'Tie them down with schedules, rules for their own sake or long theory.'],
  SJ: ['Be reliable, honour commitments and traditions, plan ahead, and thank them for what they carry.', 'Break rules casually, run late or change plans without notice.'],
  NF: ['Be sincere, talk about meaning and feelings, and recognise who they really are.', 'Be fake, cold or dismissive of feelings, or criticise harshly.'],
  NT: ['Respect their competence, give reasons, debate ideas and give them autonomy.', 'Appeal to emotion or authority without logic, micromanage, or question their competence in public.'],
};
export const ENNEA_RELATE = {
  1: ['Acknowledge their effort and good intentions; be fair and own your mistakes.', 'Criticise them harshly (their inner critic already does) or be sloppy about shared standards.'],
  2: ['Thank them specifically, and ask about their needs.', 'Take their giving for granted, or reject their help bluntly.'],
  3: ['Recognise their achievements, and value them apart from those; be efficient.', 'Embarrass them in public or waste their time.'],
  4: ['Listen to their feelings without fixing; appreciate what makes them unique.', 'Tell them they’re overreacting, or be shallow and generic.'],
  5: ['Give them space and advance notice, respect their privacy and come with substance.', 'Demand emotional disclosure fast or drop in unannounced.'],
  6: ['Be consistent and transparent, reassure them and follow through.', 'Be vague or secretive, or dismiss their worries as paranoia.'],
  7: ['Share adventures and ideas, stay positive and keep options open.', 'Trap them with heavy commitments, or criticise without offering a way forward.'],
  8: ['Be direct and honest, stand your ground, and earn trust by being straight.', 'Manipulate, act passive or betray a confidence.'],
  9: ['Ask their opinion and wait for the answer; make room for them gently.', 'Pressure them, stir up conflict or talk over them.'],
};
export const DEFENSE_RELATE = {
  adaptive: ['Name it and appreciate it; these are strengths to lean on.', 'Mistake humour or suppression for not caring.'],
  inhibition: ['Gently invite the real feeling (“that sounds like it hurt”) and give it time.', 'Force them to feel it right now, or argue with the target they displaced onto.'],
  minor: ['Stay steady and realistic; don’t take the pedestal or the put-down personally.', 'Feed the idealisation or compete with the bravado.'],
  disavowal: ['Stick to calm, specific facts and leave them room to save face.', 'Corner them with “just admit it”; that hardens denial.'],
  major: ['Keep firm, consistent boundaries and a calm tone through the all-good / all-bad swings.', 'Get pulled into playing the role they project onto you, or promise what you can’t keep.'],
  action: ['Meet the behaviour with clear limits, then talk about the feeling once things are calm.', 'Reward it (giving in, chasing) or retaliate in kind.'],
};

// ---------- Enneagram quick test (Riso & Hudson’s QUEST method) ----------
// Hornevian group (how they get what they want) × Harmonic group (how they handle
// disappointment) points to exactly one type.
export const ENNEA_TEST = [
  { id: 'horn', q: 'When they want something, how do they usually go after it?', why: 'Karen Horney’s three social styles, as Riso & Hudson use them: moving against, toward or away from people.',
    opts: [['assertive', 'Assertive', 'Go for it directly: push, insist, take the lead and expect others to adjust.', [3, 7, 8]],
      ['dutiful', 'Dutiful', 'Earn it: do what’s expected, stick to principles, be helpful or responsible.', [1, 2, 6]],
      ['withdrawn', 'Withdrawn', 'Step back: wait, retreat into themselves and avoid imposing.', [4, 5, 9]]] },
  { id: 'harm', q: 'When things go wrong, how do they react?', why: 'The Harmonic groups: how each type copes with conflict and disappointment.',
    opts: [['positive', 'Look on the bright side', 'Stay upbeat, play problems down and keep the mood good.', [2, 7, 9]],
      ['competent', 'Get logical', 'Set feelings aside, analyse and fix it efficiently.', [1, 3, 5]],
      ['reactive', 'React emotionally', 'Feel it strongly, show it, and need others to respond.', [4, 6, 8]]] },
];
export function resolveEnnea(ans) {
  const sets = ENNEA_TEST.map(q => q.opts.find(o => o[0] === ans[q.id])?.[3]);
  if (sets.some(s => !s)) return null;
  return sets[0].find(n => sets[1].includes(n));
}
// the other two types in the same social style, to check against
export const enneaNeighbours = n => ENNEA_TEST[0].opts.find(o => o[3].includes(n))[3].filter(x => x !== n);

// ---------- Erotic Blueprints (Jaiya) ----------
export const BLUEPRINTS = {
  energetic: { name: 'Energetic', tag: 'Anticipation, energy and tease',
    signs: 'Turned on by a look, a whisper or a near-touch. Can feel waves or tingles of energy. Very sensitive, and too much too fast can overwhelm them.',
    shadow: 'Can shut down when overwhelmed; may feel “too sensitive” or easily rejected.',
    relate: ['Slow down. Tease, leave space and build anticipation; hover before you touch.', 'Rush to the main event or go too hard; it can switch them off.'] },
  sensual: { name: 'Sensual', tag: 'All five senses, comfort and setting',
    signs: 'Cares about the environment: warmth, scent, music, food, textures, a long massage. Needs to relax to get out of their head.',
    shadow: 'Gets stuck in their head; small distractions or body-image worries can block arousal.',
    relate: ['Set the scene: warm, clean, beautiful. Engage every sense and take your time.', 'Expect them to switch on fast in a cold, messy or rushed setting.'] },
  sexual: { name: 'Sexual', tag: 'Sex itself: nudity, directness, orgasm',
    signs: 'Straightforward. Loves seeing and being seen, explicit touch and getting to it; needs less build-up.',
    shadow: 'Can be goal-focused, and may skip emotional intimacy or get impatient with slow, subtle play.',
    relate: ['Be direct and enthusiastic; nudity and explicit touch work.', 'Make them wait through long rituals with no payoff, or judge their directness as shallow.'] },
  kinky: { name: 'Kinky', tag: 'The taboo: anything that feels naughty',
    signs: 'Drawn to what feels forbidden. It can be physical (intense sensation, restraint) or psychological (power play, role-play). What counts as kinky is personal.',
    shadow: 'Shame about their desires; they may hide them for years.',
    relate: ['Build trust, talk openly about desires and limits, agree on boundaries and a safe word, and never judge.', 'Shame or laugh at their desires, or push boundaries without consent.'] },
  shapeshifter: { name: 'Shapeshifter', tag: 'All of the above, depending on mood',
    signs: 'Enjoys energetic, sensual, sexual and kinky play and wants variety. Bored by the same routine.',
    shadow: 'Can feel “too much” for partners, and may adapt to a partner’s style and neglect their own needs.',
    relate: ['Bring range and variety, and ask what they’re in the mood for tonight.', 'Get stuck in one routine, or feel inadequate when one style isn’t always enough.'] },
};
const BP4 = ['energetic', 'sensual', 'sexual', 'kinky'];
// Written for observing someone else; adapted, not Jaiya’s official quiz.
export const BP_QUESTIONS = [
  { q: 'What seems to get them going most?', opts: ['A look, a whisper, being close without touching', 'A beautiful setting: candles, music, a long massage', 'Getting undressed and getting straight to it', 'Something a little forbidden or daring'] },
  { q: 'What turns them off fastest?', opts: ['Being grabbed or rushed', 'Mess, bad smells, being cold or uncomfortable', 'Endless build-up with no follow-through', 'Things getting predictable or “vanilla”'] },
  { q: 'What kind of touch do they like?', opts: ['Light, barely there, or none at first', 'Slow, full-body, skin on skin', 'Direct and explicit', 'Intense sensation, restraint, or being in or out of control'] },
  { q: 'Their idea of a great night?', opts: ['Hours of flirting and tension', 'Dinner, wine, a bath, slow everything', 'Lots of sex', 'Role-play, a game or a fantasy acted out'] },
  { q: 'What do they talk about or hint at?', opts: ['Chemistry, energy, connection', 'Comfort, atmosphere, how things feel', 'Sex, directly and openly', 'Fantasies and things they’ve never tried'] },
].map(q => ({ ...q, opts: q.opts.map((l, i) => [BP4[i], l]).concat([['shapeshifter', 'Several of these, depending on mood']]) }));
// answers: array of blueprint keys → { primary, secondary }
export function resolveBlueprint(answers) {
  const n = k => answers.filter(a => a === k).length;
  const ranked = BP4.map(k => [k, n(k)]).sort((a, b) => b[1] - a[1]);
  const spread = ranked.filter(r => r[1] > 0).length;
  if (n('shapeshifter') >= 2 || (spread >= 3 && ranked[0][1] <= 2)) return { primary: 'shapeshifter', secondary: ranked[0][1] ? ranked[0][0] : null };
  return { primary: ranked[0][0], secondary: ranked[1][1] ? ranked[1][0] : null };
}

// ---------- Zodiac (tropical sun sign) ----------
// [key, name, symbol, starts (MM-DD), element, modality, traits, do, don't]
export const ZODIAC = [
  ['capricorn', 'Capricorn', '♑', '12-22', 'Earth', 'Cardinal', 'Ambitious, disciplined, reserved and responsible; plays the long game.', 'Respect their goals and their time; be dependable.', 'Be flippant about their work, or unreliable.'],
  ['aquarius', 'Aquarius', '♒', '01-20', 'Air', 'Fixed', 'Independent, original, idealistic and a little detached; cares about ideas and causes.', 'Respect their independence; talk ideas and causes.', 'Be clingy or demand that they conform.'],
  ['pisces', 'Pisces', '♓', '02-19', 'Water', 'Mutable', 'Dreamy, empathetic, artistic and sometimes escapist; feels everything.', 'Be kind and imaginative; listen to their dreams.', 'Be harsh, or flatly practical about their feelings.'],
  ['aries', 'Aries', '♈', '03-21', 'Fire', 'Cardinal', 'Bold, direct, competitive and impatient; loves a challenge and being first.', 'Be direct, keep pace and offer a challenge or adventure.', 'Be passive, drag things out or bruise their pride in public.'],
  ['taurus', 'Taurus', '♉', '04-20', 'Earth', 'Fixed', 'Steady, sensual, loyal and stubborn; loves comfort, food and security.', 'Be reliable and patient; share good food and comfort.', 'Rush them or push them into sudden change.'],
  ['gemini', 'Gemini', '♊', '05-21', 'Air', 'Mutable', 'Curious, quick, talkative and changeable; needs variety and conversation.', 'Keep the conversation lively, share ideas and news, stay flexible.', 'Bore them or demand they settle on one thing forever.'],
  ['cancer', 'Cancer', '♋', '06-21', 'Water', 'Cardinal', 'Caring, protective, sensitive and moody; home and family come first.', 'Be gentle, make them feel safe and remember what matters to their family.', 'Mock their feelings or criticise harshly.'],
  ['leo', 'Leo', '♌', '07-23', 'Fire', 'Fixed', 'Warm, proud, generous and dramatic; wants to shine and be appreciated.', 'Give sincere, generous praise and attention; be loyal.', 'Ignore or upstage them, or criticise them in public.'],
  ['virgo', 'Virgo', '♍', '08-23', 'Earth', 'Mutable', 'Precise, helpful, analytical and self-critical; notices every detail.', 'Be thoughtful and organised; appreciate their help.', 'Be sloppy or vague, or pile on criticism.'],
  ['libra', 'Libra', '♎', '09-23', 'Air', 'Cardinal', 'Charming, fair, social and indecisive; seeks harmony and beauty.', 'Be gracious and fair, and help them decide gently.', 'Force a confrontation or be rude.'],
  ['scorpio', 'Scorpio', '♏', '10-23', 'Water', 'Fixed', 'Intense, private, loyal and perceptive; all or nothing.', 'Be honest and go deep; earn trust slowly and keep secrets.', 'Lie, play games or betray a confidence.'],
  ['sagittarius', 'Sagittarius', '♐', '11-22', 'Fire', 'Mutable', 'Free-spirited, optimistic, blunt and adventurous; loves travel and big ideas.', 'Share adventures and big questions; give them room.', 'Smother them, or take their bluntness too hard.'],
];
export function signFor(date) {
  if (!date) return null;
  const md = date.slice(5);
  const asc = [...ZODIAC].sort((a, b) => a[3].localeCompare(b[3]));
  return [...asc].reverse().find(z => md >= z[3]) || asc.at(-1); // before 01-20 → Capricorn
}
// birthdays within a day of a boundary can fall either side depending on the year
export function nearCusp(date) {
  if (!date) return false;
  const y = 2001, d = new Date(`${y}-${date.slice(5)}T12:00`);
  return ZODIAC.some(z => Math.abs((new Date(`${y}-${z[3]}T12:00`) - d) / 864e5) <= 1);
}

// ---------- Big Five facets (NEO PI-R, Costa & McCrae 1992) ----------
// [code, name, high, low]
export const FACETS = {
  O: [
    ['O1', 'Fantasy', 'vivid imagination, daydreams, rich inner world', 'grounded in the here and now; rarely daydreams'],
    ['O2', 'Aesthetics', 'moved by art, music, nature and beauty', 'little interest in art or beauty for its own sake'],
    ['O3', 'Feelings', 'notices and values their own emotions; feels deeply', 'pays little attention to inner feelings'],
    ['O4', 'Actions', 'loves trying new foods, places and activities', 'prefers the familiar; sticks to routines'],
    ['O5', 'Ideas', 'intellectually curious; enjoys puzzles, theories and debate', 'focused on the practical; abstract talk bores them'],
    ['O6', 'Values', 'questions authority and tradition; open-minded on social issues', 'respects tradition and established values'],
  ],
  C: [
    ['C1', 'Competence', 'feels capable, prepared and effective', 'often feels unprepared or not up to it'],
    ['C2', 'Order', 'tidy, organised, likes things in their place', 'messy; comfortable with disorder'],
    ['C3', 'Dutifulness', 'keeps promises, follows rules and ethics strictly', 'casual about obligations and rules'],
    ['C4', 'Achievement striving', 'ambitious, high standards, driven to excel', 'content with “good enough”; low ambition'],
    ['C5', 'Self-discipline', 'starts and finishes tasks despite boredom', 'procrastinates; gives up when it gets dull'],
    ['C6', 'Deliberation', 'thinks carefully before acting', 'acts on impulse; decides quickly'],
  ],
  E: [
    ['E1', 'Warmth', 'affectionate and friendly; easily close to people', 'formal and reserved, even with people they like'],
    ['E2', 'Gregariousness', 'loves crowds, parties and company', 'avoids crowds; prefers being alone or with a few'],
    ['E3', 'Assertiveness', 'takes charge, speaks up, leads', 'stays in the background; lets others lead'],
    ['E4', 'Activity', 'fast-paced, busy, full of energy', 'leisurely, unhurried pace'],
    ['E5', 'Excitement seeking', 'craves thrills, noise and stimulation', 'avoids risk and loud, hectic places'],
    ['E6', 'Positive emotions', 'cheerful, laughs easily, upbeat', 'serious and less exuberant (not necessarily unhappy)'],
  ],
  A: [
    ['A1', 'Trust', 'assumes others mean well', 'suspicious; assumes others may be dishonest'],
    ['A2', 'Straightforwardness', 'frank and sincere; doesn’t manipulate', 'guarded; willing to flatter or manipulate'],
    ['A3', 'Altruism', 'generous with time and help', 'reluctant to get involved in others’ problems'],
    ['A4', 'Compliance', 'gives in to avoid conflict; forgives easily', 'competitive; fights back; holds a grudge'],
    ['A5', 'Modesty', 'humble; plays down their achievements', 'confident they’re superior; shows it'],
    ['A6', 'Tender-mindedness', 'moved by others’ needs; compassionate', 'hard-headed; decides on logic, not sympathy'],
  ],
  N: [
    ['N1', 'Anxiety', 'worries, tense, fearful', 'calm and relaxed; rarely worries'],
    ['N2', 'Angry hostility', 'quick to anger, frustration and bitterness', 'slow to anger; easygoing'],
    ['N3', 'Depression', 'prone to sadness, guilt and hopelessness', 'rarely down for long'],
    ['N4', 'Self-consciousness', 'easily embarrassed; shy; sensitive to ridicule', 'comfortable in social situations; hard to embarrass'],
    ['N5', 'Impulsiveness', 'gives in to cravings and urges (food, spending, etc.)', 'resists temptation easily'],
    ['N6', 'Vulnerability', 'panics or feels helpless under stress', 'stays steady in a crisis'],
  ],
};

// ---------- Enneagram type profiles ----------
// Riso & Hudson, Personality Types (1996) and The Wisdom of the Enneagram (1999):
// type in brief, key motivations, levels of development, directions of integration
// and disintegration, wing subtypes. Virtue and fixation: Ichazo, via Naranjo (1994).
// Typical defence: Naranjo (1994), Palmer (1988).
// Checked against the Enneagram Institute’s type pages (enneagraminstitute.com); wording is ours.
export const CENTERS = {
  gut: ['Instinctive (gut) centre', 'anger', 'Types 8, 9 and 1 organise around anger and control: expressing it, numbing it, or holding it in.'],
  heart: ['Feeling (heart) centre', 'shame', 'Types 2, 3 and 4 organise around self-image and the shame of not being valued.'],
  head: ['Thinking (head) centre', 'fear', 'Types 5, 6 and 7 organise around anxiety and finding support and guidance.'],
};
// brief, centre, motivations, healthy, average, unhealthy, [stress type, how], [growth type, how], {wing: name}, virtue, fixation, defence
export const ENNEA_PROFILE = {
  1: { kind: 'The rational, idealistic type', brief: 'Principled, purposeful, self-controlled and perfectionistic', center: 'gut',
    motives: 'To be right, to improve everything, to live up to their ideals, to justify themselves, and to be beyond criticism.',
    healthy: 'Wise, discerning and realistic; principled and fair, with a strong sense of purpose.',
    average: 'Idealistic crusaders who feel it is up to them to fix things; orderly but emotionally held in; critical of themselves and others.',
    unhealthy: 'Dogmatic, self-righteous and intolerant; obsessed with other people’s wrongdoing, and can turn punishing.',
    stress: [4, 'becomes moody and irrational'], growth: [7, 'becomes more spontaneous, playful and joyful'],
    wings: { 9: 'The Idealist', 2: 'The Advocate' }, virtue: 'Serenity', fixation: 'Resentment', defense: 'Reaction formation' },
  2: { kind: 'The caring, interpersonal type', brief: 'Generous, demonstrative, people-pleasing and possessive', center: 'heart',
    motives: 'To be loved, to express their feelings for others, to be needed and appreciated, to get others to respond to them, and to vindicate their claims about themselves.',
    healthy: 'Genuinely unselfish, warm and encouraging; gives freely and takes care of themselves too.',
    average: 'People-pleasing and overly intimate; needs to be needed, so hovers and meddles, and gives with strings attached.',
    unhealthy: 'Manipulative, instilling guilt about what others owe them; can become coercive and feel entitled.',
    stress: [8, 'becomes aggressive and dominating'], growth: [4, 'becomes more self-nurturing and emotionally aware'],
    wings: { 1: 'Servant', 3: 'The Host / Hostess' }, virtue: 'Humility', fixation: 'Flattery', defense: 'Repression' },
  3: { kind: 'The success-oriented, pragmatic type', brief: 'Adaptable, excelling, driven and image-conscious', center: 'heart',
    motives: 'To be affirmed, to distinguish themselves, to have attention and admiration, and to impress others.',
    healthy: 'Authentic, self-accepting and gracious; ambitious to be the best they can be, and an inspiration.',
    average: 'Performance-driven and terrified of failure; packages themselves to impress and can inflate themselves.',
    unhealthy: 'Exploitative and deceptive to protect their image; can betray or sabotage others.',
    stress: [9, 'disengages, goes numb and apathetic'], growth: [6, 'becomes more cooperative, loyal and committed to others'],
    wings: { 2: 'The Charmer', 4: 'The Professional' }, virtue: 'Truthfulness (authenticity)', fixation: 'Vanity', defense: 'Identification' },
  4: { kind: 'The sensitive, introspective type', brief: 'Expressive, dramatic, self-absorbed and temperamental', center: 'heart',
    motives: 'To express their individuality, to surround themselves with beauty, to hold on to certain moods, to withdraw to protect their self-image, to put emotional needs first, and to attract a rescuer.',
    healthy: 'Self-aware, emotionally honest and deeply creative; can turn any experience into something valuable.',
    average: 'Romantic and imaginative, but takes everything personally; moody, self-absorbed, feels exempt from ordinary life.',
    unhealthy: 'Ashamed, alienated and self-hating; can push everyone away and become self-destructive.',
    stress: [2, 'becomes over-involved and clinging'], growth: [1, 'becomes more objective and principled'],
    wings: { 3: 'The Aristocrat', 5: 'The Bohemian' }, virtue: 'Equanimity', fixation: 'Melancholy', defense: 'Introjection' },
  5: { kind: 'The intense, cerebral type', brief: 'Perceptive, innovative, secretive and isolated', center: 'head',
    motives: 'To possess knowledge, to understand their environment, and to have everything figured out as a defence against threats.',
    healthy: 'Perceptive, curious and inventive; masters their field and can make pioneering discoveries.',
    average: 'Works everything out in their head before acting; increasingly detached and preoccupied; provocative toward intrusions.',
    unhealthy: 'Reclusive, nihilistic and eccentric; can be overwhelmed by frightening ideas.',
    stress: [7, 'becomes scattered, hyperactive and distractible'], growth: [8, 'becomes confident and decisive, and takes action'],
    wings: { 4: 'The Iconoclast', 6: 'The Problem Solver' }, virtue: 'Non-attachment', fixation: 'Stinginess (retention)', defense: 'Isolation of affect' },
  6: { kind: 'The committed, security-oriented type', brief: 'Engaging, responsible, anxious and suspicious', center: 'head',
    motives: 'To have security, to feel supported, to have certainty and reassurance, to test how others feel about them, and to fight anxiety and insecurity.',
    healthy: 'Trusting of themselves and others, courageous and committed; a reliable community builder.',
    average: 'Looks for safety in alliances and authority; turns evasive and indecisive, then sarcastic and blaming, under pressure.',
    unhealthy: 'Panicky and self-disparaging; can feel persecuted and lash out irrationally.',
    stress: [3, 'becomes competitive and arrogant'], growth: [9, 'becomes more relaxed and optimistic'],
    wings: { 5: 'The Defender', 7: 'The Buddy' }, virtue: 'Courage', fixation: 'Cowardice (doubt)', defense: 'Projection' },
  7: { kind: 'The busy, variety-seeking type', brief: 'Spontaneous, versatile, acquisitive and scattered', center: 'head',
    motives: 'To stay free and happy, to not miss out on worthwhile experiences, to keep themselves excited and busy, and to avoid and discharge pain.',
    healthy: 'Joyful, grateful and multi-talented; awed by the simple wonders of life.',
    average: 'Restless and always after more options; can’t say no to themselves; slides into excess and never feels it’s enough.',
    unhealthy: 'Impulsive and out of control, escaping into excess; can spiral into addiction and despair.',
    stress: [1, 'becomes critical, perfectionistic and irritable'], growth: [5, 'becomes more focused and fascinated by life'],
    wings: { 6: 'The Entertainer', 8: 'The Realist' }, virtue: 'Sobriety', fixation: 'Planning', defense: 'Rationalisation' },
  8: { kind: 'The powerful, dominating type', brief: 'Self-confident, decisive, wilful and confrontational', center: 'gut',
    motives: 'To be self-reliant, to prove their strength and resist weakness, to matter in their world, to dominate their environment, and to stay in control.',
    healthy: 'Self-confident, decisive and protective; at their best, magnanimous and merciful.',
    average: 'Self-reliant and enterprising; starts to dominate and turns things into a test of wills.',
    unhealthy: 'Ruthless and dictatorial; can feel invincible and become destructive.',
    stress: [5, 'withdraws and becomes secretive and fearful'], growth: [2, 'becomes open-hearted, caring and generous'],
    wings: { 7: 'The Maverick', 9: 'The Bear' }, virtue: 'Innocence', fixation: 'Vengeance', defense: 'Denial' },
  9: { kind: 'The easygoing, self-effacing type', brief: 'Receptive, reassuring, agreeable and complacent', center: 'gut',
    motives: 'To create harmony, to avoid conflict and tension, to keep things as they are, and to resist whatever would upset them.',
    healthy: 'Serene, accepting and present; a calming mediator who brings people together.',
    average: 'Goes along with others to avoid conflict; disengaged and complacent; wants peace at any price.',
    unhealthy: 'Obstinate and neglectful; can dissociate until they can barely function.',
    stress: [6, 'becomes anxious and worried'], growth: [3, 'becomes energetic, focused and self-developing'],
    wings: { 8: 'The Referee', 1: 'The Dreamer' }, virtue: 'Action', fixation: 'Indolence', defense: 'Narcotisation (numbing out)' },
};
