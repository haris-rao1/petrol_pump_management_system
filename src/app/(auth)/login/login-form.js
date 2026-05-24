"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LockKeyhole, ShieldCheck, Fuel, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { loginSchema } from "@/utils/schemas";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "admin@petrolpump.local",
      password: "Admin@12345",
    },
  });

  async function onSubmit(values) {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const rawResponse = await response.text();
    let payload = {};

    if (rawResponse) {
      try {
        payload = JSON.parse(rawResponse);
      } catch {
        payload = { message: rawResponse };
      }
    }

    if (!response.ok) {
      toast.error(payload.message || "Unable to sign in");
      return;
    }

    toast.success("Welcome back");
    const nextUrl = searchParams.get("next") || "/dashboard";
    router.replace(nextUrl);
    router.refresh();
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <div className="relative overflow-hidden px-6 py-10 lg:px-12 lg:py-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(20,83,45,0.18),transparent_35%)]" />
        <div className="relative z-10 flex h-full flex-col justify-between rounded-[36px] border border-white/20 bg-white/60 p-6 shadow-2xl shadow-slate-900/10 backdrop-blur-xl dark:bg-slate-950/40">
          <div>
            <div className="inline-flex items-center gap-3 rounded-full bg-(--brand-soft) px-4 py-2 text-sm font-medium text-(--brand)">
              <Fuel className="h-4 w-4" />
              Petrol Pump Operations
            </div>
            <h1 className="mt-8 max-w-2xl text-4xl font-semibold tracking-tight text-slate-900 dark:text-white md:text-6xl">
              Manage fuel, stock, shifts, employees, and profit in one place.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
              A modern manual-entry system for Pakistani petrol pumps with role-based access, daily reporting, and automated stock calculations.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Secure JWT auth", ShieldCheck],
              ["Fast dashboard", Sparkles],
              ["Manual staff workflow", LockKeyhole],
            ].map(([label, Icon]) => (
              <div key={label} className="rounded-3xl border border-white/20 bg-white/70 p-4 shadow-lg backdrop-blur dark:bg-white/5">
                <Icon className="h-5 w-5 text-(--brand)" />
                <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-10 lg:px-12">
        <div className="glass-panel w-full max-w-md rounded-[36px] p-8">
          <p className="text-xs uppercase tracking-[0.35em] text-(--brand)">Staff Login</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Sign in to continue</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Use the default admin credentials on a fresh database or your own staff account.</p>

          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium">Email</span>
              <input type="email" className="w-full rounded-2xl border border-slate-300/70 bg-white/80 px-4 py-3 outline-none dark:border-white/10 dark:bg-white/5" {...form.register("email")} />
              {form.formState.errors.email ? <span className="text-xs text-rose-500">{form.formState.errors.email.message}</span> : null}
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium">Password</span>
              <input type="password" className="w-full rounded-2xl border border-slate-300/70 bg-white/80 px-4 py-3 outline-none dark:border-white/10 dark:bg-white/5" {...form.register("password")} />
              {form.formState.errors.password ? <span className="text-xs text-rose-500">{form.formState.errors.password.message}</span> : null}
            </label>

            <button type="submit" className="mt-2 w-full rounded-2xl bg-(--brand) px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-green-950/20 transition hover:opacity-95">
              Sign In
            </button>
          </form>

          <div className="mt-6 rounded-3xl border border-dashed border-(--border) bg-(--panel-muted) p-4 text-sm text-slate-600 dark:text-slate-300">
            <p className="font-medium text-slate-900 dark:text-white">Fresh install demo access</p>
            <p className="mt-2">Email: admin@petrolpump.local</p>
            <p>Password: Admin@12345</p>
          </div>
        </div>
      </div>
    </div>
  );
}
