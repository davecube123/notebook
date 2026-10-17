// Person profile schema — what a good spy and a good psychiatrist would want to know.
// type: text | long | date | select | scale(1–5)

export const CIRCLES = ['Family', 'Close friend', 'Friend', 'Partner', 'Work', 'Mentor', 'Acquaintance', 'Neighbor', 'Person of interest'];

export const SECTIONS = [
  {
    id: 'basics', tab: 'profile', title: 'Identity', icon: 'people',
    fields: [
      ['nickname', 'Nickname / goes by'],
      ['pronouns', 'Pronouns'],
      ['birthday', 'Birthday', 'date'],
      ['age', 'Age (approx.)'],
      ['occupation', 'Occupation'],
      ['workplace', 'Company / school'],
      ['city', 'Lives in'],
      ['origin', 'From (hometown)'],
      ['languages', 'Languages'],
    ],
  },
  {
    id: 'contact', tab: 'profile', title: 'Contact', icon: 'chat',
    fields: [
      ['phone', 'Phone'],
      ['email', 'Email'],
      ['social', 'Socials / handles'],
      ['address', 'Address', 'long'],
    ],
  },
  {
    id: 'meeting', tab: 'profile', title: 'How we know each other', icon: 'sparkle',
    fields: [
      ['metDate', 'First met', 'date'],
      ['metWhere', 'Where we met'],
      ['metHow', 'How we met / context', 'long'],
      ['introducedBy', 'Introduced by'],
      ['firstImpression', 'First impression', 'long'],
      ['keepInTouch', 'Keep in touch every', 'select', ['', 'Week', '2 weeks', 'Month', '3 months', '6 months', 'Year']],
    ],
  },
  {
    id: 'observe', tab: 'dossier', title: 'Observation', icon: 'eye',
    fields: [
      ['appearance', 'Appearance', 'long'],
      ['build', 'Height / build'],
      ['marks', 'Distinguishing marks', 'long'],
      ['style', 'Style / clothing'],
      ['voice', 'Voice & speech patterns', 'long'],
      ['bodyLanguage', 'Body language', 'long'],
      ['tells', 'Tells (when nervous, lying, excited)', 'long'],
      ['habitsObserved', 'Habits & quirks', 'long'],
    ],
  },
  {
    id: 'pattern', tab: 'dossier', title: 'Pattern of life', icon: 'clock',
    fields: [
      ['routine', 'Daily routine', 'long'],
      ['hangouts', 'Frequent places', 'long'],
      ['schedule', 'Best time to reach'],
      ['vehicle', 'Vehicle'],
      ['pets', 'Pets'],
      ['lifestyle', 'Lifestyle / spending', 'long'],
    ],
  },
  {
    id: 'network', tab: 'dossier', title: 'Network & background', icon: 'people',
    fields: [
      ['relationship', 'Relationship status'],
      ['partner', 'Partner'],
      ['family', 'Family (parents, siblings, kids)', 'long'],
      ['innerCircle', 'Inner circle / closest people', 'long'],
      ['affiliations', 'Affiliations (groups, religion, politics)', 'long'],
      ['education', 'Education'],
      ['history', 'Background / life story', 'long'],
      ['skills', 'Skills & expertise', 'long'],
    ],
  },
  {
    id: 'intel', tab: 'dossier', title: 'Intel', icon: 'spy',
    fields: [
      ['goals', 'Ambitions & current goals', 'long'],
      ['wants', 'What they want from me', 'long'],
      ['offer', 'What I can offer them', 'long'],
      ['secrets', 'Things told in confidence', 'long'],
      ['redFlags', 'Red flags', 'long'],
      ['greenFlags', 'Green flags', 'long'],
      ['unknowns', 'Open questions / gaps', 'long'],
    ],
  },
  {
    id: 'personality', tab: 'psyche', title: 'Personality', icon: 'brain',
    fields: [
      ['mbti', 'MBTI (guess)', 'select', ['', 'INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP']],
      ['enneagram', 'Enneagram (guess)', 'select', ['', '1 Reformer', '2 Helper', '3 Achiever', '4 Individualist', '5 Investigator', '6 Loyalist', '7 Enthusiast', '8 Challenger', '9 Peacemaker']],
      ['temperament', 'Temperament', 'long'],
      ['selfImage', 'How they see themselves', 'long'],
      ['othersSee', 'How others see them', 'long'],
    ],
  },
  {
    id: 'inner', tab: 'psyche', title: 'Inner world', icon: 'brain',
    fields: [
      ['values', 'Core values', 'long'],
      ['motivations', 'What drives them', 'long'],
      ['fears', 'Fears', 'long'],
      ['insecurities', 'Insecurities', 'long'],
      ['triggers', 'Triggers / sore spots', 'long'],
      ['defenses', 'Defense mechanisms', 'long'],
      ['coping', 'Coping style under stress', 'long'],
      ['formative', 'Formative experiences', 'long'],
      ['struggles', 'Current struggles', 'long'],
    ],
  },
  {
    id: 'relating', tab: 'psyche', title: 'How they relate', icon: 'chat',
    fields: [
      ['attachment', 'Attachment style', 'select', ['', 'Secure', 'Anxious', 'Avoidant', 'Fearful-avoidant', 'Unsure']],
      ['loveLanguage', 'Love language', 'select', ['', 'Words of affirmation', 'Quality time', 'Acts of service', 'Gifts', 'Physical touch']],
      ['communication', 'Communication style', 'long'],
      ['conflict', 'Conflict style', 'long'],
      ['humor', 'Sense of humor'],
      ['energizes', 'What energizes them', 'long'],
      ['drains', 'What drains them', 'long'],
      ['support', 'How to support them', 'long'],
    ],
  },
  {
    id: 'prefs', tab: 'profile', title: 'Likes & care', icon: 'star',
    fields: [
      ['likes', 'Loves / interests', 'long'],
      ['dislikes', 'Dislikes', 'long'],
      ['food', 'Food & drink', 'long'],
      ['favorites', 'Favorites (books, music, films)', 'long'],
      ['gifts', 'Gift ideas', 'long'],
      ['avoid', 'Topics to avoid', 'long'],
      ['dates', 'Important dates (anniversaries, etc.)', 'long'],
    ],
  },
];

export const BIG_FIVE = [
  ['O', 'Openness', 'Practical', 'Curious'],
  ['C', 'Conscientiousness', 'Spontaneous', 'Organized'],
  ['E', 'Extraversion', 'Reserved', 'Outgoing'],
  ['A', 'Agreeableness', 'Challenging', 'Accommodating'],
  ['N', 'Neuroticism', 'Calm', 'Sensitive'],
];

export const TABS = [
  ['profile', 'Profile', 'people'],
  ['dossier', 'Dossier', 'spy'],
  ['psyche', 'Psyche', 'brain'],
  ['log', 'Log', 'history'],
];

export const allFieldDefs = (custom = []) => {
  const out = [];
  SECTIONS.forEach(s => s.fields.forEach(([key, label, type = 'text', options]) => out.push({ key, label, type, options, section: s.id })));
  custom.forEach(c => out.push({ ...c, section: 'custom' }));
  return out;
};
