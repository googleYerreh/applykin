// Runs job ranking off the main thread so clicks never wait on scoring 20,000+ jobs.
import { rankJobs } from '../core/match.js';

let jobs = [];
self.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'jobs') { jobs = m.jobs; return; }
  if (m.type === 'rank') {
    const pos = new Map(jobs.map((j, i) => [j, i]));
    const ranked = rankJobs(m.resume, jobs, { query: m.q, remote: m.remote, limit: Infinity });
    self.postMessage({ id: m.id, results: ranked.map((x) => [pos.get(x.job), x.match]) });
  }
};
