/* eslint-disable jsx-a11y/alt-text */
/**
 * Client Authority (Change of Accountants) letter → real PDF.
 *
 * This is the letter FROM the client authorising the OUTGOING accountant to
 * release their records to us. It is auto-generated (pre-filled with the client,
 * GNS and previous-accountant details) and attached alongside the professional
 * clearance letter on the first email to the previous accountant.
 *
 * Deliberately rendered on PLAIN PAPER — no GNS logo, accent colour, regulator
 * badges or firm footer. The letter is written and signed by the client, so it
 * carries the client's own name, company number and address as the sender;
 * dressing it in our letterhead would misrepresent its author to the outgoing
 * accountant. Our details appear only in the "my new accountants" panel, which
 * is what the recipient needs in order to send the records on.
 *
 * Built with @react-pdf/renderer so it runs on the cPanel standalone build
 * with no browser.
 */
import React from 'react';
// @ts-ignore — no type declarations for the internal path (build ignores TS errors)
import { Document, Page, View, Text, StyleSheet, Font, renderToBuffer } from '@react-pdf/renderer/lib/react-pdf.js';
import type { FirmConfig } from './firms';
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

// Plain-paper styling. This letter is FROM THE CLIENT, so it deliberately
// carries no GNS logo, accent colour, regulator badges or firm footer — it
// must read as the client's own correspondence on blank paper, with their
// name and address as the sender. (Putting our letterhead on a letter the
// client signs would misrepresent who wrote it.)
const styles = StyleSheet.create({
  page: { paddingTop: 46, paddingBottom: 40, paddingHorizontal: 56, fontFamily: 'Noto', fontSize: 10.5, color: '#111111', lineHeight: 1.5 },
  senderBlock: { marginBottom: 18 },
  senderName: { fontSize: 12, fontFamily: 'Noto', fontWeight: 'bold', color: '#111111', marginBottom: 2 },
  senderLine: { fontSize: 10, color: '#333333', marginBottom: 0.5 },
  meta: { fontSize: 10.5, color: '#111111', marginBottom: 2 },
  addr: { fontSize: 10.5, marginBottom: 0.5 },
  re: { fontFamily: 'Noto', fontWeight: 'bold', fontSize: 10.5, marginTop: 12, marginBottom: 9 },
  p: { marginBottom: 9 },
  panel: { borderWidth: 0.75, borderColor: '#999999', padding: 11, marginTop: 2, marginBottom: 12 },
  lbl: { fontSize: 8, letterSpacing: 1, color: '#555555', fontFamily: 'Noto', fontWeight: 'bold', marginBottom: 4 },
  // The handwriting face is tall with long descenders, so it needs an explicit
  // line box and clear space beneath — otherwise it collides with the printed
  // name on the line below.
  sigScript: { fontFamily: 'Signature', fontSize: 26, lineHeight: 1.15, color: '#1a3fa0', marginTop: 10, marginBottom: 8 },
  sigLine: { width: 220, borderTopWidth: 0.75, borderTopColor: '#666666', marginBottom: 5 },
  sigK: { fontSize: 9.5, color: '#111111', marginBottom: 2 },
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
  const tagline = f.regBody === 'ICAEW' ? 'Chartered Accountants' : 'Chartered Certified Accountants';
  const advisers = bodies.includes('CIOT') ? 'Chartered Accountants & Chartered Tax Advisers' : tagline;
  const clientLabel = `${d.clientName}${d.companyNumber ? ` (Company No. ${d.companyNumber})` : ''}`;
  // Address may arrive as a single comma-joined string; split so it reads as a
  // normal stacked sender address block.
  const clientAddressLines = (d.clientAddress ?? '')
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    // Authored by the client, so the PDF metadata names them, not us.
    <Document title={`Change of Accountants — ${d.clientName}`} author={d.clientName || d.directorName || 'Client'}>
      <Page size="A4" style={styles.page}>

        {/* Sender = the CLIENT. Plain paper, no firm letterhead. */}
        <View style={styles.senderBlock}>
          <Text style={styles.senderName}>{d.clientName}</Text>
          {d.companyNumber ? <Text style={styles.senderLine}>Company No. {d.companyNumber}</Text> : null}
          {clientAddressLines.map((line, i) => (
            <Text key={i} style={styles.senderLine}>{line}</Text>
          ))}
        </View>

        <Text style={[styles.meta, { marginBottom: 18 }]}>{d.today}</Text>

        {/* Recipient: the outgoing accountant */}
        <View style={{ marginBottom: 18 }}>
          {d.prevFirmContact ? <Text style={styles.addr}>{d.prevFirmContact}</Text> : null}
          <Text style={styles.addr}>{d.prevFirmName}</Text>
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

        <View style={styles.panel}>
          <Text style={styles.lbl}>MY NEW ACCOUNTANTS</Text>
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
        <Text style={styles.sigK}>{d.directorName ?? ''}</Text>
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
