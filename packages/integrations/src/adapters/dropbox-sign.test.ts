import { describe, it, expect } from "vitest";
import { dropboxSignStubAdapter } from "./dropbox-sign.stub";

describe("dropboxSignStubAdapter", () => {
  it('reports provider as "dropbox_sign"', () => {
    expect(dropboxSignStubAdapter.provider).toBe("dropbox_sign");
  });

  it("createEnvelope returns a stub envelopeId when no API key set", async () => {
    delete process.env["DROPBOX_SIGN_API_KEY"];
    const result = await dropboxSignStubAdapter.createEnvelope({
      documentUrl: "http://localhost/doc.html",
      signers: [{ name: "Alice", email: "alice@example.com" }],
    });
    expect(typeof result.envelopeId).toBe("string");
    expect(result.envelopeId.startsWith("stub-")).toBe(true);
  });

  it("void resolves without throwing", async () => {
    await expect(dropboxSignStubAdapter.void("any-ref")).resolves.toBeUndefined();
  });
});
