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
`.trim();

const VOCAB = [...new Set(SKILL_VOCAB.split(/\s+/).join(' ').match(/\S+/g))];
// Multi-word phrases recognized as one skill.
const PHRASES = ['machine learning', 'deep learning', 'computer vision', 'data analysis', 'data science', 'power bi', 'google cloud', 'github actions', 'spring boot',
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
  let re = termRe.get(term);
  if (!re) { re = new RegExp(`(^|[^a-z0-9+#])${esc(term)}(?![a-z0-9+#])`, 'i'); termRe.set(term, re); }
  return re.test(textLower);
}

/** Skills found in a text, from the vocabulary plus any extra terms given (e.g. the resume's own skills). */
export function extractSkills(text, extra = []) {
  const t = ` ${String(text || '').toLowerCase()} `;
  const found = new Set();
  for (const p of PHRASES) if (hasTerm(t, p)) found.add(p);
  for (const w of SINGLE) {
    if (w.length < 2 || ['go', 'r', 'ui', 'ux', 'qa', 'hr', 'seo', 'sem', 'crm', 'erp', 'emr', 'cpr', 'sql', 'aws', 'gcp', 'git', 'api', 'rest'].includes(w)) {
      // short terms: require exact token match with case-sensitive-ish guard
      const re = new RegExp(`(^|[\\s,(/])${esc(w)}(?=[\\s,)./:;]|$)`, 'i');
      // "go" only as the language: "Golang", or capital "Go" in a list or before developer/engineer.
      const hit = w === 'go' ? /\bgolang\b|\bGo\b(?=\s*(,|\/|\)|and\b|developer|engineer|programming))|[,(/]\s*Go\b/.test(String(text || '')) : re.test(t);
      if (hit) found.add(ALIASES[w] || w);
      continue;
    }
    if (hasTerm(t, w)) found.add(ALIASES[w] || w);
  }
  for (const e of extra) {
    const k = String(e || '').toLowerCase().trim();
    if (k.length >= 2 && k.length <= 40 && hasTerm(t, k)) found.add(ALIASES[k] || k);
  }
  return found;
}

export function resumeText(r) {
  return [r.basics?.label, r.basics?.summary,
    ...(r.work || []).flatMap((w) => [w.position, w.name, w.summary, ...(w.highlights || [])]),
    ...(r.education || []).flatMap((e) => [e.studyType, e.area, e.institution]),
    ...(r.skills || []).flatMap((s) => [s.name, ...(s.keywords || [])]),
    ...(r.projects || []).flatMap((p) => [p.name, ...(p.highlights || [])]),
    ...(r.certificates || []).map((c) => c.name)].filter(Boolean).join('\n');
}

export function resumeSkillList(r) {
  return (r.skills || []).flatMap((s) => s.keywords || []).map((k) => k.toLowerCase());
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
  };
}

export function tokenize(text) {
  return (String(text || '').toLowerCase().match(/[a-zà-ÿ0-9+#.]{2,}/g) || [])
    .map((t) => t.replace(/\.$/, ''))
    .filter((t) => !STOP.has(t) && !/^\d+$/.test(t));
}

const SENIORITY = /\b(senior|sr|junior|jr|lead|principal|staff|head|intern|chief|associate|entry|mid)\b\.?/gi;
const stem = (t) => (t.length > 5 ? t.replace(/(ers|er|ing|ment|s)$/, '') : t);
function titleSimilarity(a, b) {
  const ta = new Set(tokenize(a.replace(SENIORITY, '')).map(stem)), tb = new Set(tokenize(b.replace(SENIORITY, '')).map(stem));
  if (!ta.size || !tb.size) return 0;
  let inter = 0; for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.min(ta.size, tb.size);
}

/** Build IDF from a set of jobs so common words count less. */
export function buildIndex(jobs) {
  const df = new Map();
  const docs = jobs.map((j) => {
    const toks = tokenize(`${j.title} ${j.title} ${j.department || ''} ${j.description || ''}`);
    for (const t of new Set(toks)) df.set(t, (df.get(t) || 0) + 1);
    return toks;
  });
  const N = jobs.length || 1;
  const idf = (t) => Math.log(1 + N / (1 + (df.get(t) || 0)));
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

/**
 * Score one job for one resume.
 * @returns {{score:number, parts:{skills:number,title:number,text:number}, matched:string[], missing:string[], reasons:string[]}}
 */
export function matchJob(profile, job, index, docTokens) {
  const jobText = `${job.title}\n${job.department || ''}\n${job.description || ''}`;
  const jobSkills = extractSkills(jobText, profile.ownSkills);
  const matched = [...jobSkills].filter((s) => profile.skills.has(s));
  const missing = [...jobSkills].filter((s) => !profile.skills.has(s));
  const skills = jobSkills.size ? Math.min(1, matched.length / Math.min(Math.max(jobSkills.size, 3), 10)) : 0.3;
  const title = Math.max(0, ...profile.titles.map((t) => titleSimilarity(t, job.title)));
  const idf = index?.idf || (() => 1);
  const text = cosine(tfidfVector(profile.tokens, idf), tfidfVector(docTokens || tokenize(jobText), idf));
  const raw = 0.45 * skills + 0.35 * title + 0.2 * Math.min(1, text * 2.5);
  const score = Math.round(100 * raw);
  const reasons = [];
  if (title >= 0.5) reasons.push(`Title is close to your experience as ${profile.titles[0] || 'listed'}`);
  if (matched.length) reasons.push(`You have ${matched.length} of ${jobSkills.size} skills it mentions`);
  if (missing.length) reasons.push(`Not on your resume: ${missing.slice(0, 4).join(', ')}`);
  return { score, parts: { skills: Math.round(skills * 100), title: Math.round(title * 100), text: Math.round(Math.min(1, text * 2.5) * 100) }, matched, missing, reasons };
}

/**
 * Rank jobs for a resume, with simple filters.
 * @param {object} resume JSON Resume
 * @param {object[]} jobs
 * @param {{query?:string, remote?:boolean, location?:string, limit?:number}} opts
 */
export function rankJobs(resume, jobs, opts = {}) {
  const q = (opts.query || '').toLowerCase().trim();
  const loc = (opts.location || '').toLowerCase().trim();
  const pool = jobs.filter((j) =>
    (!q || `${j.title} ${j.company} ${j.description}`.toLowerCase().includes(q)) &&
    (!opts.remote || j.remote) &&
    (!loc || `${j.location}`.toLowerCase().includes(loc) || (j.remote && opts.includeRemote !== false)));
  const index = buildIndex(pool);
  const profile = resumeProfile(resume);
  return pool
    .map((job, i) => ({ job, match: matchJob(profile, job, index, index.docs[i]) }))
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
