import { describe, expect, it } from "vitest";

/**
 * M3 unit tests — deterministic gap analysis logic.
 * No DB, no Anthropic API — pure data transformation tests.
 */

describe("Gap analysis logic (deterministic, FR-AI-3 precondition)", () => {
  type ChecklistItem = { id: string; required: boolean; status: string };

  function computeGaps(checklist: ChecklistItem[], linkedDocIds: Set<string>) {
    const blocking: string[] = [];
    const nonBlocking: string[] = [];
    for (const item of checklist) {
      const satisfied =
        item.status === "received" ||
        item.status === "verified" ||
        item.status === "na" ||
        linkedDocIds.has(item.id);
      if (!satisfied) {
        if (item.required) blocking.push(item.id);
        else nonBlocking.push(item.id);
      }
    }
    return { blocking, nonBlocking, allDocumentsReceived: blocking.length === 0 };
  }

  it("returns no blocking gaps when all required items are satisfied", () => {
    const checklist: ChecklistItem[] = [
      { id: "a", required: true, status: "verified" },
      { id: "b", required: true, status: "received" },
      { id: "c", required: false, status: "pending" },
    ];
    const result = computeGaps(checklist, new Set());
    expect(result.blocking).toHaveLength(0);
    expect(result.nonBlocking).toHaveLength(1);
    expect(result.allDocumentsReceived).toBe(true);
  });

  it("marks required pending items as blocking", () => {
    const checklist: ChecklistItem[] = [
      { id: "x", required: true, status: "pending" },
      { id: "y", required: true, status: "verified" },
    ];
    const result = computeGaps(checklist, new Set());
    expect(result.blocking).toEqual(["x"]);
    expect(result.allDocumentsReceived).toBe(false);
  });

  it("satisfies a pending item via linked document", () => {
    const checklist: ChecklistItem[] = [{ id: "doc1", required: true, status: "pending" }];
    const result = computeGaps(checklist, new Set(["doc1"]));
    expect(result.blocking).toHaveLength(0);
    expect(result.allDocumentsReceived).toBe(true);
  });

  it("treats na items as satisfied", () => {
    const checklist: ChecklistItem[] = [{ id: "opt", required: true, status: "na" }];
    const result = computeGaps(checklist, new Set());
    expect(result.blocking).toHaveLength(0);
  });

  it("returns both blocking and non-blocking gaps correctly", () => {
    const checklist: ChecklistItem[] = [
      { id: "r1", required: true, status: "pending" },
      { id: "r2", required: true, status: "received" },
      { id: "o1", required: false, status: "pending" },
      { id: "o2", required: false, status: "verified" },
    ];
    const result = computeGaps(checklist, new Set());
    expect(result.blocking).toEqual(["r1"]);
    expect(result.nonBlocking).toEqual(["o1"]);
    expect(result.allDocumentsReceived).toBe(false);
  });

  it("empty checklist means all received", () => {
    const result = computeGaps([], new Set());
    expect(result.allDocumentsReceived).toBe(true);
    expect(result.blocking).toHaveLength(0);
  });
});
