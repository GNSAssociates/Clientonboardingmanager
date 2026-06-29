/**
 * Required document types for GNS Associates client onboarding.
 * Based on the GNS engagement letter and professional clearance requirements.
 */

export interface DocType {
  id: string;
  label: string;
  description: string;
  hint: string;
  required: boolean;           // always required
  category: 'identity' | 'company' | 'tax' | 'financial' | 'access';
  acceptedFormats: string[];
  maxSizeMb: number;
}

export const DOCUMENT_TYPES: DocType[] = [
  // Identity
  {
    id: 'passport_photo_page',
    label: 'Passport — Photo Page',
    description: 'The page showing your photograph and personal details',
    hint: 'Must be valid (not expired). Photograph and all details must be clearly visible.',
    required: true,
    category: 'identity',
    acceptedFormats: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maxSizeMb: 10,
  },
  {
    id: 'passport_back_or_licence',
    label: 'Passport (Back) or Driving Licence',
    description: 'Back page of passport OR both sides of UK driving licence',
    hint: 'If using driving licence: upload as a single image showing both front and back.',
    required: true,
    category: 'identity',
    acceptedFormats: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maxSizeMb: 10,
  },
  {
    id: 'proof_of_address',
    label: 'Proof of Address',
    description: 'Utility bill, bank statement, or council tax letter — less than 3 months old',
    hint: 'Must show your full name and current address. Mobile phone bills are not accepted.',
    required: true,
    category: 'identity',
    acceptedFormats: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maxSizeMb: 15,
  },
  // Company
  {
    id: 'certificate_of_incorporation',
    label: 'Certificate of Incorporation',
    description: 'Official certificate issued by Companies House when your company was formed',
    hint: 'This is the original certificate showing your company name and registration number.',
    required: true,
    category: 'company',
    acceptedFormats: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maxSizeMb: 10,
  },
  {
    id: 'confirmation_statement',
    label: 'Latest Confirmation Statement',
    description: 'Most recent Confirmation Statement (CS01) filed with Companies House',
    hint: 'You can download this from your Companies House WebFiling account or the CH website.',
    required: true,
    category: 'company',
    acceptedFormats: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maxSizeMb: 10,
  },
  // Tax references
  {
    id: 'company_utr_letter',
    label: 'Company UTR Letter (HMRC)',
    description: 'HMRC letter showing your company\'s Unique Taxpayer Reference number',
    hint: 'Received when you registered the company with HMRC for Corporation Tax.',
    required: true,
    category: 'tax',
    acceptedFormats: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maxSizeMb: 10,
  },
  {
    id: 'director_utr_letter',
    label: 'Director\'s UTR Letter (HMRC)',
    description: 'Your personal Unique Taxpayer Reference from HMRC for Self Assessment',
    hint: 'This is your personal UTR, different from the company UTR.',
    required: true,
    category: 'tax',
    acceptedFormats: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maxSizeMb: 10,
  },
  {
    id: 'vat_certificate',
    label: 'VAT Registration Certificate',
    description: 'VAT Certificate issued by HMRC confirming your VAT registration number',
    hint: 'Only required if your company is VAT registered. If not, leave this blank.',
    required: false,
    category: 'tax',
    acceptedFormats: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maxSizeMb: 10,
  },
  // Financial
  {
    id: 'previous_accounts',
    label: 'Previous Year Accounts',
    description: 'Last 2 years statutory accounts (if available)',
    hint: 'If this is a new company or you don\'t have previous accounts, leave blank.',
    required: false,
    category: 'financial',
    acceptedFormats: ['application/pdf', 'image/jpeg', 'image/png'],
    maxSizeMb: 20,
  },
  {
    id: 'bank_statement',
    label: 'Business Bank Statement',
    description: 'Most recent 3 months of business bank statements',
    hint: 'All pages must be included. Personal bank statements are not accepted.',
    required: true,
    category: 'financial',
    acceptedFormats: ['application/pdf', 'image/jpeg', 'image/png'],
    maxSizeMb: 20,
  },
  {
    id: 'payroll_records',
    label: 'Payroll Records',
    description: 'Last 3 months payroll if you have employees',
    hint: 'Only required if your company has employees on PAYE. Otherwise leave blank.',
    required: false,
    category: 'financial',
    acceptedFormats: ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    maxSizeMb: 20,
  },
];

export const REQUIRED_DOC_IDS = DOCUMENT_TYPES.filter((d) => d.required).map((d) => d.id);

export function getDocType(id: string): DocType | undefined {
  return DOCUMENT_TYPES.find((d) => d.id === id);
}

export function getMissingRequiredDocs(uploadedIds: string[]): DocType[] {
  return DOCUMENT_TYPES.filter((d) => d.required && !uploadedIds.includes(d.id));
}

export const CATEGORY_LABELS: Record<DocType['category'], string> = {
  identity: 'Identity Verification',
  company: 'Company Documents',
  tax: 'Tax References',
  financial: 'Financial Records',
  access: 'System Access',
};
