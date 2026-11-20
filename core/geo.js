// Location matching without any map service: compare the place words in a job's location
// with the person's city, state/region and country, and sort jobs into distance tiers.
// It works offline and sends nothing anywhere. It is text-based, so "near" means same city,
// then same state, then same country, not kilometres.

export const US_STATES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine',
  MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', PR: 'Puerto Rico',
};
export const CA_PROVINCES = { AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba', NB: 'New Brunswick', NL: 'Newfoundland and Labrador', NS: 'Nova Scotia', ON: 'Ontario', PE: 'Prince Edward Island', QC: 'Quebec', SK: 'Saskatchewan' };

// Country name -> other names it appears under in job ads.
export const COUNTRIES = {
  'United States': ['usa', 'us', 'u.s.', 'u.s.a.', 'united states of america', 'america'], 'Canada': ['ca'], 'Mexico': ['méxico', 'mx'],
  'United Kingdom': ['uk', 'u.k.', 'england', 'scotland', 'wales', 'great britain', 'britain', 'gb'], 'Ireland': ['ie'], 'Germany': ['deutschland', 'de'],
  'France': ['fr'], 'Spain': ['españa', 'es'], 'Portugal': ['pt'], 'Italy': ['italia', 'it'], 'Netherlands': ['the netherlands', 'holland', 'nl'],
  'Belgium': ['be'], 'Luxembourg': ['lu'], 'Switzerland': ['schweiz', 'suisse', 'ch'], 'Austria': ['österreich', 'at'], 'Denmark': ['dk'], 'Sweden': ['se'],
  'Norway': ['no'], 'Finland': ['fi'], 'Iceland': [], 'Poland': ['pl'], 'Czechia': ['czech republic', 'cz'], 'Slovakia': [], 'Hungary': [], 'Romania': [],
  'Bulgaria': [], 'Greece': [], 'Croatia': [], 'Slovenia': [], 'Serbia': [], 'Estonia': [], 'Latvia': [], 'Lithuania': [], 'Ukraine': [], 'Turkey': ['türkiye'],
  'Israel': [], 'United Arab Emirates': ['uae', 'dubai', 'abu dhabi'], 'Saudi Arabia': [], 'Egypt': [], 'Morocco': ['maroc'], 'Nigeria': [], 'Kenya': [],
  'South Africa': [], 'Ghana': [], 'Senegal': ['sénégal'], "Côte d'Ivoire": ['ivory coast', 'cote d’ivoire', "cote d'ivoire"], 'Mali': [],
  'India': ['in'], 'Pakistan': [], 'Bangladesh': [], 'Sri Lanka': [], 'Singapore': ['sg'], 'Malaysia': [], 'Indonesia': [], 'Philippines': [], 'Vietnam': ['viet nam'],
  'Thailand': [], 'China': [], 'Hong Kong': [], 'Taiwan': [], 'Japan': ['jp'], 'South Korea': ['korea'], 'Australia': ['au'], 'New Zealand': ['nz'],
  'Brazil': ['brasil', 'br'], 'Argentina': [], 'Chile': [], 'Colombia': [], 'Peru': [], 'Uruguay': [], 'Costa Rica': [],
};

// Regions used in remote job ads -> countries they cover.
const EUROPE = ['United Kingdom', 'Ireland', 'Germany', 'France', 'Spain', 'Portugal', 'Italy', 'Netherlands', 'Belgium', 'Luxembourg', 'Switzerland', 'Austria', 'Denmark', 'Sweden', 'Norway', 'Finland', 'Iceland', 'Poland', 'Czechia', 'Slovakia', 'Hungary', 'Romania', 'Bulgaria', 'Greece', 'Croatia', 'Slovenia', 'Serbia', 'Estonia', 'Latvia', 'Lithuania', 'Ukraine'];
const EU = EUROPE.filter((c) => !['United Kingdom', 'Switzerland', 'Norway', 'Iceland', 'Serbia', 'Ukraine'].includes(c));
const LATAM = ['Mexico', 'Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru', 'Uruguay', 'Costa Rica'];
const APAC = ['India', 'Singapore', 'Malaysia', 'Indonesia', 'Philippines', 'Vietnam', 'Thailand', 'China', 'Hong Kong', 'Taiwan', 'Japan', 'South Korea', 'Australia', 'New Zealand', 'Pakistan', 'Bangladesh', 'Sri Lanka'];
const AFRICA = ['Egypt', 'Morocco', 'Nigeria', 'Kenya', 'South Africa', 'Ghana', 'Senegal', "Côte d'Ivoire", 'Mali'];
export const REGIONS = {
  'north america': ['United States', 'Canada', 'Mexico'], 'americas': ['United States', 'Canada', ...LATAM], 'latam': LATAM, 'latin america': LATAM, 'south america': LATAM.filter((c) => !['Mexico', 'Costa Rica'].includes(c)),
  'europe': EUROPE, 'eu': EU, 'european union': EU, 'eea': EU, 'emea': [...EUROPE, 'Israel', 'United Arab Emirates', 'Saudi Arabia', 'Turkey', ...AFRICA], 'dach': ['Germany', 'Austria', 'Switzerland'], 'nordics': ['Denmark', 'Sweden', 'Norway', 'Finland', 'Iceland'],
  'apac': APAC, 'asia': APAC, 'asia pacific': APAC, 'anz': ['Australia', 'New Zealand'], 'africa': AFRICA, 'mena': ['Egypt', 'Morocco', 'Israel', 'United Arab Emirates', 'Saudi Arabia', 'Turkey'],
  'us and canada': ['United States', 'Canada'], 'usa and canada': ['United States', 'Canada'],
};
const ANYWHERE = /\b(anywhere|worldwide|global(ly)?|international|any location|all locations|fully remote anywhere)\b/i;

// Big job hubs that ads often name without a country.
export const CITIES = {
  'new york': ['United States', 'NY'], 'nyc': ['United States', 'NY'], 'brooklyn': ['United States', 'NY'], 'san francisco': ['United States', 'CA'], 'bay area': ['United States', 'CA'],
  'los angeles': ['United States', 'CA'], 'san diego': ['United States', 'CA'], 'san jose': ['United States', 'CA'], 'palo alto': ['United States', 'CA'], 'mountain view': ['United States', 'CA'],
  'menlo park': ['United States', 'CA'], 'oakland': ['United States', 'CA'], 'irvine': ['United States', 'CA'], 'sacramento': ['United States', 'CA'], 'santa monica': ['United States', 'CA'],
  'seattle': ['United States', 'WA'], 'bellevue': ['United States', 'WA'], 'redmond': ['United States', 'WA'], 'portland': ['United States', 'OR'], 'austin': ['United States', 'TX'],
  'dallas': ['United States', 'TX'], 'houston': ['United States', 'TX'], 'san antonio': ['United States', 'TX'], 'denver': ['United States', 'CO'], 'boulder': ['United States', 'CO'],
  'boston': ['United States', 'MA'], 'cambridge, ma': ['United States', 'MA'], 'chicago': ['United States', 'IL'], 'atlanta': ['United States', 'GA'], 'miami': ['United States', 'FL'],
  'phoenix': ['United States', 'AZ'], 'salt lake city': ['United States', 'UT'], 'washington, dc': ['United States', 'DC'], 'philadelphia': ['United States', 'PA'], 'pittsburgh': ['United States', 'PA'],
  'detroit': ['United States', 'MI'], 'minneapolis': ['United States', 'MN'], 'nashville': ['United States', 'TN'], 'raleigh': ['United States', 'NC'], 'charlotte': ['United States', 'NC'],
  'las vegas': ['United States', 'NV'], 'columbus': ['United States', 'OH'], 'toronto': ['Canada', 'ON'], 'vancouver': ['Canada', 'BC'], 'montreal': ['Canada', 'QC'], 'ottawa': ['Canada', 'ON'], 'calgary': ['Canada', 'AB'],
  'london': ['United Kingdom'], 'manchester': ['United Kingdom'], 'edinburgh': ['United Kingdom'], 'dublin': ['Ireland'], 'berlin': ['Germany'], 'munich': ['Germany'], 'münchen': ['Germany'], 'hamburg': ['Germany'],
  'frankfurt': ['Germany'], 'cologne': ['Germany'], 'köln': ['Germany'], 'stuttgart': ['Germany'], 'paris': ['France'], 'lyon': ['France'], 'amsterdam': ['Netherlands'], 'rotterdam': ['Netherlands'],
  'brussels': ['Belgium'], 'zurich': ['Switzerland'], 'zürich': ['Switzerland'], 'geneva': ['Switzerland'], 'vienna': ['Austria'], 'wien': ['Austria'], 'copenhagen': ['Denmark'], 'stockholm': ['Sweden'],
  'oslo': ['Norway'], 'helsinki': ['Finland'], 'madrid': ['Spain'], 'barcelona': ['Spain'], 'lisbon': ['Portugal'], 'milan': ['Italy'], 'rome': ['Italy'], 'warsaw': ['Poland'], 'krakow': ['Poland'],
  'prague': ['Czechia'], 'budapest': ['Hungary'], 'bucharest': ['Romania'], 'athens': ['Greece'], 'tel aviv': ['Israel'], 'istanbul': ['Turkey'], 'singapore': ['Singapore'], 'tokyo': ['Japan'],
  'seoul': ['South Korea'], 'sydney': ['Australia'], 'melbourne': ['Australia'], 'auckland': ['New Zealand'], 'bangalore': ['India'], 'bengaluru': ['India'], 'mumbai': ['India'], 'delhi': ['India'],
  'hyderabad': ['India'], 'pune': ['India'], 'são paulo': ['Brazil'], 'sao paulo': ['Brazil'], 'mexico city': ['Mexico'], 'buenos aires': ['Argentina'], 'bogotá': ['Colombia'], 'bogota': ['Colombia'],
  'lagos': ['Nigeria'], 'nairobi': ['Kenya'], 'cape town': ['South Africa'], 'johannesburg': ['South Africa'], 'casablanca': ['Morocco'], 'dakar': ['Senegal'], 'abidjan': ["Côte d'Ivoire"],
};

// Same city, different spelling.
const CITY_SAME = [['munich', 'münchen'], ['cologne', 'köln'], ['vienna', 'wien'], ['zurich', 'zürich'], ['bangalore', 'bengaluru'], ['sao paulo', 'são paulo'], ['bogota', 'bogotá'], ['new york', 'nyc', 'new york city'], ['montreal', 'montréal'], ['lisbon', 'lisboa'], ['prague', 'praha'], ['warsaw', 'warszawa'], ['geneva', 'genève']];
const canonCity = (c) => (CITY_SAME.find((g) => g.includes(c)) || [c])[0];

const STATE_BY_NAME = Object.fromEntries(Object.entries(US_STATES).map(([c, n]) => [n.toLowerCase(), c]));
const PROV_BY_NAME = Object.fromEntries(Object.entries(CA_PROVINCES).map(([c, n]) => [n.toLowerCase(), c]));
const COUNTRY_BY_ALIAS = new Map();
for (const [name, aliases] of Object.entries(COUNTRIES)) { COUNTRY_BY_ALIAS.set(name.toLowerCase(), name); for (const a of aliases) COUNTRY_BY_ALIAS.set(a, name); }

const words = (s) => ` ${String(s || '').toLowerCase().replace(/[()\[\]/;|·•]+/g, ',').replace(/\s+/g, ' ')} `;
const has = (hay, needle) => new RegExp(`(^|[^\\p{L}])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[^\\p{L}]|$)`, 'iu').test(hay);

/** Read place words from a location string, e.g. "Remote - US", "Austin, TX", "Berlin, Germany; London". */
export function parsePlace(text) {
  const raw = String(text || '');
  const t = words(raw);
  const countries = new Set(), states = new Set(), cities = new Set();
  const remote = /\b(remote|telework|work from home|home[- ]?based|distributed|anywhere)\b/i.test(raw);
  const anywhere = ANYWHERE.test(raw);
  for (const [city, [country, st]] of Object.entries(CITIES)) if (has(t, city)) { cities.add(city); countries.add(country); if (st) states.add(st); }
  // Two-letter codes only count in a "City, XX" pattern, to avoid false hits on words like "in" or "it".
  for (const m of raw.matchAll(/,\s*([A-Z]{2})\b(?!\s*[a-z])/g)) {
    const code = m[1];
    if (US_STATES[code]) { states.add(code); countries.add('United States'); }
    else if (CA_PROVINCES[code]) { states.add(code); countries.add('Canada'); }
    else if (COUNTRY_BY_ALIAS.has(code.toLowerCase())) countries.add(COUNTRY_BY_ALIAS.get(code.toLowerCase()));
  }
  for (const [name, code] of Object.entries(STATE_BY_NAME)) if (has(t, name) && !(name === 'washington' && has(t, 'washington, dc'))) { states.add(code); countries.add('United States'); }
  for (const [name, code] of Object.entries(PROV_BY_NAME)) if (has(t, name)) { states.add(code); countries.add('Canada'); }
  for (const [alias, name] of COUNTRY_BY_ALIAS) {
    if (alias.length <= 2) { if (new RegExp(`(^|[\\s,(-])${alias.toUpperCase()}(?=$|[\\s,)-])`).test(raw) && (remote || /,/.test(raw))) countries.add(name); continue; }
    if (has(t, alias)) countries.add(name);
  }
  const regions = new Set();
  for (const [region, list] of Object.entries(REGIONS)) if (has(t, region)) { regions.add(region); if (remote) list.forEach((c) => countries.add(c)); }
  // The first comma part, when it is not a known place, is treated as a city name.
  const first = raw.split(/[,;(|]/)[0].replace(/\bremote\b|[-–]/gi, '').trim().toLowerCase();
  if (first && first.length > 2 && !COUNTRY_BY_ALIAS.has(first) && !STATE_BY_NAME[first] && !REGIONS[first] && !/^(hybrid|on-?site|anywhere|worldwide)$/.test(first)) cities.add(first);
  return { countries, states, cities, regions, remote, anywhere: anywhere || (remote && !countries.size && !regions.size) };
}

/** The person's place, from what they typed or their resume. */
export function userPlace({ city = '', region = '', country = '' } = {}) {
  let c = String(country || '').trim();
  const r = String(region || '').trim();
  let state = '';
  const up = r.toUpperCase();
  if (US_STATES[up] && (!c || /^(us|usa|united states)/i.test(c))) { state = up; c ||= 'United States'; }
  else if (STATE_BY_NAME[r.toLowerCase()]) { state = STATE_BY_NAME[r.toLowerCase()]; c ||= 'United States'; }
  else if (CA_PROVINCES[up] && /canada/i.test(c)) state = up;
  else if (PROV_BY_NAME[r.toLowerCase()]) { state = PROV_BY_NAME[r.toLowerCase()]; c ||= 'Canada'; }
  else if (!c && COUNTRY_BY_ALIAS.has(r.toLowerCase())) c = COUNTRY_BY_ALIAS.get(r.toLowerCase());
  if (c) c = COUNTRY_BY_ALIAS.get(c.toLowerCase()) || c;
  return { city: String(city || '').trim().toLowerCase(), state, stateName: US_STATES[state] || CA_PROVINCES[state] || r, country: c };
}

/** Guess a country from the browser's time zone, as a starting point the person can change. */
export function countryFromTimeZone(tz) {
  const z = String(tz || '');
  if (/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Indiana|Kentucky|Boise|Juneau|Adak|Nome|Sitka|Menominee|North_Dakota)/.test(z) || z === 'Pacific/Honolulu') return 'United States';
  if (/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina|Montreal)/.test(z)) return 'Canada';
  const map = { 'Europe/London': 'United Kingdom', 'Europe/Dublin': 'Ireland', 'Europe/Berlin': 'Germany', 'Europe/Paris': 'France', 'Europe/Madrid': 'Spain', 'Europe/Lisbon': 'Portugal', 'Europe/Rome': 'Italy',
    'Europe/Amsterdam': 'Netherlands', 'Europe/Brussels': 'Belgium', 'Europe/Zurich': 'Switzerland', 'Europe/Vienna': 'Austria', 'Europe/Stockholm': 'Sweden', 'Europe/Oslo': 'Norway', 'Europe/Copenhagen': 'Denmark',
    'Europe/Helsinki': 'Finland', 'Europe/Warsaw': 'Poland', 'Europe/Prague': 'Czechia', 'Africa/Casablanca': 'Morocco', 'Africa/Lagos': 'Nigeria', 'Africa/Nairobi': 'Kenya', 'Africa/Johannesburg': 'South Africa',
    'Africa/Dakar': 'Senegal', 'Africa/Abidjan': "Côte d'Ivoire", 'Africa/Bamako': 'Mali', 'Asia/Kolkata': 'India', 'Asia/Singapore': 'Singapore', 'Asia/Tokyo': 'Japan', 'Australia/Sydney': 'Australia',
    'Australia/Melbourne': 'Australia', 'Pacific/Auckland': 'New Zealand', 'America/Mexico_City': 'Mexico', 'America/Sao_Paulo': 'Brazil', 'America/Argentina/Buenos_Aires': 'Argentina', 'Asia/Dubai': 'United Arab Emirates', 'Asia/Jerusalem': 'Israel' };
  return map[z] || '';
}

export const TIERS = [
  { key: 'city', label: (u) => `Near you${u.city ? ` (${titleCase(u.city)})` : ''}` },
  { key: 'state', label: (u) => `Elsewhere in ${u.stateName || 'your state'}` },
  { key: 'country', label: (u) => `Elsewhere in ${u.country || 'your country'}` },
  { key: 'remoteHome', label: (u) => `Remote, open to people in ${u.country || 'your country'}` },
  { key: 'remoteAny', label: () => 'Remote, anywhere' },
  { key: 'unknown', label: () => 'Location not stated' },
  { key: 'remoteOther', label: () => 'Remote, but only for other countries' },
  { key: 'abroad', label: () => 'In other countries' },
];
const titleCase = (s) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

/**
 * Where a job sits relative to the person.
 * @returns {{tier:string, label:string, reachable:boolean}}
 */
export function proximity(user, job) {
  const loc = [job.location, job.workplace === 'Remote' || job.remote ? 'remote' : '', job.remoteScope || ''].filter(Boolean).join(', ');
  const p = parsePlace(loc);
  const remote = p.remote || !!job.remote;
  const inCountry = user.country && p.countries.has(user.country);
  let tier;
  if (!loc.trim()) tier = 'unknown';
  else if (user.city && [...p.cities].map(canonCity).some((c) => { const u = canonCity(user.city); return c === u || c.includes(u) || u.includes(c); }) && (!p.countries.size || inCountry)) tier = 'city';
  else if (!remote && user.state && p.states.has(user.state)) tier = 'state';
  else if (!remote && inCountry) tier = 'country';
  else if (remote && inCountry) tier = 'remoteHome';
  else if (remote && (p.anywhere || (!p.countries.size && !p.regions.size))) tier = 'remoteAny';
  else if (remote) tier = 'remoteOther';
  else if (p.countries.size || p.states.size) tier = user.country ? 'abroad' : 'unknown';
  else tier = 'unknown';
  // An onsite job in the person's state or city that also allows remote still counts as near.
  if (remote && user.state && p.states.has(user.state) && tier === 'remoteHome') tier = 'state';
  const t = TIERS.find((x) => x.key === tier);
  return { tier, label: t.label(user), reachable: !['remoteOther', 'abroad'].includes(tier) };
}

const ORDER = {
  near: ['city', 'state', 'country', 'remoteHome', 'remoteAny', 'unknown', 'remoteOther', 'abroad'],
  remote: ['remoteHome', 'remoteAny', 'city', 'state', 'country', 'unknown', 'remoteOther', 'abroad'],
};
export function tierRank(mode, tier) { return (ORDER[mode] || ORDER.near).indexOf(tier); }
