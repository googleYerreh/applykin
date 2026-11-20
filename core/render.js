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

// ats: how safely applicant tracking systems (ATS) read the design.
//   best    = single column, plain headings: read correctly everywhere
//   good    = single column with a colour band or date column: read well by almost all systems
//   caution = two columns: looks great to people, but some systems read the columns out of order
export const TEMPLATES = {
  classic: { label: 'Classic', blurb: 'Serif, centred name, ruled headings', font: 'georgia', accent: '#1f2933', heading: 'rule-caps', nameAlign: 'center', ats: 'best' },
  modern: { label: 'Modern', blurb: 'Clean sans-serif with colour rules', font: 'helvetica', accent: '#0b5cad', heading: 'rule-color', nameAlign: 'left', ats: 'best' },
  executive: { label: 'Executive', blurb: 'Elegant serif, centred headings', font: 'garamond', accent: '#2b2b2b', heading: 'double', nameAlign: 'center', ats: 'best' },
  compact: { label: 'Compact', blurb: 'Dense layout that fits more on a page', font: 'arial', accent: '#222222', heading: 'band', nameAlign: 'left', compact: true, ats: 'best' },
  banner: { label: 'Banner', blurb: 'Bold colour header, single column', font: 'inter', accent: '#3730c4', heading: 'rule-color', nameAlign: 'left', banner: true, ats: 'good' },
  timeline: { label: 'Timeline', blurb: 'Dates in a left column, easy to scan', font: 'sourcesans', accent: '#0f766e', heading: 'rule-color', nameAlign: 'left', timeline: true, ats: 'good' },
  sidebar: { label: 'Soft Sidebar', blurb: 'Tinted side column with photo', font: 'lato', accent: '#2f4ea8', heading: 'rule-color', nameAlign: 'left', sidebar: true, twoColumn: true, ats: 'caution' },
  sidebarDark: { label: 'Bold Column', blurb: 'Solid colour column with photo', font: 'inter', accent: '#1e293b', heading: 'rule-color', nameAlign: 'left', sidebar: true, dark: true, twoColumn: true, ats: 'caution' },
};

export const ATS_LEVELS = {
  best: { label: 'Best for ATS', note: 'Single column with plain headings. Every tracking system reads it correctly. Use it for online applications.' },
  good: { label: 'Good for ATS', note: 'Single column with a colour band or date column. Almost all tracking systems read it well.' },
  caution: { label: 'Email & networking', note: 'Two columns look great to people, but some tracking systems read them out of order. Send it by email or bring it to interviews; use a "Best" design for online applications.' },
};

// Fonts: system fonts work offline; web fonts load from Google Fonts when online and fall back otherwise.
export const FONTS = {
  georgia: { label: 'Georgia (serif)', css: "Georgia, 'Times New Roman', serif" },
  garamond: { label: 'EB Garamond (serif)', css: "'EB Garamond', Garamond, Georgia, serif", google: 'EB+Garamond:wght@400;600;700' },
  merriweather: { label: 'Merriweather (serif)', css: "Merriweather, Georgia, serif", google: 'Merriweather:wght@400;700' },
  helvetica: { label: 'Helvetica / Arial', css: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  arial: { label: 'Arial', css: 'Arial, Helvetica, sans-serif' },
  lato: { label: 'Lato', css: "Lato, 'Helvetica Neue', Arial, sans-serif", google: 'Lato:wght@400;700' },
  inter: { label: 'Inter', css: "Inter, 'Helvetica Neue', Arial, sans-serif", google: 'Inter:wght@400;600;700' },
  sourcesans: { label: 'Source Sans 3', css: "'Source Sans 3', 'Helvetica Neue', Arial, sans-serif", google: 'Source+Sans+3:wght@400;600;700' },
  roboto: { label: 'Roboto', css: "Roboto, Arial, sans-serif", google: 'Roboto:wght@400;500;700' },
};

export const ACCENTS = ['#2f4ea8', '#1f2933', '#0f766e', '#9a3412', '#7c2d12', '#6d28d9', '#a16207', '#475569'];

/** Default design settings. Every value is clamped before use. */
export const DEFAULT_DESIGN = { accent: '', font: '', textSize: 100, lineSpacing: 100, sectionSpacing: 100, margin: 100, photo: false };

const clampN = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const isHex = (c) => /^#[0-9a-f]{6}$/i.test(c || '');
const isImage = (src) => /^data:image\/(png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(src || '');

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
 * @param {{template?:string, locale?:string, design?:object}} opts
 * @returns {string} full HTML document
 */
export function renderResumeHTML(resume, opts = {}) {
  const locale = LOCALES[opts.locale] ? opts.locale : 'us';
  const L = LOCALES[locale];
  const T = TEMPLATES[opts.template] || TEMPLATES.classic;
  const d = { ...DEFAULT_DESIGN, ...(opts.design || {}) };
  const accent = isHex(d.accent) ? d.accent : T.accent;
  const font = FONTS[d.font] || FONTS[T.font];
  const size = clampN(d.textSize, 80, 125, 100) / 100;
  const line = clampN(d.lineSpacing, 80, 140, 100) / 100;
  const gap = clampN(d.sectionSpacing, 50, 200, 100) / 100;
  const marginScale = clampN(d.margin, 50, 160, 100) / 100;
  const b = resume.basics || {};
  const photo = (T.sidebar || d.photo) && isImage(b.image) ? b.image : '';

  const loc = [b.location?.city, b.location?.region].filter(Boolean).join(', ');
  const contactItems = [loc, b.email, b.phone, b.url, ...(b.profiles || []).map((p) => p.url)].filter(Boolean).map((x) => esc(String(x).replace(/^https?:\/\//, '')));
  const sec = (key, inner) => (inner ? `<section><h2>${esc(L.h[key])}</h2>${inner}</section>` : '');
  const list = (items) => (items?.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '');

  const tl = (dates, inner) => `<div class="entry tl"><div class="when">${esc(dates)}</div><div class="what">${inner}</div></div>`;
  const work = (resume.work || []).map((w) => T.timeline ? tl(range(w.startDate, w.endDate, locale),
      `<div><strong>${esc(w.position)}</strong>${w.name ? `${w.position ? ' — ' : ''}<span class="org">${esc(w.name)}</span>` : ''}${w.location ? `, ${esc(w.location)}` : ''}</div>${w.summary ? `<p>${esc(w.summary)}</p>` : ''}${list(w.highlights)}`) : `
    <div class="entry">
      <div class="row"><div><strong>${esc(w.position)}</strong>${w.name ? `${w.position ? ' — ' : ''}<span class="org">${esc(w.name)}</span>` : ''}${w.location ? `, ${esc(w.location)}` : ''}</div><div class="date">${esc(range(w.startDate, w.endDate, locale))}</div></div>
      ${w.summary ? `<p>${esc(w.summary)}</p>` : ''}${list(w.highlights)}
    </div>`).join('');

  const edu = (resume.education || []).map((e) => T.timeline && !T.sidebar ? tl(range(e.startDate, e.endDate, locale),
      `<div><strong>${esc([e.studyType, e.area].filter(Boolean).join(', '))}</strong>${e.institution ? `${e.studyType || e.area ? ' — ' : ''}${esc(e.institution)}` : ''}</div>${list(e.courses)}`) : `
    <div class="entry">
      <div class="row"><div><strong>${esc([e.studyType, e.area].filter(Boolean).join(', '))}</strong>${e.institution ? `${e.studyType || e.area ? ' — ' : ''}${esc(e.institution)}` : ''}</div><div class="date">${esc(range(e.startDate, e.endDate, locale))}</div></div>
      ${list(e.courses)}
    </div>`).join('');

  const skillGroups = (resume.skills || []).filter((s) => s.keywords?.length);
  const skillsInline = skillGroups.map((s) => `<p>${skillGroups.length > 1 && s.name ? `<strong>${esc(s.name)}:</strong> ` : ''}${esc(s.keywords.join(', '))}</p>`).join('');
  const skillsList = skillGroups.length ? `<ul class="plain">${skillGroups.flatMap((s) => s.keywords).map((k) => `<li>${esc(k)}</li>`).join('')}</ul>` : '';

  const simple = (items, nameKey, dateKey) => (items || []).map((p) => `
    <div class="entry"><div class="row"><div><strong>${esc(p[nameKey])}</strong></div><div class="date">${esc(p.startDate ? range(p.startDate, p.endDate, locale) : formatDate(p[dateKey] || p.endDate, locale))}</div></div>${list(p.highlights)}</div>`).join('');
  const langs = (resume.languages || []).map((l) => (l.fluency ? `${esc(l.language)} (${esc(l.fluency)})` : esc(l.language)));
  const vol = (resume.volunteer || []).map((v) => ({ name: [v.position, v.organization].filter(Boolean).join(' — '), startDate: v.startDate, endDate: v.endDate, highlights: v.highlights }));
  const interests = (resume.interests || []).length ? `<p>${esc(resume.interests.map((i) => i.name).join(', '))}</p>` : '';

  const mainSections = [
    sec('summary', b.summary ? `<p>${esc(b.summary)}</p>` : ''),
    sec('work', work),
    T.sidebar ? '' : sec('education', edu),
    T.sidebar ? '' : sec('skills', skillsInline),
    sec('projects', simple(resume.projects, 'name')),
    sec('certificates', simple(resume.certificates, 'name', 'date')),
    sec('volunteer', simple(vol, 'name')),
    sec('awards', simple(resume.awards, 'title', 'date')),
    sec('publications', simple(resume.publications, 'name', 'releaseDate')),
    T.sidebar ? '' : sec('languages', langs.length ? `<p>${langs.join(', ')}</p>` : ''),
    T.sidebar ? '' : sec('interests', interests),
  ].join('');

  const header = `<header class="${T.banner ? 'banner' : ''}">${photo && !T.sidebar ? `<img class="photo" src="${photo}" alt="">` : ''}<div><h1>${esc(b.name)}</h1>${b.label ? `<div class="label">${esc(b.label)}</div>` : ''}${T.sidebar ? '' : `<div class="contact">${contactItems.join('<span class="sep"> · </span>')}</div>`}</div></header>`;

  const sidebarHtml = T.sidebar ? `<aside>
      ${photo ? `<img class="photo" src="${photo}" alt="">` : ''}
      ${contactItems.length ? `<section><h2>${esc({ de: 'Kontakt', ch: 'Kontakt', fr: 'Contact' }[locale] || 'Contact')}</h2><ul class="plain">${contactItems.map((c) => `<li>${c}</li>`).join('')}</ul></section>` : ''}
      ${skillGroups.length ? `<section><h2>${esc(L.h.skills)}</h2>${skillsList}</section>` : ''}
      ${sec('education', edu)}
      ${langs.length ? `<section><h2>${esc(L.h.languages)}</h2><ul class="plain">${langs.map((l) => `<li>${l}</li>`).join('')}</ul></section>` : ''}
      ${sec('interests', interests)}
    </aside>` : '';

  const headingCss = {
    'rule-caps': `border-bottom:1px solid ${accent};text-transform:uppercase;letter-spacing:.06em;font-size:${(11 * size).toFixed(1)}pt;color:${accent};`,
    'rule-color': `color:${accent};font-size:${(12 * size).toFixed(1)}pt;border-bottom:2px solid ${accent};`,
    double: `text-align:center;text-transform:uppercase;letter-spacing:.14em;font-size:${(10.5 * size).toFixed(1)}pt;color:${accent};border-top:1px solid ${accent};border-bottom:1px solid ${accent};padding:3pt 0;`,
    band: `text-transform:uppercase;font-size:${(10 * size).toFixed(1)}pt;letter-spacing:.08em;background:${accent}14;color:${accent};padding:2px 6px;`,
  }[T.heading];
  const baseSize = (T.compact ? 9.5 : 10.5) * size;
  const m = { v: (T.compact ? 12 : 16) * marginScale, h: (T.compact ? 14 : 18) * marginScale };
  const fontLink = font.google ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${font.google}&display=swap">` : '';

  return `<!DOCTYPE html>
<html lang="${locale === 'us' || locale === 'uk' ? 'en' : locale === 'ch' ? 'de' : locale}">
<head><meta charset="utf-8"><title>${esc(b.name || 'Resume')}</title>${fontLink}
<style>
@page { size: ${L.page}; margin: ${T.sidebar ? 0 : `${m.v.toFixed(1)}mm ${m.h.toFixed(1)}mm`}; }
* { box-sizing: border-box; }
body { font-family: ${font.css}; font-size: ${baseSize.toFixed(2)}pt; line-height: ${(1.38 * line).toFixed(2)}; color: #111; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { max-width: ${L.page === 'A4' ? '210mm' : '8.5in'}; margin: 0 auto; background: #fff; ${T.sidebar ? `display: grid; grid-template-columns: 32% 1fr; min-height: ${L.page === 'A4' ? '297mm' : '11in'};` : `padding: ${m.v.toFixed(1)}mm ${m.h.toFixed(1)}mm;`} }
@media print { .page { max-width: none; ${T.sidebar ? '' : 'padding: 0;'} } }
header { display: flex; gap: 14pt; align-items: center; ${T.nameAlign === 'center' && !photo ? 'justify-content: center; text-align: center;' : ''} margin-bottom: ${(10 * gap).toFixed(1)}pt; }
h1 { font-size: ${((T.compact ? 18 : 22) * size).toFixed(1)}pt; margin: 0; color: ${accent}; font-weight: 700; line-height: 1.15; }
.label { font-size: ${(11.5 * size).toFixed(1)}pt; margin-top: 2pt; color: #333; }
.contact { margin-top: 4pt; font-size: ${(9.5 * size).toFixed(1)}pt; color: #333; }
h2 { ${headingCss} margin: ${((T.compact ? 8 : 12) * gap).toFixed(1)}pt 0 5pt; padding-bottom: 2pt; font-weight: 700; }
p { margin: 2pt 0; }
ul { margin: 2pt 0 0 0; padding-left: 14pt; } li { margin: 1pt 0; }
ul.plain { list-style: none; padding: 0; } ul.plain li { margin: 2pt 0; overflow-wrap: anywhere; }
.entry { margin-bottom: ${((T.compact ? 5 : 8) * gap).toFixed(1)}pt; break-inside: avoid; }
.row { display: flex; justify-content: space-between; gap: 12pt; }
.date { white-space: nowrap; color: #333; }
.org { color: ${T.sidebar ? accent : 'inherit'}; }
img.photo { width: ${T.sidebar ? '34mm' : '26mm'}; height: ${T.sidebar ? '34mm' : '26mm'}; object-fit: cover; border-radius: 50%; flex: none; }
${T.banner ? `header.banner { background: ${accent}; color: #fff; padding: 9mm 8mm; border-radius: 3mm; }
header.banner h1 { color: #fff; } header.banner .label, header.banner .contact { color: rgba(255,255,255,.88); }` : ''}
${T.timeline ? `.tl { display: grid; grid-template-columns: 27mm 1fr; gap: 5mm; } .tl .when { color: ${accent}; font-weight: 600; font-size: ${(baseSize * 0.92).toFixed(2)}pt; padding-top: 1pt; }` : ''}
${T.dark ? `aside { background: ${accent} !important; color: #fff; } aside h2 { color: #fff !important; border-color: rgba(255,255,255,.45) !important; } aside .date { color: rgba(255,255,255,.75) !important; } aside strong { color: #fff; }` : ''}
${T.sidebar ? `aside { background: ${accent}1f; padding: ${(m.v * 1.1).toFixed(1)}mm ${(m.h * 0.6).toFixed(1)}mm; font-size: ${(baseSize * 0.93).toFixed(2)}pt; }
aside ul.plain li { word-break: normal; overflow-wrap: break-word; hyphens: none; }
aside img.photo { display: block; margin: 0 auto ${(10 * gap).toFixed(1)}pt; }
aside h2 { font-size: ${(11 * size).toFixed(1)}pt; }
aside .row { display: block; } aside .date { color: #555; }
main { padding: ${(m.v * 1.1).toFixed(1)}mm ${m.h.toFixed(1)}mm; }` : ''}
</style></head>
<body><div class="page">
${T.sidebar ? `${sidebarHtml}<main>${header}${mainSections}</main>` : `${header}${mainSections}`}
</div></body></html>`;
}

/**
 * A cover letter in the same look as the resume: same font, accent colour and contact header.
 * @param {object} resume JSON Resume (for name and contact details)
 * @param {string} text the letter
 * @param {{template?:string, locale?:string, design?:object, company?:string, title?:string}} opts
 */
export function renderLetterHTML(resume, text, opts = {}) {
  const locale = LOCALES[opts.locale] ? opts.locale : 'us';
  const L = LOCALES[locale];
  const T = TEMPLATES[opts.template] || TEMPLATES.classic;
  const d = { ...DEFAULT_DESIGN, ...(opts.design || {}) };
  const accent = isHex(d.accent) ? d.accent : T.accent;
  const font = FONTS[d.font] || FONTS[T.font];
  const b = resume.basics || {};
  const contact = [[b.location?.city, b.location?.region].filter(Boolean).join(', '), b.email, b.phone, b.url, ...(b.profiles || []).map((p) => p.url)]
    .filter(Boolean).map((x) => esc(String(x).replace(/^https?:\/\//, ''))).join(' · ');
  const today = new Date().toLocaleDateString(locale === 'us' ? 'en-US' : locale === 'uk' ? 'en-GB' : locale === 'fr' ? 'fr-FR' : 'de-DE', { year: 'numeric', month: 'long', day: 'numeric' });
  const paras = String(text || '').split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  const fontLink = font.google ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${font.google}&display=swap">` : '';
  return `<!DOCTYPE html><html lang="${locale === 'us' || locale === 'uk' ? 'en' : locale === 'ch' ? 'de' : locale}"><head><meta charset="utf-8"><title>${esc(opts.title || `${b.name || ''} cover letter`)}</title>${fontLink}
<style>
@page { size: ${L.page}; margin: 20mm 22mm; }
body { font-family: ${font.css}; font-size: 11pt; line-height: 1.5; color: #111; margin: 0; }
.page { max-width: ${L.page === 'A4' ? '210mm' : '8.5in'}; margin: 0 auto; padding: 20mm 22mm; background: #fff; }
@media print { .page { padding: 0; max-width: none; } }
header { border-bottom: 2px solid ${accent}; padding-bottom: 8pt; margin-bottom: 18pt; }
h1 { margin: 0; color: ${accent}; font-size: 20pt; } .contact { font-size: 9.5pt; color: #333; margin-top: 3pt; }
.meta { margin-bottom: 14pt; color: #333; } p { margin: 0 0 10pt; }
</style></head><body><div class="page">
<header><h1>${esc(b.name)}</h1>${b.label ? `<div>${esc(b.label)}</div>` : ''}<div class="contact">${contact}</div></header>
<div class="meta">${esc(today)}${opts.company ? `<br>${esc(opts.company)}` : ''}${opts.jobTitle ? `<br>Re: ${esc(opts.jobTitle)}` : ''}</div>
${paras}
</div></body></html>`;
}
