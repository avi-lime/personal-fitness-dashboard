"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/action-result";
import { endSession, ensureOwnerUser, startSession, verifyCredentials } from "@/server/auth";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  next: z.string().optional(),
});

export async function loginAction(
  _previous: ActionResult<undefined> | null,
  form: FormData,
): Promise<ActionResult<undefined>> {
  const parsed = loginSchema.safeParse({
    username: form.get("username"),
    password: form.get("password"),
    next: form.get("next") ?? undefined,
  });
  if (!parsed.success) return fail("Enter a username and password");

  if (!verifyCredentials(parsed.data.username, parsed.data.password)) {
    return fail("Incorrect username or password");
  }

  const user = await ensureOwnerUser();
  await startSession(user);

  const target = parsed.data.next;
  redirect(target && target.startsWith("/") && !target.startsWith("//") ? target : "/");
}

export async function logoutAction(): Promise<never> {
  await endSession();
  redirect("/login");
}
