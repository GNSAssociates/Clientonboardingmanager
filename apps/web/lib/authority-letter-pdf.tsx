/* eslint-disable jsx-a11y/alt-text */
/**
 * Client Authority (Change of Accountants) letter → real PDF.
 *
 * This is the letter FROM the client authorising the OUTGOING accountant to
 * release their records to us. It is auto-generated (pre-filled with the client,
 * GNS and previous-accountant details) and attached alongside the professional
 * clearance letter on the first email to the previous accountant.
 *
 * Built with @react-pdf/renderer using the same firm letterhead (logo header +
 * regulator-badge footer) as the engagement letter, so it runs on the cPanel
 * standalone build with no browser.
 */
import React from 'react';
// @ts-ignore — no type declarations for the internal path (build ignores TS errors)
import { Document, Page, View, Text, Image, StyleSheet, Font, renderToBuffer } from '@react-pdf/renderer/lib/react-pdf.js';
import type { FirmConfig } from './firms';
import { GNS_LOGO_DATA_URI } from './brand-assets';
import { ICAEW_LOGO_DATA_URI } from './icaew-logo';
import { ACCA_LOGO_DATA_URI } from './acca-logo';
import { CIOT_LOGO_DATA_URI } from './ciot-logo';
import { NOTO_SANS_DATA_URI } from './font-noto';
import { DANCING_SCRIPT_DATA_URI } from './font-cursive';

let fontRegistered = false;
function ensureFont() {
  if (fontRegistered) return;
  Font.register({ family: 'Noto', fonts: [
    { src: NOTO_SANS_DATA_URI, fontWeight: 'normal' },
    { src: NOTO_SANS_DATA_URI, fontWeight: 'bold' },
    { src: NOTO_SANS_DATA_URI, fontWeight: 'normal', fontStyle: 'italic' },
  ] });
  Font.register({ family: 'Signature', fonts: [{ src: DANCING_SCRIPT_DATA_URI }] });
  Font.registerHyphenationCallback((word) => [word]);
  fontRegistered = true;
}

const styles = StyleSheet.create({
  page: { paddingTop: 92, paddingBottom: 104, paddingHorizontal: 46, fontFamily: 'Noto', fontSize: 10, color: '#24292f', lineHeight: 1.55 },
  header: { position: 'absolute', top: 26, left: 46, right: 46 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerLogo: { height: 36 },
  headerRight: { alignItems: 'flex-end' },
  headerName: { fontSize: 9, fontFamily: 'Noto', fontWeight: 'bold', color: '#1a1f2b', letterSpacing: 0.6 },
  headerTag: { fontSize: 6.5, color: '#7a828f', letterSpacing: 1.2, marginTop: 2, textTransform: 'uppercase' },
  headerContact: { fontSize: 6.5, color: '#9aa1ab', marginTop: 1 },
  headerRuleAccent: { borderTopWidth: 1.4, marginTop: 9 },
  headerRuleThin: { borderTopWidth: 0.4, borderTopColor: '#cdd2da', marginTop: 1.5 },
  footer: { position: 'absolute', bottom: 24, left: 46, right: 46, alignItems: 'center' },
  footerRuleAccent: { borderTopWidth: 1, width: '100%', marginBottom: 5 },
  footerLogo: { height: 16, marginBottom: 4 },
  footerStrong: { fontSize: 6.8, color: '#3b4453', fontFamily: 'Noto', fontWeight: 'bold', textAlign: 'center' },
  footerTxt: { fontSize: 6.5, color: '#6b7280', textAlign: 'center', marginTop: 1.5, lineHeight: 1.35 },
  kicker: { fontSize: 7, letterSpacing: 2, color: '#8a919c', fontFamily: 'Noto', fontWeight: 'bold', textAlign: 'center', marginTop: 4 },
  title: { fontSize: 16, textAlign: 'center', marginTop: 3, marginBottom: 10, color: '#1a1f2b', fontFamily: 'Noto', fontWeight: 'bold' },
  meta: { fontSize: 9, color: '#5b6472', marginBottom: 2 },
  addr: { fontSize: 9.5, marginBottom: 1 },
  addrK: { color: '#8a919c' },
  re: { fontFamily: 'Noto', fontWeight: 'bold', fontSize: 11, marginTop: 14, marginBottom: 8 },
  p: { marginBottom: 9, textAlign: 'justify' },
  panel: { borderWidth: 0.5, borderColor: '#d7dbe0', borderTopWidth: 2, padding: 12, marginTop: 4, marginBottom: 14 },
  lbl: { fontSize: 7, letterSpacing: 1.5, color: '#9aa1ab', fontFamily: 'Noto', fontWeight: 'bold', marginBottom: 4 },
  sigLine: { width: 200, borderTopWidth: 0.6, borderTopColor: '#9aa1ab', marginTop: 26, marginBottom: 4 },
  sigK: { fontSize: 8.5, color: '#5b6472', marginBottom: 3 },
  sigScript: { fontFamily: 'Signature', fontSize: 30, color: '#1a3fa0', marginTop: 20 },
});

export interface AuthorityLetterInput {
  firm: FirmConfig;
  clientName: string;            // the client company / individual granting authority
  companyNumber?: string;
  directorName?: string;         // who signs on the client's behalf
  clientAddress?: string;
  prevFirmName: string;          // outgoing accountant
  prevFirmContact?: string;      // named contact at the outgoing accountant (optional)
  prevFirmAddress?: string;
  today: string;
}

function authorityDoc(d: AuthorityLetterInput) {
  const f = d.firm;
  const bodies = f.regBodies ?? (f.regBody ? [f.regBody] : []);
  const LOGO_MAP: Record<string, string> = { ICAEW: ICAEW_LOGO_DATA_URI, ACCA: ACCA_LOGO_DATA_URI, CIOT: CIOT_LOGO_DATA_URI };
  const tagline = f.regBody === 'ICAEW' ? 'Chartered Accountants' : 'Chartered Certified Accountants';
  const advisers = bodies.includes('CIOT') ? 'Chartered Accountants & Chartered Tax Advisers' : tagline;
  const footerTitle = bodies.length > 1
    ? `${f.legalName}, Chartered Accountants (${bodies.join(', ')})`
    : f.regBody === 'ACCA'
      ? `${f.legalName}, Chartered Certified Accountants (ACCA)`
      : `${f.legalName}, Chartered Accountants (${f.regBody})`;
  const clientLabel = `${d.clientName}${d.companyNumber ? ` (Company No. ${d.companyNumber})` : ''}`;

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
  const Footer = () => (
    <View style={styles.footer} fixed>
      <View style={[styles.footerRuleAccent, { borderTopColor: f.accentColor }]} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 4 }}>
        {bodies.map((b) => LOGO_MAP[b] ? <Image key={b} style={styles.footerLogo} src={LOGO_MAP[b]!} /> : null)}
      </View>
      <Text style={styles.footerStrong}>{footerTitle}</Text>
      <Text style={styles.footerTxt}>Registered in England and Wales, Company Registration No: {f.companyNumber}</Text>
      <Text style={styles.footerTxt}>{f.address}, {f.city}, {f.postcode}</Text>
      <Text style={styles.footerTxt}>t: {f.footerTel}  |  m: {f.footerMobile}  |  {f.email}  |  {f.website}</Text>
    </View>
  );

  return (
    <Document title={`Change of Accountants — ${d.clientName}`} author={f.legalName}>
      <Page size="A4" style={styles.page}>
        <Header />
        <Footer />

        <Text style={styles.kicker}>CLIENT AUTHORITY · PRIVATE &amp; CONFIDENTIAL</Text>
        <Text style={styles.title}>Change of Accountants</Text>
        <Text style={[styles.meta, { textAlign: 'right' }]}>Date: {d.today}</Text>

        {/* Outgoing accountant address block */}
        <View style={{ marginTop: 10, marginBottom: 12 }}>
          <Text style={styles.lbl}>OUTGOING ACCOUNTANTS</Text>
          {d.prevFirmContact ? <Text style={styles.addr}>{d.prevFirmContact}</Text> : null}
          <Text style={[styles.addr, { fontFamily: 'Noto', fontWeight: 'bold' }]}>{d.prevFirmName}</Text>
          {d.prevFirmAddress ? <Text style={styles.addr}>{d.prevFirmAddress}</Text> : null}
        </View>

        <Text>Dear Sir/Madam,</Text>
        <Text style={styles.re}>Re: Change of Accountants{d.clientName ? ` — ${clientLabel}` : ''}</Text>

        <Text style={styles.p}>
          I am writing to formally notify you that I have appointed {f.legalName} as my new accountant
          and tax advisor with immediate effect.
        </Text>
        <Text style={styles.p}>
          Please take this letter as my authority for you to release all my personal and business
          accounting, tax and payroll records to {f.legalName}.
        </Text>
        <Text style={styles.p}>
          Please provide {f.legalName} with the necessary paperwork at your earliest convenience.
        </Text>

        <View style={[styles.panel, { borderTopColor: f.accentColor }]}>
          <Text style={styles.lbl}>NEW ACCOUNTANT CONTACT DETAILS</Text>
          <Text style={[styles.addr, { fontFamily: 'Noto', fontWeight: 'bold' }]}>{f.legalName}</Text>
          <Text style={styles.addr}>{advisers}</Text>
          <Text style={styles.addr}>{f.address}, {f.city}, {f.postcode}</Text>
          <Text style={styles.addr}>Email: {f.email}</Text>
          <Text style={styles.addr}>Tel: {f.footerTel}{f.footerMobile ? `, ${f.footerMobile}` : ''}</Text>
        </View>

        <Text style={styles.p}>I appreciate your cooperation in this regard.</Text>
        <Text style={styles.p}>If you require any further confirmation, please let me know.</Text>

        <Text style={{ marginTop: 6 }}>Kind regards,</Text>

        <Text style={styles.sigScript}>{d.directorName ?? ''}</Text>
        <View style={styles.sigLine} />
        <Text style={styles.sigK}>Name: {d.directorName ?? ''}</Text>
        {d.clientName ? <Text style={styles.sigK}>For and on behalf of {clientLabel}</Text> : null}
        <Text style={styles.sigK}>Date: {d.today}</Text>
      </Page>
    </Document>
  );
}

export async function buildAuthorityLetterPdf(input: AuthorityLetterInput): Promise<Buffer> {
  ensureFont();
  return renderToBuffer(authorityDoc(input));
}

export function authorityLetterFilename(clientName: string): string {
  const safe = (clientName || 'Client').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
  return `Change-of-Accountants-Authority-${safe}.pdf`;
}
