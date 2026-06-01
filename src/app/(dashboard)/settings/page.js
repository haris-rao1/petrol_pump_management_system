export default function SettingsPage() {
  return (
    <div className="space-y-5">
      <section className="glass-panel rounded-4xl p-6 md:p-8">
        <p className="text-xs uppercase tracking-[0.35em] text-(--brand)">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">System control</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          Manage petrol pumps and staff accounts from one simple place.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <a href="/settings/pumps" className="glass-panel rounded-4xl p-6 transition hover:-translate-y-0.5 hover:shadow-xl">
          <p className="text-sm text-slate-500 dark:text-slate-400">Pumps</p>
          <h2 className="mt-2 text-xl font-semibold">Create and select a pump</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Open one pump to work inside it, or add another branch.</p>
        </a>

        <a href="/settings/users" className="glass-panel rounded-4xl p-6 transition hover:-translate-y-0.5 hover:shadow-xl">
          <p className="text-sm text-slate-500 dark:text-slate-400">Users</p>
          <h2 className="mt-2 text-xl font-semibold">Create staff login accounts</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Assign a user to a specific pump and role.</p>
        </a>

        <a href="/settings/products" className="glass-panel rounded-4xl p-6 transition hover:-translate-y-0.5 hover:shadow-xl">
          <p className="text-sm text-slate-500 dark:text-slate-400">Products & Rates</p>
          <h2 className="mt-2 text-xl font-semibold">Define fuel names and sale rates</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Manage Petrol, Diesel, or any other product you sell at the pump.</p>
        </a>
      </section>

      <section className="glass-panel rounded-4xl p-6 text-sm text-slate-600 dark:text-slate-300">
        <p className="font-medium text-slate-900 dark:text-white">How it works</p>
        <ul className="mt-3 space-y-2">
          <li>• Add a pump first.</li>
          <li>• Assign a user to that pump.</li>
          <li>• Staff log in and go directly to their pump.</li>
          <li>• Admin can open another pump from the Pumps page.</li>
        </ul>
      </section>
    </div>
  );
}