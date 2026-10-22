// Personality reading for a person: five lenses, each explained as you fill it in.
//   Big Five (Costa & McCrae) · Temperament (Keirsey, Please Understand Me II) ·
//   Enneagram core desire / fear / passion (Riso & Hudson; Ichazo, Naranjo) ·
//   Erotic profile, Dual Control Model (Bancroft & Janssen; Basson; Nagoski) ·
//   Defense mechanisms, DSM-IV Defensive Functioning Scale (after Vaillant).
import { get, save } from '../db.js';
import { esc, debounce, haptic } from '../util.js';
import { icon } from '../icons.js';
import { sheet, toast } from '../ui.js';

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
const LEVEL = ['', 'Very low', 'Low', 'Average', 'High', 'Very high'];

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
const DIRECTIVE = ['Operator', 'Administrator', 'Mentor', 'Coordinator'];
// Keirsey's own questions: words, tools, directive/informative role, expressive/reserved
const QUESTIONS = [
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
function resolveKeirsey(ans) {
  if (Object.keys(ans).length < 4) return null;
  const temp = ans.words === 'concrete' ? (ans.tools === 'cooperative' ? 'SJ' : 'SP') : (ans.tools === 'cooperative' ? 'NF' : 'NT');
  const roles = [...new Set(VARIANTS.filter(v => v[1] === temp).map(v => v[2]))];
  const role = roles.find(r => DIRECTIVE.includes(r) === (ans.role === 'directive'));
  return VARIANTS.find(v => v[1] === temp && v[2] === role && v[0].startsWith(ans.social === 'expressive' ? 'E' : 'I'));
}
export const keirseyOf = p => VARIANTS.find(v => v[0] === (p.keirsey || p.fields?.mbti)) || null;

// ---------- Enneagram: core desire, core fear, passion ----------
export const ENNEA = [
  [1, 'Reformer', 'To be good, right and to have integrity', 'Being bad, corrupt or defective', 'Anger', 'Resentment held in check; constant irritation that things are not as they should be.'],
  [2, 'Helper', 'To be loved and wanted', 'Being unwanted or unworthy of love', 'Pride', 'Seeing oneself as indispensable; meeting others’ needs while denying one’s own.'],
  [3, 'Achiever', 'To feel valuable and worthwhile', 'Being worthless apart from achievements', 'Deceit', 'Vanity: shaping an image to impress and becoming the role instead of oneself.'],
  [4, 'Individualist', 'To find themselves and their significance', 'Having no identity or personal significance', 'Envy', 'Feeling something essential is missing that others seem to have.'],
  [5, 'Investigator', 'To be capable and competent', 'Being useless, helpless or incapable', 'Avarice', 'Hoarding time, energy, knowledge and privacy; withdrawing to conserve.'],
  [6, 'Loyalist', 'To have security and support', 'Being without support or guidance', 'Fear', 'Anxiety and doubt; scanning for threats and testing who can be trusted.'],
  [7, 'Enthusiast', 'To be satisfied and content', 'Being deprived or trapped in pain', 'Gluttony', 'Craving more experiences and stimulation to stay ahead of pain or boredom.'],
  [8, 'Challenger', 'To protect themselves and control their own life', 'Being harmed or controlled by others', 'Lust', 'Intensity and excess; pushing hard against limits and people.'],
  [9, 'Peacemaker', 'Inner stability and peace of mind', 'Loss, separation and conflict', 'Sloth', 'Self-forgetting: numbing out and going along to avoid disturbance.'],
];
const ENNEA_PARTS = [['desire', 'Core desire', 2, 'What they are ultimately chasing.'], ['fear', 'Core fear', 3, 'What they are ultimately running from.'], ['passion', 'Passion (“sin”)', 4, 'The emotional habit that takes over when they lose themselves.']];
export const enneaOf = p => {
  if (p.enneagram) return p.enneagram;
  const n = parseInt(p.fields?.enneagram, 10);
  return n ? { desire: n, fear: n, passion: n } : {};
};
function enneaVerdict(e) {
  const picks = ENNEA_PARTS.map(([k]) => e[k]).filter(Boolean);
  if (!picks.length) return '';
  const counts = picks.reduce((m, n) => m.set(n, (m.get(n) || 0) + 1), new Map());
  const [n, c] = [...counts].sort((a, b) => b[1] - a[1])[0];
  const name = ENNEA[n - 1][1];
  if (c === 3) return `All three point to <b>Type ${n}, the ${name}</b>.`;
  if (c === 2) return `Leans <b>Type ${n}, the ${name}</b> (2 of 3 match).`;
  return picks.length === 1 ? `So far: Type ${n}, the ${name}.` : 'Mixed signals. Keep observing; core fear is usually the most telling.';
}

// ---------- Erotic profile: Dual Control Model ----------
const STYLES = [['spontaneous', 'Spontaneous', 'Desire shows up out of the blue, before any touch.'], ['responsive', 'Responsive', 'Desire emerges after things start, in response to arousal and the right context.'], ['both', 'Both / varies', 'Depends on the relationship, stress and season of life.']];
function eroticVerdict(er) {
  const a = er.acc, b = er.brake;
  if (!a || !b) return '';
  if (a >= 4 && b <= 2) return 'Easily turned on, hard to turn off. Novelty and spontaneity work; risk-taking can follow.';
  if (a >= 4 && b >= 4) return 'Strong desire with sensitive brakes. Needs safety, trust and low stress to let go.';
  if (a <= 2 && b <= 2) return 'Slow to start, steady once going. Needs time and deliberate, explicit stimulation.';
  if (a <= 2 && b >= 4) return 'Easily put off. Context is everything: lower stress, build safety, go slowly.';
  return 'Balanced accelerator and brakes; context still shapes a lot.';
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
const DEFENSE = new Map(DEFENSE_LEVELS.flatMap(l => l.items.map(([k, n, d, ex]) => [k, { k, name: n, def: d, ex, level: l }])));

// ---------- rendering ----------
const info = (summary, body) => `<details class="ty-info"><summary>${icon('info')}${summary}</summary><div>${body}</div></details>`;
const card = (title, sub, body) => `<section class="prop-section"><h3 class="group-label">${title}${sub ? `<span class="count">${sub}</span>` : ''}</h3><div class="card pad ty-card">${body}</div></section>`;
const scale5 = (attr, k, v, label) => `<div class="ty-scale" role="radiogroup" aria-label="${esc(label)}">${[1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" aria-checked="${v === n}" class="${v === n ? 'on' : ''}" ${attr}="${k}" data-v="${n}">${n}</button>`).join('')}</div>`;

export function personalityTab(p) {
  const tr = traitsOf(p), kv = keirseyOf(p), en = enneaOf(p), er = p.erotic || {}, defs = (p.defenses || []).filter(k => DEFENSE.has(k));
  const filled = [Object.keys(tr).length === 5, !!kv, !!(en.desire || en.fear || en.passion), !!(er.acc || er.brake || er.style), defs.length > 0].filter(Boolean).length;

  const big5 = TRAITS.map(t => {
    const v = tr[t.k];
    const desc = !v ? '<span class="faint">Not rated</span>' : v <= 2 ? `<b>${LEVEL[v]}:</b> ${t.low}` : v >= 4 ? `<b>${LEVEL[v]}:</b> ${t.high}` : '<b>Average:</b> a mix of both, depending on the situation';
    return `<div class="ty-trait"><div class="ty-trait-head"><b>${t.name}</b>${t.alt ? `<span class="faint small">${t.alt}</span>` : ''}</div>
      ${scale5('data-trait', t.k, v, t.name)}<div class="ty-desc small">${desc}</div>
      ${info('What to look for', `<p>${esc(t.what)}</p><p><b>High:</b> ${esc(t.high)}.<br><b>Low:</b> ${esc(t.low)}.</p><p class="muted">${esc(t.look)}</p>`)}</div>`;
  }).join('');

  const temp = kv && TEMPERAMENTS[kv[1]];
  const keirsey = kv ? `<div class="ty-result"><div class="ty-big">${esc(kv[3])} <span class="faint">${kv[0]}</span></div>
      <div class="chip-row wrap"><span class="ty-pill">${temp.name}</span><span class="ty-pill">${kv[2]}</span><span class="ty-pill">${temp.words} · ${temp.tools}</span></div>
      <p>${esc(kv[4])}</p><p class="muted small"><b>${temp.name}s</b> seek ${esc(temp.core.charAt(0).toLowerCase() + temp.core.slice(1))}</p>
      <p class="muted small"><b>Needs:</b> ${esc(temp.needs)}. <b>Stressed by:</b> ${esc(temp.stress)}.</p></div>
      <div class="row-end"><button class="btn ghost sm" data-ty="keirsey-clear">Clear</button><button class="btn ghost sm" data-ty="keirsey">Re-type</button></div>`
    : `<p class="muted small">Answer 4 questions about how they talk and act, and the type is worked out for you.</p><button class="btn primary sm" data-ty="keirsey">Find their type</button>`;

  const ennea = `${ENNEA_PARTS.map(([k, label, idx, hint]) => { const n = en[k]; return `<button class="ty-pick" data-ty="ennea" data-part="${k}"><span class="ty-pick-label">${label}</span><span class="ty-pick-val">${n ? esc(ENNEA[n - 1][idx]) : `<span class="faint">${hint}</span>`}</span>${icon('chevR')}</button>`; }).join('')}
    ${enneaVerdict(en) ? `<p class="ty-verdict">${enneaVerdict(en)}</p>` : ''}`;

  const erotic = `<div class="ty-row"><span><b>Accelerator</b><span class="muted small">How readily they respond to sexual cues</span></span>${scale5('data-erotic', 'acc', er.acc, 'Accelerator')}</div>
    <div class="ty-row"><span><b>Brakes</b><span class="muted small">How readily arousal shuts down</span></span>${scale5('data-erotic', 'brake', er.brake, 'Brakes')}</div>
    <div class="feel-label">Desire style</div>
    <div class="chip-row wrap">${STYLES.map(([k, l]) => `<button class="chip ${er.style === k ? 'on' : ''}" data-erotic-style="${k}">${l}</button>`).join('')}</div>
    ${er.style ? `<p class="muted small">${esc(STYLES.find(s => s[0] === er.style)[2])}</p>` : ''}
    ${eroticVerdict(er) ? `<p class="ty-verdict">${eroticVerdict(er)}</p>` : ''}
    <label class="field"><span>What hits their accelerator</span><textarea class="input" rows="2" data-erotic-note="accNotes" placeholder="e.g. novelty, being desired, banter, a certain place">${esc(er.accNotes || '')}</textarea></label>
    <label class="field"><span>What hits their brakes</span><textarea class="input" rows="2" data-erotic-note="brakeNotes" placeholder="e.g. stress, feeling judged, worry about consequences, distractions">${esc(er.brakeNotes || '')}</textarea></label>
    ${info('How this model works', `<p>The <b>Dual Control Model</b> (Bancroft &amp; Janssen, Kinsey Institute) sees arousal as two independent systems: an <b>accelerator</b> that notices anything sexually relevant (attraction, touch, fantasy, novelty), and <b>brakes</b> that notice reasons not to be aroused right now (stress, worry about performance or consequences, body image, the wrong setting).</p><p>People differ a lot in both. Most difficulties come from brakes being hit, not from a weak accelerator. Turning off the brakes usually matters more than pressing harder on the accelerator.</p><p><b>Spontaneous vs responsive desire</b> (Basson): both are normal. Responsive desire only appears once things are under way.</p>`)}`;

  const chosenByLevel = DEFENSE_LEVELS.map(l => [l, defs.filter(k => DEFENSE.get(k).level === l)]).filter(([, ks]) => ks.length);
  const defenses = `${chosenByLevel.length ? chosenByLevel.map(([l, ks]) => `<div class="ty-def-level"><span class="ty-tone ${l.tone}">${esc(l.name)}</span>
      <div class="chip-row wrap">${ks.map(k => `<span class="ty-pill" title="${esc(DEFENSE.get(k).def)}">${esc(DEFENSE.get(k).name)}</span>`).join('')}</div></div>`).join('')
      : '<p class="muted small">Which defences do they reach for when they feel threatened, hurt or ashamed?</p>'}
    <button class="btn ${defs.length ? 'ghost' : 'primary'} sm" data-ty="defenses">${defs.length ? 'Edit' : 'Choose defences'}</button>
    ${defs.length ? `<p class="ty-verdict">${defenseVerdict(chosenByLevel)}</p>` : ''}`;

  return `
    <p class="muted small pad-x ty-intro">Your read of them, ${filled}/5 lenses filled. Tap <b>ⓘ</b> anywhere to learn what to look for. These are impressions to refine over time, not diagnoses.</p>
    ${card('Big Five traits', Object.keys(tr).length ? `${Object.keys(tr).length}/5` : '', big5 + info('About the Big Five', '<p>The most researched model of personality (Costa &amp; McCrae). Each trait is a spectrum; most people sit near the middle. Ratings by people who know someone well are valid and add to what they would say about themselves (Vazire, 2010).</p>'))}
    ${card('Temperament', 'Please Understand Me II', keirsey + info('About Keirsey’s temperaments', '<p>David Keirsey sorts people by two things you can observe: what they talk about (<b>concrete</b> vs <b>abstract</b>) and how they pursue goals (<b>cooperative</b> vs <b>utilitarian</b>). That gives four temperaments: Artisan, Guardian, Idealist and Rational. Each splits into two roles and four of the 16 types (e.g. Champion = ENFP).</p><p class="muted">Popular and practical, but with weaker scientific support than the Big Five. Treat it as a lens.</p>'))}
    ${card('Enneagram core', '', ennea + info('About the Enneagram core', '<p>Each of the nine types is driven by a <b>core desire</b>, defended against a <b>core fear</b> (Riso &amp; Hudson), and has a <b>passion</b>, the “sin” or emotional habit that takes over (Ichazo, Naranjo). Picking them separately lets you notice when someone does not fit one type neatly.</p><p class="muted">A reflection tool with little scientific validation.</p>'))}
    ${card('Erotic profile', 'Dual Control Model', erotic)}
    ${card('Defence mechanisms', defs.length ? String(defs.length) : '', defenses + info('About defence mechanisms', '<p>Defences are automatic ways the mind protects itself from anxiety, shame or pain. The DSM-IV <b>Defensive Functioning Scale</b>, built on George Vaillant’s work, ranks them from <b>high adaptive</b> (healthy, like humour and sublimation) down to <b>action-level</b> defences (like acting out). Everyone uses several; what matters is which ones dominate under stress.</p>'))}
    <details class="card pad why"><summary><b>Sources</b></summary>
      <p>Costa, P. &amp; McCrae, R. (1992). <i>NEO PI-R Professional Manual.</i> · Vazire, S. (2010). Who knows what about a person? <i>J. Personality &amp; Social Psychology.</i></p>
      <p>Keirsey, D. (1998). <i>Please Understand Me II.</i></p>
      <p>Riso, D. &amp; Hudson, R. (1999). <i>The Wisdom of the Enneagram.</i> · Naranjo, C. (1994). <i>Character and Neurosis.</i></p>
      <p>Bancroft, J. &amp; Janssen, E. (2000). The dual control model of male sexual response. · Basson, R. (2000). The female sexual response. · Nagoski, E. (2015). <i>Come As You Are.</i></p>
      <p>Vaillant, G. (1992). <i>Ego Mechanisms of Defense.</i> · American Psychiatric Association (1994). <i>DSM-IV</i>, Defensive Functioning Scale.</p>
    </details>`;
}

function defenseVerdict(chosenByLevel) {
  const order = DEFENSE_LEVELS.map(l => l.id);
  const levels = chosenByLevel.map(([l]) => l).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const best = levels[0], worst = levels.at(-1);
  if (best === worst) return best.id === 'adaptive' ? 'Mostly healthy, mature defences.' : `Mostly ${best.name.toLowerCase()} defences. Gentle honesty and patience help most here.`;
  return `At best: ${best.name.toLowerCase()}. Under pressure they can drop to ${worst.name.toLowerCase()}.`;
}

// ---------- interaction ----------
// Returns true when the click was handled. `redraw` re-renders the person page.
export function handlePersonality(e, id, redraw) {
  const p = () => get('people', id);
  const put = patch => save('people', { ...p(), ...patch, updated: Date.now() }, { silent: true });
  const tb = e.target.closest('[data-trait]');
  if (tb) { const tr = { ...traitsOf(p()) }, k = tb.dataset.trait, v = +tb.dataset.v; tr[k] === v ? delete tr[k] : tr[k] = v; put({ traits: tr }); haptic(5); redraw(); return true; }
  const eb = e.target.closest('[data-erotic]');
  if (eb) { const er = { ...(p().erotic || {}) }, k = eb.dataset.erotic, v = +eb.dataset.v; er[k] = er[k] === v ? null : v; put({ erotic: er }); haptic(5); redraw(); return true; }
  const es = e.target.closest('[data-erotic-style]');
  if (es) { const er = { ...(p().erotic || {}) }; er.style = er.style === es.dataset.eroticStyle ? null : es.dataset.eroticStyle; put({ erotic: er }); redraw(); return true; }
  const b = e.target.closest('[data-ty]');
  if (!b) return false;
  const act = b.dataset.ty;
  if (act === 'keirsey') keirseySheet(p(), code => { put({ keirsey: code }); redraw(); });
  if (act === 'keirsey-clear') { const prev = keirseyOf(p())?.[0]; put({ keirsey: null, fields: { ...p().fields, mbti: '' } }); redraw(); toast('Cleared', { action: 'Undo', onAction: () => { put({ keirsey: prev }); redraw(); } }); }
  if (act === 'ennea') enneaSheet(p(), b.dataset.part, n => { put({ enneagram: { ...enneaOf(p()), [b.dataset.part]: n } }); redraw(); });
  if (act === 'defenses') defenseSheet(p(), keys => { put({ defenses: keys }); redraw(); });
  return true;
}

const saveNote = debounce((id, k, v) => { const p = get('people', id); save('people', { ...p, erotic: { ...(p.erotic || {}), [k]: v }, updated: Date.now() }, { silent: true }); }, 400);
export function handlePersonalityInput(e, id) {
  const t = e.target.closest('[data-erotic-note]');
  if (!t) return false;
  saveNote(id, t.dataset.eroticNote, t.value);
  return true;
}

function keirseySheet(p, done) {
  const ans = {};
  let step = 0;
  sheet({
    title: `${p.name.split(/\s+/)[0]}’s temperament`,
    render(body, close) {
      const draw = () => {
        const result = resolveKeirsey(ans);
        if (step >= QUESTIONS.length && result) {
          const t = TEMPERAMENTS[result[1]];
          body.innerHTML = `<div class="ty-result center"><p class="muted small">From your answers</p><div class="ty-big">${esc(result[3])} <span class="faint">${result[0]}</span></div>
            <p><b>${t.name}</b> · ${esc(result[2])}</p><p>${esc(result[4])}</p><p class="muted small">${esc(t.core)}</p></div>
            <div class="row-end"><button class="btn ghost" data-redo>Start over</button><button class="btn primary" data-save>Save</button></div>`;
          body.querySelector('[data-save]').onclick = () => { done(result[0]); close(); toast(`Saved: ${result[3]} (${result[0]})`); };
          body.querySelector('[data-redo]').onclick = () => { step = 0; Object.keys(ans).forEach(k => delete ans[k]); draw(); };
          return;
        }
        const q = QUESTIONS[step];
        body.innerHTML = `<div class="ty-steps">${QUESTIONS.map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>
          <h3 class="ty-q">${esc(q.q)}</h3><p class="muted small">${esc(q.why)}</p>
          ${[q.a, q.b].map(([v, l, d]) => `<button class="ty-option ${ans[q.id] === v ? 'sel' : ''}" data-answer="${v}"><b>${l}</b><span>${esc(d)}</span></button>`).join('')}
          <div class="row-between">${step ? '<button class="btn ghost sm" data-back>Back</button>' : '<span></span>'}<button class="link small" data-direct>I already know their type</button></div>`;
      };
      draw();
      body.addEventListener('click', e => {
        const a = e.target.closest('[data-answer]');
        if (a) { ans[QUESTIONS[step].id] = a.dataset.answer; step++; haptic(5); draw(); return; }
        if (e.target.closest('[data-back]')) { step = Math.max(0, step - 1); draw(); return; }
        if (e.target.closest('[data-direct]')) {
          body.innerHTML = Object.entries(TEMPERAMENTS).map(([k, t]) => `<div class="feel-label">${t.name}</div><div class="ty-grid">${VARIANTS.filter(v => v[1] === k).map(v => `<button class="ty-option compact" data-code="${v[0]}"><b>${v[3]}</b><span>${v[0]} · ${v[2]}</span></button>`).join('')}</div>`).join('');
          return;
        }
        const c = e.target.closest('[data-code]');
        if (c) { const v = VARIANTS.find(x => x[0] === c.dataset.code); done(v[0]); close(); toast(`Saved: ${v[3]} (${v[0]})`); }
      });
    },
  });
}

function enneaSheet(p, part, done) {
  const [, label, idx, hint] = ENNEA_PARTS.find(x => x[0] === part);
  const cur = enneaOf(p)[part];
  sheet({
    title: label,
    render(body, close) {
      body.innerHTML = `<p class="muted small">${esc(hint)} Pick the one that fits best${part === 'passion' ? '' : ', even if they would never say it out loud'}.</p>
        ${ENNEA.map(row => `<button class="ty-option ${cur === row[0] ? 'sel' : ''}" data-n="${row[0]}"><b>${esc(row[idx])}</b>${part === 'passion' ? `<span>${esc(row[5])}</span>` : ''}<span class="faint small">Type ${row[0]} · ${row[1]}</span></button>`).join('')}
        ${cur ? '<button class="btn ghost block" data-clear>Not sure, clear it</button>' : ''}`;
      body.addEventListener('click', e => {
        const b = e.target.closest('[data-n]');
        if (b) { done(+b.dataset.n); close(); return; }
        if (e.target.closest('[data-clear]')) { done(null); close(); }
      });
    },
  });
}

function defenseSheet(p, done) {
  const picked = new Set((p.defenses || []).filter(k => DEFENSE.has(k)));
  sheet({
    title: 'Defence mechanisms',
    render(body, close) {
      body.innerHTML = `<p class="muted small">Pick the ones you have actually seen, usually 2–5. Ordered from healthiest to least adaptive.</p>
        ${DEFENSE_LEVELS.map(l => `<div class="feel-label"><span class="ty-tone ${l.tone}">${esc(l.name)}</span></div>
          ${l.items.map(([k, n, d, ex]) => `<label class="ty-check"><input type="checkbox" value="${k}" ${picked.has(k) ? 'checked' : ''}><span><b>${esc(n)}</b><span>${esc(d)}</span><span class="faint small">e.g. ${esc(ex)}</span></span></label>`).join('')}`).join('')}
        <div class="feel-save row-end"><button class="btn ghost" data-cancel>Cancel</button><button class="btn primary" data-save>Save</button></div>`;
      body.addEventListener('change', e => { if (e.target.matches('input[type=checkbox]')) e.target.checked ? picked.add(e.target.value) : picked.delete(e.target.value); });
      body.querySelector('[data-cancel]').onclick = () => close();
      body.querySelector('[data-save]').onclick = () => { done([...picked]); close(); };
    },
  });
}

// Plain-text version for export
export function personalityText(p) {
  const out = [];
  const tr = traitsOf(p);
  if (Object.keys(tr).length) out.push('## Big Five', ...TRAITS.filter(t => tr[t.k]).map(t => `- ${t.name}: ${tr[t.k]}/5 (${LEVEL[tr[t.k]]})`), '');
  const kv = keirseyOf(p);
  if (kv) out.push('## Temperament', `${kv[3]} (${kv[0]}), ${TEMPERAMENTS[kv[1]].name} ${kv[2]}`, '');
  const en = enneaOf(p);
  if (en.desire || en.fear || en.passion) out.push('## Enneagram core', ...ENNEA_PARTS.filter(([k]) => en[k]).map(([k, l, i]) => `- ${l}: ${ENNEA[en[k] - 1][i]} (type ${en[k]})`), '');
  const er = p.erotic || {};
  if (er.acc || er.brake || er.style) out.push('## Erotic profile', `- Accelerator ${er.acc || '?'}/5, brakes ${er.brake || '?'}/5${er.style ? `, ${er.style} desire` : ''}`, ...(er.accNotes ? [`- Accelerators: ${er.accNotes}`] : []), ...(er.brakeNotes ? [`- Brakes: ${er.brakeNotes}`] : []), '');
  const defs = (p.defenses || []).filter(k => DEFENSE.has(k));
  if (defs.length) out.push('## Defence mechanisms', ...defs.map(k => `- ${DEFENSE.get(k).name} (${DEFENSE.get(k).level.name})`), '');
  return out;
}
