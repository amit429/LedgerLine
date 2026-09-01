"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 10;

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setError(signUpError.message);
      setIsSubmitting(false);
      return;
    }

    if (data.session) {
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    // Email confirmation is enabled on the project — there's no session yet.
    setCheckEmail(true);
    setIsSubmitting(false);
  }

  if (checkEmail) {
    return (
      <div>
        <h1 className="mb-2 text-[29px] font-semibold tracking-tight">
          Check your email
        </h1>
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link to <strong>{email}</strong>. Follow it
          to finish creating your account.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1 className="mb-2 text-[29px] font-semibold tracking-tight">
        Create your account
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Your imports and results stay private to your account.
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
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 10 characters"
          className="w-full rounded-md border border-border bg-white px-3.5 py-3 text-sm placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none"
        />
      </div>

      <div className="mb-4">
        <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium">
          Confirm password
        </label>
        <input
          id="confirm-password"
          type="password"
          required
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
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
        {isSubmitting ? "Creating account…" : "Create account"}
      </button>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-[var(--severity-reconciled)]">
          Sign in
        </Link>
      </p>
    </form>
  );
}
