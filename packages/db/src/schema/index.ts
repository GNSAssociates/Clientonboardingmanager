/**
 * Schema barrel — drizzle-kit reads this to build migrations (A3 §8).
 * M0 — cross-cutting foundation (tenancy + audit + outbox).
 * M2 — client master, services/pricing, onboarding cases, checklist, tasks.
 * Further domain tables (documents, compliance, reviews, AI, comms) follow in
 * their respective modules.
 */
export * from "./enums";
export * from "./tenancy";
export * from "./platform";
export * from "./clients";
export * from "./cases";
export * from "./services";
export * from "./tasks";
