/** The longer sample documents: agreements, a lease and a tax summary. All text is invented. */
import { CLIENTS, LANDLORD, OWNER, PREPARER, STUDIO } from './people.mjs';

const operating = {
  issuer: STUDIO,
  heading: 'Operating Agreement of Fernhill Studio LLC',
  intro: `This Operating Agreement is made on March 4, 2024, by ${OWNER.name}, the sole member of ${STUDIO.name}, a limited liability company.`,
  sections: [
    [
      'Formation',
      [
        'The company was formed by filing articles of organization on February 12, 2024. The member agrees to the terms of this agreement for the operation of the company.',
        'The name of the company is Fernhill Studio LLC. The company may do business under that name and under any other name that the member selects.',
      ],
    ],
    [
      'Purpose',
      [
        'The company provides graphic design, branding and illustration services, and may do any other lawful business that the member selects.',
      ],
    ],
    [
      'Member and capital',
      [
        `${OWNER.name} is the only member and holds 100% of the membership interest.`,
        'The member made an initial capital contribution of $2,500.00 in cash and equipment. The member does not have to make more contributions.',
        'The company keeps a capital account for the member. Contributions increase the account. Distributions and losses decrease it.',
      ],
    ],
    [
      'Management',
      [
        'The member manages the company. The member may sign contracts, open bank accounts, hire contractors and take any other action for the company.',
        'The company keeps its money in accounts in the name of the company. The member does not mix company money with personal money.',
      ],
    ],
    [
      'Distributions',
      [
        'The member decides when the company makes distributions and how much. The company makes no distribution that leaves it unable to pay its debts.',
      ],
    ],
    [
      'Taxes and records',
      [
        'For federal income tax, the company is a disregarded entity. The member reports the income and the expenses of the company on the personal return.',
        'The company keeps complete books and records at its principal office. The fiscal year is the calendar year.',
      ],
    ],
    [
      'Liability and indemnification',
      [
        'The member is not personally liable for the debts or the obligations of the company only because the member is a member.',
        'The company indemnifies the member for any loss that the member suffers while acting in good faith for the company.',
      ],
    ],
    [
      'Dissolution',
      [
        'The company dissolves when the member decides in writing, or when the law requires it. After dissolution the company pays its debts and then distributes the remaining assets to the member.',
      ],
    ],
    [
      'General',
      [
        'This agreement is the complete agreement of the member about the company. The member may change it in writing at any time.',
        'If a court finds a part of this agreement invalid, the other parts stay in effect.',
      ],
    ],
  ],
  signatures: [[OWNER.name, 'Sole member']],
};

const larkspur = {
  issuer: STUDIO,
  heading: 'Design Services Agreement',
  intro: `This agreement starts on January 20, 2026, between ${STUDIO.name} ("Studio") and ${CLIENTS.larkspur.name} ("Client").`,
  sections: [
    [
      'Services',
      [
        'Studio provides design work that Client requests in writing: menu boards, packaging labels, cup sleeves, signs and social media graphics.',
        'For each request, Studio sends an estimate. Work starts when Client approves the estimate by email.',
      ],
    ],
    [
      'Fees and payment',
      [
        'Studio charges the fees in each approved estimate. Extra revisions cost $85.00 an hour.',
        'Studio sends an invoice at the end of each month. Client pays each invoice within 30 days.',
      ],
    ],
    [
      'Ownership',
      [
        'When Client pays in full, Client owns the final designs. Studio keeps the right to show the work in its portfolio.',
        'Sketches and files that Client did not select stay the property of Studio.',
      ],
    ],
    [
      'Term and ending',
      [
        'This agreement continues until one party ends it with 30 days written notice. Client pays for all work done before the end date.',
      ],
    ],
    [
      'Liability',
      [
        'The liability of Studio under this agreement is never more than the fees that Client paid in the 12 months before the claim.',
      ],
    ],
  ],
  signatures: [
    [OWNER.name, `Member, ${STUDIO.name}`],
    ['Priya Natarajan', `Owner, ${CLIENTS.larkspur.name}`],
  ],
};

const orchard = {
  issuer: STUDIO,
  heading: 'Statement of Work — Identity Refresh',
  intro: `This statement of work is made on May 6, 2026, between ${STUDIO.name} and ${CLIENTS.orchard.name}.`,
  sections: [
    [
      'Scope',
      [
        'Studio designs a new logo and visual identity for the bookshop, and these items: six shelf talker templates, an event poster template and a gift card.',
      ],
    ],
    [
      'Timeline',
      [
        'Logo sketches: May 22, 2026. Final logo: June 12, 2026. Templates and gift card: September 25, 2026.',
      ],
    ],
    [
      'Fees',
      [
        'The identity costs $4,800.00. Client pays 50% when the logo is final and 50% when all items are delivered. Templates and the gift card cost extra, as shown in each invoice.',
      ],
    ],
    [
      'Approvals',
      ['Client has two rounds of revisions at each stage. More rounds cost $85.00 an hour.'],
    ],
  ],
  signatures: [
    [OWNER.name, `Member, ${STUDIO.name}`],
    ['Dana Whitfield', `Owner, ${CLIENTS.orchard.name}`],
  ],
};

const leaseSections = (start, end, rent) => [
  [
    'Premises',
    [
      `${LANDLORD.name} ("Landlord") rents to ${OWNER.name} ("Tenant") the apartment at 418 Alder Street, Apt 3B, Maple Falls, OR 97000, with one parking space (number 14) and one storage locker.`,
    ],
  ],
  ['Term', [`The lease starts on ${start} and ends on ${end}.`]],
  [
    'Rent',
    [
      `Rent is ${rent} a month, due on the first day of each month. Rent paid after the fifth day has a late fee of $50.00.`,
      'Tenant pays rent through the online portal or by check to the office.',
    ],
  ],
  [
    'Security deposit',
    [
      'Tenant paid a security deposit of $1,600.00. Landlord returns the deposit, less any amount for damage beyond normal wear, within 31 days after Tenant moves out.',
    ],
  ],
  [
    'Utilities',
    [
      'Landlord pays water, sewer and trash. Tenant pays electricity and internet and puts these accounts in the name of Tenant.',
    ],
  ],
  [
    'Use and care',
    [
      'Tenant uses the apartment only as a home. Tenant keeps it clean and tells Landlord about any damage or leak promptly.',
      'Tenant does not paint or make changes without written consent from Landlord.',
      'Smoking is not allowed in the apartment or on the balcony.',
    ],
  ],
  [
    'Pets',
    ['Tenant may keep one cat. No other pets are allowed without written consent from Landlord.'],
  ],
  [
    'Entry',
    [
      'Landlord may enter the apartment for repairs or inspections after 24 hours of notice, or at any time in an emergency.',
    ],
  ],
  [
    'Ending the lease',
    [
      'At the end of the term the lease changes to month to month, unless either party gives 30 days written notice, or the parties sign a renewal.',
    ],
  ],
  [
    'Notices',
    [
      `Notices to Landlord go to ${LANDLORD.lines.join(', ')}. Notices to Tenant go to the apartment or to ${OWNER.email}.`,
    ],
  ],
];

const lease = {
  issuer: LANDLORD,
  heading: 'Residential Lease Agreement',
  intro: `This lease is made on May 20, 2025, between ${LANDLORD.name} and ${OWNER.name}.`,
  sections: leaseSections('June 1, 2025', 'May 31, 2026', '$1,600.00'),
  signatures: [
    [OWNER.name, 'Tenant'],
    ['Jordan Ellis', `Property manager, ${LANDLORD.name}`],
  ],
};

const renewal = {
  issuer: LANDLORD,
  heading: 'Lease Renewal Agreement',
  intro: `This renewal is made on May 18, 2026, between ${LANDLORD.name} and ${OWNER.name}. It continues the lease of May 20, 2025, with the changes below. All other terms stay the same.`,
  sections: leaseSections('June 1, 2026', 'May 31, 2027', '$1,665.00').filter(([title]) =>
    ['Premises', 'Term', 'Rent', 'Pets', 'Ending the lease'].includes(title),
  ),
  signatures: [
    [OWNER.name, 'Tenant'],
    ['Jordan Ellis', `Property manager, ${LANDLORD.name}`],
  ],
};

const taxSummary = {
  issuer: PREPARER,
  heading: '2025 individual tax return — summary',
  fields: [
    ['Taxpayer', OWNER.name],
    ['Filing status', 'Single'],
    ['Business income (net)', '$54,912.00'],
    ['Self-employment tax', '$7,758.00'],
    ['Student loan interest deduction', '$612.00'],
    ['Taxable income', '$37,904.00'],
    ['Total federal tax', '$12,140.00'],
    ['Estimated payments made', '$11,600.00'],
    ['Balance due', '$540.00'],
    ['State balance due', '$118.00'],
    ['E-filed', 'April 8, 2026 — accepted'],
  ],
  note: `Prepared by ${PREPARER.name}. Keep this summary and the full return for at least seven years.`,
};

export const AGREEMENTS = { operating, larkspur, orchard, lease, renewal, taxSummary };
