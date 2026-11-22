// One landing page per menu item (Resume builder, ATS checker, Job search, ...), built from data
// so every page shares the same structure: hero, 4 steps, what we check, what's next, free tools.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Titles may mark one phrase with [[...]] for the highlighter.
const hl = (s) => esc(s).replace(/\[\[(.+?)\]\]/g, '<span class="hl">$1</span>');

// Small CSS illustrations, shared by the step cards and feature rows.
const ART = {
  upload: `<div class="a-doc"><i class="t"></i><i></i><i></i><i class="m"></i><i></i></div><div class="a-file"><span class="a-tag">PDF</span><i></i><b class="a-ok">✓</b><em></em></div><span class="a-fab">↑</span>`,
  ring: `<div class="mini-ring" style="--v:96"><b>96</b><small>Quality</small></div><span class="h-up">↑ +24</span>`,
  ats: `<div class="a-scan"><div class="a-doc sm"><i class="t"></i><i></i><i class="m"></i><i></i></div><span class="a-badge">ATS 100</span></div>`,
  pick: `<div class="a-three"><div class="a-doc xs"><i class="t"></i><i></i><i></i></div><div class="a-doc xs on"><i class="t"></i><i></i><i class="m"></i><b class="a-ok">✓</b></div><div class="a-doc xs"><i class="t"></i><i></i><i></i></div></div>`,
  fix: `<div class="a-list"><p><span>✓</span><i></i></p><p class="warn"><span>→</span><i></i><em>+4</em></p><p><span>✓</span><i></i></p></div>`,
  download: `<div class="a-doc"><i class="t"></i><i></i><i></i><i class="m"></i><i></i></div><div class="a-file dark"><span class="a-tag">PDF</span><i></i><b class="a-pct">Free</b><em></em></div><span class="a-fab">↓</span>`,
  jobs: `<div class="a-jobs"><p class="on"><span>NW</span><i></i><b>87</b></p><p><span>PS</span><i></i><b>74</b></p><p><span>MM</span><i></i><b>63</b></p></div>`,
  pin: `<div class="h-pin"><b>87</b><small>Strong match</small><em>In your state</em></div>`,
  side: `<div class="a-jobs"><p class="on"><span>$</span><i></i><b class="warm">PT</b></p><p><span>$</span><i></i><b class="warm">Gig</b></p><p><span>$</span><i></i><b class="warm">PT</b></p></div>`,
  kit: `<div class="a-kit"><div class="a-post"><i></i><span>vendor mgmt</span><span>KPIs</span><span class="miss">Shopify</span></div><div class="a-doc sm"><i class="t"></i><i class="m"></i><i></i><i></i></div><span class="a-match">Match 82</span></div>`,
  letter: `<div class="a-letters"><div class="a-lt"><b></b><i></i><i></i><i class="s"></i></div><span class="a-pen">✎</span><div class="a-lt big"><b></b><i></i><i></i><i></i><i class="s"></i><em>✓</em></div></div>`,
  board: `<div class="a-board"><div><i></i><p></p><p></p></div><div><i class="o"></i><p></p><p class="on"></p></div><div><i class="g"></i><p></p><p class="dash"></p></div></div>`,
  rate: `<div class="a-rate"><b>2 of 5</b><small>tailored applications got a reply</small><div><i style="height:60%"></i><i style="height:20%"></i></div></div>`,
};

// The tools, used for "what's next" and "free tools" sections.
const TOOLS = {
  'resume-builder': { label: 'Resume builder', group: 'Resume', blurb: 'Improve your resume in six short, guided steps.', art: 'fix' },
  'ats-checker': { label: 'ATS checker', group: 'Resume tools', blurb: 'See exactly what a tracking system reads from your file.', art: 'ats' },
  'resume-checker': { label: 'Resume checker', group: 'Resume tools', blurb: 'Two scores with every rule, weight and source shown.', art: 'ring' },
  designs: { label: 'Resume designs', group: 'Resume', blurb: 'Eight designs, each rated for tracking systems.', art: 'pick' },
  'job-search': { label: 'Job search', group: 'Jobs', blurb: 'Jobs near you first, ranked by how well you fit.', art: 'jobs' },
  'side-income': { label: 'Side income', group: 'Jobs', blurb: 'Remote part-time and freelance work.', art: 'side' },
  apply: { label: 'Apply with Applykin', group: 'Apply', blurb: 'A tailored resume, letter and answers for each job.', art: 'kit' },
  'cover-letter': { label: 'Cover letter writer', group: 'Apply', blurb: 'A letter for each job, using only facts on your resume.', art: 'letter' },
  tracker: { label: 'Application tracker', group: 'Track', blurb: 'Every job, stage and reply in one place.', art: 'board' },
};

export const PAGES = {
  'resume-builder': {
    title: 'Build your resume [[step by step]] and finally hear back',
    lead: "You don't need to know what makes a great resume. Add the one you have, and Applykin walks you through six short steps, each with clear fixes. Nothing is written for you that isn't true.",
    cta: 'Start my resume', rail: true,
    stepsTitle: '[[4 steps]] to a resume that gets read',
    stepsLead: 'Upload your resume or paste it in. Applykin checks it, helps you fix it, and gives you a free PDF.',
    steps: [['upload', 'Add your resume', 'Upload a PDF or Word file, or paste the text.'], ['fix', 'Fix it step by step', 'Contact, summary, experience, skills: one short step at a time.'], ['pick', 'Pick a design', 'Each design is rated for how safely hiring software reads it.'], ['download', 'Download it free', 'PDF, web page or JSON Resume. No watermark, no paywall.']],
    checks: [['Contact details', 'Name, email, phone, city and a profile link, where recruiters expect them.'], ['Every job has dates', 'Clear start and end dates, newest first, so nothing looks hidden.'], ['Bullets that prove it', 'Action verbs, numbers and results instead of duties.'], ['Clean, readable layout', 'Plain headings and a single column that every system can read.']],
  },
  'ats-checker': {
    title: 'See your resume [[the way hiring software does]]',
    lead: 'Most applications pass through an applicant tracking system (ATS) first. Applykin reads your file the same way and shows you what came through and what got lost.',
    cta: 'Check my resume', rail: true,
    stepsTitle: 'The ATS check in [[4 steps]]',
    stepsLead: 'It takes under a minute, and your file never leaves your device.',
    steps: [['upload', 'Add your file', 'The same PDF or Word file you send to employers.'], ['ats', 'See what it reads', 'Name, contact, jobs, dates and skills, as software sees them.'], ['fix', 'Fix what got lost', 'Each problem links straight to the line that causes it.'], ['pick', 'Switch to a safe design', 'Two-column designs are flagged; single-column ones are safe.']],
    checks: [['Text, not images', 'If your PDF is a scan, nothing can be read. Applykin checks for a real text layer.'], ['Standard headings', '"Experience", "Education", "Skills": headings software recognizes.'], ['Contact in the body', 'Details in headers and footers are often skipped by parsers.'], ['Layout safety', 'Columns, tables and text boxes can scramble the reading order.']],
  },
  'resume-checker': {
    title: 'A resume score that [[shows its work]]',
    lead: 'Two scores: one for quality, one for how well tracking systems can read it. Every rule, its weight and the evidence behind it is on the page. No black box, no scare tactics.',
    cta: 'Score my resume', rail: true,
    stepsTitle: 'From score to fixes in [[4 steps]]',
    stepsLead: 'See where you stand, then fix the biggest gaps first.',
    steps: [['upload', 'Add your resume', 'PDF, Word, or pasted text.'], ['ring', 'Get two scores', 'Resume quality, and ATS readability, kept separate.'], ['fix', 'Work through fixes', 'Sorted by how many points each one is worth.'], ['download', 'Download the result', 'A clean PDF in the design you choose.']],
    checks: [['Completeness · 40%', 'Contact details, summary, experience, education and skills are all there.'], ['Structure · 35%', 'Dates, order, and the right number of bullets per job.'], ['Clarity · 25%', 'Action verbs, numbers, short bullets, no clichés or "I".'], ['Evidence for every rule', 'Each rule says whether it rests on strong research or is simply advice.']],
  },
  designs: {
    title: 'Resume designs [[rated for tracking systems]]',
    lead: 'Pick a design and your resume changes instantly. Each one is labeled: best for online applications, good, or better saved for email and networking.',
    cta: 'Try designs on my resume', rail: true,
    stepsTitle: 'Change the look in [[4 steps]]',
    stepsLead: 'Your content stays the same; only the design changes.',
    steps: [['upload', 'Add your resume', 'Or try one of the sample resumes.'], ['pick', 'Pick a design', 'Eight designs, from Classic to Bold Column.'], ['fix', 'Adjust it', 'Color, font, spacing, margins and an optional photo.'], ['download', 'Download it', 'Free PDF. Your letter uses the same design.']],
    checks: [['Best for ATS', 'Single column, plain headings. Safe everywhere. Use these online.'], ['Good for ATS', 'A color band or date column. Read well by almost every system.'], ['Email & networking', 'Two columns look great to people but can confuse some software.'], ['Matching letter', 'Cover letters use the same header and colors as your resume.']],
  },
  'job-search': {
    title: 'Jobs [[near you first]], ranked by how well you fit',
    lead: 'Thousands of jobs from public company job boards, refreshed every 6 hours. Tell Applykin where you are and it shows your city first, then your state, then your country, then remote.',
    cta: 'Find jobs', ctaHref: '#get-started', art: 'jobs',
    stepsTitle: 'Find the right jobs in [[4 steps]]',
    stepsLead: 'No account, no alerts to unsubscribe from.',
    steps: [['pin', 'Say where you are', 'City, state and country. Filled in from your resume if it is there.'], ['jobs', 'See jobs by distance', 'Closest first, remote first, or best match: your choice.'], ['ring', 'Read the match', 'Skills, title and wording, each shown so you know why.'], ['kit', 'Apply', 'Open a job and get a tailored application kit.']],
    checks: [['Skills · 45%', 'Skills the ad names that your resume shows.'], ['Job title · 35%', 'How close the role is to titles, and work, you have done.'], ['Wording · 20%', "How much of the ad's language your resume shares."], ['Plain labels', '75+ strong, 60–74 good, 45–59 worth a look. Not your odds of being hired.']],
  },
  'side-income': {
    title: 'Make extra money with [[remote part-time work]]',
    lead: 'Part-time, contract and freelance jobs you can do from home, alongside a job or between jobs. One click filters the list to just those.',
    cta: 'Show side income jobs', ctaHref: '#side-income', art: 'side',
    stepsTitle: 'Find side work in [[4 steps]]',
    stepsLead: 'Every job is labeled Full-time, Part-time, Contract or Internship.',
    steps: [['upload', 'Add your resume', 'So jobs can be ranked by fit.'], ['side', 'Filter to side work', 'Remote part-time and freelance, shown first.'], ['kit', 'Apply with a kit', 'Tailored resume and letter in minutes.'], ['board', 'Track it', 'Keep side gigs and full-time searches in one board.']],
    checks: [['Remote first', 'Jobs you can do from anywhere open to your country come first.'], ['Clear job types', 'Part-time, contract and freelance are labeled on every card.'], ['Real listings', 'From company job boards and the Jobicy remote feed, credited on each job.'], ['No gig-site scraping', "Sites like Upwork or Fiverr don't share their listings, so they aren't included."]],
  },
  apply: {
    title: 'Apply with [[a tailored kit]], never made-up facts',
    lead: 'For each job, Applykin reorders your resume to put the most relevant experience first, uses the job ad\'s spelling for skills you have, drafts a letter, and keeps your answers ready to paste.',
    cta: 'Pick a job', ctaHref: '#apply', art: 'kit',
    stepsTitle: 'Apply in [[4 steps]]',
    stepsLead: 'You review every change and submit on the employer\'s own page.',
    steps: [['jobs', 'Pick a job', 'From the list, or paste any job ad.'], ['kit', 'Tailor your resume', 'Relevant bullets first. Every change listed, each one optional.'], ['letter', 'Write the letter', 'A draft from your resume, ready to edit.'], ['board', 'Apply and track', 'Open the posting, submit, and mark it applied.']],
    checks: [['Only your facts', "Missing skills are pointed out, never added. If it's not true, it's not there."], ['Matches the ad', 'Uses the ad\'s spelling for skills you already have ("KPIs", "P&L").'], ['Saved answers', 'Work authorization, notice period, salary: typed once, reused everywhere.'], ['A record of what you sent', 'The exact resume and letter are saved with each application.']],
  },
  'cover-letter': {
    title: 'A cover letter for [[each job]], in minutes',
    lead: 'Applykin drafts a letter from the facts on your resume and the job ad, in the same design as your resume. Polish it with your own AI key or a free model on your computer, if you like.',
    cta: 'Write a letter', ctaHref: '#cover-letter', art: 'letter',
    stepsTitle: 'Write a letter in [[4 steps]]',
    stepsLead: 'Built from your resume. Nothing invented.',
    steps: [['jobs', 'Pick a job', 'Or paste any job ad.'], ['letter', 'Get a draft', 'Your strongest relevant results, in plain language.'], ['fix', 'Edit it', 'Change anything; optional AI polish keeps to your facts.'], ['download', 'Download it', 'PDF in your resume\'s design.']],
    checks: [['Uses your results', 'Quotes your own bullets that best match the role.'], ['Names the company and role', 'So it reads as written for this job, because it is.'], ['Same design as your resume', 'Header, font and colors match.'], ['AI is optional', 'Works without AI. With it, the prompt forbids inventing anything.']],
  },
  tracker: {
    title: 'Every application [[in one place]]',
    lead: 'A simple board from Saved to Offer. Each application keeps the resume and letter you sent, and your results show which approach gets replies.',
    cta: 'Open my tracker', ctaHref: '#tracker', art: 'board',
    stepsTitle: 'Track it in [[4 steps]]',
    stepsLead: 'Stored in your browser. No account needed.',
    steps: [['jobs', 'Save jobs', 'One click from any job.'], ['kit', 'Apply', 'Your tailored kit is saved with the application.'], ['board', 'Move it along', 'Applied, interview, offer, or no reply.'], ['rate', 'Learn what works', 'Reply rates by tailoring, design and score.']],
    checks: [['Stages that make sense', 'Saved, applied, interview, offer, rejected, no reply.'], ['What you sent', 'The exact resume, letter and design for each job.'], ['Your own reply rate', 'Measured from your applications, not a marketing claim.'], ['Private', 'Kept in your browser. Export or clear it anytime.']],
  },
};

// Questions, per page; pages without their own get the shared set.
const FAQ_COMMON = [
  ['Is Applykin really free?', 'Yes. Checking, designs, PDF downloads, job search, tailoring, letters and the tracker are free with no limits. There is no paid plan to upgrade to.'],
  ['Where is my resume stored?', 'Only in your browser on this device. It is never uploaded to a server. Clearing your browser data, or pressing Start over, removes it.'],
  ['Does Applykin use AI?', 'Scoring, matching and tailoring are rule-based and run on your device. AI is optional: for polishing a letter you can connect your own key or a free local model.'],
  ['Will it make things up?', 'No. Tailoring and letters only use facts from your resume. Skills you don\'t list are pointed out as missing, never added.'],
];
const FAQS = {
  'resume-builder': [
    ['How does the resume builder work?', 'Add the resume you have. Applykin reads it, then walks you through six steps: contact, summary, experience, more sections, design, and download. Each step lists exactly what to fix.'],
    ['Can I upload my existing resume?', 'Yes: PDF, Word (.docx), plain text or JSON Resume. You can also paste the text.'],
    ['Is the result ATS-friendly?', 'Designs marked "Best for ATS" use one column and standard headings, which tracking systems like Greenhouse, Lever and Workday read reliably.'],
    ['Does it work for other countries?', 'Yes. Date formats, page size (Letter or A4) and section headings follow your country: US, UK, Germany, Switzerland and France.'],
  ],
  'ats-checker': [
    ['What is an ATS?', 'An applicant tracking system: software employers use to collect and search applications. It turns your file into text, so anything it cannot read is lost.'],
    ['Is there an official ATS score?', 'No. Every system is different and none publishes a score. Applykin checks the things that commonly break parsing and shows you what it read.'],
    ['Why are two-column designs flagged?', 'Some systems read across both columns line by line, mixing up your sections. One column is the safe choice for online applications.'],
    ['Does it check a scanned PDF?', 'It tells you if your PDF has no text layer. A scan is an image, so tracking systems cannot read it at all.'],
  ],
  'resume-checker': [
    ['How is the score calculated?', 'A checklist of rules, weighted 40% completeness, 35% structure and 25% clarity. Every rule, its weight and its evidence are shown in the app.'],
    ['Why might other sites score me lower?', 'Scores are not standardized. Some tools start low to encourage upgrades. Applykin shows every rule so you can judge for yourself.'],
    ['Is a higher score a guarantee?', 'No. It means your resume avoids common problems. Getting interviews also depends on fit, timing and the role.'],
  ],
  'job-search': [
    ['Where do the jobs come from?', 'Public job boards that companies publish themselves (Greenhouse, Lever, Ashby), plus the Arbeitnow and Jobicy feeds. Refreshed every 6 hours.'],
    ['How does "near me" work?', 'It compares city, state and country names: your city first, then your state, your country, then remote. It does not measure miles.'],
    ['What does a match of 60 mean?', 'A good match: 75+ strong, 60–74 good, 45–59 worth a look. It shows how well your resume lines up with the ad, not your odds of being hired.'],
  ],
  apply: [
    ['Does Applykin apply for me?', 'No. It prepares your tailored resume, letter and answers, then opens the employer\'s page so you review and submit. Bots that auto-apply tend to get blocked.'],
    ['What exactly does tailoring change?', 'It puts your most relevant bullets first, uses the ad\'s spelling for skills you already have, and can trim old bullets or change your headline if you choose. Every change is listed.'],
  ],
};

const ORDER = ['resume-builder', 'ats-checker', 'resume-checker', 'designs', 'job-search', 'side-income', 'apply', 'cover-letter', 'tracker'];

const RESUME_PAGES = ['resume-builder', 'ats-checker', 'resume-checker', 'designs'];
// The dark "what we consider" card: real numbers come from the app (sample resume scores).
function scoreCard(id, nums) {
  const resume = RESUME_PAGES.includes(id);
  const n = resume ? nums.quality : 87;
  const title = resume ? 'Your personal resume score' : 'Your match score for each job';
  const text = resume
    ? 'Calculated from what is on your resume and how it is laid out, with every rule shown.'
    : 'Calculated from your skills, the titles you have held, and the wording of each job ad.';
  const chips = resume ? ['Completeness', 'Structure', 'Clarity', 'ATS readability'] : ['Skills', 'Job title', 'Wording', 'Distance'];
  return `<div class="p-scorecard"><div class="mini-ring big" style="--v:${n}"><b>${n}</b><small>/ 100</small></div>
    <div class="p-sc-text"><h3>${esc(title)}</h3><p>${esc(text)}</p><div class="p-chips">${chips.map((c) => `<span>${esc(c)}</span>`).join('')}</div></div><span class="p-sc-n">01</span></div>`;
}

/** @param {string} id page id  @param {{quality:number, weak:number}} nums real sample scores */
export function renderPage(id, nums = { quality: 98, weak: 46 }) {
  const p = PAGES[id];
  if (!p) return '';
  const go = `#go/${id}`;
  const resume = RESUME_PAGES.includes(id);
  const nextFour = resume ? ['job-search', 'apply', 'cover-letter', 'tracker'] : ['resume-builder', 'job-search', 'apply', 'cover-letter', 'tracker'].filter((k) => k !== id).slice(0, 4);
  const nextTitles = { 'job-search': 'Job suggestions matched to you', apply: 'Tailor your resume to the job', 'cover-letter': 'Create a cover letter for the job', tracker: 'Manage all applications in one place', 'resume-builder': 'Build a resume that gets read' };
  return `
  <section class="h-hero p-hero">
    <h1 class="h-title p-title">${hl(p.title)}</h1>
    <p class="h-lead">${esc(p.lead)}</p>
    <div class="h-ctas"><a class="btn big" href="${go}">Get started <span aria-hidden="true">→</span></a></div>
    <p class="p-trust">🔒 Your resume stays private, on your device</p>
    <p class="p-facts"><b>100% free</b> · <b>8</b> designs · <b>27</b> checks, all explained · <b>No</b> account needed</p>
    ${resume ? `<div class="p-rail ba" data-rail="before-after"></div><p class="p-fine">Sample resumes. The "before" is a real weak resume scoring ${nums.weak}; the "after" is a finished one scoring ${nums.quality}.</p>` : `<div class="p-art">${ART[p.art]}</div>`}
  </section>

  <section class="h-sec">
    <h2 class="h-h2">${hl(p.stepsTitle)}</h2>
    <p class="h-sub">${esc(p.stepsLead)}</p>
    <ol class="h-four">${p.steps.map(([art, t, d], i) => `<li><div class="h-art">${ART[art]}</div><span class="h-n">${i + 1}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></li>`).join('')}</ol>
  </section>

  <section class="p-dark">
    <p class="p-eyebrow">What we consider</p>
    <h2>What ${resume ? 'the Applykin resume check' : 'Applykin'} looks at</h2>
    <p class="p-dark-lead">${resume ? 'Nothing hidden. Each rule, its weight, and how strong the evidence behind it is, are all shown in the app.' : 'Every number has its reasons listed next to it, so you know why a job ranks where it does.'}</p>
    ${scoreCard(id, nums)}
    <div class="p-dgrid">${p.checks.map(([t, d], i) => `<div class="p-dcard"><span class="p-num">0${i + 1}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join('')}</div>
  </section>

  <section class="h-sec">
    <h2 class="h-h2 center">How Applykin helps with<br>your application <span class="hl">next</span></h2>
    <p class="h-sub center">Everything you need for your job search, from resume to cover letter to tracking.</p>
    ${nextFour.map((k, i) => `
    <div class="p-row ${i % 2 ? 'flip' : ''}">
      <div class="p-row-text"><p class="p-idx">0${i + 1}</p><h3>${esc(nextTitles[k] || TOOLS[k].label)}</h3><p>${esc(TOOLS[k].blurb)}</p><a class="h-link" href="#page/${k}">Learn more →</a></div>
      <a class="p-row-art" href="#page/${k}" aria-label="${esc(TOOLS[k].label)}">${ART[TOOLS[k].art]}</a>
    </div>`).join('')}
  </section>

  <section class="p-dark p-tools">
    <h2>Free tools for your resume</h2>
    <div class="p-tgrid">${['ats-checker', 'resume-checker', 'job-search'].filter((k) => k !== id).slice(0, 2).map((k) => `
      <a class="p-tool" href="#page/${k}"><span class="p-ti">${k === 'job-search' ? '◎' : k === 'ats-checker' ? '⌕' : '✓'}</span><span class="p-arrow">↗</span><p class="p-eyebrow">${k === 'job-search' ? 'Job tools' : 'Resume tools'}</p><h3>${esc(TOOLS[k].label)}</h3><p>${esc(TOOLS[k].blurb)}</p></a>`).join('')}</div>
  </section>

  <section class="h-designs warm">
    <div class="h-designs-head">
      <div><h2>Professional resume and cover letter designs</h2><p>Each design is rated for tracking systems, and your cover letter uses the same look.</p></div>
      <div class="h-arrows"><button type="button" data-scroll-rail="-1" aria-label="Previous designs">‹</button><button type="button" data-scroll-rail="1" aria-label="Next designs">›</button></div>
    </div>
    <div class="h-rail" data-rail="designs"></div>
  </section>

  <section class="p-dark p-privacy">
    <h2>Data protection and privacy <span class="hl dark">at Applykin</span></h2>
    <p class="p-dark-lead">Applykin keeps no servers full of your data, because it doesn't need any.</p>
    <div class="p-pgrid">
      <div><h3>🔒 Stays on your device</h3><p>Reading, scoring, tailoring and PDF export all run in your browser. Your resume is never uploaded.</p></div>
      <div><h3>✓ No account</h3><p>No sign-up, no email list, no tracking pixels. Close the tab and nothing about you is left anywhere else.</p></div>
      <div><h3>⚙ You're in control</h3><p>Press Start over to delete everything. If you connect an AI key, only the text you send goes to that provider.</p></div>
      <div><h3>{ } Open source</h3><p>Anyone can read the code and check these promises. <a href="https://github.com/googleYerreh/applykin" target="_blank" rel="noopener">View it on GitHub ↗</a></p></div>
    </div>
  </section>

  <section class="h-sec p-faq">
    <h2 class="h-h2">Questions about <span class="hl">${esc(TOOLS[id].label)}</span></h2>
    <p class="h-sub">Short answers to the questions job seekers ask most.</p>
    <div class="p-qgrid">${[...(FAQS[id] || []), ...FAQ_COMMON].slice(0, 8).map(([q, a]) => `<div><h3>${esc(q)}</h3><p>${esc(a)}</p></div>`).join('')}</div>
  </section>

  <section class="p-end">
    <h2>Your next application<br><span class="hl">gets a response.</span></h2>
    <a class="btn big" href="${go}">Try Applykin now <span aria-hidden="true">→</span></a>
    <div class="p-rail end" data-rail="designs"></div>
  </section>
  <footer class="h-foot"><span>apply<b>kin</b> · free and open source (AGPL)</span><span><a href="#home">Home</a> · <a href="https://github.com/googleYerreh/applykin" target="_blank" rel="noopener">GitHub</a></span></footer>`;
}

export const PAGE_IDS = ORDER;
