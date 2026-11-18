/**
 * The sample archive of the public demo: one fictional freelancer, their studio and their home.
 * `build.mjs` renders each entry to a real file. The server then reads `index.json`.
 */
import {
  AUTO,
  BANK,
  CLIENTS,
  CLINIC,
  FIBER,
  GARAGE,
  HEALTH_PLAN,
  LANDLORD,
  OWNER,
  POWER,
  PREPARER,
  RENTERS,
  STATE_OFFICE,
  STUDIO,
} from './people.mjs';
import { AGREEMENTS } from './agreements.mjs';
import { statement } from './ledger.mjs';

const CURRENT = 1;
const SUPERSEDED = 2;
const SIGNED = 3;
const AREA = { studio: 10, personal: 11, home: 12 };
const TOPIC = {
  company: 20,
  clients: 21,
  banking: 22,
  expenses: 23,
  businessTax: 24,
  taxes: 30,
  health: 31,
  insurance: 32,
  vehicle: 33,
  identity: 34,
  lease: 40,
  utilities: 41,
  appliances: 42,
};

/** [id, name, color, parent] */
const TAG_ROWS = [
  [CURRENT, 'Current', '#2e7d32', null],
  [SUPERSEDED, 'Superseded', '#8d8d8d', null],
  [SIGNED, 'Signed', '#3e63dd', null],
  [AREA.studio, 'Fernhill Studio', '#8e4ec6', null],
  [AREA.personal, 'Personal', '#0090ff', null],
  [AREA.home, 'Home', '#f76b15', null],
  [TOPIC.company, 'Company', '#6e56cf', AREA.studio],
  [TOPIC.clients, 'Clients', '#12a594', AREA.studio],
  [TOPIC.banking, 'Business banking', '#0d74ce', AREA.studio],
  [TOPIC.expenses, 'Expenses', '#ffb224', AREA.studio],
  [TOPIC.businessTax, 'Business tax', '#e5484d', AREA.studio],
  [TOPIC.taxes, 'Taxes', '#dc3e42', AREA.personal],
  [TOPIC.health, 'Health', '#e93d82', AREA.personal],
  [TOPIC.insurance, 'Insurance', '#3e63dd', AREA.personal],
  [TOPIC.vehicle, 'Vehicle', '#978365', AREA.personal],
  [TOPIC.identity, 'Identity', '#7c66dc', AREA.personal],
  [TOPIC.lease, 'Lease', '#f76b15', AREA.home],
  [TOPIC.utilities, 'Utilities', '#ffc53d', AREA.home],
  [TOPIC.appliances, 'Appliances', '#46a758', AREA.home],
];

export const TAGS = TAG_ROWS.map(([id, name, color, parent]) => ({
  id,
  name,
  slug: name.toLowerCase().replace(/\s+/g, '-'),
  color,
  parent,
  children: TAG_ROWS.filter((row) => row[3] === id).map((row) => row[0]),
}));

export const SUCCESSOR_FIELD = { id: 1, name: 'Superseded by', data_type: 'documentlink' };

const areaOf = (topic) => TAG_ROWS.find((row) => row[0] === topic)[3];

/** One record. `status` is CURRENT unless set; `signed` adds the Signed marker. */
function rec(id, title, created, topic, kind, data, options = {}) {
  const status = options.status ?? CURRENT;
  const tags = [status, areaOf(topic), topic, ...(options.signed ? [SIGNED] : [])];
  return { id, title, created, tags: tags.filter(Boolean), kind, data, ...options.extra };
}

const studio = [
  rec(101, 'Articles of organization', '2024-02-12', TOPIC.company, 'form', {
    issuer: STATE_OFFICE,
    heading: 'Articles of Organization — Limited Liability Company',
    fields: [
      ['Entity name', STUDIO.name],
      ['Registry number', '2024-118430'],
      ['Principal office', STUDIO.lines.join(', ')],
      ['Registered agent', `${OWNER.name}, ${OWNER.lines.join(', ')}`],
      ['Management', 'Member-managed'],
      ['Duration', 'Perpetual'],
      ['Purpose', 'Graphic design, branding and illustration services'],
      ['Organizer', OWNER.name],
      ['Filed', 'February 12, 2024'],
      ['Filing fee', '$100.00 (paid)'],
    ],
    note: 'This filing is accepted and recorded. Keep this copy with the company records.',
  }),
  rec(102, 'EIN assignment notice', '2024-02-20', TOPIC.company, 'letter', {
    from: STUDIO,
    to: [STUDIO.name, ...STUDIO.lines],
    date: 'February 20, 2024',
    subject: `Employer identification number: ${STUDIO.ein}`,
    paragraphs: [
      `This notice records the employer identification number assigned to ${STUDIO.name}. Use this number on federal tax forms, bank applications and contractor forms.`,
      'The company files as a single-member LLC. The owner reports the business income on the personal return, on the schedule for self-employment income.',
      'Keep this notice with the articles of organization. Banks and clients may ask for a copy.',
    ],
    sign: OWNER.name,
  }),
  rec(103, 'Operating agreement', '2024-03-04', TOPIC.company, 'agreement', AGREEMENTS.operating, {
    signed: true,
    extra: { versions: [{ id: 1031, label: 'Signed copy', data: { signedBy: OWNER.name } }] },
  }),
  rec(104, 'Annual report 2025', '2025-02-03', TOPIC.company, 'form', {
    issuer: STATE_OFFICE,
    heading: 'Annual Report — Limited Liability Company',
    fields: [
      ['Entity name', STUDIO.name],
      ['Registry number', '2024-118430'],
      ['Report year', '2025'],
      ['Status', 'Active'],
      ['Principal office', STUDIO.lines.join(', ')],
      ['Member', OWNER.name],
      ['Fee', '$100.00 (paid)'],
    ],
    note: 'The next annual report is due on the anniversary of the filing date.',
  }),
  rec(105, 'Annual report 2026', '2026-02-09', TOPIC.company, 'form', {
    issuer: STATE_OFFICE,
    heading: 'Annual Report — Limited Liability Company',
    fields: [
      ['Entity name', STUDIO.name],
      ['Registry number', '2024-118430'],
      ['Report year', '2026'],
      ['Status', 'Active'],
      ['Principal office', STUDIO.lines.join(', ')],
      ['Member', OWNER.name],
      ['Fee', '$100.00 (paid)'],
    ],
    note: 'The next annual report is due on the anniversary of the filing date.',
  }),
  rec(106, 'General liability certificate', '2026-01-15', TOPIC.company, 'form', {
    issuer: RENTERS,
    heading: 'Certificate of Liability Insurance',
    fields: [
      ['Insured', STUDIO.name],
      ['Policy number', 'HS-GL-55-20817'],
      ['Coverage', 'Commercial general liability'],
      ['Each occurrence', '$1,000,000'],
      ['General aggregate', '$2,000,000'],
      ['Policy period', 'Jan 15, 2026 – Jan 15, 2027'],
      ['Certificate holder', CLIENTS.larkspur.name],
    ],
    note: 'This certificate is for information only. It does not change the policy terms.',
  }),
  rec(
    111,
    'Services agreement — Larkspur Coffee',
    '2026-01-20',
    TOPIC.clients,
    'agreement',
    AGREEMENTS.larkspur,
    { signed: true },
  ),
  rec(
    112,
    'Statement of work — Orchard Street Books',
    '2026-05-06',
    TOPIC.clients,
    'agreement',
    AGREEMENTS.orchard,
    { signed: true },
  ),
  rec(113, 'Kickoff notes — Orchard Street Books', '2026-05-08', TOPIC.clients, 'note', {
    text: [
      'Kickoff — Orchard Street Books',
      'May 8, 2026, at the shop',
      '',
      'People: Dana (owner), Marcus (events), Riley',
      '',
      '- They want the new look before the summer reading program (June 20).',
      '- Keep the green. The old fox drawing goes.',
      '- Deliverables: logo, shelf talkers, event poster template, gift card.',
      '- Dana sends photos of the shop front by Friday.',
      '- First round of logo sketches: May 22.',
      '',
      'Next: send the moodboard on Monday.',
    ].join('\n'),
  }),
  rec(114, 'Invoice FS-2026-014 — Larkspur Coffee', '2026-06-30', TOPIC.clients, 'invoice', {
    number: 'FS-2026-014',
    client: CLIENTS.larkspur,
    date: 'June 30, 2026',
    due: 'July 30, 2026',
    items: [
      ['Seasonal menu boards (3 designs)', 3, 420],
      ['Cup sleeve illustration', 1, 650],
      ['Revisions (hours)', 4, 85],
    ],
  }),
  rec(115, 'Invoice FS-2026-015 — Orchard Street Books', '2026-07-15', TOPIC.clients, 'invoice', {
    number: 'FS-2026-015',
    client: CLIENTS.orchard,
    date: 'July 15, 2026',
    due: 'August 14, 2026',
    items: [
      ['Logo and identity — phase 1 (50%)', 1, 2400],
      ['Shelf talker templates', 6, 75],
    ],
  }),
  rec(116, 'Invoice FS-2026-018 — Tidewater Yoga', '2026-08-29', TOPIC.clients, 'invoice', {
    number: 'FS-2026-018',
    client: CLIENTS.tidewater,
    date: 'August 29, 2026',
    due: 'September 28, 2026',
    items: [
      ['Class schedule poster', 1, 380],
      ['Social media templates', 8, 60],
      ['Photo retouching (hours)', 3, 85],
    ],
  }),
  rec(117, 'Invoice FS-2026-021 — Orchard Street Books', '2026-09-30', TOPIC.clients, 'invoice', {
    number: 'FS-2026-021',
    client: CLIENTS.orchard,
    date: 'September 30, 2026',
    due: 'October 30, 2026',
    items: [
      ['Logo and identity — phase 2 (50%)', 1, 2400],
      ['Event poster template', 1, 450],
      ['Gift card design', 1, 300],
    ],
  }),
  rec(118, 'Invoice FS-2026-024 — Larkspur Coffee', '2026-10-31', TOPIC.clients, 'invoice', {
    number: 'FS-2026-024',
    client: CLIENTS.larkspur,
    date: 'October 31, 2026',
    due: 'November 30, 2026',
    items: [
      ['Holiday packaging labels', 4, 310],
      ['Gift box illustration', 1, 720],
    ],
  }),
  ...['2026-06', '2026-07', '2026-08', '2026-09', '2026-10'].map((month, i) =>
    rec(
      121 + i,
      `Business checking statement — ${statement(month).label}`,
      statement(month).closed,
      TOPIC.banking,
      'statement',
      statement(month),
    ),
  ),
  rec(131, 'Receipt — studio monitor', '2026-03-14', TOPIC.expenses, 'receipt', {
    store: 'Brightline Electronics',
    lines: ['880 Market Street', 'Maple Falls, OR 97000'],
    date: '03/14/2026 14:22',
    items: [
      ['27" 4K monitor', 429.99],
      ['Monitor arm', 89.0],
      ['USB-C cable 2 m', 19.99],
    ],
    taxRate: 0,
    payment: 'VISA ****4417',
  }),
  rec(132, 'Coworking membership — October', '2026-10-01', TOPIC.expenses, 'invoice', {
    issuer: {
      name: 'The Loft Coworking',
      lines: ['21 Mill Street, 2nd floor', 'Maple Falls, OR 97000'],
    },
    client: STUDIO,
    number: 'LOFT-10-2026-0388',
    date: 'October 1, 2026',
    due: 'Paid by card on file',
    items: [
      ['Flex desk membership — October', 1, 185],
      ['Meeting room (hours)', 2, 15],
    ],
  }),
  rec(133, 'Design software — annual plan', '2026-04-02', TOPIC.expenses, 'invoice', {
    issuer: {
      name: 'Inkwell Cloud Tools',
      lines: ['500 Example Avenue', 'San Mateo Bay, CA 94000'],
    },
    client: STUDIO,
    number: 'VCT-778120',
    date: 'April 2, 2026',
    due: 'Paid by card on file',
    items: [
      ['Creative suite — annual, 1 seat', 1, 659.88],
      ['Font library add-on', 1, 96],
    ],
  }),
  rec(134, 'Receipt — printing proofs', '2026-09-12', TOPIC.expenses, 'receipt', {
    store: 'Mill Street Print Shop',
    lines: ['19 Mill Street', 'Maple Falls, OR 97000'],
    date: '09/12/2026 10:05',
    items: [
      ['Poster proof 18x24', 24.0],
      ['Card stock samples', 12.5],
      ['Gift card proofs (10)', 18.0],
    ],
    taxRate: 0,
    payment: 'Debit ****0921',
  }),
  rec(141, 'Form 1099-NEC — Larkspur Coffee (2025)', '2026-01-28', TOPIC.businessTax, 'form', {
    issuer: CLIENTS.larkspur,
    heading: 'Nonemployee compensation — 2025 (recipient copy)',
    fields: [
      ['Payer', CLIENTS.larkspur.name],
      ['Recipient', STUDIO.name],
      ['Recipient TIN', 'XX-XXX0417'],
      ['Nonemployee compensation', '$8,640.00'],
      ['Federal income tax withheld', '$0.00'],
      ['Tax year', '2025'],
    ],
    note: 'Report this income on your tax return. The payer also files this information.',
  }),
  rec(142, 'Estimated tax payment — Q3 2026', '2026-09-15', TOPIC.businessTax, 'form', {
    issuer: PREPARER,
    heading: 'Estimated tax payment confirmation',
    fields: [
      ['Taxpayer', OWNER.name],
      ['Period', 'Third quarter 2026'],
      ['Federal payment', '$2,150.00'],
      ['State payment', '$640.00'],
      ['Paid on', 'September 15, 2026'],
      ['Confirmation', 'GL-Q3-26-58172'],
    ],
    note: 'The next payment is due January 15, 2027.',
  }),
  rec(143, 'Quarterly profit and loss — Q3 2026', '2026-10-06', TOPIC.businessTax, 'form', {
    issuer: STUDIO,
    heading: 'Profit and loss — July to September 2026',
    fields: [
      ['Client income', '$14,860.00'],
      ['Software and subscriptions', '−$271.16'],
      ['Coworking', '−$615.00'],
      ['Printing and supplies', '−$212.40'],
      ['Equipment', '−$0.00'],
      ['Insurance', '−$94.00'],
      ['Net profit', '$13,667.44'],
    ],
    note: 'Prepared from the business checking account. Not audited.',
  }),
];

const personal = [
  rec(201, '2025 tax return summary', '2026-04-08', TOPIC.taxes, 'form', AGREEMENTS.taxSummary, {
    signed: true,
  }),
  rec(202, 'Student loan interest statement (2025)', '2026-01-24', TOPIC.taxes, 'form', {
    issuer: { name: 'Summit Student Loans', lines: ['PO Box 7400', 'Lakeport, NV 89000'] },
    heading: 'Student loan interest statement — 2025',
    fields: [
      ['Borrower', OWNER.name],
      ['Account', '••••5530'],
      ['Interest received in 2025', '$612.48'],
      ['Principal balance at year end', '$9,884.10'],
    ],
    note: 'You may be able to deduct this interest. Ask your tax preparer.',
  }),
  rec(211, 'Annual physical — visit summary', '2026-03-03', TOPIC.health, 'letter', {
    from: CLINIC,
    to: [OWNER.name, ...OWNER.lines],
    date: 'March 3, 2026',
    subject: 'After-visit summary',
    paragraphs: [
      'Thank you for your visit today with Dr. Amara Osei for your yearly physical.',
      'Vitals: blood pressure 118/76, pulse 64, weight 152 lb. Your exam was normal.',
      'We ordered routine blood tests. Results will be in your patient portal in 3 to 5 days.',
      'Next steps: a tetanus booster is due next year. Come back for your next physical in 12 months.',
    ],
    sign: 'Maple Falls Family Clinic',
  }),
  rec(212, 'Lab results — lipid panel', '2026-03-07', TOPIC.health, 'form', {
    issuer: CLINIC,
    heading: 'Laboratory report',
    fields: [
      ['Patient', OWNER.name],
      ['Collected', 'March 4, 2026'],
      ['Total cholesterol', '182 mg/dL (under 200)'],
      ['HDL', '61 mg/dL (40 or more)'],
      ['LDL', '104 mg/dL (under 130)'],
      ['Triglycerides', '86 mg/dL (under 150)'],
      ['Glucose, fasting', '88 mg/dL (70–99)'],
    ],
    note: 'All results are in the reference range.',
  }),
  rec(213, 'Dental cleaning — explanation of benefits', '2026-05-19', TOPIC.health, 'form', {
    issuer: HEALTH_PLAN,
    heading: 'Explanation of benefits — this is not a bill',
    fields: [
      ['Member', OWNER.name],
      ['Provider', 'Birch Avenue Dental'],
      ['Service date', 'May 2, 2026'],
      ['Billed', '$245.00'],
      ['Plan discount', '−$61.00'],
      ['Plan paid', '−$184.00'],
      ['You owe', '$0.00'],
    ],
    note: 'Preventive dental care is covered at 100% in network.',
  }),
  rec(214, 'Eyeglass prescription', '2026-08-11', TOPIC.health, 'form', {
    issuer: { name: 'Clearview Optometry', lines: ['8 Birch Avenue', 'Maple Falls, OR 97000'] },
    heading: 'Spectacle prescription',
    fields: [
      ['Patient', OWNER.name],
      ['Right eye (OD)', 'SPH −1.75  CYL −0.50  AXIS 180'],
      ['Left eye (OS)', 'SPH −1.50  CYL −0.25  AXIS 170'],
      ['Pupil distance', '62 mm'],
      ['Valid until', 'August 11, 2028'],
    ],
    note: 'Dr. Lena Park, OD',
  }),
  rec(215, 'Vaccination record', '2025-10-21', TOPIC.health, 'form', {
    issuer: CLINIC,
    heading: 'Immunization record',
    fields: [
      ['Patient', OWNER.name],
      ['Influenza', 'Oct 21, 2025'],
      ['COVID-19 (2025–26)', 'Oct 21, 2025'],
      ['Tdap', 'Jun 4, 2017'],
      ['Hepatitis B series', 'Complete'],
      ['MMR', 'Complete'],
    ],
    note: 'Bring this record to your next visit.',
  }),
  rec(221, 'Health plan — summary of benefits 2026', '2025-12-02', TOPIC.insurance, 'form', {
    issuer: HEALTH_PLAN,
    heading: 'Summary of benefits — Bluebird Silver 2500',
    fields: [
      ['Member', OWNER.name],
      ['Member ID', 'BBM-448-21907'],
      ['Plan year', 'Jan 1 – Dec 31, 2026'],
      ['Deductible', '$2,500'],
      ['Out-of-pocket maximum', '$7,000'],
      ['Primary care visit', '$30 copay'],
      ['Specialist visit', '$60 copay'],
      ['Generic drugs', '$10 copay'],
    ],
    note: 'This summary is not a contract. The policy has the full terms.',
  }),
  rec(
    222,
    "Renter's insurance policy 2025",
    '2025-04-01',
    TOPIC.insurance,
    'form',
    {
      issuer: RENTERS,
      heading: "Renter's insurance — declarations page",
      fields: [
        ['Named insured', OWNER.name],
        ['Policy number', 'HS-R-30-11842'],
        ['Policy period', 'Apr 1, 2025 – Apr 1, 2026'],
        ['Personal property', '$25,000'],
        ['Liability', '$100,000'],
        ['Deductible', '$500'],
        ['Premium', '$168.00 a year'],
      ],
      note: 'Location: 418 Alder Street, Apt 3B.',
    },
    { status: SUPERSEDED, extra: { successor: 223 } },
  ),
  rec(223, "Renter's insurance policy 2026", '2026-03-28', TOPIC.insurance, 'form', {
    issuer: RENTERS,
    heading: "Renter's insurance — declarations page",
    fields: [
      ['Named insured', OWNER.name],
      ['Policy number', 'HS-R-30-11842'],
      ['Policy period', 'Apr 1, 2026 – Apr 1, 2027'],
      ['Personal property', '$30,000'],
      ['Liability', '$100,000'],
      ['Deductible', '$500'],
      ['Premium', '$184.00 a year'],
    ],
    note: 'Location: 418 Alder Street, Apt 3B. Personal property limit raised at renewal.',
  }),
  rec(231, 'Auto insurance ID card', '2026-06-01', TOPIC.vehicle, 'card', {
    issuer: AUTO,
    title: 'Proof of insurance',
    fields: [
      ['Insured', OWNER.name],
      ['Policy', 'PC-A-77-30451'],
      ['Vehicle', '2019 Subaru Crosstrek'],
      ['VIN', 'JF2GT0000K0000417'],
      ['Effective', 'Jun 1, 2026 – Dec 1, 2026'],
    ],
  }),
  rec(232, 'Vehicle registration renewal', '2026-07-09', TOPIC.vehicle, 'form', {
    issuer: {
      name: 'Motor Vehicle Services',
      lines: ['1905 Lana Avenue', 'Salem Grove, OR 97002'],
    },
    heading: 'Registration renewal receipt',
    fields: [
      ['Owner', OWNER.name],
      ['Plate', 'FERN 417'],
      ['Vehicle', '2019 Subaru Crosstrek'],
      ['Valid until', 'July 31, 2028'],
      ['Fee', '$186.00 (paid)'],
    ],
    note: 'Put the new sticker on the rear plate.',
  }),
  rec(233, 'Service record — 60,000 mile', '2026-09-22', TOPIC.vehicle, 'invoice', {
    issuer: GARAGE,
    client: OWNER,
    number: 'RO-48821',
    date: 'September 22, 2026',
    due: 'Paid',
    items: [
      ['Oil and filter change', 1, 79.95],
      ['Tire rotation', 1, 29.95],
      ['Engine air filter', 1, 34.5],
      ['Brake inspection', 1, 0],
    ],
    terms: 'Odometer: 60,212 mi. Next service at 66,000 mi.',
  }),
  rec(241, 'Passport renewal receipt', '2025-08-18', TOPIC.identity, 'form', {
    issuer: { name: 'Passport Services', lines: ['Application acceptance receipt'] },
    heading: 'Passport renewal — application received',
    fields: [
      ['Applicant', OWNER.name],
      ['Application locator', 'R-25-0081774'],
      ['Service', 'Routine, by mail'],
      ['Fee', '$130.00 (check 1204)'],
      ['Received', 'August 18, 2025'],
    ],
    note: 'Track the status online with the application locator.',
  }),
];

const home = [
  rec(301, 'Apartment lease 2025–2026', '2025-05-20', TOPIC.lease, 'agreement', AGREEMENTS.lease, {
    signed: true,
    status: SUPERSEDED,
    extra: { successor: 302 },
  }),
  rec(302, 'Lease renewal 2026–2027', '2026-05-18', TOPIC.lease, 'agreement', AGREEMENTS.renewal, {
    signed: true,
  }),
  rec(303, 'Move-in inspection checklist', '2025-06-01', TOPIC.lease, 'form', {
    issuer: LANDLORD,
    heading: 'Move-in condition report — 418 Alder Street, Apt 3B',
    fields: [
      ['Entry and hall', 'Good. Small scuff by the door.'],
      ['Kitchen', 'Good. Oven and dishwasher work.'],
      ['Living room', 'Good. Blinds complete.'],
      ['Bedroom', 'Good. Nail holes on the west wall.'],
      ['Bathroom', 'Good. Grout stain near the tub.'],
      ['Smoke detectors', 'Tested. Both work.'],
      ['Keys given', '2 door keys, 1 mailbox key'],
    ],
    note: `Signed by ${OWNER.name} (tenant) and Jordan Ellis (manager), June 1, 2025.`,
  }),
  ...[
    ['2026-08', 'August 2026', 412, 58.34, 'September 14, 2026'],
    ['2026-09', 'September 2026', 368, 52.91, 'October 15, 2026'],
    ['2026-10', 'October 2026', 455, 63.7, 'November 14, 2026'],
  ].map(([month, label, kwh, total, due], i) =>
    rec(311 + i, `Electric bill — ${label}`, `${month}-24`, TOPIC.utilities, 'bill', {
      issuer: POWER,
      account: '30-11842-02',
      period: label,
      usage: `${kwh} kWh`,
      due,
      charges: [
        ['Basic charge', 11.25],
        [`Energy (${kwh} kWh)`, Number((total - 11.25 - 2.1).toFixed(2))],
        ['Public purpose charge', 2.1],
      ],
    }),
  ),
  rec(314, 'Internet bill — October 2026', '2026-10-05', TOPIC.utilities, 'bill', {
    issuer: FIBER,
    account: 'RF-0071-4471',
    period: 'October 2026',
    usage: 'Fiber 500',
    due: 'October 25, 2026',
    charges: [
      ['Fiber 500 Mbps', 55],
      ['Router rental', 0],
      ['Paperless billing credit', -5],
    ],
  }),
  rec(315, 'Wi-Fi and router notes', '2025-06-03', TOPIC.utilities, 'note', {
    text: [
      'Home network',
      '',
      'Router: in the hall closet, top shelf.',
      'Network name: alder-3b (the password is in the password manager, not here).',
      'Admin page: http://192.168.1.1',
      'Support: Riverline Fiber, (555) 010-7700, account RF-0071-4471.',
      '',
      'If the internet stops:',
      '1. Unplug the router for 30 seconds.',
      '2. Check the green light on the fiber box in the closet.',
      '3. Call support if the light is red.',
    ].join('\n'),
  }),
  rec(321, 'Dishwasher warranty registration', '2025-11-29', TOPIC.appliances, 'form', {
    issuer: { name: 'Kestrel Home Appliances', lines: ['Customer care', '(555) 010-9090'] },
    heading: 'Product registration confirmation',
    fields: [
      ['Owner', OWNER.name],
      ['Model', 'KDW-450 Quiet Series'],
      ['Serial number', 'KH25-118-90441'],
      ['Purchased', 'November 28, 2025'],
      ['Warranty', '2 years parts and labor'],
      ['Ends', 'November 28, 2027'],
    ],
    note: 'Keep the purchase receipt with this registration.',
  }),
  rec(322, 'Receipt — dishwasher', '2025-11-28', TOPIC.appliances, 'receipt', {
    store: 'Harbor Home Supply',
    lines: ['3400 Harbor Road', 'Port Wren, OR 97001'],
    date: '11/28/2025 16:48',
    items: [
      ['Dishwasher KDW-450', 649.0],
      ['Delivery and install', 99.0],
      ['Haul-away of old unit', 25.0],
    ],
    taxRate: 0,
    payment: 'VISA ****4417',
  }),
];

export const ENTRIES = [...studio, ...personal, ...home];
export { OWNER, BANK };
