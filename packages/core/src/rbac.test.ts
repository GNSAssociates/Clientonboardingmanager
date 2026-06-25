import { describe, expect, it } from "vitest";
import { authorize, can } from "./rbac";
import { ForbiddenError } from "./errors";
import type { AuthSession } from "./auth";

const session = (roles: AuthSession["roles"], extra: Partial<AuthSession> = {}): AuthSession => ({
  userId: "u1",
  roles,
  entityIds: ["e1"],
  isAdmin: roles.includes("Admin"),
  ...extra,
});

describe("RBAC (PRD §7.2)", () => {
  it("Admin holds every capability", () => {
    const s = session(["Admin"]);
    expect(can(s, "configure_entities")).toBe(true);
    expect(can(s, "manage_retention")).toBe(true);
  });

  it("Client cannot configure entities or perform CDD", () => {
    const s = session(["Client"], { entityIds: [], clientId: "c1" });
    expect(can(s, "configure_entities")).toBe(false);
    expect(can(s, "perform_cdd")).toBe(false);
    expect(can(s, "upload_documents")).toBe(true);
  });

  it("Reviewer can conduct reviews but not sign off compliance", () => {
    const s = session(["Reviewer"]);
    expect(can(s, "conduct_review")).toBe(true);
    expect(can(s, "approve_ai_compliance")).toBe(false);
  });

  it("ComplianceOfficer signs off compliance, OnboardingStaff does not", () => {
    expect(can(session(["ComplianceOfficer"]), "approve_ai_compliance")).toBe(true);
    expect(can(session(["OnboardingStaff"]), "approve_ai_compliance")).toBe(false);
  });

  it("authorize throws ForbiddenError when capability is missing", () => {
    expect(() => authorize(session(["OnboardingStaff"]), "configure_entities")).toThrow(
      ForbiddenError,
    );
  });
});
