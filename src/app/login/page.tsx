import { redirect } from "next/navigation";
import { LoginForm } from "@/components/layout/login-form";
import { getCurrentUser } from "@/server/auth";

export const metadata = { title: "Sign in · Life Dashboard" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/");
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-lg bg-surface-2 p-6 sm:p-8">
        <div className="mb-8 space-y-2">
          <span className="block h-1 w-8 rounded-full bg-brand" aria-hidden />
          <h1 className="font-display text-4xl">Life Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Private. Sign in with the credentials configured for this deployment.
          </p>
        </div>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
