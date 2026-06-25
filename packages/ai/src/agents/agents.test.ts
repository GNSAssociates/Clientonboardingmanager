import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIDENCE_THRESHOLD } from "@gns/config";
import { documentClassifierAgent } from "./classifier";
import { missingInfoDetectorAgent } from "./missing-info";

/**
 * M3 agent definition tests (FR-AI-2, FR-AI-3).
 * Validates contract — no Claude API call, no DB.
 */

describe("DocumentClassifier agent definition (FR-AI-2)", () => {
  it("has the correct agent name", () => {
    expect(documentClassifierAgent.name).toBe("document_classifier");
  });

  it("uses fast model tier (Haiku) for cost efficiency", () => {
    expect(documentClassifierAgent.model).toBe("fast");
  });

  it("threshold matches the platform default", () => {
    expect(documentClassifierAgent.confidence.threshold).toBe(DEFAULT_CONFIDENCE_THRESHOLD);
  });

  it("HITL policy routes below-threshold outputs to Reviewer", () => {
    expect(documentClassifierAgent.hitl.kind).toBe("below_threshold");
    if (documentClassifierAgent.hitl.kind === "below_threshold") {
      expect(documentClassifierAgent.hitl.assignedRole).toBe("Reviewer");
    }
  });

  it("confidence-range validator accepts in-range values", () => {
    const v = documentClassifierAgent.validators.find((x) => x.name === "confidence-range");
    expect(v).toBeDefined();
    expect(
      v!.validate({ category: "other", confidence: 0.9, reasoning: "ok", needsReview: false }),
    ).toBe(true);
  });

  it("confidence-range validator rejects out-of-range values", () => {
    const v = documentClassifierAgent.validators.find((x) => x.name === "confidence-range");
    expect(
      v!.validate({ category: "other", confidence: 1.5, reasoning: "bad", needsReview: false }),
    ).not.toBe(true);
    expect(
      v!.validate({ category: "other", confidence: -0.1, reasoning: "bad", needsReview: false }),
    ).not.toBe(true);
  });

  it("needsReview validator matches low confidence to true flag", () => {
    const v = documentClassifierAgent.validators.find(
      (x) => x.name === "needs-review-matches-threshold",
    );
    expect(v).toBeDefined();

    // high confidence → needsReview false → valid
    expect(
      v!.validate({ category: "id_document", confidence: 0.9, reasoning: "clear", needsReview: false }),
    ).toBe(true);

    // low confidence → needsReview true → valid
    expect(
      v!.validate({ category: "other", confidence: 0.7, reasoning: "unclear", needsReview: true }),
    ).toBe(true);

    // low confidence + needsReview false → invalid
    expect(
      v!.validate({ category: "other", confidence: 0.7, reasoning: "unclear", needsReview: false }),
    ).not.toBe(true);
  });

  it("input schema validates correctly", () => {
    const valid = documentClassifierAgent.input.safeParse({
      documentId: "00000000-0000-4000-8000-000000000001",
      label: "John Smith Passport",
      mimeType: "application/pdf",
    });
    expect(valid.success).toBe(true);

    const invalid = documentClassifierAgent.input.safeParse({ label: "missing uuid" });
    expect(invalid.success).toBe(false);
  });

  it("output schema validates a correct classifier output", () => {
    const valid = documentClassifierAgent.output.safeParse({
      category: "id_document",
      confidence: 0.95,
      reasoning: "Passport clearly visible",
      needsReview: false,
    });
    expect(valid.success).toBe(true);
  });
});

describe("MissingInfoDetector agent definition (FR-AI-3)", () => {
  it("has the correct agent name", () => {
    expect(missingInfoDetectorAgent.name).toBe("missing_info_detector");
  });

  it("never requires HITL (output is advisory)", () => {
    expect(missingInfoDetectorAgent.hitl.kind).toBe("never");
  });

  it("uses fast model tier", () => {
    expect(missingInfoDetectorAgent.model).toBe("fast");
  });

  it("threshold is 0 (always auto-accept)", () => {
    expect(missingInfoDetectorAgent.confidence.threshold).toBe(0.0);
  });

  it("output schema validates a correct missing-info output", () => {
    const valid = missingInfoDetectorAgent.output.safeParse({
      blocking: [{ checklistKey: "photo_id", label: "Photo ID", reason: "Not uploaded" }],
      nonBlocking: [],
      suggestions: ["The uploaded 'other' document may be an ID document"],
      allDocumentsReceived: false,
      confidence: 0.9,
    });
    expect(valid.success).toBe(true);
  });
});
