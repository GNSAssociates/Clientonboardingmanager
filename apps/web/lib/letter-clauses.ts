/**
 * Three clauses every engagement letter carries, for all three practices:
 *
 *   1. Who will carry out the work: the practices share staff and systems, and
 *      some work is done by the associated company, GNS Associates Private
 *      Limited. The contracting practice stays responsible.
 *   2. How we look after your data: the UK GDPR Article 13 points the older
 *      Data Protection text did not cover (controller and contact, recipients,
 *      the transfer to Nepal and its safeguard, why the data is needed, no
 *      automated decisions, retention, rights, complaints to the ICO).
 *   3. Identity checks: the Money Laundering Regulations 2017 duties.
 *
 * Written plainly and calmly, as routine practice, so clients are informed
 * without being alarmed (agreed with the partners, 26 Nov 2026). Nepal is
 * named once, where the law expects it: in the transfer paragraph.
 *
 * One source for both renderings (letter-html.ts and engagement-pdf.ts), so
 * the online letter and the PDF can never say different things. Pure: tested
 * by scripts/test-letter-clauses.mts.
 */
import type { FirmConfig } from "./firms";

export const ASSOCIATED_COMPANY = "GNS Associates Private Limited";

/** The three UK practices, by legal name, as clients know them. */
const PRACTICES: Record<string, string> = {
  gns: "GNS Associates Limited",
  llp: "GNS Associates UK LLP",
  galaxy: "Galaxy GNS Accountants Ltd",
};

/** Records are kept this long after the engagement ends (HMRC enquiry and limitation periods). */
export const RETENTION_YEARS = 6;

export interface Para {
  /** Optional bold lead-in, e.g. "Who is responsible." */
  lead?: string;
  text: string;
}

export interface Clause {
  heading: string;
  paras: Para[];
}

/** "A and B" / "A, B and C". */
function andList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function contracting(firm: FirmConfig): string {
  return PRACTICES[firm.slug] ?? firm.legalName;
}

/** Clause 1: printed after "Period of engagement". */
export function whoDoesTheWork(firm: FirmConfig): Clause {
  const us = contracting(firm);
  const others = Object.entries(PRACTICES).filter(([slug]) => slug !== firm.slug).map(([, n]) => n);
  return {
    heading: "Who will carry out the work",
    paras: [
      {
        text: `This engagement is with ${us}. We work closely with our associated practices, ${andList(others)}, and share staff, offices and systems with them, so their staff may work on your affairs and access your information for that purpose. Whoever carries out the work, ${us} remains responsible to you for it.`,
      },
      {
        text: `Some of the work, such as bookkeeping and the preparation of accounts and returns, may be carried out by our associated company, ${ASSOCIATED_COMPANY}. Its team works on our instructions and under our supervision and review, to the same standards of confidentiality and care as our own staff.`,
      },
    ],
  };
}

/** Clause 2: printed inside "Data Protection", after the privacy-notice paragraph. */
export function howWeLookAfterYourData(firm: FirmConfig): Clause {
  const us = contracting(firm);
  const others = Object.entries(PRACTICES).filter(([slug]) => slug !== firm.slug).map(([, n]) => n);
  const ico = firm.icoNumber?.trim();
  return {
    heading: "How we look after your information",
    paras: [
      {
        lead: "Who is responsible.",
        text: `${us} is responsible for the personal information we hold about you (the "controller")${ico ? `, and is registered with the Information Commissioner's Office under number ${ico}` : ""}. If you have any questions about your information, please contact us at ${firm.email}.`,
      },
      {
        lead: "Who we share it with.",
        text: `We share your information only where we need to in order to provide our services: with HM Revenue & Customs, Companies House and other authorities; with the software providers we use, which are listed in our privacy notice; with our professional body, as described above; and with our associated practices, ${andList(others)}, whose staff may access it when they work on your affairs for us.`,
      },
      {
        lead: "Shared systems and security.",
        text: `Our three practices and our associated company, ${ASSOCIATED_COMPANY}, which has an office in Nepal, share offices, servers, software and other resources. Access is protected by a secure private network connection (VPN) and multi-factor authentication, and each practice's records are kept separate, so staff see only the information they need for the work they are doing. Where your information is accessed from outside the UK, it is protected by the safeguards that UK data protection law requires, including the International Data Transfer Agreement issued by the Information Commissioner's Office. A copy of these safeguards is available on request.`,
      },
      {
        lead: "Why we need it.",
        text: "We need your information to provide our services, to meet our legal obligations and to keep proper records; without it we may not be able to act for you. We do not make decisions about you by automated means alone.",
      },
      {
        lead: "How long we keep it.",
        text: `We keep your records for ${RETENTION_YEARS} years after our engagement ends, or longer where the law requires, and then delete them securely.`,
      },
      {
        lead: "Your rights.",
        text: "You can ask for a copy of your information, ask us to correct or delete it, ask us to restrict or stop using it, and withdraw any consent you have given, for example to marketing. If you are unhappy with how we handle your information, please tell us first. You can also contact the Information Commissioner's Office at ico.org.uk.",
      },
    ],
  };
}

/** Clause 3: printed after the Data Protection section, before the specific terms and the agreement. */
export function identityChecks(firm: FirmConfig): Clause {
  const us = contracting(firm);
  return {
    heading: "Identity checks",
    paras: [
      {
        text: "Like all UK accountancy firms, we are required by the Money Laundering Regulations 2017 to confirm the identity of our clients and of the people who own or control them. We do this before we start work and from time to time afterwards. We may ask for photo identification, proof of address and some information about your business, and we may use an electronic identity check.",
      },
      {
        text: `We keep these records for at least five years after our relationship ends. Members of our wider team may help with these checks, but responsibility stays with ${us}.`,
      },
      {
        text: "The law also requires us to report certain matters to the relevant authorities, and in those cases we may not be able to discuss them with you. If we are required to pause work while checks are completed, we will not be responsible for any resulting delay. If we cannot complete these checks, we may not be able to start or continue acting for you.",
      },
    ],
  };
}
