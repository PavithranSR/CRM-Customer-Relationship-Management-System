"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { Loader2, LockKeyhole, Mail } from "lucide-react";
import { login } from "@/actions/auth.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

const authFieldClassName =
  "h-11 rounded-md border-slate-300 bg-white pl-10 text-slate-900 placeholder:text-slate-400 shadow-none focus-visible:border-[#5e58ca] focus-visible:ring-[#5e58ca]/20";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await login(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      // Use a hard redirect so the browser sends all cookies fresh on the
      // next request. router.push() (soft navigation) can race against
      // cookie propagation on Vercel's serverless environment.
      window.location.href = "/dashboard";
    });
  }

  return (
    <div>
      <div className="flex justify-center">
        <div className="flex items-center justify-center rounded-2xl bg-white px-3 py-2">
          <Image
            src="/logo.png"
            alt="Matt Work Track logo"
            width={120}
            height={120}
            className="h-14 w-auto object-contain"
            priority
          />
        </div>
      </div>

      <div className="mt-6 text-center">
        <h2 className="text-[1.75rem] font-semibold tracking-tight text-slate-950">
          Welcome Back!
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Let&apos;s track your work, all in one place.
        </p>
      </div>

      <form action={handleSubmit}>
        <div className="mt-7 space-y-4">
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              Email
            </Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your email address"
                required
                disabled={isPending}
                onChange={() => setError(null)}
                className={authFieldClassName}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              Password
            </Label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <PasswordInput
                id="password"
                name="password"
                required
                disabled={isPending}
                onChange={() => setError(null)}
                className={authFieldClassName}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <Button
            type="submit"
            className="h-11 w-full rounded-md border-0 bg-[linear-gradient(135deg,#5e58ca_0%,#6558d7_100%)] text-sm font-semibold text-white shadow-[0_18px_30px_-18px_rgba(94,88,202,0.6)] hover:bg-[linear-gradient(135deg,#5e58ca_0%,#6558d7_100%)]"
            disabled={isPending}
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Login
          </Button>
        </div>
      </form>
    </div>
  );
}
