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
  logo: string;
  regBody: string;
  regStatement: string;
  // Signing partner
  partnerName: string;
  partnerTitle: string;
  // Email for MTD software invites
  mtdEmail: string;
  // NEST pension delegation
  nestOrgName: string;
  nestDelegateId: string;
  // brand
  gradient: string;
  accentColor: string;
  description: string;
}

export const FIRMS: Record<string, FirmConfig> = {
  gns: {
    slug: 'gns',
    name: 'GNS Associates',
    legalName: 'GNS Associates Limited',
    companyNumber: '08086819',
    address: 'Boundary House, Cricket Field Road',
    city: 'Uxbridge',
    postcode: 'UB8 1QG',
    phone: '+44 1895 123456',
    email: 'info@gnsassociates.co.uk',
    website: 'www.gnsassociates.co.uk',
    logo: '/logos/gns.png',
    regBody: 'ACCA',
    regStatement: 'GNS Associates Limited is registered in England & Wales (No. 08086819). We are bound by the ethical guidelines of the Association of Chartered Certified Accountants (ACCA). A copy of these guidelines can be found at www.accaglobal.com.',
    partnerName: 'Lekh N Ghimire',
    partnerTitle: 'For and on behalf of GNS Associates Limited',
    mtdEmail: 'info@gnsassociates.co.uk',
    nestOrgName: 'GNS Associates Ltd',
    nestDelegateId: 'TPA008702283',
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
    partnerName: 'Subash Ghimire',
    partnerTitle: 'Partner',
    mtdEmail: 'sg@gnsassociates.co.uk',
    nestOrgName: 'GNS Associates Ltd',
    nestDelegateId: 'TPA008702283',
    gradient: 'from-indigo-700 to-blue-900',
    accentColor: '#1e3a8a',
    description: 'Partnership-focused accounting, tax planning, and business advisory services for businesses across the UK.',
  },
  galaxy: {
    slug: 'galaxy',
    name: 'Galaxy Accountants',
    legalName: 'Galaxy Accountants Limited',
    companyNumber: '',
    address: 'Boundary House, Cricket Field Road',
    city: 'Uxbridge',
    postcode: 'UB8 1QG',
    phone: '+44 1895 123456',
    email: 'info@galaxyaccountants.co.uk',
    website: 'www.galaxyaccountants.co.uk',
    logo: '/logos/galaxy.png',
    regBody: 'ICAEW',
    regStatement: 'Galaxy Accountants Limited is registered in England & Wales. Regulated by the Institute of Chartered Accountants in England and Wales.',
    partnerName: 'Galaxy Director',
    partnerTitle: 'Director',
    mtdEmail: 'info@galaxyaccountants.co.uk',
    nestOrgName: 'Galaxy Accountants Ltd',
    nestDelegateId: '',
    gradient: 'from-violet-600 to-purple-900',
    accentColor: '#7c3aed',
    description: 'Specialist accounting services for technology companies, startups, and growth-stage businesses.',
  },
};

export function getFirm(slug: string): FirmConfig {
  return (FIRMS[slug] ?? FIRMS['gns']) as FirmConfig;
}
