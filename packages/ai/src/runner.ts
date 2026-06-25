import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import type { AgentDefinition } from "./agent";

const MODEL_MAP: Record<"fast" | "complex", string> = {
  fast: "claude-haiku-4-5-20251001",
  complex: "claude-opus-4-8",
};

/**
 * Agent run result returned to callers.
 */
export interface AgentRunResult<O> {
  output: O;
  confidence: number;
  needsHumanReview: boolean;
  rawResponse?: unknown;
}

let _client: Anthropic | undefined;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({
      apiKey: process.env["ANTHROPIC_API_KEY"],
    });
  }
  return _client;
}

/**
 * Run an agent against the Claude API using tool-use for structured output.
 * Applies all validators and computes the final confidence.
 * Throws if the API key is missing in production; returns a stub in dev/test.
 */
export async function runAgent<I extends z.ZodTypeAny, O extends z.ZodTypeAny>(
  agent: AgentDefinition<I, O>,
  rawInput: z.input<I>,
): Promise<AgentRunResult<z.infer<O>>> {
  // Validate input
  const input = agent.input.parse(rawInput) as z.infer<I>;

  // In dev/test mode with no API key, return a labelled stub response
  if (!process.env["ANTHROPIC_API_KEY"]) {
    return buildStubResult(agent, input);
  }

  const client = getClient();
  const model = MODEL_MAP[agent.model];

  // Build the tool-use tool from the agent's output schema
  const outputTool: Anthropic.Messages.Tool = {
    name: "structured_output",
    description: "Return the structured result for this agent task.",
    input_schema: zodToJsonSchema(agent.output) as Anthropic.Messages.Tool["input_schema"],
  };

  const systemPrompt = `${agent.prompt}\n\nYou MUST call the structured_output tool with your response.`;
  const userMessage = `Input data:\n${JSON.stringify(input, null, 2)}`;

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    tools: [outputTool],
    tool_choice: { type: "any" },
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  // Extract tool-use block
  const toolUse = response.content.find((b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) {
    throw new Error(`Agent ${agent.name}: model did not call structured_output tool`);
  }

  // Parse and validate output
  const output = agent.output.parse(toolUse.input) as z.infer<O>;

  // Run deterministic validators — each failure docks confidence by 0.1
  let confidence = (output as Record<string, unknown>)["confidence"] as number | undefined ?? 1.0;
  for (const validator of agent.validators) {
    const result = validator.validate(output);
    if (result !== true) {
      confidence = Math.max(0, confidence - 0.1);
    }
  }

  const needsHumanReview =
    agent.hitl.kind !== "never" && confidence < agent.confidence.threshold;

  return { output, confidence, needsHumanReview, rawResponse: response };
}

/**
 * Returns a clearly-labelled stub so the pipeline runs end-to-end in dev
 * without real API calls. Output values are typed-correct but semantically
 * meaningless — a real API key will override this path in production.
 */
function buildStubResult<I extends z.ZodTypeAny, O extends z.ZodTypeAny>(
  agent: AgentDefinition<I, O>,
  _input: z.infer<I>,
): AgentRunResult<z.infer<O>> {
  const stubValues = buildStubOutput(agent.output);
  return {
    output: stubValues,
    confidence: 0.5,
    needsHumanReview: true,
    rawResponse: { stub: true },
  };
}

/** Build a minimally-valid stub that satisfies the Zod output schema. */
function buildStubOutput(schema: z.ZodTypeAny): unknown {
  const shape = (schema as z.AnyZodObject)._def?.shape?.();
  if (!shape) {
    // fallback for non-object schemas
    return {};
  }
  const result: Record<string, unknown> = {};
  for (const [key, fieldSchema] of Object.entries(shape)) {
    const fs = fieldSchema as z.ZodTypeAny;
    const def = fs._def as { typeName: string; defaultValue?: () => unknown; options?: unknown[] };
    if (def.defaultValue) {
      result[key] = def.defaultValue();
    } else if (def.typeName === "ZodString") {
      result[key] = "[stub]";
    } else if (def.typeName === "ZodNumber") {
      result[key] = 0.5;
    } else if (def.typeName === "ZodBoolean") {
      result[key] = true;
    } else if (def.typeName === "ZodArray") {
      result[key] = [];
    } else if (def.typeName === "ZodEnum" && def.options && (def.options as string[]).length > 0) {
      result[key] = (def.options as string[])[0];
    } else if (def.typeName === "ZodOptional") {
      result[key] = undefined;
    } else {
      result[key] = null;
    }
  }
  return result;
}

/**
 * Minimal Zod → JSON Schema converter for the subset of shapes used in agent I/O.
 * Production-grade conversion is handled by `zod-to-json-schema` (add in M8).
 */
function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const shape = (schema as z.AnyZodObject)._def?.shape?.();
  if (!shape) return { type: "object" };

  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, fieldSchema] of Object.entries(shape)) {
    const fs = fieldSchema as z.ZodTypeAny;
    properties[key] = zodFieldToJsonSchema(fs);
    const def = fs._def as { typeName: string };
    if (def.typeName !== "ZodOptional") {
      required.push(key);
    }
  }

  return { type: "object", properties, required };
}

function zodFieldToJsonSchema(fs: z.ZodTypeAny): Record<string, unknown> {
  const def = fs._def as {
    typeName: string;
    options?: unknown[];
    values?: Record<string, string>;
    innerType?: z.ZodTypeAny;
    minValue?: number;
    maxValue?: number;
  };
  switch (def.typeName) {
    case "ZodString":
      return { type: "string" };
    case "ZodNumber":
      return {
        type: "number",
        ...(def.minValue !== undefined ? { minimum: def.minValue } : {}),
        ...(def.maxValue !== undefined ? { maximum: def.maxValue } : {}),
      };
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodArray":
      return { type: "array", items: { type: "string" } };
    case "ZodEnum":
      return { type: "string", enum: def.options ?? [] };
    case "ZodOptional":
      return zodFieldToJsonSchema(def.innerType!);
    case "ZodObject":
      return zodToJsonSchema(fs);
    default:
      return {};
  }
}
