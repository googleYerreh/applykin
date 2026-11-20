// FICTIONAL sample listings so the Jobs tab can be tried anywhere (including offline).
// Companies, links and pay are made up. Real listings come from the job feed.
const d = (daysAgo) => new Date(Date.now() - daysAgo * 864e5).toISOString();
const job = (id, company, title, location, remote, daysAgo, description, salary = null, department = '') => ({
  id: `sample:${id}`, source: 'sample', sourceLabel: 'Sample', attribution: 'Fictional sample listing',
  company, title, location, remote, workplace: remote ? 'Remote' : '', employmentType: 'Full-time', department, salary,
  description, url: `https://example.com/jobs/${id}`, applyUrl: `https://example.com/jobs/${id}`, postedAt: d(daysAgo),
});

export const SAMPLE_JOBS = [
  job('pd-1', 'Northwind Pay (sample)', 'Senior Product Designer', 'Austin, TX', false, 2,
    'Design the merchant experience for a payments product. You will own flows end to end in Figma, contribute to our design system, run user interviews and usability testing with merchants, and partner closely with engineering and product. 5+ years of product design for B2B SaaS. Prototyping and interaction design skills required.',
    { min: 145000, max: 175000, currency: 'USD', interval: '1 YEAR', text: '$145K – $175K' }, 'Design'),
  job('pd-2', 'Lumen Health (sample)', 'Design Lead', 'Remote - US', true, 5,
    'Lead a team of four designers across our patient app. Set direction for the design system, coach designers, and run user research. Strong Figma, prototyping and accessibility skills. Experience presenting to executives.',
    { min: 170000, max: 200000, currency: 'USD', interval: '1 YEAR', text: '$170K – $200K' }, 'Design'),
  job('ux-3', 'Contoso Retail (sample)', 'UX Researcher', 'Chicago, IL', false, 9,
    'Plan and run user interviews, surveys and usability testing. Turn findings into journey mapping and clear recommendations for product teams. Experience with Notion and Jira is a plus.', null, 'Research'),
  job('be-4', 'Fabrikam Bank (sample)', 'Backend Engineer (Kotlin)', 'Munich, Germany', false, 1,
    'Build payment APIs with Kotlin, Java and Spring Boot on PostgreSQL. We run on Kubernetes in AWS and ship with GitHub Actions. You will take part in code reviews and on-call.',
    { min: 70000, max: 90000, currency: 'EUR', interval: '1 YEAR', text: '€70K – €90K' }, 'Engineering'),
  job('be-5', 'Tailspin Travel (sample)', 'Senior Java Developer', 'Berlin, Germany', true, 12,
    'Java and Spring Boot microservices, Kafka, PostgreSQL and Docker. Mentor mid-level engineers and improve CI/CD.', null, 'Engineering'),
  job('fe-6', 'Adatum Labs (sample)', 'Frontend Engineer (React)', 'Remote - Europe', true, 3,
    'Build our dashboard in React and TypeScript. Work with designers on our design system; care about accessibility and performance. GraphQL experience helps.', null, 'Engineering'),
  job('wh-7', 'Harbor Logistics (sample)', 'Warehouse Team Lead', 'Columbus, OH', false, 4,
    'Lead a night-shift team of 12. Forklift certification required. Manage inventory counts, shipping and receiving, and safety training. Previous warehouse experience required.',
    { min: 52000, max: 60000, currency: 'USD', interval: '1 YEAR', text: '$25 – $29 per hour' }, 'Operations'),
  job('wh-8', 'Coho Foods (sample)', 'Inventory Associate', 'Dayton, OH', false, 6,
    'Count and track inventory, load trucks, and keep the warehouse organized. Forklift experience preferred. Microsoft Office basics. Customer service attitude.', null, 'Operations'),
  job('cs-9', 'Wide World Software (sample)', 'Customer Success Manager', 'Remote - US', true, 7,
    'Own a book of 40 B2B accounts. Run onboarding, quarterly reviews and renewals. Salesforce and Zendesk experience. Excellent communication and problem solving.', null, 'Customer Success'),
  job('da-10', 'Proseware Analytics (sample)', 'Data Analyst', 'Zurich, Switzerland', false, 10,
    'SQL, Python and Tableau. Build dashboards, run A/B testing analysis, and present findings to stakeholders. German and English required.', null, 'Data'),
];
