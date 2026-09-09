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
      <div className="w-full max-w-sm">
        <div className="mb-8 space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Life Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            A private dashboard. Sign in with the credentials configured for this deployment.
          </p>
        </div>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
