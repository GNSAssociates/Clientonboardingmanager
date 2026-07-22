/* eslint-disable jsx-a11y/alt-text */
/**
 * Engagement letter → real PDF (pure JavaScript, no browser).
 *
 * Uses @react-pdf/renderer so it runs reliably on Vercel serverless. Produces
 * a true downloadable .pdf with the firm header (logo + name) and footer
 * (address + "Page X of Y") repeated on EVERY page, plus the signature audit
 * report for signed copies. Content is driven by the same data as the on-screen
 * HTML letter (services, scope, Companies House details, dynamic schedules).
 */
import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet, Font, renderToBuffer } from '@react-pdf/renderer';
import type { FirmConfig } from './firms';
import { GNS_LOGO_DATA_URI, GNS_SIGNATURE_DATA_URI } from './brand-assets';
import { SG_SIGNATURE_DATA_URI } from './sg-signature';
import { MG_SIGNATURE_DATA_URI } from './mg-signature';
import { ICAEW_LOGO_DATA_URI } from './icaew-logo';
import { ACCA_LOGO_DATA_URI } from './acca-logo';
import { CIOT_LOGO_DATA_URI } from './ciot-logo';
import { NOTO_SANS_DATA_URI } from './font-noto';
import { SERVICE_SCHEDULES, ADHOC_SCHEDULE } from './service-schedules';
import { scopeRowsForServices, CLIENT_TYPE_TERMS, type LetterData, type AuditData, type LetterService } from './letter-html';
import { buildTermsOfBusinessHtml, buildPrivacyNoticeHtml } from './terms-of-business';

const PARTNER_SIGNATURES: Record<string, string> = {
  'Lekh Nath Ghimire': GNS_SIGNATURE_DATA_URI,
  'Subash Ghimire': SG_SIGNATURE_DATA_URI,
  'Mahesh Giri': MG_SIGNATURE_DATA_URI,
};

const PARTNER_DESIGNATIONS: Record<string, string> = {
  'Lekh Nath Ghimire': 'ACCA, MBA, ICAEW (ACA), CIOT',
  'Subash Ghimire': 'ACCA, MBA',
  'Mahesh Giri': 'ACCA, MA',
};

// Register an embedded TrueType font. react-pdf's built-in standard fonts fail
// to load their metrics under Next's bundler ("unitsPerEm" error); an embedded
// TTF renders reliably on the server and on Vercel. Regular covers bold too
// (headings stay distinct via size, caps and colour).
let fontRegistered = false;
function ensureFont() {
  if (fontRegistered) return;
  Font.register({ family: 'Noto', fonts: [
    { src: NOTO_SANS_DATA_URI, fontWeight: 'normal' },
    { src: NOTO_SANS_DATA_URI, fontWeight: 'bold' },
    { src: NOTO_SANS_DATA_URI, fontWeight: 'normal', fontStyle: 'italic' },
    { src: NOTO_SANS_DATA_URI, fontWeight: 'bold', fontStyle: 'italic' },
  ] });
  Font.registerHyphenationCallback((word) => [word]); // no hyphenation splits
  fontRegistered = true;
}

import { fmtGBP } from './format';
const GBP = fmtGBP;
const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

// ── Parse the schedule HTML (h3/p/ul/li/strong) into flat blocks for PDF ──
type Block = { t: 'h'; s: string } | { t: 'p'; s: string } | { t: 'li'; s: string };
function parseBlocks(html: string): Block[] {
  const out: Block[] = [];
  const clean = (s: string) => s.replace(/<\/?strong>/g, '').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;|&#39;/g, "'").trim();
  const re = /<(h3|p)>([\s\S]*?)<\/\1>|<li>([\s\S]*?)<\/li>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[1] === 'h3') out.push({ t: 'h', s: clean(m[2]!) });
    else if (m[1] === 'p') out.push({ t: 'p', s: clean(m[2]!) });
    else if (m[3] !== undefined) out.push({ t: 'li', s: clean(m[3]) });
  }
  return out;
}

export interface PdfLetterInput extends LetterData {
  regBody?: string;
  audit?: AuditData | null; // present → append signature audit report (signed copy)
}

const styles = StyleSheet.create({
  // Extra bottom padding leaves room for the centered running footer (regulator
  // logo + 4 firm-detail lines) plus the page number beneath it.
  page: { paddingTop: 92, paddingBottom: 104, paddingHorizontal: 46, fontFamily: 'Noto', fontSize: 9, color: '#24292f', lineHeight: 1.5 },

  // Running header — logo left, firm identity right, refined double rule
  header: { position: 'absolute', top: 26, left: 46, right: 46 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerLogo: { height: 36 },
  headerRight: { alignItems: 'flex-end' },
  headerName: { fontSize: 9, fontFamily: 'Noto', fontWeight: 'bold', color: '#1a1f2b', letterSpacing: 0.6 },
  headerTag: { fontSize: 6.5, color: '#7a828f', letterSpacing: 1.2, marginTop: 2, textTransform: 'uppercase' },
  headerContact: { fontSize: 6.5, color: '#9aa1ab', marginTop: 1 },
  headerRuleAccent: { borderTopWidth: 1.4, marginTop: 9 },
  headerRuleThin: { borderTopWidth: 0.4, borderTopColor: '#cdd2da', marginTop: 1.5 },

  // Running footer — separate fixed elements (a fixed View that nests a
  // dynamic `render` Text breaks react-pdf layout, so the page number is its
  // own fixed Text sibling).
  // Running footer — centered regulator logo + firm details, matching the GNS
  // letterhead. Everything is centre-aligned; the page number is stamped
  // separately (pdf-lib) beneath this block.
  footer: { position: 'absolute', bottom: 24, left: 46, right: 46, alignItems: 'center' },
  footerRuleAccent: { borderTopWidth: 1, width: '100%', marginBottom: 5 },
  footerLogo: { height: 16, marginBottom: 4 },
  footerStrong: { fontSize: 6.8, color: '#3b4453', fontFamily: 'Noto', fontWeight: 'bold', textAlign: 'center' },
  footerTxt: { fontSize: 6.5, color: '#6b7280', textAlign: 'center', marginTop: 1.5, lineHeight: 1.35 },
  kicker: { fontSize: 7, letterSpacing: 2, color: '#8a919c', fontFamily: 'Noto', fontWeight: 'bold', textAlign: 'center', marginTop: 4 },
  title: { fontSize: 16, textAlign: 'center', marginTop: 3, marginBottom: 10, color: '#1a1f2b', fontFamily: 'Noto', fontWeight: 'bold' },
  h2: { fontSize: 9.5, fontFamily: 'Noto', fontWeight: 'bold', letterSpacing: 0.8, marginTop: 14, marginBottom: 5, paddingBottom: 3, borderBottomWidth: 0.5, borderBottomColor: '#e3e6ea' },
  h3: { fontSize: 9, fontFamily: 'Noto', fontWeight: 'bold', marginTop: 8, marginBottom: 3, color: '#1a1f2b' },
  p: { marginBottom: 6, textAlign: 'justify' },
  li: { flexDirection: 'row', marginBottom: 2, paddingLeft: 6 },
  bullet: { width: 10 },
  panel: { borderWidth: 0.5, borderColor: '#d7dbe0', borderTopWidth: 2, padding: 12, marginBottom: 8 },
  lbl: { fontSize: 7, letterSpacing: 1.5, color: '#9aa1ab', fontFamily: 'Noto', fontWeight: 'bold', marginBottom: 2 },
  pty: { fontSize: 10, marginBottom: 8 },
  integral: { fontSize: 8, fontStyle: 'italic', color: '#6b7280', textAlign: 'center', marginTop: 6, marginBottom: 12 },
  chGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  chItem: { width: '50%', fontSize: 8, marginBottom: 2 },
  chFull: { width: '100%', fontSize: 8, marginBottom: 2 },
  chK: { color: '#8a919c' },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e8eaee' },
  th: { backgroundColor: '#1a1f2b', color: '#fff', fontSize: 7.5, fontFamily: 'Noto', fontWeight: 'bold', padding: 5 },
  td: { fontSize: 8, padding: 5 },
  vat: { fontSize: 7.5, fontFamily: 'Noto', fontWeight: 'bold', color: '#5b6472', textAlign: 'right', marginTop: 3, marginBottom: 12 },
  callout: { borderLeftWidth: 3, padding: 9, marginBottom: 12, backgroundColor: '#f6f7f9' },
  calloutT: { fontFamily: 'Noto', fontWeight: 'bold', fontSize: 8, letterSpacing: 0.8, marginBottom: 3 },
  sscH: { fontSize: 7.5, fontFamily: 'Noto', fontWeight: 'bold', letterSpacing: 0.8, marginTop: 12, marginBottom: 4 },
  sig: { height: 34, marginTop: 6, marginBottom: 2 },
  sigLine: { width: 160, borderTopWidth: 0.5, borderTopColor: '#9aa1ab', marginTop: 3, marginBottom: 3 },
  auditBadge: { borderWidth: 2, borderColor: '#16a34a', backgroundColor: '#f0fdf4', padding: 12, marginBottom: 14, borderRadius: 4 },
});

// Section headings. `minPresenceAhead` tells react-pdf to keep at least this
// much space below the heading on the current page — if there isn't room, the
// heading moves to the next page WITH the paragraph that follows it, so a
// heading is never left orphaned at the bottom of a page.
function H2({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h2} minPresenceAhead={64}>{children}</Text>;
}

function Bullets({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((it, i) => (
        <View key={i} style={styles.li}>
          <Text style={styles.bullet}>{'•'}</Text>
          <Text style={{ flex: 1 }}>{it}</Text>
        </View>
      ))}
    </View>
  );
}

function Table({ head, rows, widths, accent }: { head: string[]; rows: string[][]; widths: number[]; accent: string }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={[styles.row, { borderBottomWidth: 0 }]}>
        {head.map((h, i) => (
          <Text key={i} style={[styles.th, { width: `${widths[i]}%`, textAlign: i === 0 ? 'left' : 'right', backgroundColor: i === 0 ? '#1a1f2b' : '#1a1f2b' }]}>{h}</Text>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View key={ri} style={[styles.row, ri % 2 ? { backgroundColor: '#fafbfc' } : {}]} wrap={false}>
          {r.map((c, ci) => (
            <Text key={ci} style={[styles.td, { width: `${widths[ci]}%`, textAlign: ci === 0 ? 'left' : 'right', color: ci === 0 ? '#1a1f2b' : '#374151' }]}>{c}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function ScheduleBlocks({ html }: { html: string }) {
  const blocks = parseBlocks(html);
  const groups: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = (key: string) => {
    if (bullets.length) { groups.push(<Bullets key={key} items={bullets} />); bullets = []; }
  };
  blocks.forEach((b, i) => {
    if (b.t === 'li') { bullets.push(b.s); return; }
    flush(`b${i}`);
    if (b.t === 'h') groups.push(<Text key={i} style={styles.h3} minPresenceAhead={48}>{b.s}</Text>);
    else groups.push(<Text key={i} style={styles.p}>{b.s}</Text>);
  });
  flush('bend');
  return <View>{groups}</View>;
}

function letterDoc(d: PdfLetterInput) {
  const f = d.firm;
  const partner = d.partnerName || f.partnerName;
  const monthly = d.services.filter((s) => !s.oneoff);
  const oneoff = d.services.filter((s) => s.oneoff);
  const customFees = (d.customFees ?? []).filter((c) => c.description.trim());
  const totalMonthly = monthly.reduce((s, x) => s + x.price, 0);
  const totalOneoff = oneoff.reduce((s, x) => s + x.price, 0) + customFees.reduce((s, x) => s + x.price, 0);
  const monthlyIds = monthly.map((s) => s.id ?? '');
  const scopeRows = scopeRowsForServices(monthlyIds, d.scopeRows);
  const selectedSchedules = SERVICE_SCHEDULES.filter((s) => monthlyIds.includes(s.id));
  const schedules = [...selectedSchedules, ...(oneoff.length || customFees.length || selectedSchedules.length === 0 ? [ADHOC_SCHEDULE] : [])];
  const ctx = { firmName: f.name, regBody: f.regBody };
  const regBody = d.regBody || f.regBody;
  const isManual = d.paymentMethod === 'manual';
  const showAnnexA = d.includeAnnexA !== false;
  const tobOpts = { firmName: f.name, firmLegalName: f.legalName, firmAddress: `${f.address}, ${f.city} ${f.postcode}`, regBody, firmEmail: f.email };
  const termsHtml = buildTermsOfBusinessHtml(tobOpts);
  const privacyHtml = buildPrivacyNoticeHtml({ ...tobOpts, companyNumber: f.companyNumber });
  const terms = CLIENT_TYPE_TERMS[d.clientType ?? 'limited'] ?? CLIENT_TYPE_TERMS.limited!;
  const payMode = isManual ? 'Monthly Inv' : 'Monthly DD';

  const tagline = regBody === 'ICAEW' ? 'Chartered Accountants' : 'Chartered Certified Accountants';
  const Header = () => (
    <View style={styles.header} fixed>
      <View style={styles.headerRow}>
        <Image style={styles.headerLogo} src={GNS_LOGO_DATA_URI} />
        <View style={styles.headerRight}>
          <Text style={styles.headerName}>{f.legalName}</Text>
          <Text style={styles.headerTag}>{tagline}</Text>
          <Text style={styles.headerContact}>{f.phone}  ·  {f.email}</Text>
        </View>
      </View>
      <View style={[styles.headerRuleAccent, { borderTopColor: f.accentColor }]} />
      <View style={styles.headerRuleThin} />
    </View>
  );
  const LOGO_MAP: Record<string, string> = { ICAEW: ICAEW_LOGO_DATA_URI, ACCA: ACCA_LOGO_DATA_URI, CIOT: CIOT_LOGO_DATA_URI };
  const bodies = f.regBodies ?? (f.regBody ? [f.regBody] : []);
  const footerTitle = bodies.length > 1
    ? `${f.legalName}, Chartered Accountants (${bodies.join(', ')})`
    : regBody === 'ACCA'
      ? `${f.legalName}, Chartered Certified Accountants (ACCA)`
      : `${f.legalName}, Chartered Accountants (${regBody})`;
  const Footer = () => (
    <View style={styles.footer} fixed>
      <View style={[styles.footerRuleAccent, { borderTopColor: f.accentColor }]} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 4 }}>
        {bodies.map((b) => LOGO_MAP[b] ? <Image key={b} style={styles.footerLogo} src={LOGO_MAP[b]!} /> : null)}
      </View>
      <Text style={styles.footerStrong}>{footerTitle}</Text>
      <Text style={styles.footerTxt}>Registered in England and Wales, Company Registration No: {f.companyNumber}</Text>
      <Text style={styles.footerTxt}>{f.address}, {f.city}, {f.postcode}</Text>
      <Text style={styles.footerTxt}>t: {f.footerTel}  |  m: {f.footerMobile}  |  f: {f.footerFax}  |  {f.email}  |  {f.website}</Text>
    </View>
  );

  return (
    <Document title={`Engagement Letter — ${d.companyName}`} author={f.legalName}>
      <Page size="A4" style={styles.page}>
        <Header />
        <Footer />


        <Text style={styles.kicker}>LETTER OF ENGAGEMENT · PRIVATE &amp; CONFIDENTIAL</Text>
        <Text style={styles.title}>Contract for Services</Text>
        <Text style={{ textAlign: 'center', fontSize: 8, color: '#6b7280', marginBottom: 10 }}>Date: {d.dateStr}</Text>

        <View style={[styles.panel, { borderTopColor: f.accentColor }]}>
          <Text style={styles.lbl}>BETWEEN</Text>
          <Text style={styles.pty}>{f.legalName.toUpperCase()}, {f.address}, {f.city} {f.postcode} (&lsquo;The Accountants&rsquo;)</Text>
          <Text style={styles.lbl}>AND</Text>
          <Text style={[styles.pty, { marginBottom: 0 }]}>{(d.clientName || d.companyName).toUpperCase()}{d.clientAddress ? `, ${d.clientAddress}` : ''}{d.companyNumber ? ` (Company No. ${d.companyNumber})` : ''}{d.utr ? ` (UTR ${d.utr})` : ''} (&lsquo;The Client&rsquo;)</Text>
        </View>
        <Text style={styles.integral}>This fee structure and quotation is an integral part of the engagement letter.</Text>

        {d.ch && d.ch.number ? (
          <View style={[styles.panel, { borderTopWidth: 0.5 }]}>
            <Text style={[styles.lbl, { marginBottom: 6 }]}>COMPANY DETAILS — VERIFIED WITH COMPANIES HOUSE</Text>
            <View style={styles.chGrid}>
              <Text style={styles.chItem}><Text style={styles.chK}>Company No: </Text>{d.ch.number}</Text>
              {d.ch.status ? <Text style={styles.chItem}><Text style={styles.chK}>Status: </Text>{d.ch.status}</Text> : null}
              {d.ch.address ? <Text style={styles.chFull}><Text style={styles.chK}>Registered Office: </Text>{d.ch.address}</Text> : null}
              {d.ch.incorporationDate ? <Text style={styles.chItem}><Text style={styles.chK}>Incorporated: </Text>{fmtDate(d.ch.incorporationDate)}</Text> : null}
              {d.ch.natureOfBusiness ? <Text style={styles.chItem}><Text style={styles.chK}>SIC: </Text>{d.ch.natureOfBusiness}</Text> : null}
              {d.ch.aaDue ? <Text style={styles.chItem}><Text style={styles.chK}>Accounts due: </Text>{fmtDate(d.ch.aaDue)}</Text> : null}
              {d.ch.csDue ? <Text style={styles.chItem}><Text style={styles.chK}>Conf. statement due: </Text>{fmtDate(d.ch.csDue)}</Text> : null}
            </View>
          </View>
        ) : null}

        {/* Fee structure */}
        <Table
          accent={f.accentColor}
          widths={[40, 15, 15, 18, 12]}
          head={['Fees', 'Monthly £', 'Upfront £', 'Annual £', 'Mode']}
          rows={[
            ['Fees Agreed', GBP(totalMonthly), '—', GBP(totalMonthly * 12), payMode],
            ...monthly.map((s) => [`• ${s.name}`, GBP(s.price), '', GBP(s.price * 12), '']),
            ...(oneoff.length || customFees.length ? [['Past due / catch-up / ad-hoc work (if any)', '', '', '', '']] : []),
            ...oneoff.map((s, i) => [`${i + 1}. ${s.name}`, '', GBP(s.price), '', 'One off']),
            ...customFees.map((c, i) => [`${oneoff.length + i + 1}. ${c.description}`, '', GBP(c.price), '', 'One off']),
            ['Final Monthly and One-off Fees Agreed', GBP(totalMonthly), GBP(totalOneoff), GBP(totalMonthly * 12), isManual ? 'Inv / Upfront' : 'DD / Upfront'],
          ]}
        />
        <Text style={styles.vat}>Note: 20% VAT applies to all above</Text>

        {isManual ? (
          <View style={[styles.callout, { borderLeftColor: '#3b4453' }]}>
            <Text style={styles.calloutT}>PAYMENT — MONTHLY INVOICE</Text>
            <Text>The Client&rsquo;s fees are invoiced monthly and are payable within 14 days of the invoice date. One-off and ad-hoc work is invoiced on completion and payable upfront. No Direct Debit mandate is required for this engagement.</Text>
          </View>
        ) : (
          <View style={[styles.callout, { borderLeftColor: '#3b4453' }]}>
            <Text style={styles.calloutT}>DIRECT DEBIT — GOCARDLESS MANDATE</Text>
            <Text>The Client&rsquo;s fees are collected by GoCardless Direct Debit. By signing this contract the Client authorises {f.name} to collect fees using GoCardless direct debit and authorises use of the bank details provided at signing for the mandate. Payments are protected by the Direct Debit Guarantee.</Text>
          </View>
        )}
        <View style={[styles.callout, { borderLeftColor: f.accentColor, backgroundColor: '#fbf7f7' }]}>
          <Text style={[styles.calloutT, { color: f.accentColor }]}>IMPORTANT!</Text>
          <Text>Please read the contract to the last page. Do not sign unless you have read and understood the contract in its entirety.</Text>
        </View>

        {/* Scope of services */}
        <Text style={{ fontSize: 8, fontFamily: 'Noto', fontWeight: 'bold', marginBottom: 4 }}>Services not covered below are charged per our Schedule of Service Charges (Annex A).</Text>
        <Table
          accent={f.accentColor}
          widths={[32, 38, 30]}
          head={['Scope of Services', 'Coverage Threshold (included)', 'Fee Exceeding Scope']}
          rows={scopeRows.map((r) => [r.service, r.threshold, r.excess])}
        />

        {/* Engagement terms */}
        <H2>PERIOD OF ENGAGEMENT</H2>
        <Text style={styles.p}>This letter is effective from the date signed and supersedes any previous engagement letter for the period covered. It will remain effective until replaced. You or we may vary or terminate our authority to act at any time without penalty; notice must be given in writing.</Text>

        <H2>SCOPE OF SERVICES</H2>
        <Text style={styles.p}>We have set out the agreed scope of your instructions in this letter and the Schedule of Services. Only the services listed are within the scope of our instructions. Any subsequent changes will be discussed and, where appropriate, a new or amended engagement letter agreed. We rely on you to tell us as soon as possible if anything renders information previously given to us incorrect or inaccurate.</Text>
        <Text style={styles.p}>We are bound by the ethical guidelines of {regBody} and accept instructions to act for you on the basis that we will act in accordance with those guidelines{regBody === 'ACCA' ? ' (www.accaglobal.com)' : ' (www.icaew.com)'}.</Text>

        <H2>YOUR RESPONSIBILITIES</H2>
        <Text style={styles.p}>As directors you are responsible for preparing financial statements which give a true and fair view and which have been prepared in accordance with the Companies Act 2006. You must not approve the financial statements unless you are satisfied that they give a true and fair view of the assets, liabilities, financial position and profit or loss of the company. In preparing the financial statements you are required to select suitable accounting policies and apply them consistently, make judgements and estimates that are reasonable and prudent, and prepare the financial statements on the going concern basis unless it is inappropriate to presume that the company will continue in business.</Text>
        <Text style={styles.p}>You are responsible for keeping adequate accounting records that set out with reasonable accuracy at any time the company&rsquo;s financial position, for safeguarding the assets of the company, for taking reasonable steps to prevent and detect fraud and other irregularities, and for determining whether the company meets the conditions for exemption from an audit under sections 477 or 480 of the Companies Act 2006. You have undertaken to make available to us, as and when required, all the company&rsquo;s accounting records and related financial information, including minutes of management and members&rsquo; meetings.</Text>
        <Text style={styles.p}>You are also responsible for ensuring the company complies with the laws and regulations that apply to its activities, for the completeness and accuracy of information supplied to us (including all tax returns), and for making payment of all taxes by the due dates. You are legally responsible for ensuring that any returns filed are correct and complete. Failure to do so may lead to penalties and/or interest.</Text>

        <H2>OUR RESPONSIBILITIES</H2>
        <Text style={styles.p}>We will compile the annual financial statements for your approval based on the accounting records maintained by you and the information and explanations that you give us. We shall plan our work on the basis that no report on the financial statements is required by statute or regulation for the year, unless you inform us otherwise. Our work will not be an audit of the financial statements in accordance with International Standards on Auditing (UK), so we will not be able to provide any assurance that the accounting records or the financial statements are free from material misstatement, whether caused by fraud, other irregularities or error, nor to identify weaknesses in internal controls.</Text>
        <Text style={styles.p}>We have a professional duty to compile accounts that conform with generally accepted accounting principles. Where we identify that the accounts do not conform with generally accepted accounting principles or standards, we will inform you and suggest amendments. We have a professional responsibility not to allow our name to be associated with accounts that may be misleading. In extreme cases, where this matter cannot be resolved, we will withdraw from the engagement and notify you in writing of the reasons.</Text>
        <Text style={styles.p}>To ensure that anyone reading the accounts is aware that we have not carried out an audit, we will attach to the accounts a report stating this fact, developed by the Consultative Committee of Accountancy Bodies (CCAB), that explains what work has been done, the professional requirements we have fulfilled and the standard to which the work has been carried out.</Text>

        <H2>FEES</H2>
        <Text style={styles.p}>Fees are as set out in the fee structure above and are collected by monthly Direct Debit unless otherwise agreed. Fees are exclusive of VAT, which is added where chargeable. Work outside the agreed scope may involve additional fees; where the value will exceed £200 we will agree a separate scope and fee (or issue a new engagement letter) beforehand. Ad hoc queries by way of telephone and email enquiries are not routine compliance and may result in additional fees; where appropriate we will aim to discuss and agree additional fees, but it may not always be possible to agree these in advance and we reserve the right to charge you an additional fee for these queries.</Text>

        <H2>CHANGES IN THE LAW OR PRACTICE</H2>
        <Text style={styles.p}>We will not accept responsibility if you act on advice given by us on an earlier occasion without first confirming with us that the advice is still valid in the light of any change in the law, in practice, in public policy, or in your circumstances. We will accept no liability for losses arising from changes in the law, in practice, or in public policy that are first published after the date on which the advice is given.</Text>

        <H2>LIMITATION OF LIABILITY</H2>
        <Text style={styles.p}>We provide our services with reasonable care and skill. To the fullest extent permitted by law, we will not be responsible for losses, penalties, surcharges, interest or additional tax liabilities arising from the supply of incorrect or incomplete information, or from failure to act on our advice or to respond promptly to us or the tax authorities. We will not be liable for any loss of profit, loss of business, or indirect or consequential loss or damage, howsoever arising. This limitation does not apply to death or personal injury caused by our negligence, or to any liability that cannot be excluded by law.</Text>

        <H2>THIRD PARTIES</H2>
        <Text style={styles.p}>Unless otherwise agreed in writing, no person other than the parties to this engagement is intended to have any right to enforce any term of this engagement under the Contracts (Rights of Third Parties) Act 1999. There are no third parties that we have agreed should be entitled to rely on the work done pursuant to this engagement letter.</Text>

        <H2>DATA PROTECTION &amp; PRIVACY NOTICE</H2>
        <Text style={styles.p}>We are registered with the Information Commissioner&rsquo;s Office as a data controller. We comply with the UK GDPR and the Data Protection Act 2018 when processing personal data.</Text>
        <Text style={styles.p}><Text style={{ fontFamily: 'Noto', fontWeight: 'bold' }}>Lawful basis:</Text> We process your personal data on the basis of: (a) contractual necessity — to perform this engagement; (b) legal obligation — to comply with tax, company and anti-money-laundering legislation (including MLR 2017); and (c) legitimate interest — for practice administration and to keep you informed of changes in law or of services that may be relevant.</Text>
        <Text style={styles.p}><Text style={{ fontFamily: 'Noto', fontWeight: 'bold' }}>Categories of data:</Text> Name, address, date of birth, contact details, financial information, tax records, bank account details (for DD mandate only), National Insurance number, UTR, and such other personal data as is necessary for us to carry out our services.</Text>
        <Text style={styles.p}><Text style={{ fontFamily: 'Noto', fontWeight: 'bold' }}>Recipients:</Text> We may disclose personal data to HMRC, Companies House, your pension provider, our professional indemnity insurers, our regulatory body ({regBody}), and our sub-processors (cloud software providers, payment processors) where necessary. We will not share data with third parties for marketing purposes.</Text>
        <Text style={styles.p}><Text style={{ fontFamily: 'Noto', fontWeight: 'bold' }}>Retention:</Text> We will retain your personal data for a minimum of seven years from the end of the tax year to which it relates or from the end of the engagement, whichever is later, to meet HMRC and regulatory requirements.</Text>
        <Text style={styles.p}><Text style={{ fontFamily: 'Noto', fontWeight: 'bold' }}>Your rights:</Text> You have the right to access your personal data, request rectification or erasure, restrict processing, object to processing, and data portability. You also have the right to lodge a complaint with the Information Commissioner&rsquo;s Office (ICO) at ico.org.uk if you believe your data protection rights have been breached.</Text>
        <Text style={styles.p}>Bank details provided for the Direct Debit mandate are used solely for that purpose and transmitted securely to our payment provider (GoCardless). In signing this letter you confirm you have read and understood this privacy notice.</Text>

        <H2>ANTI-MONEY LAUNDERING</H2>
        <Text style={styles.p}>We are supervised for the purposes of the Money Laundering, Terrorist Financing and Transfer of Funds (Information on the Payer) Regulations 2017 by {regBody}. We are required to identify and verify our clients (and beneficial owners) before commencing work, and may request identification documentation and evidence of source of funds. We are required to retain such records for at least five years after the end of our business relationship.</Text>
        <Text style={styles.p}>If during the course of our work we become aware of any knowledge or suspicion that money laundering or terrorist financing is taking place, or has taken place, we are required by law to report this to the National Crime Agency (NCA). We may be prohibited from informing you that any such report has been or is being made.</Text>

        <H2>CONFLICTS OF INTEREST</H2>
        <Text style={styles.p}>We will inform you if we become aware of any conflict of interest in our relationship with you or with any of our other clients. Where conflicts are identified which cannot be managed in a way that protects your interests, we will not accept or continue a conflicting engagement. We reserve the right to act for other clients whose interests are or may compete with yours, subject to our obligations of confidentiality and the management of any conflict.</Text>

        <H2>INVESTMENT BUSINESS</H2>
        <Text style={styles.p}>Investment business services that are not covered by our professional body&rsquo;s Designated Professional Body licence are not provided by this firm. Where you require such services, we may refer you to an independent third party authorised by the Financial Conduct Authority (FCA). We do not provide personalized investment advice. Any discussion of tax-efficient investments is limited to the tax implications only and does not constitute a recommendation to invest.</Text>

        <H2>COMMISSIONS &amp; REFERRAL FEES</H2>
        <Text style={styles.p}>In some cases, commissions or other benefits may become payable to us in respect of introductions to other professionals or services. Where this arises, we will notify you in writing of the amount and terms, and will account to you for any such amounts unless otherwise agreed.</Text>

        <H2>CLIENT MONEY</H2>
        <Text style={styles.p}>We may, from time to time, hold money on your behalf (for example, tax refunds received from HMRC, or funds for payment of tax liabilities on your behalf). Such money will be held in a client bank account, separate from the firm&rsquo;s own money, in accordance with the rules of {regBody}. We will not pay interest on client money held unless specifically agreed.</Text>

        <H2>INTELLECTUAL PROPERTY &amp; LIEN</H2>
        <Text style={styles.p}>We reserve the right to exercise a lien over all documents, books, records and papers in our possession relating to your affairs until all fees and disbursements due to us are paid in full. We own the copyright and all intellectual property rights in any document, report, system or product we create in performing our services (other than original documents belonging to you that are returned).</Text>

        <H2>ELECTRONIC COMMUNICATION</H2>
        <Text style={styles.p}>Unless you instruct us otherwise, we may communicate with you and with third parties by email or via our client portal. Internet communications are not secure and data can be corrupted, not reach its intended destination, or be intercepted by unauthorised parties. We do not accept liability for any errors or problems that may arise as a result of electronic communication. Any sensitive personal data sent to us by email should, where possible, be encrypted. If you do not wish us to communicate by email, please notify us in writing.</Text>

        <H2>QUALITY CONTROL</H2>
        <Text style={styles.p}>As part of our ongoing obligation to maintain the highest professional standards, our files are subject to periodic review for quality control purposes by {regBody} or its agents. Such reviews are conducted on a confidential basis. By signing this letter, you acknowledge that our files relating to your affairs may be inspected as part of this quality assurance review process.</Text>

        <H2>COMPLAINTS</H2>
        <Text style={styles.p}>We are committed to providing a high quality service. If you are unhappy with any aspect of our service, please raise the matter in the first instance with the partner responsible for your affairs, {partner}. If the matter is not resolved to your satisfaction you may refer it to {regBody === 'ACCA' ? 'ACCA at accaglobal.com/complaints' : 'ICAEW at icaew.com/complaints'}.</Text>

        <H2>APPLICABLE LAW</H2>
        <Text style={styles.p}>This engagement letter and the terms of our relationship shall be governed by, and construed in accordance with, the laws of England and Wales. Each party irrevocably agrees that the courts of England and Wales shall have exclusive jurisdiction to settle any dispute arising out of or in connection with this engagement.</Text>

        <H2>PERIOD OF ENGAGEMENT &amp; TERMINATION</H2>
        <Text style={styles.p}>This letter is effective from the date signed and supersedes any previous engagement letter for the period covered. It will remain effective until replaced. Either party may terminate this engagement by giving not less than 30 days&rsquo; written notice to the other party. Termination will not affect any accrued rights or obligations. Upon termination:</Text>
        <Bullets items={[
          'We will complete any work in progress that you have specifically instructed us to complete, subject to payment of our fees;',
          'We will return to you all original documents belonging to you, subject to our right of lien for unpaid fees;',
          'We will retain our working papers, correspondence and copies of documents for a minimum of seven years from the date of disengagement;',
          'You will be responsible for notifying HMRC and any other relevant authorities of the change of agent; and',
          'Outstanding fees become immediately due and payable.',
        ]} />

        <H2>FORCE MAJEURE</H2>
        <Text style={styles.p}>Neither party shall be liable for any failure or delay in performing their obligations where such failure or delay results from circumstances beyond the reasonable control of that party, including but not limited to acts of God, pandemic, government action, fire, flood, failure of third-party IT systems, or industrial action.</Text>

        <H2>AGREEMENT OF TERMS</H2>
        <Text style={styles.p}>By signing this document you confirm your agreement to the terms of this letter, the Schedule of Services, the standard terms and conditions, and the privacy notice and associated data protection matters. This letter, together with the schedules, constitutes the entire contract between us. It supersedes all previous negotiations, representations, warranties, undertakings and agreements between the parties, and will be effective for future years unless we advise you of any change.</Text>
        <Text style={styles.p}>Please sign and return one copy of this letter to indicate your agreement with its terms. If it is not returned to us within 30 days, we will assume that you are in agreement with its contents.</Text>

        <Text style={styles.p}>Yours sincerely,</Text>
        <Image style={styles.sig} src={PARTNER_SIGNATURES[partner] || GNS_SIGNATURE_DATA_URI} />
        <View style={styles.sigLine} />
        <Text style={{ fontFamily: 'Noto', fontWeight: 'bold', fontSize: 9 }}>{partner}{PARTNER_DESIGNATIONS[partner] ? `, ${PARTNER_DESIGNATIONS[partner]}` : ''}</Text>
        <Text style={{ fontSize: 8, color: '#5b6472' }}>Director, {f.legalName}</Text>

        {/* Schedule of Services */}
        <Text style={[styles.title, { fontSize: 13, marginTop: 20 }]} break>SCHEDULE OF SERVICES</Text>
        <Text style={styles.p}>This section provides a full explanation of the services you have engaged us to carry out, and should be read in conjunction with the engagement letter and terms and conditions. Only the services listed in these schedules are within the scope of our instructions.</Text>
        {schedules.map((sch, i) => (
          <View key={sch.id} wrap>
            <H2>SCHEDULE {String.fromCharCode(65 + i)} — {sch.title.toUpperCase()}</H2>
            <ScheduleBlocks html={sch.html(ctx)} />
          </View>
        ))}

        {/* Terms of Business (ICAEW Part 4) */}
        <Text style={[styles.title, { fontSize: 13, marginTop: 20 }]} break>TERMS OF BUSINESS</Text>
        <ScheduleBlocks html={termsHtml} />

        {/* Privacy Notice (ICAEW Part 5) */}
        <Text style={[styles.title, { fontSize: 13, marginTop: 20 }]} break>PRIVACY NOTICE</Text>
        <ScheduleBlocks html={privacyHtml} />

        {/* Annex A SSC — omitted when the wizard's Include-Annex-A toggle is off */}
        {showAnnexA && (<>
        <Text style={[styles.title, { fontSize: 13, marginTop: 20 }]} break>ANNEX A — SCHEDULE OF SERVICE CHARGES</Text>
        <Text style={styles.sscH} minPresenceAhead={44}>SELF-ASSESSMENT (SA) TAX RETURN</Text>
        <Table accent={f.accentColor} widths={[52, 24, 24]} head={['Service', 'Single', 'Couple']} rows={[
          ['Buy to Let SA Filing', '£250+VAT', '£350+VAT'],
          ['Director and other SA (Salary, Dividend)', '£200+VAT', '£375+VAT'],
          ['Sole Trader (with GNS bookkeeping)', '£350+VAT', 'NA'],
          ['Change of Beneficial Ownership (Rental)', '£500 New', '£400 Existing'],
        ]} />
        <Text style={styles.sscH} minPresenceAhead={44}>MTD FILING FOR SELF-ASSESSMENT</Text>
        <Table accent={f.accentColor} widths={[52, 24, 24]} head={['Service', 'Single', 'Couple']} rows={[
          ['Quarterly', '£75+VAT/q', '£150+VAT/q'],
          ['Annual Summary Filing', 'Free', 'Free'],
          ['Total when MTD in full force', '£550+VAT', '£850+VAT'],
        ]} />
        <Text style={styles.sscH} minPresenceAhead={44}>COMPLIANCE &amp; TAX REGISTRATION</Text>
        <Table accent={f.accentColor} widths={[40, 15, 15, 15, 15]} head={['Service', 'CH', 'Fee', 'VAT', 'Total']} rows={[
          ['Company Registration', '£100', '£125', '£25', '£250'],
          ['Company Registration — Same Day', '£156', '£200', '£40', '£396'],
          ['Change of Name', '£20', '£75', '£15', '£110'],
          ['Confirmation Statement Filing', '£50', '£50', '£10', '£110'],
          ['Voluntary Strike Off (DS01)', '£14', '£100', '£20', '£134'],
          ['Certificate of Good Standing', '£15', '£50', '£10', '£75'],
          ['Companies House ID Verification', '—', '£75', '£15', '£90'],
          ['PAYE Registration', '—', '£100', '£20', '£120'],
          ['VAT Registration', '—', '£75', '£15', '£90'],
          ['Self-Assessment Registration', '—', '£100', '£20', '£120'],
        ]} />
        <Text style={styles.sscH} minPresenceAhead={44}>SUBSCRIPTION BASED SERVICES</Text>
        <Table accent={f.accentColor} widths={[70, 30]} head={['Service', 'Amount']} rows={[
          ['Registered Office Address', '£20+VAT / month'],
          ['QuickBooks Subscription', '£25+VAT / month'],
        ]} />
        </>)}

        {/* Signature audit report (signed copies) */}
        {d.audit ? <AuditReport a={d.audit} f={f} /> : null}
      </Page>
    </Document>
  );
}

function AuditReport({ a, f }: { a: AuditData; f: FirmConfig }) {
  const fmt = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/London' }) + ' (UK)' : '';
  const rows: Array<[string, string | undefined]> = [
    ['Signatory (typed signature)', a.signatureName],
    ['Signatory email', a.signerEmail],
    ['Signing on behalf of', `${a.companyName}${a.companyNumber ? ` (Company No. ${a.companyNumber})` : ''}`],
    ['Date & time (UTC)', new Date(a.signedAtIso).toISOString()],
    ['Date & time (UK)', fmt(a.signedAtIso)],
    ['Network (IP) address', a.ipAddress],
    ['Document fingerprint (SHA-256)', a.documentSha256],
    ['Direct Debit mandate', a.ddSummary ?? undefined],
    ['Transaction ID', a.token ? `GNS-${a.token.substring(0, 20).toUpperCase()}` : undefined],
  ];
  const ev: Array<[string, string | null | undefined]> = [
    [`Document created by ${a.firmName ?? f.legalName}`, a.createdAtIso],
    [`Document emailed to ${a.signerEmail} for signature`, a.emailedAtIso ?? a.createdAtIso],
    [`Document viewed by ${a.signerEmail}`, a.firstViewedAtIso],
    [`Document e-signed by ${a.signatureName}`, a.signedAtIso],
    ['Agreement completed', a.signedAtIso],
  ];
  return (
    <View break>
      <View style={styles.auditBadge}>
        <Text style={{ fontFamily: 'Noto', fontWeight: 'bold', fontSize: 13, color: '#166534' }}>e-Sign Audit Trail</Text>
        <Text style={{ fontSize: 8, color: '#166534', marginTop: 3 }}>This contract was executed by electronic signature. The audit record below forms part of the signed document.</Text>
      </View>
      <H2>AGREEMENT HISTORY</H2>
      {ev.filter(([, w]) => w).map(([t, w], i) => (
        <View key={i} style={{ borderLeftWidth: 2, borderLeftColor: '#cbd2da', paddingLeft: 8, marginBottom: 8 }}>
          <Text style={{ fontSize: 8.5, fontFamily: 'Noto', fontWeight: 'bold' }}>{t}</Text>
          <Text style={{ fontSize: 7.5, color: '#6b7280' }}>{fmt(w)}</Text>
        </View>
      ))}
      <H2>SIGNATURE DETAILS</H2>
      {rows.filter(([, v]) => v).map(([k, v], i) => (
        <View key={i} style={{ flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#eceef1', paddingVertical: 3 }}>
          <Text style={{ width: '32%', fontSize: 7.5, fontFamily: 'Noto', fontWeight: 'bold', color: '#3b4453' }}>{k}</Text>
          <Text style={{ width: '68%', fontSize: 7.5 }}>{v}</Text>
        </View>
      ))}
      <Text style={{ fontSize: 7, color: '#8a919c', marginTop: 12, lineHeight: 1.6 }}>
        Legal notice: signed electronically under the Electronic Communications Act 2000, the UK eIDAS Regulations (SI 2016/696) and the Law Commission&rsquo;s 2019 Statement on the Electronic Execution of Documents. The signatory verified their email against the address the signing link was issued to and confirmed intent to be bound before signing. The fingerprint is the SHA-256 hash of the contract at the point of signature; any later alteration produces a different fingerprint. Personal data is processed under UK GDPR Art. 6(1)(b) and (c).
      </Text>
    </View>
  );
}

export async function renderLetterPdf(input: PdfLetterInput): Promise<Buffer> {
  ensureFont();
  const base = await renderToBuffer(letterDoc(input));
  return stampPageNumbers(base);
}

/**
 * Stamp "Page X of Y" on every page, bottom-right, using pdf-lib's built-in
 * Helvetica. react-pdf's dynamic `render` page-number prop does not evaluate
 * reliably under Next's bundler with a custom font, so we add the numbers as a
 * deterministic post-process. Never throws — returns the original on failure.
 */
async function stampPageNumbers(pdf: Buffer): Promise<Buffer> {
  try {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const doc = await PDFDocument.load(pdf);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const pages = doc.getPages();
    const total = pages.length;
    pages.forEach((page, i) => {
      const { width } = page.getSize();
      const label = `Page ${i + 1} of ${total}`;
      const size = 7;
      const w = font.widthOfTextAtSize(label, size);
      page.drawText(label, {
        x: (width - w) / 2,  // centred, clear of the multi-line footer band above
        y: 12,               // sits below the running footer (which bottoms at ~26pt)
        size,
        font,
        color: rgb(0.42, 0.45, 0.5),
      });
    });
    const out = await doc.save();
    return Buffer.from(out);
  } catch (e) {
    console.error('Page-number stamping failed (non-fatal):', e instanceof Error ? e.message : e);
    return pdf;
  }
}
