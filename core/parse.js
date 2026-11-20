// Turns plain resume text into a JSON Resume object (https://jsonresume.org/schema).
// Pure JavaScript, no dependencies: runs in the browser, Node, and the MCP server.

const SECTION_ALIASES = {
  summary: ['summary', 'professional summary', 'profile', 'professional profile', 'about', 'about me', 'objective', 'career objective', 'overview', 'personal statement', 'kurzprofil', 'profil'],
  work: ['experience', 'work experience', 'professional experience', 'employment', 'employment history', 'work history', 'career history', 'relevant experience', 'berufserfahrung', 'experience professionnelle', 'expérience professionnelle'],
  education: ['education', 'education and training', 'education and certifications', 'education and certificates', 'certifications and education', 'education and qualifications', 'academic background', 'academic history', 'qualifications', 'ausbildung', 'bildung', 'formation'],
  skills: ['skills', 'technical skills', 'core skills', 'key skills', 'core competencies', 'competencies', 'skills and tools', 'tools', 'technologies', 'kenntnisse', 'fähigkeiten', 'compétences'],
  projects: ['projects', 'selected projects', 'personal projects', 'side projects', 'projekte', 'projets'],
  certificates: ['certifications', 'certificates', 'licenses', 'licenses and certifications', 'zertifikate', 'zertifizierungen'],
  languages: ['languages', 'language skills', 'sprachen', 'langues'],
  awards: ['awards', 'honors', 'honors and awards', 'achievements', 'auszeichnungen'],
  volunteer: ['volunteer', 'volunteering', 'volunteer experience', 'community', 'ehrenamt'],
  publications: ['publications', 'publikationen'],
  interests: ['interests', 'hobbies', 'interessen'],
  additional: ['additional', 'additional information', 'other', 'miscellaneous', 'sonstiges', 'informations complémentaires'],
  references: ['references', 'referenzen'],
};

const HEADING_LOOKUP = new Map();
for (const [key, names] of Object.entries(SECTION_ALIASES)) for (const n of names) HEADING_LOOKUP.set(n, key);

const MONTHS = {
  jan: 1, january: 1, januar: 1, janvier: 1, feb: 2, february: 2, februar: 2, février: 2, mar: 3, march: 3, märz: 3, mars: 3,
  apr: 4, april: 4, avril: 4, may: 5, mai: 5, jun: 6, june: 6, juni: 6, juin: 6, jul: 7, july: 7, juli: 7, juillet: 7,
  aug: 8, august: 8, août: 8, sep: 9, sept: 9, september: 9, septembre: 9, oct: 10, october: 10, oktober: 10, okt: 10, octobre: 10,
  nov: 11, november: 11, novembre: 11, dec: 12, december: 12, dezember: 12, dez: 12, décembre: 12,
};
const MONTH_RE = '(?:' + Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|') + ')\\.?';
const PRESENT_RE = '(?:present|current|now|today|heute|aktuell|bis heute|actuel|aujourd\'hui|ongoing)';
const ONE_DATE = `(?:${MONTH_RE}\\s+\\d{4}|\\d{1,2}[/.]\\d{4}|\\d{4}[/-]\\d{1,2}|\\d{4})`;
const RANGE_RE = new RegExp(`(${ONE_DATE})\\s*(?:-|–|—|to|bis|à|until|\\u2013|\\u2014)\\s*(${ONE_DATE}|${PRESENT_RE})`, 'i');
const SINGLE_DATE_RE = new RegExp(`\\b(${MONTH_RE}\\s+\\d{4}|\\d{1,2}[/.]\\d{4}|(?:19|20)\\d{2})\\b`, 'i');

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}/;
const URL_RE = /\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|io|dev|org|net|me|co|app|ai|de|ch|uk|fr|eu|design|site|xyz|tech|page|info|art)(?![a-z0-9-])(?:\/[^\s,;|]*)?/gi;
const BULLET_RE = /^\s*(?:[•●▪■◦‣∙·*–—-]|\u2022|\uf0b7|\d+[.)])\s+/;

export function normalizeDate(raw) {
  if (!raw) return '';
  const s = raw.trim().toLowerCase();
  if (new RegExp(`^${PRESENT_RE}$`, 'i').test(s)) return '';
  let m = s.match(new RegExp(`^(${MONTH_RE})\\s+(\\d{4})$`, 'i'));
  if (m) {
    const mon = MONTHS[m[1].replace('.', '')];
    return `${m[2]}-${String(mon).padStart(2, '0')}`;
  }
  m = s.match(/^(\d{1,2})[/.](\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})[/-](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}`;
  m = s.match(/^(\d{4})$/);
  if (m) return m[1];
  return '';
}

export function findDateRange(line) {
  const m = line.match(RANGE_RE);
  if (!m) return null;
  return {
    raw: m[0],
    startDate: normalizeDate(m[1]),
    endDate: normalizeDate(m[2]),
    current: new RegExp(`^${PRESENT_RE}$`, 'i').test(m[2].trim()),
  };
}

function cleanLines(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((l) => l.trim());
}

function headingKey(line) {
  const t = line.replace(/[:：]$/, '').replace(/\s+/g, ' ').trim().toLowerCase().replace(/&/g, 'and');
  if (!t || t.length > 40) return null;
  return HEADING_LOOKUP.get(t) || null;
}

function isBullet(line) {
  return BULLET_RE.test(line);
}

function stripBullet(line) {
  return line.replace(BULLET_RE, '').trim();
}

// Splits "Senior Engineer at Acme Corp", "Acme Corp | Senior Engineer", "Senior Engineer, Acme Corp".
function splitRoleAndOrg(text) {
  const t = text.replace(/\s{2,}/g, ' ').replace(/[|,–—-]\s*$/, '').trim();
  if (!t) return { a: '', b: '' };
  let m = t.match(/^(.*?)\s+(?:at|@|bei|chez)\s+(.*)$/i);
  if (m) return { a: m[1].trim(), b: m[2].trim() };
  for (const sep of [' | ', ' — ', ' – ', ' - ', ', ', ' · ']) {
    const i = t.indexOf(sep);
    if (i > 0) return { a: t.slice(0, i).trim(), b: t.slice(i + sep.length).trim() };
  }
  return { a: t, b: '' };
}

const ROLE_WORDS = /\b(engineer|developer|manager|director|designer|analyst|consultant|specialist|lead|head|intern|assistant|associate|coordinator|officer|architect|scientist|administrator|representative|technician|nurse|teacher|accountant|writer|editor|producer|owner|founder|president|vp|chief|cto|ceo|cfo|coo|recruiter|agent|clerk|cashier|driver|operator|supervisor|advisor|researcher|programmer|marketer|strategist|planner|sales|support|werkstudent|praktikant|entwickler|ingenieur|leiter)\b/i;

function looksLikeRole(s) {
  return ROLE_WORDS.test(s);
}

function looksLikeLocation(s) {
  const t = String(s).replace(/\s*\(.*?\)\s*/g, ' ').trim();
  return /^(remote|hybrid|Remote|Hybrid|REMOTE|[A-Z][A-Za-zÀ-ÿ .'-]+,\s*[A-Z][A-Za-zÀ-ÿ .'-]+)$/.test(t) && t.length < 45 && !looksLikeRole(t);
}

// Groups lines of a section into entries. A new entry starts at a non-bullet line
// that follows bullets, or at a line holding a date range when the current entry already has one.
function groupEntries(lines) {
  const entries = [];
  let cur = null;
  for (const line of lines) {
    if (!line) continue;
    const bullet = isBullet(line);
    const range = findDateRange(line);
    const startNew =
      !cur ||
      (!bullet && cur.bullets.length > 0 && (range || cur.headers.length === 0 || !isContinuation(line)) &&
        !(!range && continuesBullet(cur.bullets[cur.bullets.length - 1], line))) ||
      (range && cur.range);
    if (startNew) {
      cur = { headers: [], bullets: [], range: null };
      entries.push(cur);
    }
    if (bullet) {
      cur.bullets.push(stripBullet(line));
    } else if (cur.bullets.length > 0 && !range && continuesBullet(cur.bullets[cur.bullets.length - 1], line)) {
      // wrapped bullet text
      cur.bullets[cur.bullets.length - 1] += ' ' + line;
    } else {
      if (range && !cur.range) cur.range = range;
      cur.headers.push(line);
    }
  }
  return entries;
}

// A line continues the previous bullet when it starts lower-case or with a number, or the bullet
// ended mid-phrase ("…a mix of 90% short-term and" / "…mentoring 6").
function continuesBullet(prev, line) {
  if (/\s\|\s/.test(line) || line.length > 160) return false;
  if (isContinuation(line) || /^[\d%$€£+]/.test(line)) return true;
  return /\b(and|or|of|to|the|a|an|with|for|in|on|by|at|as|from|across|through|while|including|per)$|[,\-–]$|\d$/i.test(prev.trim());
}

function isContinuation(line) {
  // Lower-case start usually means a wrapped sentence.
  return /^[a-zà-ÿ(]/.test(line);
}

function parseWorkEntry(e) {
  const segments = e.headers
    .map((h) => (e.range ? h.replace(e.range.raw, '') : h))
    .flatMap((h) => h.split(/\s+[|•·]\s+/))
    .map((h) => h.replace(/^\s*[|,–—-]\s*|\s*[|,–—-]\s*$/g, '').trim())
    .filter(Boolean);
  let position = '', name = '', location = '';
  const parts = [];
  for (const seg of segments) {
    if (!location && looksLikeLocation(seg)) { location = seg; continue; }
    parts.push(seg);
  }
  if (parts.length === 1) {
    const { a, b } = splitRoleAndOrg(parts[0]);
    if (b && looksLikeRole(b) && !looksLikeRole(a)) { position = b; name = a; }
    else if (!b && !looksLikeRole(a) && !e.bullets.length) { name = a; }
    else { position = a; name = b; }
  } else if (parts.length >= 2) {
    const [p0, p1] = parts;
    if (looksLikeRole(p1) && !looksLikeRole(p0)) { name = p0; position = p1; } else { position = p0; name = p1; }
  }
  const summaryLines = parts.slice(2);
  return {
    name,
    position,
    location: location || undefined,
    startDate: e.range?.startDate || '',
    endDate: e.range?.current ? '' : e.range?.endDate || '',
    summary: summaryLines.join(' ') || undefined,
    highlights: e.bullets,
  };
}

// One employer with several roles listed under it: copy the employer onto each role.
function mergeNestedRoles(work) {
  const out = [];
  let parent = null;
  for (const w of work) {
    const isParent = w.name && !w.position && !w.highlights.length;
    if (isParent) { parent = w; continue; }
    if (!w.name && parent) { w.name = parent.name; w.location ||= parent.location; }
    else if (w.name) parent = null;
    out.push(w);
  }
  return out;
}

function parseEducationEntry(e) {
  const headerText = e.headers.map((h) => (e.range ? h.replace(e.range.raw, '') : h).replace(/\s*[|,–—-]\s*$/, '').trim()).filter(Boolean);
  let institution = '', studyType = '', area = '';
  const degreeRe = /\b(b\.?sc|m\.?sc|b\.?a|m\.?a|b\.?s|m\.?s|bachelor|master|mba|ph\.?d|doctor|diploma|diplom|associate|certificate|high school|abitur|ged|bsc|msc|beng|meng)\b/i;
  const instRe = /(\b(university|universität|université|universidad|universita|college|school|institute|academy|hochschule|eth|epfl|polytechnic|gymnasium|coursera|udemy|edx)\b|école|ecole|escuela)/i;
  const rest = [];
  const pieces = headerText.flatMap((h) => (/\s[|—–]\s|\s-\s/.test(h) ? h.split(/\s+[|—–]\s+|\s+-\s+/) : [h]));
  for (const h of pieces) {
    if (!institution && instRe.test(h) && !degreeRe.test(h)) institution = h;
    else if (!studyType && degreeRe.test(h)) {
      const comma = h.match(/^(.+?),\s*(.+)$/);
      const m = h.match(/^(.*?)\s+(?:in)\s+(.*)$/i);
      if (comma) { studyType = comma[1].trim(); area = comma[2].trim(); }
      else if (m) { studyType = m[1].trim(); area = m[2].trim(); } else studyType = h;
      if (instRe.test(h) && !institution) {
        const sp = splitRoleAndOrg(h);
        if (instRe.test(sp.b)) { institution = sp.b; studyType = sp.a; }
        else if (instRe.test(sp.a)) { institution = sp.a; studyType = sp.b; }
      }
    } else rest.push(h);
  }
  if (!institution && rest.length) institution = rest.shift();
  if (!studyType && rest.length) studyType = rest.shift(); // e.g. a certificate name
  // If dates give only a single year (graduation), use it as endDate.
  let startDate = e.range?.startDate || '', endDate = e.range?.endDate || '';
  if (!e.range) {
    const all = e.headers.join(' ');
    const m = all.match(SINGLE_DATE_RE);
    if (m) {
      endDate = normalizeDate(m[1]);
      institution = institution.replace(m[0], '').replace(/\s*[|,–—-]\s*$/, '').trim();
      studyType = studyType.replace(m[0], '').replace(/\s*[|,–—-]\s*$/, '').trim();
    }
  }
  return {
    institution,
    studyType: studyType || undefined,
    area: area || undefined,
    startDate,
    endDate,
    courses: e.bullets.length ? e.bullets : undefined,
  };
}

function parseSkills(lines) {
  const groups = [];
  const loose = [];
  for (let line of lines) {
    if (!line) continue;
    line = stripBullet(line);
    const m = line.match(/^([^:]{2,40}):\s*(.+)$/);
    if (m) {
      groups.push({ name: m[1].trim(), keywords: splitList(m[2]) });
    } else {
      loose.push(...splitList(line));
    }
  }
  if (loose.length) groups.unshift({ name: groups.length ? 'Other' : 'Skills', keywords: loose });
  return groups;
}

function splitList(s) {
  return s
    .split(/\s*[,;|•·▪]\s*|\s{3,}/)
    .map((x) => x.trim().replace(/\.$/, ''))
    .filter((x) => x && x.length <= 60);
}

function parseLanguages(lines) {
  const out = [];
  for (const l of lines.filter(Boolean)) {
    for (const item of splitList(stripBullet(l))) {
      const m = item.match(/^(.+?)\s*[(\-–:]\s*([^)]+)\)?$/);
      out.push(m ? { language: m[1].trim(), fluency: m[2].trim() } : { language: item });
    }
  }
  return out;
}

function parseSimpleList(lines) {
  const entries = groupEntries(lines);
  return entries.map((e) => ({
    name: e.headers.map((h) => (e.range ? h.replace(e.range.raw, '').trim() : h)).filter(Boolean).join(' — '),
    startDate: e.range?.startDate || undefined,
    endDate: e.range?.endDate || undefined,
    highlights: e.bullets.length ? e.bullets : undefined,
  }));
}

function parseBasics(headLines, allText) {
  const basics = { name: '', label: '', email: '', phone: '', url: '', summary: '', location: {}, profiles: [] };
  const email = allText.match(EMAIL_RE);
  if (email) basics.email = email[0];

  const urls = (headLines.join(' ').match(URL_RE) || []).filter((u) => !u.includes('@') && !(email && email[0].includes(u)));
  for (const u of urls) {
    const url = u.startsWith('http') ? u : 'https://' + u;
    if (/linkedin\.com/i.test(u)) basics.profiles.push({ network: 'LinkedIn', url });
    else if (/github\.com/i.test(u)) basics.profiles.push({ network: 'GitHub', url });
    else if (/gitlab\.com/i.test(u)) basics.profiles.push({ network: 'GitLab', url });
    else if (/behance|dribbble/i.test(u)) basics.profiles.push({ network: /behance/i.test(u) ? 'Behance' : 'Dribbble', url });
    else if (!basics.url) basics.url = url;
  }

  for (const line of headLines) {
    const noUrls = line.replace(URL_RE, ' ').replace(EMAIL_RE, ' ');
    const phone = noUrls.match(PHONE_RE);
    if (!basics.phone && phone && phone[0].replace(/\D/g, '').length >= 7) basics.phone = phone[0].trim();
  }

  // Name: first short line with letters only and no contact info.
  for (const line of headLines) {
    if (!line || EMAIL_RE.test(line) || /\d{3}/.test(line) || URL_RE.test(line)) { URL_RE.lastIndex = 0; continue; }
    URL_RE.lastIndex = 0;
    const words = line.split(/\s+/);
    if (words.length >= 1 && words.length <= 5 && /^[\p{L} .'-]+$/u.test(line)) { basics.name = toNameCase(line); break; }
  }
  // Label: next short non-contact line after the name.
  const nameIdx = headLines.findIndex((l) => toNameCase(l) === basics.name);
  for (const line of headLines.slice(nameIdx + 1)) {
    if (!line) continue;
    if (EMAIL_RE.test(line) || PHONE_RE.test(line.replace(URL_RE, '')) || /[|•·]/.test(line)) { URL_RE.lastIndex = 0; break; }
    URL_RE.lastIndex = 0;
    if (line.split(' ').length <= 8 && !looksLikeLocation(line)) { basics.label = line; }
    break;
  }
  // Location: a "City, Region" token in the header.
  for (const line of headLines) {
    for (const part of line.split(/\s*[|•·]\s*/)) {
      const p = part.trim();
      if (looksLikeLocation(p) && !EMAIL_RE.test(p) && !/remote|hybrid/i.test(p)) {
        const [city, region] = p.replace(/\s*\(.*?\)\s*/g, ' ').trim().split(/,\s*/);
        basics.location = { city, region };
        return basics;
      }
    }
  }
  return basics;
}

function toNameCase(s) {
  if (s === s.toUpperCase() || s === s.toLowerCase()) return s.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (c) => c.toUpperCase());
  return s;
}

/**
 * Parse resume text into JSON Resume.
 * @param {string} text
 * @returns {object} JSON Resume, with meta.applykin holding parse notes and unknown sections.
 */
export function parseResume(text) {
  const lines = cleanLines(text || '');
  const sections = [];
  let current = { key: '_head', title: '', lines: [] };
  sections.push(current);
  let prevBlank = true;
  for (const line of lines) {
    let key = headingKey(line);
    // An unknown heading: short, ALL CAPS or ending with a colon, after a blank line, once sections have started.
    if (!key && current.key !== '_head' && prevBlank && line && line.split(' ').length <= 4 && !/\d/.test(line) &&
        (/:$/.test(line) || (line === line.toUpperCase() && /\p{Lu}{3}/u.test(line)))) key = '_unknown';
    prevBlank = !line;
    if (key) {
      current = { key, title: line.replace(/[:：]$/, ''), lines: [] };
      sections.push(current);
    } else {
      current.lines.push(line);
    }
  }

  const head = sections[0].lines.filter(Boolean).slice(0, 12);
  const resume = {
    $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
    basics: parseBasics(head, text || ''),
    work: [],
    education: [],
    skills: [],
    projects: [],
    certificates: [],
    languages: [],
    awards: [],
    volunteer: [],
    publications: [],
    interests: [],
    meta: { applykin: { headings: [], unparsed: [], parsedAt: new Date().toISOString() } },
  };
  const notes = resume.meta.applykin;

  // Header lines that are not contact info, after name/label, become a summary if none is found.
  const headExtra = head.filter((l) => l.split(' ').length > 12 && !EMAIL_RE.test(l));

  for (const s of sections.slice(1)) {
    notes.headings.push(s.title);
    const body = s.lines;
    switch (s.key) {
      case 'summary':
        resume.basics.summary = body.filter(Boolean).map(stripBullet).join(' ');
        break;
      case 'work':
        resume.work.push(...mergeNestedRoles(groupEntries(body).map(parseWorkEntry)).filter((w) => w.name || w.position || w.highlights.length));
        break;
      case 'volunteer':
        resume.volunteer.push(...groupEntries(body).map(parseWorkEntry).map((w) => ({ organization: w.name, position: w.position, startDate: w.startDate, endDate: w.endDate, highlights: w.highlights })));
        break;
      case 'education':
        // Education written as a bulleted list: each bullet is one entry.
        resume.education.push(...groupEntries(body)
          .flatMap((g) => (!g.headers.length && g.bullets.length ? g.bullets.map((b) => ({ headers: [b], bullets: [], range: findDateRange(b) })) : [g]))
          .map(parseEducationEntry).filter((e) => e.institution || e.studyType));
        break;
      case 'skills':
        resume.skills.push(...parseSkills(body));
        break;
      case 'languages':
        resume.languages.push(...parseLanguages(body));
        break;
      case 'projects':
        resume.projects.push(...parseSimpleList(body));
        break;
      case 'certificates':
        resume.certificates.push(...parseSimpleList(body).map((c) => ({ name: c.name, date: c.endDate || c.startDate })));
        break;
      case 'awards':
        resume.awards.push(...parseSimpleList(body).map((a) => ({ title: a.name, date: a.endDate || a.startDate })));
        break;
      case 'publications':
        resume.publications.push(...parseSimpleList(body).map((p) => ({ name: p.name, releaseDate: p.endDate })));
        break;
      case 'additional':
        for (const line of body.filter(Boolean).map(stripBullet)) {
          const m = line.match(/^(languages?|sprachen|langues)\s*:\s*(.+)$/i);
          if (m) resume.languages.push(...parseLanguages([m[2]]));
          else resume.interests.push(...splitList(line.replace(/^[^:]{2,30}:\s*/, '')).map((name) => ({ name })));
        }
        break;
      case 'interests':
        resume.interests.push(...splitList(body.filter(Boolean).map(stripBullet).join(', ')).map((name) => ({ name })));
        break;
      default:
        notes.unparsed.push({ title: s.title, text: body.join('\n').trim() });
    }
  }
  if (!resume.basics.summary && headExtra.length) resume.basics.summary = headExtra.join(' ');
  notes.sourceText = text;
  return resume;
}
