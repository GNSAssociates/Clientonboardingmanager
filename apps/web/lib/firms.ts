export interface FirmConfig {
  slug: string;
  name: string;
  legalName: string;
  companyNumber: string;
  address: string;
  city: string;
  postcode: string;
  phone: string;
  email: string;
  website: string;
  logo: string;           // path under /public
  regBody: string;        // regulatory body
  regStatement: string;   // full registration statement
  // brand
  gradient: string;       // Tailwind from-X to-Y
  accentColor: string;    // hex for letterhead stripe
  description: string;
}

export const FIRMS: Record<string, FirmConfig> = {
  gns: {
    slug: 'gns',
    name: 'GNS Associates',
    legalName: 'GNS Associates Limited',
    companyNumber: '08086819',
    address: 'Devonshire Business Centres, Boundary House, Cricket Field Road',
    city: 'Uxbridge, Middlesex',
    postcode: 'UB8 1QG',
    phone: '+44 1895 123456',
    email: 'info@gnsassociates.co.uk',
    website: 'www.gnsassociates.co.uk',
    logo: '/logos/gns.png',
    regBody: 'ICAEW',
    regStatement: 'GNS Associates Limited is registered in England & Wales (No. 08086819). Regulated for a range of investment business activities by the Institute of Chartered Accountants in England and Wales.',
    gradient: 'from-red-700 to-blue-900',
    accentColor: '#cc2229',
    description: 'Chartered Accountants providing comprehensive accounting, tax, and compliance services for businesses across the UK.',
  },
  llp: {
    slug: 'llp',
    name: 'GNS Associates UK LLP',
    legalName: 'GNS Associates UK LLP',
    companyNumber: 'OC428532',
    address: 'Boundary House, Cricket Field Road',
    city: 'Uxbridge',
    postcode: 'UB8 1QG',
    phone: '+44 1895 123456',
    email: 'info@gnsassociates.co.uk',
    website: 'www.gnsassociates.co.uk',
    logo: '/logos/gns.png',
    regBody: 'ICAEW',
    regStatement: 'GNS Associates UK LLP is a Limited Liability Partnership registered in England & Wales (No. OC428532). Regulated for a range of investment business activities by the Institute of Chartered Accountants in England and Wales.',
    gradient: 'from-indigo-700 to-blue-900',
    accentColor: '#1e3a8a',
    description: 'Partnership-focused accounting, tax planning, and business advisory services for businesses across the UK.',
  },
  galaxy: {
    slug: 'galaxy',
    name: 'Galaxy Accountants',
    legalName: 'Galaxy Accountants Limited',
    companyNumber: '',        // fill when known
    address: 'Devonshire Business Centres, Boundary House, Cricket Field Road',
    city: 'Uxbridge, Middlesex',
    postcode: 'UB8 1QG',
    phone: '+44 1895 123456',
    email: 'info@galaxyaccountants.co.uk',
    website: 'www.galaxyaccountants.co.uk',
    logo: '/logos/galaxy.png',
    regBody: 'ICAEW',
    regStatement: 'Galaxy Accountants Limited is registered in England & Wales. Regulated by the Institute of Chartered Accountants in England and Wales.',
    gradient: 'from-violet-600 to-purple-900',
    accentColor: '#7c3aed',
    description: 'Specialist accounting services for technology companies, startups, and growth-stage businesses.',
  },
};

export function getFirm(slug: string): FirmConfig {
  return FIRMS[slug] ?? FIRMS.gns;
}
