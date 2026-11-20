// Job sources. Each source documents its endpoint, rate limit and reuse terms, and turns
// the raw API response into the shared Job shape. fetch is passed in, so this runs in
// Node (the scheduled pipeline), the browser, and the MCP server.
//
// Job = { id, source, sourceLabel, company, title, location, remote, workplace, employmentType,
//         department, salary: {min,max,currency,interval,text}|null, description (plain text),
//         url, applyUrl, postedAt (ISO), attribution }

export const SOURCES = {
  greenhouse: {
    label: 'Greenhouse',
    kind: 'per-company',
    endpoint: (slug) => `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`,
    docs: 'https://developers.greenhouse.io/job-board.html',
    rateLimitMs: 500,
    terms: 'Public Job Board API; GET needs no key. Link to the employer\'s own posting.',
    normalize: (raw, slug) => (raw.jobs || []).map((j) => ({
      id: `greenhouse:${slug}:${j.id}`,
      source: 'greenhouse',
      company: j.company_name || slug,
      title: j.title,
      location: j.location?.name || '',
      department: j.departments?.[0]?.name || '',
      description: htmlToText(decodeEntities(j.content || '')),
      url: j.absolute_url,
      applyUrl: j.absolute_url,
      postedAt: toISO(j.first_published || j.updated_at),
    })),
  },
  lever: {
    label: 'Lever',
    kind: 'per-company',
    endpoint: (slug) => `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`,
    docs: 'https://github.com/lever/postings-api',
    rateLimitMs: 1000,
    terms: 'Published postings are public. Keep to about 1 request per second.',
    normalize: (raw, slug) => (Array.isArray(raw) ? raw : []).map((j) => ({
      id: `lever:${slug}:${j.id}`,
      source: 'lever',
      company: titleCase(slug),
      title: j.text,
      location: j.categories?.location || (j.categories?.allLocations || []).join('; '),
      workplace: j.workplaceType || '',
      employmentType: j.categories?.commitment || '',
      department: j.categories?.team || j.categories?.department || '',
      salary: j.salaryRange ? { min: j.salaryRange.min, max: j.salaryRange.max, currency: j.salaryRange.currency, interval: j.salaryRange.interval } : null,
      description: [j.descriptionPlain || htmlToText(j.description || ''),
        ...(j.lists || []).map((l) => `${l.text}\n${htmlToText(l.content || '')}`), j.additionalPlain || ''].filter(Boolean).join('\n\n'),
      url: j.hostedUrl,
      applyUrl: j.applyUrl || j.hostedUrl,
      postedAt: toISO(j.createdAt),
    })),
  },
  ashby: {
    label: 'Ashby',
    kind: 'per-company',
    endpoint: (slug) => `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true`,
    docs: 'https://developers.ashbyhq.com/docs/public-job-posting-api',
    rateLimitMs: 500,
    terms: 'Public, unauthenticated Job Posting API. Link to the employer\'s posting.',
    normalize: (raw, slug) => (raw.jobs || []).filter((j) => j.isListed !== false).map((j) => {
      const sal = (j.compensation?.summaryComponents || []).find((c) => c.compensationType === 'Salary' && (c.minValue || c.maxValue));
      return {
        id: `ashby:${slug}:${j.id}`,
        source: 'ashby',
        company: titleCase(slug),
        title: j.title,
        location: j.location || '',
        remote: !!j.isRemote,
        workplace: j.workplaceType || '',
        employmentType: j.employmentType || '',
        department: j.department || '',
        salary: sal ? { min: sal.minValue, max: sal.maxValue, currency: sal.currencyCode, interval: sal.interval, text: j.compensation?.scrapeableCompensationSalarySummary } : null,
        description: j.descriptionPlain || htmlToText(j.descriptionHtml || ''),
        url: j.jobUrl,
        applyUrl: j.applyUrl || j.jobUrl,
        postedAt: toISO(j.publishedAt),
      };
    }),
  },
  arbeitnow: {
    label: 'Arbeitnow',
    kind: 'feed',
    endpoint: (page = 1) => `https://www.arbeitnow.com/api/job-board-api?page=${page}`,
    docs: 'https://www.arbeitnow.com/blog/job-board-api',
    rateLimitMs: 1000,
    terms: 'Free API; Arbeitnow asks for a link back. Show "via Arbeitnow" with each listing.',
    attribution: 'via Arbeitnow',
    normalize: (raw) => (raw.data || []).map((j) => ({
      id: `arbeitnow:${j.slug}`,
      source: 'arbeitnow',
      company: j.company_name,
      title: j.title,
      location: j.location || '',
      remote: !!j.remote,
      employmentType: (j.job_types || []).join(', '),
      department: (j.tags || []).join(', '),
      description: htmlToText(decodeEntities(j.description || '')),
      url: j.url,
      applyUrl: j.url,
      postedAt: toISO(j.created_at > 1e12 ? j.created_at : j.created_at * 1000),
    })),
  },
};

// ---------- helpers ----------
export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', bull: '•' }[e.toLowerCase()] ?? m;
  });
}

export function htmlToText(html) {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<\/(p|div|h[1-6]|li|ul|ol|tr)>|<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function toISO(v) {
  if (v === undefined || v === null || v === '') return '';
  const d = new Date(v);
  return isNaN(d) ? '' : d.toISOString();
}

function titleCase(slug) {
  return String(slug).replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const REMOTE_RE = /\bremote\b|\banywhere\b|home[- ]?office|work from home/i;

/** Fill derived fields and attribution. */
export function finalizeJob(j) {
  const src = SOURCES[j.source];
  return {
    remote: REMOTE_RE.test(`${j.location} ${j.workplace || ''}`),
    workplace: '',
    employmentType: '',
    department: '',
    salary: null,
    ...j,
    sourceLabel: src?.label || j.source,
    attribution: src?.attribution || `from ${j.company}'s ${src?.label || ''} job board`.replace(/\s+/g, ' '),
    description: (j.description || '').slice(0, 20000),
  };
}

/** Remove duplicates (same company + title + location) and stale listings. */
export function dedupeJobs(jobs, { maxAgeDays = 45, now = Date.now() } = {}) {
  const seen = new Map();
  for (const j of jobs) {
    if (!j.title || !j.url) continue;
    if (j.postedAt && now - Date.parse(j.postedAt) > maxAgeDays * 864e5) continue;
    const key = [j.company, j.title, j.location].map((x) => String(x || '').toLowerCase().replace(/\W+/g, '')).join('|');
    const prev = seen.get(key);
    if (!prev || (j.postedAt || '') > (prev.postedAt || '')) seen.set(key, j);
  }
  return [...seen.values()].sort((a, b) => (b.postedAt || '').localeCompare(a.postedAt || ''));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch one company board, or one page of a feed.
 * @param {string} source key of SOURCES
 * @param {string|number} slugOrPage company slug, or page number for feeds
 * @param {typeof fetch} fetchFn
 */
export async function fetchSource(source, slugOrPage, fetchFn = fetch, headers = {}) {
  const src = SOURCES[source];
  if (!src) throw new Error(`Unknown source "${source}"`);
  // Browsers: keep to simple headers so no CORS preflight is needed. Node can add a User-Agent.
  const res = await fetchFn(src.endpoint(slugOrPage), { headers: { accept: 'application/json', ...headers } });
  if (!res.ok) throw new Error(`${src.label} ${slugOrPage}: HTTP ${res.status}`);
  return src.normalize(await res.json(), slugOrPage).map(finalizeJob);
}

/**
 * Fetch many boards politely (sequential per source, each source's rate limit respected).
 * @param {{source:string, slug?:string, pages?:number}[]} boards
 * @returns {{jobs: object[], errors: string[]}}
 */
export async function fetchBoards(boards, fetchFn = fetch, { onProgress, maxAgeDays, headers } = {}) {
  const jobs = [], errors = [];
  let done = 0;
  for (const b of boards) {
    const src = SOURCES[b.source];
    const targets = src?.kind === 'feed' ? Array.from({ length: b.pages || 1 }, (_, i) => i + 1) : [b.slug];
    for (const t of targets) {
      try {
        const got = await fetchSource(b.source, t, fetchFn, headers);
        jobs.push(...(b.company ? got.map((j) => ({ ...j, company: b.company, attribution: `from ${b.company}'s ${src.label} job board` })) : got));
      }
      catch (e) { errors.push(e.message); }
      await sleep(src?.rateLimitMs || 1000);
    }
    onProgress?.(++done, boards.length);
  }
  return { jobs: dedupeJobs(jobs, { maxAgeDays }), errors };
}
