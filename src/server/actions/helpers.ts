import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/action-result";
import { formatZodError } from "@/lib/validation";
import { describeError } from "@/lib/errors";
import { requireContext, type RequestContext } from "@/server/auth";

/**
 * Wraps an action body with authentication, Zod validation and error
 * normalisation so no action has to repeat any of it.
 */
export async function withValidation<Schema extends z.ZodType, T>(
  schema: Schema,
  input: unknown,
  handler: (value: z.infer<Schema>, ctx: RequestContext) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail(formatZodError(parsed.error));
  try {
    const ctx = await requireContext();
    return await handler(parsed.data, ctx);
  } catch (error) {
    return fail(describeError(error));
  }
}

export async function withContext<T>(
  handler: (ctx: RequestContext) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await handler(await requireContext());
  } catch (error) {
    return fail(describeError(error));
  }
}

/** One cache-busting call: this app's pages all derive from the same events. */
export function revalidateAll(): void {
  revalidatePath("/", "layout");
}

/** Reads a form field as a trimmed string, or undefined when blank. */
export function text(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** Reads a numeric form field, or undefined when blank/not a number. */
export function number(form: FormData, key: string): number | undefined {
  const value = text(form, key);
  if (value === undefined) return undefined;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function checkbox(form: FormData, key: string): boolean {
  const value = form.get(key);
  return value === "on" || value === "true" || value === "1";
}
