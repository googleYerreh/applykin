// Explainable, on-device job matching. No model download, no server: skills overlap,
// title similarity and TF-IDF text similarity, with the reasons shown for every score.

// A starter vocabulary of skills across fields. Contributors: add terms, keep them lowercase.
export const SKILL_VOCAB = `
javascript typescript python java kotlin swift go golang rust ruby php scala c# c++ .net node.js node react vue angular svelte next.js
html css sass tailwind graphql rest api apis microservices sql postgresql mysql mongodb redis elasticsearch kafka spark hadoop airflow dbt snowflake bigquery
aws azure gcp google cloud docker kubernetes terraform ansible ci/cd github actions jenkins linux bash git spring boot django flask fastapi rails laravel
machine learning deep learning nlp computer vision pytorch tensorflow scikit-learn llm data analysis data science statistics excel power bi tableau looker r pandas
figma sketch adobe xd photoshop illustrator indesign after effects premiere prototyping wireframing design systems interaction design visual design ux ui
user research user interviews usability testing journey mapping accessibility information architecture motion design branding typography
product management roadmap roadmapping agile scrum kanban jira confluence notion okrs a/b testing analytics experimentation stakeholder management
seo sem google ads content marketing copywriting social media email marketing hubspot salesforce crm marketing automation growth
sales account management business development lead generation cold calling negotiation customer success customer service customer support zendesk
project management budgeting forecasting financial modeling accounting bookkeeping quickbooks sap erp payroll audit tax compliance
recruiting sourcing onboarding hr employee relations training coaching mentoring public speaking presentations
forklift inventory warehouse logistics supply chain shipping receiving procurement purchasing lean six sigma quality assurance qa testing
nursing patient care emr cpr first aid phlebotomy scheduling medical billing
teaching curriculum lesson planning classroom management tutoring
technical writing documentation editing translation german english french spanish
security penetration testing soc siem iam networking tcp/ip cisco itil helpdesk active directory
leadership team leadership people management cross-functional collaboration communication problem solving
amazon seller central ppc e-commerce ecommerce marketplace shopify etsy walmart listing optimization product listings inventory management vendor management supplier management
operations management process improvement sops kpi kpis p&l budgeting pricing revenue management forecasting merchandising retail wholesale sourcing fulfillment
hospitality property management short-term rentals airbnb guest experience front desk housekeeping facilities maintenance scheduling dispatch
sales management account executive membership sales quota coaching recruiting onboarding training customer experience retention upselling
bookkeeping accounts payable accounts receivable reconciliation invoicing data entry virtual assistant admin administrative transcription tutoring
`.trim();

const VOCAB = [...new Set(SKILL_VOCAB.split(/\s+/).join(' ').match(/\S+/g))];
// Multi-word phrases recognized as one skill.
const PHRASES = ['amazon seller central', 'listing optimization', 'product listings', 'inventory management', 'vendor management', 'supplier management', 'operations management',
  'process improvement', 'revenue management', 'property management', 'short-term rentals', 'guest experience', 'front desk', 'sales management', 'account executive',
  'membership sales', 'customer experience', 'accounts payable', 'accounts receivable', 'data entry', 'virtual assistant', 'machine learning', 'deep learning', 'computer vision', 'data analysis', 'data science', 'power bi', 'google cloud', 'github actions', 'spring boot',
  'adobe xd', 'after effects', 'design systems', 'interaction design', 'visual design', 'user research', 'user interviews', 'usability testing', 'journey mapping',
  'information architecture', 'motion design', 'product management', 'a/b testing', 'stakeholder management', 'content marketing', 'social media', 'email marketing',
  'marketing automation', 'account management', 'business development', 'lead generation', 'cold calling', 'customer success', 'customer service', 'customer support',
  'project management', 'financial modeling', 'employee relations', 'public speaking', 'supply chain', 'six sigma', 'quality assurance', 'patient care', 'first aid',
  'medical billing', 'lesson planning', 'classroom management', 'technical writing', 'penetration testing', 'active directory', 'team leadership', 'people management',
  'cross-functional collaboration', 'problem solving', 'scikit-learn', 'ci/cd'];
const SINGLE = VOCAB.filter((w) => !PHRASES.some((p) => p.split(' ').includes(w)) || ['figma', 'jira'].includes(w));
const ALIASES = { golang: 'go', 'node.js': 'node', postgres: 'postgresql', k8s: 'kubernetes', 'ci/cd': 'ci/cd', apis: 'api', 'ux design': 'ux', 'ui design': 'ui' };

const STOP = new Set('a an and the of to in for on with at by from as is are be or we you our your this that will who what our their it its all any can job role team work working experience years year more new help using use including across about into within'.split(' '));

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/#]/g, '\\$&');
const termRe = new Map();
function hasTerm(textLower, term) {
  if (!textLower.includes(term)) return false; // cheap filter before the regex
  let re = termRe.get(term);
  if (!re) { re = new RegExp(`(^|[^a-z0-9+#])${esc(term)}(?![a-z0-9+#])`, 'i'); termRe.set(term, re); }
  return re.test(textLower);
}

const SHORT = new Set(['go', 'r', 'ui', 'ux', 'qa', 'hr', 'seo', 'sem', 'crm', 'erp', 'emr', 'cpr', 'sql', 'aws', 'gcp', 'git', 'api', 'rest']);
const shortRe = new Map();
const leadOf = new Map();
// A term can only match if its first word is a whole word in the text. Checking that in a Set
// first skips almost every regex, which keeps ranking 20,000+ jobs fast in the browser.
function lead(term) {
  let l = leadOf.get(term);
  if (l === undefined) { l = (term.match(/^[a-z0-9+#]+/) || [''])[0]; leadOf.set(term, l); }
  return l;
}

/** Skills found in a text, from the vocabulary plus any extra terms given (e.g. the resume's own skills). */
export function extractSkills(text, extra = [], pre) {
  const t = pre?.t || ` ${String(text || '').toLowerCase()} `;
  const words = pre?.words || new Set(t.split(/[^a-z0-9+#]+/));
  const may = (term) => { const l = lead(term); return l ? words.has(l) : t.includes(term); };
  const found = new Set(pre?.vocab || []);
  if (pre?.vocab) return addExtras(found, t, extra, may);
  for (const p of PHRASES) if (may(p) && hasTerm(t, p)) found.add(p);
  for (const w of SINGLE) {
    if (!may(w)) continue;
    if (w.length < 2 || SHORT.has(w)) {
      // short terms: require exact token match with case-sensitive-ish guard
      let re = shortRe.get(w);
      if (!re) { re = new RegExp(`(^|[\\s,(/])${esc(w)}(?=[\\s,)./:;]|$)`, 'i'); shortRe.set(w, re); }
      // "go" only as the language: "Golang", or capital "Go" in a list or before developer/engineer.
      const hit = w === 'go' ? /\bgolang\b|\bGo\b(?=\s*(,|\/|\)|and\b|developer|engineer|programming))|[,(/]\s*Go\b/.test(String(text || '')) : re.test(t);
      if (hit) found.add(ALIASES[w] || w);
      continue;
    }
    if (hasTerm(t, w)) found.add(ALIASES[w] || w);
  }
  return addExtras(found, t, extra, may);
}
function addExtras(found, t, extra, may) {
  for (const e of extra) {
    const k = String(e || '').toLowerCase().trim();
    if (k.length >= 2 && k.length <= 40 && may(k) && hasTerm(t, k)) found.add(ALIASES[k] || k);
  }
  return found;
}

// Per-job work that doesn't depend on the resume, done once per job object and reused on
// every re-sort, filter click and resume edit.
const jobCache = new WeakMap();
function prepJob(job) {
  let c = jobCache.get(job);
  if (!c) {
    const raw = `${job.title}\n${job.department || ''}\n${job.description || ''}`;
    const t = ` ${raw.toLowerCase()} `;
    const words = new Set(t.split(/[^a-z0-9+#]+/));
    c = { raw, t, words, tokens: tokenize(`${job.title} ${job.title} ${job.department || ''} ${job.description || ''}`) };
    c.vocab = [...extractSkills(raw, [], { t, words })];
    jobCache.set(job, c);
  }
  return c;
}

export function resumeText(r) {
  return [r.basics?.label, r.basics?.summary,
    ...(r.work || []).flatMap((w) => [w.position, w.name, w.summary, ...(w.highlights || [])]),
    ...(r.education || []).flatMap((e) => [e.studyType, e.area, e.institution]),
    ...(r.skills || []).flatMap((s) => [s.name, ...(s.keywords || [])]),
    ...(r.projects || []).flatMap((p) => [p.name, ...(p.highlights || [])]),
    ...(r.certificates || []).map((c) => c.name)].filter(Boolean).join('\n');
}

// Words that appear in almost every job ad; alone they say nothing about a skill.
const GENERIC = new Set('customer management development service support data design business team product project user social media content account sales marketing operations people technical public quality first patient medical front property short-term revenue growth platforms tools systems strategy relationship relationships performance'.split(' '));

export function resumeSkillList(r) {
  // Rejoin keywords a PDF line-wrap split in two: "KPI &" + "Performance Management".
  const raw = (r.skills || []).flatMap((s) => s.keywords || []).map((k) => String(k).trim()).filter(Boolean);
  const keys = [];
  for (const k of raw) {
    const prev = keys[keys.length - 1];
    if (prev && (/(&|\band|\/|,)$/i.test(prev) || /^(&|and\b|\/)/i.test(k))) keys[keys.length - 1] = `${prev} ${k}`.replace(/\s+/g, ' ');
    else keys.push(k);
  }
  const known = new Set([...VOCAB, ...PHRASES].filter((w) => !GENERIC.has(w)));
  const out = new Set();
  for (const k of keys) {
    const low = k.toLowerCase().replace(/^[&/,\s]+|[&/,\s]+$/g, '').trim();
    if (low.length >= 2) out.add(low);
    // "Amazon PPC & Advertising" -> "amazon ppc", "advertising". A lone generic word
    // ("customer", "platforms") is kept only if it is a known skill, so it can't match every job.
    for (let part of low.split(/\s*(?:&|\band\b|\/|,)\s*/)) {
      part = part.replace(/\(.*?\)/g, '').trim();
      if (part.length < 2 || part === low) continue;
      if (part.includes(' ') || known.has(part)) out.add(part);
    }
  }
  return [...out];
}

export function resumeProfile(r) {
  const text = resumeText(r);
  const own = resumeSkillList(r);
  return {
    text,
    skills: extractSkills(text, own),
    ownSkills: own,
    titles: [r.basics?.label, ...(r.work || []).slice(0, 3).map((w) => w.position)].filter(Boolean),
    tokens: tokenize(text),
    stems: new Set(tokenize(text).map((w) => FAMILY[w] || w).map(stem).map((w) => FAMILY[w] || w)),
  };
}

export function tokenize(text) {
  return (String(text || '').toLowerCase().match(/[a-zà-ÿ0-9+#.]{2,}/g) || [])
    .map((t) => t.replace(/\.$/, ''))
    .filter((t) => !STOP.has(t) && !/^\d+$/.test(t));
}

const SENIORITY = /\b(senior|sr|junior|jr|principal|staff|intern|entry|mid|level|i{1,3}|iv)\b\.?/gi;
// Words that say how senior a role is, not what field it is in. "Manager" alone must not make
// a Sales Manager look like an Operations Manager.
const LEVEL = new Set('manager manag director head lead chief vp vice president officer supervisor coordinator specialist associate assistant executive representative rep owner founder partner consultant administrator admin'.split(' '));
const TITLE_STOP = new Set('general all levels remote hybrid global freelance contract part-time part time full-time temporary'.split(' '));
const FAMILY = { ops: 'operation', operational: 'operation', operating: 'operation', ecommerce: 'e-commerce', gm: 'operation' };
const stem = (t) => (t.length > 5 ? t.replace(/(ers|er|ing|ment|s)$/, '') : t);
function titleParts(raw) {
  let t = String(raw || '').toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ')             // "(All Levels)", "(Sales focus)"
    .split(/\s+[|–—]\s+|\s+-\s+/)[0]                 // drop "- Iberia", "| Enterprise" tails
    .replace(SENIORITY, ' ')
    .replace(/\bgeneral manager\b/g, 'gm manager');   // a GM runs operations
  const toks = tokenize(t).map((w) => FAMILY[w] || w).map(stem).map((w) => FAMILY[w] || w);
  return {
    field: new Set(toks.filter((w) => !LEVEL.has(w) && !TITLE_STOP.has(w))),
    level: new Set(toks.filter((w) => LEVEL.has(w))),
  };
}
function titleSimilarity(a, b) {
  const A = titleParts(a), B = titleParts(b);
  if (!B.field.size && !B.level.size) return 0;
  let inter = 0; for (const t of B.field) if (A.field.has(t)) inter++;
  // How much of the job's field you have done (Dice keeps one shared word from counting as a full match).
  const field = B.field.size && A.field.size ? (2 * inter) / (A.field.size + B.field.size) : 0;
  const levelHit = [...B.level].some((t) => A.level.has(t)) ? 1 : 0;
  if (!B.field.size) return 0.4 * levelHit;
  return Math.min(1, 0.8 * Math.min(1, field * 1.25) + 0.2 * levelHit * (inter ? 1 : 0.5));
}

/** Build IDF from a set of jobs so common words count less. */
export function buildIndex(jobs) {
  const df = new Map();
  const docs = jobs.map((j) => {
    const toks = typeof j === 'object' && j ? prepJob(j).tokens : [];
    for (const t of new Set(toks)) df.set(t, (df.get(t) || 0) + 1);
    return toks;
  });
  const N = jobs.length || 1;
  const cache = new Map();
  const idf = (t) => { let v = cache.get(t); if (v === undefined) { v = Math.log(1 + N / (1 + (df.get(t) || 0))); cache.set(t, v); } return v; };
  return { docs, idf };
}

function tfidfVector(tokens, idf) {
  const tf = new Map();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  const v = new Map();
  let norm = 0;
  for (const [t, n] of tf) { const w = (1 + Math.log(n)) * idf(t); v.set(t, w); norm += w * w; }
  return { v, norm: Math.sqrt(norm) || 1 };
}

function cosine(a, b) {
  let dot = 0;
  const [s, l] = a.v.size < b.v.size ? [a, b] : [b, a];
  for (const [t, w] of s.v) { const w2 = l.v.get(t); if (w2) dot += w * w2; }
  return dot / (a.norm * b.norm);
}

const TEXT_FLOOR = 0.03, TEXT_STRONG = 0.13;

/** Plain-language band for a match score. */
export const MATCH_BANDS = [
  { min: 75, id: 'strong', label: 'Strong match' },
  { min: 60, id: 'good', label: 'Good match' },
  { min: 45, id: 'fair', label: 'Worth a look' },
  { min: 0, id: 'low', label: 'Stretch' },
];
export function matchBand(score) { return MATCH_BANDS.find((b) => score >= b.min); }

/**
 * Score one job for one resume.
 * @returns {{score:number, parts:{skills:number,title:number,text:number}, matched:string[], missing:string[], reasons:string[]}}
 */
export function matchJob(profile, job, index, docTokens, jobIndex = -1) {
  const pj = prepJob(job);
  const jobSkills = extractSkills(pj.raw, profile.ownSkills, pj);
  const matched = [...jobSkills].filter((s) => profile.skills.has(s));
  const missing = [...jobSkills].filter((s) => !profile.skills.has(s));
  const skills = jobSkills.size ? Math.min(1, matched.length / Math.min(Math.max(jobSkills.size, 3), 10)) : 0.3;
  let held = 0, heldAs = '';
  for (const t of profile.titles) { const v = titleSimilarity(t, job.title); if (v > held) { held = v; heldAs = t; } }
  // Work you have done without holding the title ("Amazon listing" in your bullets) earns
  // partial title credit, capped below a title you actually held.
  const jf = titleParts(job.title).field;
  let done = 0; for (const w of jf) if (profile.stems.has(w)) done++;
  const title = Math.max(held, jf.size ? 0.6 * (done / jf.size) : 0);
  const idf = index?.idf || (() => 1);
  const pv = profile._vec?.idf === idf ? profile._vec.v : (profile._vec = { idf, v: tfidfVector(profile.tokens, idf) }).v;
  const jv = index?.vecs?.[jobIndex] || tfidfVector(docTokens || pj.tokens, idf);
  const text = cosine(pv, jv);
  // Calibrated on real feeds: résumé-vs-ad cosine sits near 0.03 for unrelated jobs and
  // 0.13+ for a close one, so that range becomes 0-100 instead of capping text at a third.
  const textFit = Math.max(0, Math.min(1, (text - TEXT_FLOOR) / (TEXT_STRONG - TEXT_FLOOR)));
  const raw = 0.45 * skills + 0.35 * title + 0.2 * textFit;
  const score = Math.round(100 * raw);
  const reasons = [];
  if (held >= 0.6) reasons.push(`Close to your role as ${heldAs}`);
  else if (title >= 0.45 && done) reasons.push(`Your experience covers ${tokenize(job.title).filter((w) => profile.stems.has(FAMILY[stem(FAMILY[w] || w)] || stem(FAMILY[w] || w)) && jf.has(FAMILY[stem(FAMILY[w] || w)] || stem(FAMILY[w] || w))).join(' ')} work`);
  if (matched.length) reasons.push(`You have ${matched.length} of ${jobSkills.size} skills it mentions`);
  if (missing.length) reasons.push(`Not on your resume: ${missing.slice(0, 4).join(', ')}`);
  return { score, parts: { skills: Math.round(skills * 100), title: Math.round(title * 100), text: Math.round(textFit * 100) }, band: matchBand(score), matched, missing, reasons };
}

/**
 * Rank jobs for a resume, with simple filters.
 * @param {object} resume JSON Resume
 * @param {object[]} jobs
 * @param {{query?:string, remote?:boolean, location?:string, limit?:number}} opts
 */
const indexCache = new WeakMap();
export function rankJobs(resume, jobs, opts = {}) {
  const q = (opts.query || '').toLowerCase().trim();
  const loc = (opts.location || '').toLowerCase().trim();
  const pool = jobs.filter((j) =>
    (!q || `${j.title} ${j.company} ${j.description}`.toLowerCase().includes(q)) &&
    (!opts.remote || j.remote) &&
    (!loc || `${j.location}`.toLowerCase().includes(loc) || (j.remote && opts.includeRemote !== false)));
  // The word-weight index only depends on which jobs are in the pool, so reuse it across
  // re-renders (sorting, location, resume edits) for the same job list and search.
  let byKey = indexCache.get(jobs);
  if (!byKey) indexCache.set(jobs, (byKey = new Map()));
  const key = `${q}|${opts.remote ? 1 : 0}|${loc}|${pool.length}`;
  let index = byKey.get(key);
  if (!index) { if (byKey.size > 8) byKey.clear(); index = buildIndex(pool); index.vecs = index.docs.map((d) => tfidfVector(d, index.idf)); byKey.set(key, index); }
  const profile = resumeProfile(resume);
  return pool
    .map((job, i) => ({ job, match: matchJob(profile, job, index, index.docs[i], i) }))
    .sort((a, b) => b.match.score - a.match.score || (b.job.postedAt || '').localeCompare(a.job.postedAt || ''))
    .slice(0, opts.limit || 200);
}

/** Show a skill the way the resume (or the job ad) writes it: "figma" -> "Figma". */
export function displaySkill(term, ...texts) {
  for (const t of texts) {
    const m = String(t || '').match(new RegExp(`(?:^|[^A-Za-z0-9+#])(${esc(term)})(?![A-Za-z0-9+#])`, 'i'));
    if (m) return m[1];
  }
  return term;
}
