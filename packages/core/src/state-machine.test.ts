import { describe, expect, it } from "vitest";
import { CASE_STATUSES } from "@gns/config";
import { assertTransition, canTransition } from "./state-machine";
import { IllegalTransitionError } from "./errors";

describe("onboarding state machine (FR-WF-1)", () => {
  it("allows the linear happy-path transition", () => {
    expect(canTransition("lead", "service_selection")).toBe(true);
    expect(canTransition("engagement_signed", "clearance_requested")).toBe(true);
  });

  it("rejects skipping a state", () => {
    expect(canTransition("lead", "engagement_signed")).toBe(false);
  });

  it("rejects backwards transitions", () => {
    expect(canTransition("pricing_agreed", "lead")).toBe(false);
  });

  it("throws IllegalTransitionError on an illegal move", () => {
    expect(() => assertTransition("lead", "completed")).toThrow(IllegalTransitionError);
  });

  it("permits the full onboarding lifecycle chain end-to-end", () => {
    for (let i = 0; i < CASE_STATUSES.length - 1; i++) {
      const from = CASE_STATUSES[i]!;
      const to = CASE_STATUSES[i + 1]!;
      expect(canTransition(from, to)).toBe(true);
    }
    // lead must not jump straight to completed
    expect(canTransition("lead", "completed")).toBe(false);
  });

  it("runs guards and blocks when a gate fails", () => {
    const guard = (ctx: { gates?: Record<string, boolean> }) =>
      ctx.gates?.cddSignedOff ? true : "cdd sign-off required";
    expect(() =>
      assertTransition("tasks_created", "completed", { gates: { cddSignedOff: false } }, [guard]),
    ).toThrow(IllegalTransitionError);
    expect(() =>
      assertTransition("tasks_created", "completed", { gates: { cddSignedOff: true } }, [guard]),
    ).not.toThrow();
  });
});
