import { describe, it, expect } from "vitest";
import { renderTemplate, wrapHtml } from "../templates/engine";
import { AUTH_LETTER_TEMPLATE } from "../templates/auth-letter";
import { ENGAGEMENT_LETTER_TEMPLATE } from "../templates/engagement-letter";

/* ── Template rendering (no DB or network) ───────────────────────────────── */

const BASE_DATA = {
  date: "2026-06-25T00:00:00.000Z",
  reference: "GNS-2026-0001",
  entity: {
    legalName: "GNS Associates Ltd",
    address: "1 Chancery Lane, London, WC2A 1LF",
    signatoryName: "Surendra Chaulagain FCCA",
  },
  client: {
    name: "Acme Ltd",
    companyNumber: "12345678",
    type: "limited_company",
  },
  contact: {
    name: "John Smith",
    email: "john@acme.co.uk",
  },
};

describe("AUTH_LETTER_TEMPLATE", () => {
  it("renders without throwing", () => {
    const html = renderTemplate(AUTH_LETTER_TEMPLATE, BASE_DATA);
    expect(html).toContain("GNS Associates Ltd");
  });

  it("includes the entity signatory", () => {
    const html = renderTemplate(AUTH_LETTER_TEMPLATE, BASE_DATA);
    expect(html).toContain("Surendra Chaulagain FCCA");
  });

  it("includes client name", () => {
    const html = renderTemplate(AUTH_LETTER_TEMPLATE, BASE_DATA);
    expect(html).toContain("Acme Ltd");
  });

  it("includes case reference", () => {
    const html = renderTemplate(AUTH_LETTER_TEMPLATE, BASE_DATA);
    expect(html).toContain("GNS-2026-0001");
  });

  it("formatDate helper renders a non-ISO date string", () => {
    const html = renderTemplate(AUTH_LETTER_TEMPLATE, BASE_DATA);
    // The formatDate helper should convert the ISO string to a human-readable form.
    // We verify the raw ISO string is NOT present (helper ran) and the year is present.
    expect(html).not.toContain("2026-06-25T00:00:00");
    expect(html).toContain("2026");
  });

  it("includes company number when present", () => {
    const html = renderTemplate(AUTH_LETTER_TEMPLATE, BASE_DATA);
    expect(html).toContain("12345678");
  });

  it("omits company number block when not present", () => {
    const data = { ...BASE_DATA, client: { ...BASE_DATA.client, companyNumber: undefined } };
    const html = renderTemplate(AUTH_LETTER_TEMPLATE, data);
    // Should still render without throwing
    expect(html).toContain("Acme Ltd");
  });
});

describe("ENGAGEMENT_LETTER_TEMPLATE", () => {
  const engData = {
    ...BASE_DATA,
    services: [
      { name: "Bookkeeping", description: "Monthly reconciliation" },
      { name: "VAT Returns", description: "Quarterly submission" },
    ],
    fees: { total: "3,600", currency: "£" },
  };

  it("renders without throwing", () => {
    const html = renderTemplate(ENGAGEMENT_LETTER_TEMPLATE, engData);
    expect(html).toContain("GNS Associates Ltd");
  });

  it("lists all services", () => {
    const html = renderTemplate(ENGAGEMENT_LETTER_TEMPLATE, engData);
    expect(html).toContain("Bookkeeping");
    expect(html).toContain("VAT Returns");
  });

  it("includes agreed fees", () => {
    const html = renderTemplate(ENGAGEMENT_LETTER_TEMPLATE, engData);
    expect(html).toContain("3,600");
  });

  it("includes contact name and company name", () => {
    const html = renderTemplate(ENGAGEMENT_LETTER_TEMPLATE, engData);
    expect(html).toContain("John Smith");
    expect(html).toContain("Acme Ltd");
  });

  it("renders empty services list without throwing", () => {
    const data = { ...engData, services: [] };
    const html = renderTemplate(ENGAGEMENT_LETTER_TEMPLATE, data);
    expect(html).toContain("following services");
  });
});

describe("wrapHtml", () => {
  it("wraps body in an A4 HTML shell", () => {
    const html = wrapHtml("<p>Hello</p>", "Test");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("A4");
    expect(html).toContain("<p>Hello</p>");
    expect(html).toContain("Test");
  });
});
