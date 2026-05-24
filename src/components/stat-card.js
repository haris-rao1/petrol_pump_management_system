import { cn } from "@/components/cn";

export function StatCard({ title, value, subtitle, icon: Icon, tone = "default" }) {
  const toneStyles = {
    default: "bg-white/80 dark:bg-white/5",
    green: "bg-emerald-500/10",
    amber: "bg-amber-500/10",
    blue: "bg-sky-500/10",
    rose: "bg-rose-500/10",
  };

  return (
    <article className="glass-panel rounded-[28px] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
          <h3 className="mt-2 text-3xl font-semibold tracking-tight">{value}</h3>
          {subtitle ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
        </div>
        {Icon ? (
          <div className={cn("rounded-2xl p-3 text-slate-700 dark:text-slate-200", toneStyles[tone] || toneStyles.default)}>
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>
    </article>
  );
}