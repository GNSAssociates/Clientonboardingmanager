import type { DocExtraction } from "@gns/core";

/**
 * Azure Document Intelligence stub (M3).
 * Returns plausible extracted fields based on mime type so the rest of the
 * pipeline can be exercised without a live Azure endpoint.
 * Swap for the real AzureDocExtractionAdapter in M5 by registering a
 * different adapter behind the DocExtraction port.
 */
export const stubDocExtractionAdapter: DocExtraction = {
  provider: "azure-stub",

  async extract(input) {
    const { mime } = input;

    if (mime.startsWith("image/") || mime === "application/pdf") {
      return {
        fields: {
          documentType: "unknown",
          extractedText: "[stub] text extraction not available in dev mode",
          pageCount: 1,
          confidence: 0.5,
        },
      };
    }

    return { fields: {} };
  },
};
