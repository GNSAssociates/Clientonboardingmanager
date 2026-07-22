/**
 * Documents the CLIENT (director) uploads through the secure portal.
 *
 * These are the director's own identity documents required for anti-money-
 * laundering (KYC) checks — the only things the client uploads. Company and
 * accounting records (accounts, UTRs, VAT certificates, payroll, bank
 * statements, etc.) are NOT collected here: they are requested directly from
 * the previous accountant by email as part of professional clearance.
 */

export interface DocType {
  id: string;
  label: string;
  description: string;
  hint: string;
  required: boolean;
  category: 'identity';
  acceptedFormats: string[];
  maxSizeMb: number;
}

export const DOCUMENT_TYPES: DocType[] = [
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
};
