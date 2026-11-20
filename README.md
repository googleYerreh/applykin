# Applykin

**Your job search, on your side.** Free, open-source job-search tools. Live at https://googleyerreh.github.io/applykin/

Free, open-source job-search tools. No account, no paywall, and your data stays on your own device.

- **Step by step:** after upload, six short guided steps (contact, summary, experience, education & skills, design, download), each with its own fixes, per-bullet hints, and Back/Next. "Edit everything" shows the full editor.
- **Design:** a gallery of 8 designs, each rated for ATS safety (Best, Good, or Email & networking), plus, accent colours, fonts, and sliders for text size, line spacing, section spacing and margins.
- **Phase 1 – Resume:** import a PDF/Word resume, score it with an open rubric, fix it, export an ATS-friendly PDF.
- **Phase 2 – Jobs:** a free job feed from public company job boards, match scores that explain themselves, resume tailoring that never invents anything, cover-letter drafts, and an application tracker. AI is optional: a free local model (Ollama) or your own API key.

The same core runs in three places:

| Surface | What it is | Start it |
|---|---|---|
| Web app | One self-contained HTML file. Works offline. | `npm run build`, then open `dist/index.html` |
| CLI | `parse / score / render / pdf / rubric / jobs fetch / match / tailor / letter` | `node bin/applykin.js --help` |
| MCP server | 8 tools for AI agents (below) | `node mcp/server.js` (stdio) |
| Job feed | Scheduled job that writes `jobs.json` for the web app | `node scripts/fetch-jobs.js` |

## Quick start

```bash
npm install
npm test                      # 17 tests
npm run build                 # -> dist/index.html

node bin/applykin.js score samples/weak.pdf
node bin/applykin.js parse samples/strong.docx -o maria.json
node bin/applykin.js pdf maria.json --template modern --locale us -o maria.pdf   # needs Chrome; set CHROME_PATH if not found

node bin/applykin.js jobs fetch --boards data/boards.json -o jobs.json            # needs internet
node bin/applykin.js match samples/strong.pdf jobs.json --remote --limit 10
node bin/applykin.js tailor samples/strong.pdf jobs.json --id <job id> -o tailored.json
node bin/applykin.js letter samples/strong.pdf jobs.json --id <job id> [--ai ollama]
```

## Deploying the free job site (GitHub Pages, $0)

1. Push this repo to GitHub and turn on Pages with "GitHub Actions" as the source.
2. `.github/workflows/fetch-jobs.yml` runs every 6 hours: it tests, builds `dist/index.html`, collects jobs into `dist/jobs.json`, and publishes both.
3. The web app loads `jobs.json` from its own address, so visitors get fresh jobs with no server of yours.

**Find more employers automatically:** add company names to `data/candidates.txt` and run `npm run find-boards`. It tries each one on Greenhouse, Lever and Ashby and adds the ones with open jobs to `data/boards.json`.

Or add companies to `data/boards.json` by hand (`{ "source": "greenhouse", "slug": "gitlab", "company": "GitLab" }`). The slug is the name in the company's job-board URL. Boards marked `verified` answered when the list was made; a wrong slug just logs an error.

### Job sources and their terms

| Source | Endpoint | Terms we follow |
|---|---|---|
| Greenhouse | `boards-api.greenhouse.io/v1/boards/{slug}/jobs` | Public, no key. Link to the employer's page. |
| Lever | `api.lever.co/v0/postings/{slug}` | Public postings. About 1 request/second. |
| Ashby | `api.ashbyhq.com/posting-api/job-board/{slug}` | Public, no key. |
| Arbeitnow | `arbeitnow.com/api/job-board-api` | Free; credit "via Arbeitnow" on every listing. |

Each source lives in `core/jobs.js` with its rate limit and terms. "Apply" always goes to the employer's own page. We don't scrape LinkedIn, Indeed or Glassdoor.

## How matching works

Matching runs on your device: 45% skill overlap, 35% job-title similarity and 20% text similarity (TF-IDF). Every score lists the skills you match and the ones you're missing. Tailoring reorders your existing bullets and skills; it never adds or rewords anything. Cover letters are built only from your resume's facts. The optional AI step is told not to invent anything, and you should still check every line.

### MCP client config

```json
{
  "mcpServers": {
    "applykin": { "command": "node", "args": ["/path/to/applykin/mcp/server.js"] }
  }
}
```

Tools: `parse_resume`, `score_resume`, `render_resume`, `get_rubric`, `fetch_jobs`, `match_jobs`, `tailor_resume`, `write_cover_letter`.

## What's inside

```
core/        Pure JS, no dependencies. Runs in the browser, Node and MCP.
  parse.js   text -> JSON Resume (EN/DE/FR headings, many date formats)
  score.js   the open rubric: 26 rules in 4 categories, fixes ranked by points gained
  render.js  JSON Resume -> print-ready HTML (3 templates; US, UK, DE, CH, FR formats)
  extract.js PDF/DOCX text extraction (pdf.js / mammoth passed in)
  jobs.js    job sources (Greenhouse, Lever, Ashby, Arbeitnow), normalize, dedupe, polite fetching
  match.js   explainable job matching; skill vocabulary (contributions welcome)
  tailor.js  keyword gaps + relevance reordering (no new content)
  letter.js  template cover letter + AI prompts with a no-invention rule
  ai.js      Ollama / OpenAI-compatible / Anthropic, user's own key
  tracker.js application stages and history
node/        file loading for CLI + MCP
web/         the web app source; scripts/build-web.js bundles it into one file
bin/         CLI
mcp/         MCP server
samples/     fictional test resumes (TXT, PDF, DOCX)
test/        node:test suite
```

Data format: [JSON Resume](https://jsonresume.org/schema), so exports work with other tools.

## Applying

Applykin does not submit applications for you: the job boards' application APIs need each employer's private key, and bots on employer sites run into CAPTCHAs and site rules. Instead, **Apply with Applykin** prepares everything for one job:

1. **Tailor:** a copy of your resume for that job. It puts the most relevant bullets and skills first, uses the ad's spelling for skills you already list, can leave out unrelated bullets from older jobs, and can use the job title as your headline only if you tick that it is accurate. Every change is listed. Nothing is invented.
2. **Cover letter:** drafted from your resume's facts (optional AI polish with your own model or key), saved as a PDF in the same design as your resume.
3. **Apply:** download both PDFs, open the employer's form, copy your saved answers, then mark it applied. The tracker keeps the exact version you sent.

**Your results** (Tracker tab) shows how many applications led to an interview or offer, split by tailored vs main resume, design and score. It stays on your device.

## Scoring

There are **two separate scores**: *Resume quality* (completeness 40%, structure 35%, clarity 25%) and *ATS readability* (can tracking systems read the file). There is no official or proven resume score; ours is a transparent checklist. Every rule shows its evidence level (strong, some, or common advice) and sources (Ladders eye-tracking study, Enhancv recruiter interviews, parsing guidance). The weights are judgment, not fitted to hiring outcomes. Scores are rule-based and fully explained. Run `node bin/applykin.js rubric` or open "How the score works" in the app. Category weights: Completeness 25%, Structure 25%, Clarity 30%, ATS readiness 20%. Each fix shows how many points it adds. There's no percentile ranking: we won't claim one without real, opt-in data.

## Privacy

Your resume, tracker and AI settings are saved only in your browser's local storage. The web app makes network requests only when you load a job feed, fetch boards, or use the AI provider you chose. API keys go only to that provider.

## Roadmap

- **Phase 2.1:** more sources (Himalayas, USAJOBS with a key, Workable, SmartRecruiters), a larger seed list of company boards, and semantic matching with an in-browser embedding model.
- **Phase 3:** more sources and templates, a desktop app, translations, and an agent mode.
- **Core port:** the Rust/WASM core in the blueprint. Phase 1 uses plain JS to ship fast; the module boundaries match, so it can be swapped in.

## Rules for contributors

Rebuild the features only. Don't copy any commercial product's code, text, templates, branding or data. Job sources must allow reuse; see the blueprint's source table.

License: AGPL-3.0-only.
