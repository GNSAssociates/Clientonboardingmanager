/**
 * ONE definition of what a set of services costs.
 *
 * Every screen used to work this out for itself, and they disagreed. The staff
 * client list summed `price` straight across the services array — ignoring
 * `frequency`, so an annual £50 Confirmation Statement was reported as £50 a
 * MONTH, and ignoring `chFee`, so the Companies House disbursement vanished
 * from every figure staff saw. The letter, meanwhile, did both correctly. Two
 * screens, two answers, one client asking which is right.
 *
 * Anything that shows a fee should call this. Nothing should add up a services
 * array by hand.
 *
 * The VAT rule is not a formatting choice: our fees are VATable, the Companies
 * House fee is a disbursement paid on the client's behalf and carries no VAT.
 * It is kept in its own field for exactly that reason — never folded into the
 * others, never multiplied by 1.2.
 */

export type FeeFrequency = 'monthly' | 'quarterly' | 'annually';

export interface FeeService {
  name?: string;
  price: number;
  oneoff?: boolean;
  frequency?: string;
  /** Companies House disbursement carried by this service (annual, no VAT). */
  chFee?: number;
}

export interface FeeTotals {
  /** Our recurring fee expressed monthly, excluding VAT and CH fees. */
  monthly: number;
  /** Our recurring fee expressed annually, excluding VAT and CH fees. */
  annual: number;
  /** One-off / ad-hoc fees, excluding VAT. */
  oneoff: number;
  /** Companies House disbursements per year. NO VAT applies to these. */
  chAnnual: number;
  /** VAT on our recurring annual fee only. */
  vatOnAnnual: number;
  /** What the client actually pays in a year: fee + VAT + CH disbursements. */
  annualPayable: number;
}

export const VAT_RATE = 0.2;

export function toMonthly(price: number, freq?: string): number {
  if (freq === 'annually') return price / 12;
  if (freq === 'quarterly') return price / 3;
  return price;
}

export function toAnnual(price: number, freq?: string): number {
  if (freq === 'annually') return price;
  if (freq === 'quarterly') return price * 4;
  return price * 12;
}

export function feeTotals(services: FeeService[] | null | undefined): FeeTotals {
  const list = services ?? [];
  const recurring = list.filter((s) => !s.oneoff);

  const monthly = recurring.reduce((t, s) => t + toMonthly(s.price || 0, s.frequency), 0);
  const annual = recurring.reduce((t, s) => t + toAnnual(s.price || 0, s.frequency), 0);
  const oneoff = list.filter((s) => s.oneoff).reduce((t, s) => t + (s.price || 0), 0);
  // Carried by recurring AND one-off services — a CH fee on an ad-hoc filing is
  // still a CH fee, and dropping it here is how it disappeared from the quote.
  const chAnnual = list.reduce((t, s) => t + (s.chFee || 0), 0);
  const vatOnAnnual = annual * VAT_RATE;

  return {
    monthly,
    annual,
    oneoff,
    chAnnual,
    vatOnAnnual,
    annualPayable: annual + vatOnAnnual + chAnnual,
  };
}

/** "£1,234.56" — one money format, so screens can't drift apart on that either. */
export function gbp(n: number): string {
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
