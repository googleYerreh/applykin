// Tailor a resume to a job without inventing anything: find the keyword gaps, reorder
// existing bullets and skills by relevance, and suggest wording. New facts only come from the user.
import { extractSkills, resumeProfile, tokenize } from './match.js';

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
 */
export function tailorResume(resume, job) {
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

  // Reorder bullets within each role and skills within each group by relevance. Nothing is added or reworded.
  const tailored = structuredClone(resume);
  const moves = [];
  for (const w of tailored.work || []) {
    const before = [...(w.highlights || [])];
    w.highlights = before.map((h, i) => ({ h, i, r: relevance(h, jobSkills, jobTokens) })).sort((a, b) => b.r - a.r || a.i - b.i).map((x) => x.h);
    if (before.join('\n') !== w.highlights.join('\n')) moves.push(`${w.position || 'Role'}${w.name ? ' at ' + w.name : ''}: moved the most relevant bullet to the top`);
  }
  for (const g of tailored.skills || []) {
    g.keywords = [...(g.keywords || [])].sort((a, b) => Number(jobSkills.has(b.toLowerCase())) - Number(jobSkills.has(a.toLowerCase())));
  }

  const suggestions = [];
  if (job.title && !(resume.basics?.label || '').toLowerCase().includes(job.title.toLowerCase().replace(/\(.*\)/, '').trim())) {
    suggestions.push(`If it's accurate, set your headline to match the role: "${job.title.replace(/\s*\(.*\)/, '')}".`);
  }
  for (const k of listedOnly.slice(0, 5)) suggestions.push(`"${k}" is in your skills but no bullet shows it. Add a bullet with a result where you used ${k}.`);
  if (missing.length) suggestions.push(`The job mentions ${missing.slice(0, 6).join(', ')}. Add any you really have; leave out the rest.`);
  if (matched.length && !(resume.basics?.summary || '')) suggestions.push('Add a 2–3 sentence summary naming your strongest matching skills.');
  const coverage = jobSkills.size ? Math.round(100 * (matched.length + listedOnly.length) / jobSkills.size) : null;

  return { coverage, matched, listedOnly, missing, suggestions, changes: moves, tailoredResume: tailored };
}
