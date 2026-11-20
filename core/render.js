// Renders a JSON Resume to a standalone, print-ready HTML page (single column, real text, ATS-safe).
// Print it to PDF from any browser, or with the CLI's `pdf` command.

export const LOCALES = {
  us: { label: 'United States', page: 'Letter', months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], fmt: 'mon-year', present: 'Present',
    h: { summary: 'Summary', work: 'Experience', education: 'Education', skills: 'Skills', projects: 'Projects', certificates: 'Certifications', languages: 'Languages', awards: 'Awards', volunteer: 'Volunteering', publications: 'Publications', interests: 'Interests' } },
  uk: { label: 'United Kingdom', page: 'A4', months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], fmt: 'mon-year', present: 'Present',
    h: { summary: 'Profile', work: 'Experience', education: 'Education', skills: 'Skills', projects: 'Projects', certificates: 'Certifications', languages: 'Languages', awards: 'Awards', volunteer: 'Volunteering', publications: 'Publications', interests: 'Interests' } },
  de: { label: 'Deutschland', page: 'A4', fmt: 'mm/yyyy', present: 'heute',
    h: { summary: 'Profil', work: 'Berufserfahrung', education: 'Ausbildung', skills: 'Kenntnisse', projects: 'Projekte', certificates: 'Zertifikate', languages: 'Sprachen', awards: 'Auszeichnungen', volunteer: 'Ehrenamt', publications: 'Publikationen', interests: 'Interessen' } },
  ch: { label: 'Schweiz', page: 'A4', fmt: 'mm.yyyy', present: 'heute',
    h: { summary: 'Profil', work: 'Berufserfahrung', education: 'Ausbildung', skills: 'Kenntnisse', projects: 'Projekte', certificates: 'Zertifikate', languages: 'Sprachen', awards: 'Auszeichnungen', volunteer: 'Ehrenamt', publications: 'Publikationen', interests: 'Interessen' } },
  fr: { label: 'France', page: 'A4', fmt: 'mm/yyyy', present: "aujourd'hui",
    h: { summary: 'Profil', work: 'Expérience professionnelle', education: 'Formation', skills: 'Compétences', projects: 'Projets', certificates: 'Certifications', languages: 'Langues', awards: 'Distinctions', volunteer: 'Bénévolat', publications: 'Publications', interests: "Centres d'intérêt" } },
};

export const TEMPLATES = {
  classic: { label: 'Classic', font: "Georgia, 'Times New Roman', serif", accent: '#1f2933', headingStyle: 'border-bottom:1px solid #1f2933;text-transform:uppercase;letter-spacing:.06em;font-size:11pt;', nameAlign: 'center' },
  modern: { label: 'Modern', font: "'Helvetica Neue', Arial, sans-serif", accent: '#0b5cad', headingStyle: 'color:#0b5cad;font-size:12pt;border-bottom:2px solid #0b5cad;', nameAlign: 'left' },
  compact: { label: 'Compact', font: "Arial, 'Helvetica Neue', sans-serif", accent: '#222', headingStyle: 'text-transform:uppercase;font-size:10pt;letter-spacing:.08em;background:#f0f0f0;padding:2px 6px;', nameAlign: 'left', compact: true },
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function formatDate(d, locale) {
  if (!d) return '';
  const L = LOCALES[locale] || LOCALES.us;
  const [y, m] = d.split('-');
  if (!m) return y;
  if (L.fmt === 'mon-year') return `${L.months[Number(m) - 1]} ${y}`;
  if (L.fmt === 'mm.yyyy') return `${m}.${y}`;
  return `${m}/${y}`;
}

function range(start, end, locale) {
  const L = LOCALES[locale] || LOCALES.us;
  if (!start && !end) return '';
  if (!start) return formatDate(end, locale);
  return `${formatDate(start, locale)} – ${end ? formatDate(end, locale) : L.present}`;
}

/**
 * @param {object} resume JSON Resume
 * @param {{template?:string, locale?:string}} opts
 * @returns {string} full HTML document
 */
export function renderResumeHTML(resume, opts = {}) {
  const locale = LOCALES[opts.locale] ? opts.locale : 'us';
  const L = LOCALES[locale];
  const T = TEMPLATES[opts.template] || TEMPLATES.classic;
  const b = resume.basics || {};
  const loc = [b.location?.city, b.location?.region].filter(Boolean).join(', ');
  const contact = [loc, b.email, b.phone, b.url, ...(b.profiles || []).map((p) => p.url)].filter(Boolean)
    .map((x) => `<span>${esc(x.replace(/^https?:\/\//, ''))}</span>`).join('<span class="sep"> · </span>');

  const sec = (key, inner) => (inner ? `<section><h2>${esc(L.h[key])}</h2>${inner}</section>` : '');
  const list = (items) => (items?.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '');

  const work = (resume.work || []).map((w) => `
    <div class="entry">
      <div class="row"><div><strong>${esc(w.position)}</strong>${w.name ? `${w.position ? ' — ' : ''}${esc(w.name)}` : ''}${w.location ? `, ${esc(w.location)}` : ''}</div><div class="date">${esc(range(w.startDate, w.endDate, locale))}</div></div>
      ${w.summary ? `<p>${esc(w.summary)}</p>` : ''}${list(w.highlights)}
    </div>`).join('');

  const edu = (resume.education || []).map((e) => `
    <div class="entry">
      <div class="row"><div><strong>${esc([e.studyType, e.area].filter(Boolean).join(' in '))}</strong>${e.institution ? `${e.studyType || e.area ? ' — ' : ''}${esc(e.institution)}` : ''}</div><div class="date">${esc(range(e.startDate, e.endDate, locale))}</div></div>
      ${list(e.courses)}
    </div>`).join('');

  const skillGroups = (resume.skills || []).filter((s) => s.keywords?.length);
  const skills = skillGroups.map((s) =>
    `<p>${skillGroups.length > 1 && s.name ? `<strong>${esc(s.name)}:</strong> ` : ''}${esc(s.keywords.join(', '))}</p>`).join('');

  const simple = (items, nameKey, dateKey) => (items || []).map((p) => `
    <div class="entry"><div class="row"><div><strong>${esc(p[nameKey])}</strong></div><div class="date">${esc(p.startDate ? range(p.startDate, p.endDate, locale) : formatDate(p[dateKey] || p.endDate, locale))}</div></div>${list(p.highlights)}</div>`).join('');

  const langs = (resume.languages || []).map((l) => esc(l.fluency ? `${l.language} (${l.fluency})` : l.language)).join(', ');
  const vol = (resume.volunteer || []).map((v) => ({ name: [v.position, v.organization].filter(Boolean).join(' — '), startDate: v.startDate, endDate: v.endDate, highlights: v.highlights }));

  const body = [
    sec('summary', b.summary ? `<p>${esc(b.summary)}</p>` : ''),
    sec('work', work),
    sec('education', edu),
    sec('skills', skills),
    sec('projects', simple(resume.projects, 'name')),
    sec('certificates', simple(resume.certificates, 'name', 'date')),
    sec('volunteer', simple(vol, 'name')),
    sec('awards', simple(resume.awards, 'title', 'date')),
    sec('publications', simple(resume.publications, 'name', 'releaseDate')),
    sec('languages', langs ? `<p>${langs}</p>` : ''),
    sec('interests', (resume.interests || []).length ? `<p>${esc(resume.interests.map((i) => i.name).join(', '))}</p>` : ''),
  ].join('');

  const fs = T.compact ? '9.5pt' : '10.5pt';
  return `<!DOCTYPE html>
<html lang="${locale === 'us' || locale === 'uk' ? 'en' : locale === 'ch' ? 'de' : locale}">
<head><meta charset="utf-8"><title>${esc(b.name || 'Resume')}</title>
<style>
@page { size: ${L.page}; margin: ${T.compact ? '12mm 14mm' : '16mm 18mm'}; }
* { box-sizing: border-box; }
body { font-family: ${T.font}; font-size: ${fs}; line-height: 1.38; color: #111; margin: 0; }
.page { max-width: ${L.page === 'A4' ? '210mm' : '8.5in'}; margin: 0 auto; padding: ${T.compact ? '12mm 14mm' : '16mm 18mm'}; background: #fff; }
@media print { .page { padding: 0; max-width: none; } }
header { text-align: ${T.nameAlign}; margin-bottom: 10pt; }
h1 { font-size: ${T.compact ? '18pt' : '22pt'}; margin: 0; color: ${T.accent}; font-weight: 700; }
.label { font-size: 11.5pt; margin-top: 2pt; color: #333; }
.contact { margin-top: 4pt; font-size: 9.5pt; color: #333; }
h2 { ${T.headingStyle} margin: ${T.compact ? '8pt' : '12pt'} 0 5pt; padding-bottom: 2pt; font-weight: 700; }
p { margin: 2pt 0; }
ul { margin: 2pt 0 0 0; padding-left: 14pt; }
li { margin: 1pt 0; }
.entry { margin-bottom: ${T.compact ? '5pt' : '8pt'}; break-inside: avoid; }
.row { display: flex; justify-content: space-between; gap: 12pt; }
.date { white-space: nowrap; color: #333; }
</style></head>
<body><div class="page">
<header><h1>${esc(b.name)}</h1>${b.label ? `<div class="label">${esc(b.label)}</div>` : ''}<div class="contact">${contact}</div></header>
${body}
</div></body></html>`;
}
