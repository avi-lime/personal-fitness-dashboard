import "server-only";
import { z } from "zod";
import { AREA_KEYS, EXPENSE_CATEGORIES } from "@/lib/domain";
import type { LocalDate } from "@/lib/date";
import { weekdayOf } from "@/lib/plan";
import { type ChatClient } from "./client";

/**
 * Structured "give me a sensible number" requests. Each kind has a focused
 * prompt and a Zod schema; the answer is validated before anyone sees it, and
 * callers store it flagged as an estimate — it is never silently presented as
 * a measurement.
 */

export const foodMacrosInput = z.object({
  name: z.string().trim().min(1).max(120),
  quantity: z.number().finite().min(0.001).max(10_000).default(1),
  unit: z.string().trim().max(20).default("serving"),
});
export const foodMacrosOutput = z.object({
  calories: z.number().min(0).max(20_000),
  proteinG: z.number().min(0).max(2_000),
  carbsG: z.number().min(0).max(2_000),
  fatG: z.number().min(0).max(2_000),
  /** What the estimate assumed, e.g. "1 bowl ≈ 250 g cooked oats with milk". */
  assumption: z.string().max(200),
  confidence: z.enum(["low", "medium", "high"]),
});

export const expenseCategoryInput = z.object({
  label: z.string().trim().min(1).max(120),
  amount: z.number().finite().min(0).max(100_000_000).optional(),
});
export const expenseCategoryOutput = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  reason: z.string().max(120),
});

export const taskFieldsInput = z.object({
  title: z.string().trim().min(1).max(160),
});
export const taskFieldsOutput = z.object({
  title: z.string().min(1).max(160),
  area: z.enum(AREA_KEYS).nullable(),
  priority: z.enum(["low", "medium", "high"]),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  reason: z.string().max(120),
});

export const ESTIMATE_KINDS = ["food_macros", "expense_category", "task_fields"] as const;
export type EstimateKind = (typeof ESTIMATE_KINDS)[number];

export interface EstimateContext {
  today: LocalDate;
  timezone: string;
  currency: string;
}

interface Spec<I extends z.ZodType, O extends z.ZodType> {
  input: I;
  output: O;
  prompt: (input: z.output<I>, ctx: EstimateContext) => string;
}

const SPECS = {
  food_macros: {
    input: foodMacrosInput,
    output: foodMacrosOutput,
    prompt: ({ name, quantity, unit }) =>
      `You are a careful nutritionist. Estimate the nutrition of: "${name}", quantity ${quantity} ${unit}.
If the unit is "serving", assume one typical home serving and say what you assumed (with an approximate weight) in "assumption".
Use typical values for common Indian and international foods; when a dish varies a lot, choose the most common preparation and set confidence to "low" or "medium".
Return JSON only: {"calories": number, "proteinG": number, "carbsG": number, "fatG": number, "assumption": string, "confidence": "low"|"medium"|"high"}. Whole numbers.`,
  } satisfies Spec<typeof foodMacrosInput, typeof foodMacrosOutput>,
  expense_category: {
    input: expenseCategoryInput,
    output: expenseCategoryOutput,
    prompt: ({ label, amount }, ctx) =>
      `Classify a personal expense into exactly one category from: ${EXPENSE_CATEGORIES.join(", ")}.
Expense: "${label}"${amount !== undefined ? ` (${amount} ${ctx.currency})` : ""}.
Return JSON only: {"category": string, "reason": string}.`,
  } satisfies Spec<typeof expenseCategoryInput, typeof expenseCategoryOutput>,
  task_fields: {
    input: taskFieldsInput,
    output: taskFieldsOutput,
    prompt: ({ title }, ctx) =>
      `Turn a quickly typed to-do into structured fields. Today is ${ctx.today} (${weekdayOf(ctx.today)}), timezone ${ctx.timezone}.
To-do: "${title}".
- "title": the task without any date words, tidy capitalisation.
- "area": one of ${AREA_KEYS.join(", ")}, or null if unclear.
- "priority": "high" if it sounds urgent or important, "low" if it sounds optional, else "medium".
- "dueDate": YYYY-MM-DD if the text implies a day ("by Friday", "tomorrow", "end of month"), else null. Never invent a date that is not implied.
Return JSON only: {"title": string, "area": string|null, "priority": string, "dueDate": string|null, "reason": string}.`,
  } satisfies Spec<typeof taskFieldsInput, typeof taskFieldsOutput>,
};

export type EstimateInput<K extends EstimateKind> = z.input<(typeof SPECS)[K]["input"]>;
export type EstimateOutput<K extends EstimateKind> = z.output<(typeof SPECS)[K]["output"]>;

export class EstimateError extends Error {}

/** Pulls the first JSON object out of a reply, tolerating code fences and prose. */
export function extractJson(text: string): unknown {
  const stripped = text.replace(/```(?:json)?/gi, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new EstimateError("No JSON object in reply");
  return JSON.parse(stripped.slice(start, end + 1));
}

export async function runEstimate<K extends EstimateKind>(
  kind: K,
  rawInput: unknown,
  ctx: EstimateContext,
  client: ChatClient,
  model: string,
): Promise<EstimateOutput<K>> {
  const spec = SPECS[kind] as Spec<z.ZodType, z.ZodType>;
  const input = spec.input.parse(rawInput);
  const messages: Array<{ role: "system" | "user"; content: string }> = [
    { role: "system", content: "You answer with a single JSON object and nothing else." },
    { role: "user", content: spec.prompt(input, ctx) },
  ];

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const completion = await client.complete({
      model,
      messages,
      temperature: 0.2,
      response_format: { type: "json_object" },
    });
    const content = completion.choices[0]?.message?.content ?? "";
    try {
      const parsed = spec.output.safeParse(extractJson(content));
      if (parsed.success) return parsed.data as EstimateOutput<K>;
      lastError = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    } catch (error) {
      lastError = error instanceof Error ? error.message : "unparseable reply";
    }
    messages.push({
      role: "user",
      content: `That was not valid. ${lastError}. Reply again with only the JSON object.`,
    });
  }
  throw new EstimateError(`Could not get a usable estimate (${lastError}).`);
}
