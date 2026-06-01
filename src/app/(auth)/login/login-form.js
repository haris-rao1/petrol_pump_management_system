"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Fuel } from "lucide-react";
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
    try {
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
      const signedInUser = payload.data?.user;
      const nextUrl =
        signedInUser?.role === "Admin" && !signedInUser?.activePumpId
          ? "/settings/pumps"
          : searchParams.get("next") || "/dashboard";
      router.replace(nextUrl);
      router.refresh();
    } catch (error) {
      toast.error(error?.message || "Unable to sign in");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(20,83,45,0.14),transparent_36%),radial-gradient(circle_at_bottom,rgba(245,158,11,0.12),transparent_30%)]" />

      <div className="relative w-full max-w-md overflow-hidden rounded-4xl border border-white/50 bg-white/80 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:bg-slate-950/60 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand)">
            <Fuel className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Petrol Pump System</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Login</h1>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Use your staff account to continue.
        </p>

        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4" dir="ltr">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Email</span>
            <input
              type="email"
              dir="ltr"
              className="w-full rounded-2xl border border-slate-300/80 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-(--brand) dark:border-white/10 dark:bg-white/5 dark:text-white"
              placeholder="example@email.com"
              {...form.register("email")}
            />
            {form.formState.errors.email ? <span className="text-xs text-rose-500">{form.formState.errors.email.message}</span> : null}
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Password</span>
            <input
              type="password"
              dir="ltr"
              className="w-full rounded-2xl border border-slate-300/80 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-(--brand) dark:border-white/10 dark:bg-white/5 dark:text-white"
              placeholder="••••••••"
              {...form.register("password")}
            />
            {form.formState.errors.password ? <span className="text-xs text-rose-500">{form.formState.errors.password.message}</span> : null}
          </label>

          <button
            type="submit"
            className="mt-2 w-full rounded-2xl bg-(--brand) px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-green-950/20 transition hover:opacity-95"
          >
            Sign In
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-500 dark:text-slate-400">
          Authorized staff only.
        </p>
      </div>
    </div>
  );
}
