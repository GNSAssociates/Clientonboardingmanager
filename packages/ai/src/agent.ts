import type { z } from "zod";
import type { AgentName } from "@gns/config";

/**
 * Agent framework contract (A2 §6, FR-AI-1..4). Each of the 8 agents is a
 * declarative `AgentDefinition`: typed Zod I/O (enforced via Claude tool-use),
 * a model tier, deterministic validators, a confidence policy and a HITL policy.
 * The runner (added in M8) executes the LLM call, runs validators, computes
 * confidence and routes low-confidence/compliance outputs to the approval queue.
 */
export type ModelTier = "fast" | "complex";

export interface ConfidencePolicy {
  /** Auto-accept threshold; below this routes to HITL (A2 §6). */
  threshold: number;
}

export type HitlPolicy =
  | { kind: "never" }
  | { kind: "always"; assignedRole: string }
  | { kind: "first_then_auto"; assignedRole: string }
  | { kind: "below_threshold"; assignedRole: string };

export interface AgentValidator<O> {
  name: string;
  /** Return true if valid, or a string describing the conflict (lowers confidence). */
  validate: (output: O) => true | string;
}

export interface AgentDefinition<I extends z.ZodTypeAny, O extends z.ZodTypeAny> {
  name: AgentName;
  objective: string;
  model: ModelTier;
  input: I;
  output: O;
  prompt: string;
  validators: AgentValidator<z.infer<O>>[];
  confidence: ConfidencePolicy;
  hitl: HitlPolicy;
}

export function defineAgent<I extends z.ZodTypeAny, O extends z.ZodTypeAny>(
  def: AgentDefinition<I, O>,
): AgentDefinition<I, O> {
  return def;
}
