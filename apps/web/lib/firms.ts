export interface FirmConfig {
  slug: string;
  name: string;
  legalName: string;
  companyNumber: string;
  address: string;
  city: string;
  postcode: string;
  phone: string;
  footerTel: string;
  footerMobile: string;
  footerFax: string;
  email: string;
  website: string;
  logo: string;
  signatureImg: string;
  regBody: string;
  regBodies: string[];
  regStatement: string;
  partnerName: string;
  partnerName2?: string;
  partnerTitle: string;
  partnerDesignation?: string;
  partnerDesignation2?: string;
  mtdEmail: string;
  nestOrgName: string;
  nestDelegateId: string;
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
    phone: '+44 1895 239250',
    footerTel: '0208 090 2604',
    footerMobile: '0778 744 9594',
    footerFax: '0208 711 5184',
    email: 'info@gnsassociates.co.uk',
    website: 'www.gnsassociates.co.uk',
    logo: '/logos/gns.png',
    signatureImg: '/logos/gns-signature.png',
    regBody: 'ICAEW',
    regBodies: ['ICAEW', 'ACCA', 'CIOT'],
    regStatement: 'GNS Associates Limited, Chartered Accountants (ICAEW, ACCA, CIOT). Registered in England and Wales, Company Registration No: 08086819.',
    partnerName: 'Lekh Nath Ghimire',
    partnerDesignation: 'ACCA, MBA, ICAEW (ACA), CIOT',
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
    phone: '+44 1895 239250',
    footerTel: '0208 090 2604',
    footerMobile: '0778 744 9594',
    footerFax: '0208 711 5184',
    email: 'info@gnsassociates.co.uk',
    website: 'www.gnsassociates.co.uk',
    logo: '/logos/gns.png',
    signatureImg: '/logos/gns-signature.png',
    regBody: 'ACCA',
    regBodies: ['ACCA'],
    regStatement: 'GNS Associates UK LLP, Chartered Certified Accountants (ACCA). A Limited Liability Partnership registered in England and Wales, Registration No: OC428532.',
    partnerName: 'Subash Ghimire',
    partnerDesignation: 'ACCA, MBA',
    partnerName2: 'Mahesh Giri',
    partnerDesignation2: 'ACCA, MA',
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
    name: 'Galaxy GNS Accountants',
    legalName: 'GALAXY GNS ACCOUNTANTS LTD',
    companyNumber: '07965573',
    address: '1-3 Uxbridge Road',
    city: 'Hayes',
    postcode: 'UB4 0JN',
    phone: '+44 1895 239250',
    footerTel: '0208 090 2604',
    footerMobile: '0778 744 9594',
    footerFax: '0208 711 5184',
    email: 'info@gnsassociates.co.uk',
    website: 'www.gnsassociates.co.uk',
    logo: '/logos/gns.png',
    signatureImg: '/logos/gns-signature.png',
    regBody: 'ICAEW',
    regBodies: ['ICAEW', 'ACCA', 'CIOT'],
    regStatement: 'GALAXY GNS ACCOUNTANTS LTD, Chartered Accountants (ICAEW, ACCA, CIOT). Registered in England and Wales, Company Registration No: 07965573.',
    partnerName: 'Mahesh Giri',
    partnerDesignation: 'ACCA, MA',
    partnerTitle: 'Director',
    mtdEmail: 'info@gnsassociates.co.uk',
    nestOrgName: 'Galaxy GNS Accountants Ltd',
    nestDelegateId: '',
    gradient: 'from-violet-600 to-purple-900',
    accentColor: '#7c3aed',
    description: 'Chartered Accountants providing accounting, tax, and compliance services for businesses across the UK.',
  },
};

export function getFirm(slug: string): FirmConfig {
  return (FIRMS[slug] ?? FIRMS['gns']) as FirmConfig;
}

// entityId in DB is a UUID — map by checking the company number stored against entities table.
// As a fallback, returns GNS (first firm). Used when we only have an entityId, not a slug.
export function getFirmByEntityId(_entityId: string): FirmConfig {
  return FIRMS['gns'] as FirmConfig;
}
