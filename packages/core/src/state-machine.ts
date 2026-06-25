import { CASE_STATUSES, type CaseStatus } from "@gns/config";
import { IllegalTransitionError } from "./errors";

/**
 * Onboarding state machine (A2 §5, FR-WF-1, PRD §11).
 *
 * The authoritative, deterministic transition graph. n8n/agents may *suggest*
 * a transition but every actual change is validated here, so the diagrams in A5
 * and the running system stay in lock-step. Side-states (on_hold/blocked/etc.)
 * are modelled on `substatus` and handled separately.
 *
 * M0 seeds the linear happy-path adjacency; richer guards (entity rules, gate
 * checks like CDD sign-off) are layered on in M2/M5 via `TransitionGuard`s.
 */
const LINEAR_ORDER: CaseStatus[] = [...CASE_STATUSES];

const ALLOWED: Record<CaseStatus, CaseStatus[]> = LINEAR_ORDER.reduce(
  (acc, status, idx) => {
    const next = LINEAR_ORDER[idx + 1];
    acc[status] = next ? [next] : [];
    return acc;
  },
  {} as Record<CaseStatus, CaseStatus[]>,
);

export interface TransitionContext {
  /** Gate predicates evaluated by domain modules (e.g. cddSignedOff). */
  readonly gates?: Record<string, boolean>;
}

export type TransitionGuard = (ctx: TransitionContext) => true | string;

/** Pure check: is `to` reachable from `from` in the adjacency graph? */
export function canTransition(from: CaseStatus, to: CaseStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

/**
 * Assert a transition is legal, running any provided guards. Throws
 * IllegalTransitionError on failure (mapped to HTTP 409 at the API boundary).
 */
export function assertTransition(
  from: CaseStatus,
  to: CaseStatus,
  ctx: TransitionContext = {},
  guards: TransitionGuard[] = [],
): void {
  if (!canTransition(from, to)) throw new IllegalTransitionError(from, to);
  for (const guard of guards) {
    const result = guard(ctx);
    if (result !== true) throw new IllegalTransitionError(from, `${to} (${result})`);
  }
}

export { ALLOWED as TRANSITIONS };
