"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BadgeCheck, Menu, LogOut, MoonStar, SunMedium, Gauge, ChevronRight } from "lucide-react";
import { NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/components/cn";

export function AppShell({ user, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const visibleNav = useMemo(
    () => NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user?.role)),
    [user?.role],
  );

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-transparent text-slate-950 dark:text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-430 gap-5 p-3 sm:p-4 lg:p-6">
        <aside
          className={cn(
            "glass-panel fixed inset-y-3 left-3 z-50 w-70 rounded-[28px] p-4 transition-transform duration-300 lg:static lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "translate-x-[-110%] lg:translate-x-0",
          )}
        >
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-(--brand) text-white shadow-lg shadow-green-950/20">
              <Gauge className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Petrol Pump</p>
              <h1 className="text-lg font-semibold">Management System</h1>
            </div>
          </div>

          <div className="mt-4 rounded-3xl bg-(--panel-muted) p-4 dark:bg-white/5">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Pump Context</p>
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
              {user?.activePumpId ? "Pump selected" : user?.role === "Admin" ? "Select a pump" : "Assigned pump"}
            </p>
            {user?.role === "Admin" && !user?.activePumpId ? (
              <Link href="/settings/pumps" className="mt-3 inline-flex rounded-2xl bg-(--brand) px-4 py-2 text-xs font-semibold text-white">
                Open Pumps
              </Link>
            ) : null}
          </div>

          <nav className="mt-5 space-y-1 overflow-y-auto pr-1 scrollbar-thin">
            {visibleNav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition-all",
                    active
                      ? "bg-(--brand) text-white shadow-lg shadow-green-950/20"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5",
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span>{item.label}</span>
                  <ChevronRight className={cn("h-4 w-4 transition-transform", active ? "translate-x-0" : "group-hover:translate-x-1")} />
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 rounded-3xl bg-(--panel-muted) p-4 dark:bg-white/5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-300">
                <BadgeCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Signed in as</p>
                <p className="font-semibold">{user?.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{user?.role}</p>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="glass-panel sticky top-3 z-40 flex items-center justify-between rounded-[28px] px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen((value) => !value)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/60 text-slate-700 shadow-sm transition hover:bg-white dark:bg-white/5 dark:text-slate-200 lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Operational Control</p>
                <h2 className="text-lg font-semibold">Pakistani Petrol Pump Dashboard</h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </header>

          <main className="min-w-0 flex-1 pb-4">{children}</main>
        </div>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    const saved = window.localStorage.getItem("ppm-theme");
    return saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    const root = document.documentElement;
    root.classList.toggle("dark", next);
    window.localStorage.setItem("ppm-theme", next ? "dark" : "light");
  }

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    window.localStorage.setItem("ppm-theme", isDark ? "dark" : "light");
  }, [isDark]);

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/60 text-slate-700 transition hover:bg-white dark:bg-white/5 dark:text-slate-200"
      aria-label="Toggle theme"
    >
      {isDark ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
    </button>
  );
}