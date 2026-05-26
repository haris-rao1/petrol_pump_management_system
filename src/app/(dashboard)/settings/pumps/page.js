import { ModulePage } from "@/components/module-page";
import { PumpSelector } from "@/components/pump-selector";

export default function PumpsSettingsPage() {
  return (
    <div className="space-y-5">
      <section className="glass-panel rounded-4xl p-6 md:p-8">
        <p className="text-xs uppercase tracking-[0.35em] text-(--brand)">Pumps</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Select and manage pumps</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          Open one pump to work inside it, or create more pumps for separate branches.
        </p>
      </section>

      <PumpSelector />
      <ModulePage resource="pumps" />
    </div>
  );
}
