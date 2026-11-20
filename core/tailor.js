// Tailor a resume to one job without inventing anything. Every change is one of:
//  - reorder: most relevant bullets, skills and skill groups first
//  - spelling: use the job ad's name for a skill you already list ("Postgres" -> "PostgreSQL")
//  - trim (optional): leave out bullets from older jobs that relate to nothing in the ad, for this version only
//  - headline (optional, only when you confirm it is accurate): use the ad's job title as your headline
// New facts, skills, numbers or experience are never added. Every change is listed for review.
import { extractSkills, resumeProfile, tokenize } from './match.js';

// Different names for the same skill. Contributors: add groups, keep them lowercase.
export const SKILL_SYNONYMS = [
  ['postgresql', 'postgres'], ['javascript', 'js'], ['typescript', 'ts'], ['kubernetes', 'k8s'], ['node.js', 'nodejs', 'node'],
  ['microsoft excel', 'ms excel', 'excel'], ['microsoft office', 'ms office', 'office 365', 'microsoft 365'], ['powerpoint', 'ms powerpoint'],
  ['google ads', 'adwords', 'google adwords'], ['search engine optimization', 'seo'], ['pay-per-click', 'ppc'],
  ['customer relationship management', 'crm'], ['amazon web services', 'aws'], ['google cloud', 'gcp', 'google cloud platform'],
  ['machine learning', 'ml'], ['artificial intelligence', 'ai'], ['user experience', 'ux'], ['user interface', 'ui'],
  ['continuous integration', 'ci/cd', 'ci'], ['profit and loss', 'p&l', 'p & l'], ['key performance indicators', 'kpis', 'kpi'],
  ['standard operating procedures', 'sops', 'sop'], ['amazon seller central', 'seller central'], ['salesforce', 'sfdc'],
  ['project management', 'pm'], ['human resources', 'hr'], ['quality assurance', 'qa'], ['b2b', 'business-to-business'],
  ['e-commerce', 'ecommerce', 'e commerce'], ['a/b testing', 'ab testing', 'split testing'],
];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const findForm = (text, form) => {
  const m = String(text).match(new RegExp(`(?:^|[^A-Za-z0-9+#])(${esc(form)})(?![A-Za-z0-9+#])`, 'i'));
  return m ? m[1] : null;
};

function relevance(text, jobSkills, jobTokens) {
  const t = String(text || '').toLowerCase();
  let s = 0;
  for (const k of jobSkills) if (t.includes(k)) s += 3;
  for (const tok of new Set(tokenize(t))) if (jobTokens.has(tok)) s += 0.3;
  return s;
}

/**
 * @param {object} resume JSON Resume
 * @param {{title?:string, company?:string, description:string}} job
 * @param {{trimOlder?:boolean, headline?:boolean}} opts
 */
export function tailorResume(resume, job, opts = {}) {
  const jobText = `${job.title || ''}\n${job.description || ''}`;
  const profile = resumeProfile(resume);
  const jobSkills = extractSkills(jobText, profile.ownSkills);
  const jobTokens = new Set(tokenize(jobText));
  const bulletsText = (resume.work || []).flatMap((w) => w.highlights || []).join('\n').toLowerCase();
  const listed = new Set(profile.ownSkills);

  const matched = [], listedOnly = [], missing = [];
  for (const k of jobSkills) {
    const forms = [k, k.replace(/s$/, '')].filter((x) => x.length > 1);
    const inText = (txt) => forms.some((f) => txt.includes(f));
    if (inText(bulletsText) || inText((resume.basics?.summary || '').toLowerCase())) matched.push(k);
    else if (profile.skills.has(k) || listed.has(k)) listedOnly.push(k);
    else missing.push(k);
  }

  const tailored = structuredClone(resume);
  const changes = [];

  // 1. Skill spelling: if the ad names a skill you list under another name, use the ad's name.
  for (const g of tailored.skills || []) {
    g.keywords = (g.keywords || []).map((kw) => {
      const low = kw.toLowerCase().trim();
      const group = SKILL_SYNONYMS.find((grp) => grp.includes(low));
      if (!group || findForm(jobText, kw)) return kw;
      for (const alt of group) {
        if (alt === low) continue;
        const form = findForm(jobText, alt);
        if (form && form.length > 1) { changes.push({ kind: 'spelling', text: `Skill "${kw}" written as "${form}", the way the job ad says it` }); return form; }
      }
      return kw;
    });
  }

  // 2. Reorder bullets within each job, and skills within each group, by relevance to the ad.
  const relSkills = new Set([...jobSkills].map((s) => s.toLowerCase()));
  (tailored.work || []).forEach((w, i) => {
    const before = [...(w.highlights || [])];
    const scored = before.map((h, j) => ({ h, j, r: relevance(h, jobSkills, jobTokens) }));
    w.highlights = [...scored].sort((a, b) => b.r - a.r || a.j - b.j).map((x) => x.h);
    if (before.join('\n') !== w.highlights.join('\n')) changes.push({ kind: 'reorder', text: `${w.position || 'Job'}${w.name ? ' at ' + w.name : ''}: most relevant bullet moved to the top` });

    // 3. Optional trim: older jobs (3rd and later) lose bullets that relate to nothing in the ad. Keep at least 2.
    if (opts.trimOlder && i >= 2 && w.highlights.length > 2) {
      const keep = scored.filter((x) => x.r > 0).map((x) => x.h);
      const kept = w.highlights.filter((h) => keep.includes(h));
      while (kept.length < 2) kept.push(w.highlights.find((h) => !kept.includes(h)));
      const removed = w.highlights.length - kept.length;
      if (removed > 0) {
        w.highlights = w.highlights.filter((h) => kept.includes(h));
        changes.push({ kind: 'trim', text: `${w.position || 'Job'}${w.name ? ' at ' + w.name : ''}: left out ${removed} bullet${removed > 1 ? 's' : ''} unrelated to this job (still in your main resume)` });
      }
    }
  });
  let skillMoves = 0;
  for (const g of tailored.skills || []) {
    const before = (g.keywords || []).join('|');
    g.keywords = [...(g.keywords || [])].sort((a, b) => Number(relSkills.has(b.toLowerCase())) - Number(relSkills.has(a.toLowerCase())));
    if (g.keywords.join('|') !== before) skillMoves++;
  }
  if ((tailored.skills || []).length > 1) {
    const before = tailored.skills.map((g) => g.name).join('|');
    tailored.skills.sort((a, b) => (b.keywords || []).filter((k) => relSkills.has(k.toLowerCase())).length - (a.keywords || []).filter((k) => relSkills.has(k.toLowerCase())).length);
    if (tailored.skills.map((g) => g.name).join('|') !== before) skillMoves++;
  }
  if (skillMoves) changes.push({ kind: 'reorder', text: 'Skills that the job asks for moved to the front' });

  // 4. Optional headline, only when the person confirms the title is accurate for them.
  const cleanTitle = String(job.title || '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s*[-–|,]\s*(remote|hybrid|on-?site|[A-Z]{2,})$/i, '').trim();
  const headlineDiffers = cleanTitle && (tailored.basics?.label || '').toLowerCase() !== cleanTitle.toLowerCase();
  if (opts.headline && headlineDiffers) {
    changes.push({ kind: 'headline', text: `Headline changed from "${tailored.basics.label || '(none)'}" to "${cleanTitle}"` });
    tailored.basics.label = cleanTitle;
  }

  const suggestions = [];
  for (const k of listedOnly.slice(0, 5)) suggestions.push(`"${k}" is in your skills, but no bullet shows it. If you've used it, add a bullet with a result.`);
  if (missing.length) suggestions.push(`The job mentions ${missing.slice(0, 6).join(', ')}. Add any you really have; leave out the rest.`);
  if (!(resume.basics?.summary || '')) suggestions.push('Add a 2–3 sentence summary naming your strongest matching skills.');
  const coverage = jobSkills.size ? Math.round(100 * (matched.length + listedOnly.length) / jobSkills.size) : null;

  tailored.meta = { ...(tailored.meta || {}), applykin: { ...(tailored.meta?.applykin || {}), tailoredFor: { title: job.title || '', company: job.company || '', at: new Date().toISOString() } } };
  return { coverage, matched, listedOnly, missing, suggestions, changes, headlineOption: headlineDiffers ? cleanTitle : null, tailoredResume: tailored };
}
