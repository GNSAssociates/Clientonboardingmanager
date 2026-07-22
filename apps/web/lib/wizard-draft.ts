// Client-side helpers for autosaving and resuming the onboarding wizard.
// A draft is a real onboarding_links row (status "draft"); the token is carried
// in the URL (?draft=<token>) so a refresh or a dashboard "Resume" click picks
// up exactly where the staff member left off — including the fee section.

export interface WizardDraftState {
  token?: string | null;
  firmSlug: string;
  step?: string;
  companyNumber?: string;
  companyName?: string;
  directorName?: string;
  directorEmail?: string;
  services?: Array<{ id: string; name: string; price: number; oneoff?: boolean }>;
  prices?: Record<string, number>;
  selectedOneoff?: string[];
  customFees?: Array<{ title?: string; description: string; price: number; frequency?: string }>;
  scopeRows?: Array<{ service: string; threshold: string; excess: string }> | null;
  partnerName?: string | null;
  sendMode?: string | null;
  regBody?: string | null;
  ch?: Record<string, unknown> | null;
  frequencies?: Record<string, string>;
  paymentMethod?: string;
  includeInLetter?: Record<string, boolean>;
  includeAnnexA?: boolean;
  softwareItems?: Array<{ name: string; price: number }>;
  clientType?: string;
  clientName?: string;
  businessAddress?: string;
  oneoffScopes?: Record<string, string>;
  utr?: string;
}

export interface LoadedWizardDraft extends WizardDraftState {
  token: string;
  status: string;
  savedAt: string | null;
}

/** Upsert the wizard draft. Returns the server-assigned token (or null on failure). */
export async function saveWizardDraft(state: WizardDraftState): Promise<string | null> {
  try {
    const res = await fetch("/api/onboarding/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { token?: string };
    return data.token ?? null;
  } catch {
    return null;
  }
}

/** Load a saved draft for resume. Returns null if not found / not a draft. */
export async function loadWizardDraft(token: string): Promise<LoadedWizardDraft | null> {
  try {
    const res = await fetch(`/api/onboarding/drafts/${token}`);
    if (!res.ok) return null;
    return (await res.json()) as LoadedWizardDraft;
  } catch {
    return null;
  }
}
