"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setIsSubmitting(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1 className="mb-2 text-[29px] font-semibold tracking-tight">
        Sign in
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Pick up where your last reconciliation left off.
      </p>

      <div className="mb-4">
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
          Work email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="w-full rounded-md border border-border bg-white px-3.5 py-3 text-sm placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none"
        />
      </div>

      <div className="mb-4">
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••••"
          className="w-full rounded-md border border-border bg-white px-3.5 py-3 text-sm placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none"
        />
      </div>

      {error && (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-1.5 w-full rounded-md bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        No account yet?{" "}
        <Link href="/signup" className="font-semibold text-[var(--severity-reconciled)]">
          Create one
        </Link>
      </p>
    </form>
  );
}
