// Person profile schema: a short, practical profile. The personality reading
// (Big Five, temperament, Enneagram core, erotic profile, defenses) lives in typology.js.
// type: text | long | date | select

export const CIRCLES = ['Family', 'Close friend', 'Friend', 'Partner', 'Work', 'Mentor', 'Acquaintance', 'Neighbor', 'Person of interest'];

export const SECTIONS = [
  {
    id: 'basics', title: 'Identity', icon: 'people',
    fields: [
      ['nickname', 'Nickname / goes by'],
      ['birthday', 'Birthday', 'date'],
      ['occupation', 'Occupation'],
      ['workplace', 'Company / school'],
      ['city', 'Lives in'],
    ],
  },
  {
    id: 'contact', title: 'Contact', icon: 'chat',
    fields: [
      ['phone', 'Phone'],
      ['email', 'Email'],
      ['social', 'Socials / handles'],
    ],
  },
  {
    id: 'meeting', title: 'How we know each other', icon: 'sparkle',
    fields: [
      ['metDate', 'First met', 'date'],
      ['metWhere', 'Where we met'],
      ['metHow', 'How we met / context', 'long'],
      ['keepInTouch', 'Keep in touch every', 'select', ['', 'Week', '2 weeks', 'Month', '3 months', '6 months', 'Year']],
    ],
  },
  {
    id: 'prefs', title: 'Likes & care', icon: 'star',
    fields: [
      ['likes', 'Loves / interests', 'long'],
      ['dislikes', 'Dislikes', 'long'],
      ['gifts', 'Gift ideas', 'long'],
      ['avoid', 'Topics to avoid', 'long'],
    ],
  },
];

// Fields from the earlier, longer profile. They're no longer asked for, but anything
// already filled in still shows (and stays editable) under "Earlier details".
export const LEGACY_FIELDS = [
  ['pronouns', 'Pronouns'],
  ['age', 'Age (approx.)'],
  ['origin', 'From (hometown)'],
  ['languages', 'Languages'],
  ['address', 'Address', 'long'],
  ['introducedBy', 'Introduced by'],
  ['firstImpression', 'First impression', 'long'],
  ['appearance', 'Appearance', 'long'],
  ['build', 'Height / build'],
  ['marks', 'Distinguishing marks', 'long'],
  ['style', 'Style / clothing'],
  ['voice', 'Voice & speech patterns', 'long'],
  ['bodyLanguage', 'Body language', 'long'],
  ['tells', 'Tells (when nervous, lying, excited)', 'long'],
  ['habitsObserved', 'Habits & quirks', 'long'],
  ['routine', 'Daily routine', 'long'],
  ['hangouts', 'Frequent places', 'long'],
  ['schedule', 'Best time to reach'],
  ['vehicle', 'Vehicle'],
  ['pets', 'Pets'],
  ['lifestyle', 'Lifestyle / spending', 'long'],
  ['relationship', 'Relationship status'],
  ['partner', 'Partner'],
  ['family', 'Family (parents, siblings, kids)', 'long'],
  ['innerCircle', 'Inner circle / closest people', 'long'],
  ['affiliations', 'Affiliations (groups, religion, politics)', 'long'],
  ['education', 'Education'],
  ['history', 'Background / life story', 'long'],
  ['skills', 'Skills & expertise', 'long'],
  ['goals', 'Ambitions & current goals', 'long'],
  ['wants', 'What they want from me', 'long'],
  ['offer', 'What I can offer them', 'long'],
  ['secrets', 'Things told in confidence', 'long'],
  ['redFlags', 'Red flags', 'long'],
  ['greenFlags', 'Green flags', 'long'],
  ['unknowns', 'Open questions / gaps', 'long'],
  ['mbti', 'MBTI (guess)', 'select', ['', 'INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP']],
  ['enneagram', 'Enneagram (guess)', 'select', ['', '1 Reformer', '2 Helper', '3 Achiever', '4 Individualist', '5 Investigator', '6 Loyalist', '7 Enthusiast', '8 Challenger', '9 Peacemaker']],
  ['temperament', 'Temperament', 'long'],
  ['selfImage', 'How they see themselves', 'long'],
  ['othersSee', 'How others see them', 'long'],
  ['values', 'Core values', 'long'],
  ['motivations', 'What drives them', 'long'],
  ['fears', 'Fears', 'long'],
  ['insecurities', 'Insecurities', 'long'],
  ['triggers', 'Triggers / sore spots', 'long'],
  ['defenses', 'Defense mechanisms', 'long'],
  ['coping', 'Coping style under stress', 'long'],
  ['formative', 'Formative experiences', 'long'],
  ['struggles', 'Current struggles', 'long'],
  ['attachment', 'Attachment style', 'select', ['', 'Secure', 'Anxious', 'Avoidant', 'Fearful-avoidant', 'Unsure']],
  ['loveLanguage', 'Love language', 'select', ['', 'Words of affirmation', 'Quality time', 'Acts of service', 'Gifts', 'Physical touch']],
  ['communication', 'Communication style', 'long'],
  ['conflict', 'Conflict style', 'long'],
  ['humor', 'Sense of humor'],
  ['energizes', 'What energizes them', 'long'],
  ['drains', 'What drains them', 'long'],
  ['support', 'How to support them', 'long'],
  ['food', 'Food & drink', 'long'],
  ['favorites', 'Favorites (books, music, films)', 'long'],
  ['dates', 'Important dates (anniversaries, etc.)', 'long'],
];

export const findField = (key, custom = []) =>
  [...SECTIONS.flatMap(s => s.fields), ...LEGACY_FIELDS, ...custom.map(c => [c.key, c.label, c.type])].find(f => f[0] === key);

export const TABS = [
  ['personality', 'Personality', 'brain'],
  ['log', 'Log', 'history'],
  ['notes', 'Notes', 'notes'],
];
