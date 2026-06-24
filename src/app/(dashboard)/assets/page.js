"use client";

import { useEffect, useState } from "react";
import { Plus, Download, Pencil, Trash2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { STATUS_OPTIONS } from "@/lib/constants";

export default function AssetsPage() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "",
    category: "",
    description: "",
    serialNumber: "",
    purchaseDate: "",
    purchasePrice: 0,
    currentValue: 0,
    location: "",
    status: "active",
    documents: [],
  });

  useEffect(() => {
    void fetchAssets();
  }, []);

  async function fetchAssets() {
    setLoading(true);
    try {
      const response = await fetch("/api/assets");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Unable to load assets");
      setAssets(payload.data || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  function openNewAsset() {
    setEditing(null);
    setForm({
      name: "",
      category: "",
      description: "",
      serialNumber: "",
      purchaseDate: "",
      purchasePrice: 0,
      currentValue: 0,
      location: "",
      status: "active",
      documents: [],
    });
    setFormOpen(true);
  }

  function openEditAsset(asset) {
    setEditing(asset);
    setForm({
      name: asset.name || "",
      category: asset.category || "",
      description: asset.description || "",
      serialNumber: asset.serialNumber || "",
      purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().slice(0, 10) : "",
      purchasePrice: asset.purchasePrice || 0,
      currentValue: asset.currentValue || 0,
      location: asset.location || "",
      status: asset.status || "active",
      documents: asset.documents || [],
    });
    setFormOpen(true);
  }

  async function saveAsset() {
    try {
      const payload = { ...form };
      const url = editing ? `/api/assets/${editing._id}` : "/api/assets";
      const method = editing ? "PATCH" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to save asset");
      toast.success(editing ? "Asset updated" : "Asset created");
      setFormOpen(false);
      void fetchAssets();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function deleteAsset(assetId) {
    if (!confirm("Delete this asset?")) return;
    try {
      const response = await fetch(`/api/assets/${assetId}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to delete asset");
      toast.success("Asset deleted");
      void fetchAssets();
    } catch (error) {
      toast.error(error.message);
    }
  }

  function downloadCsv() {
    window.location.href = "/api/assets?download=csv";
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 rounded-3xl bg-white/80 p-4 shadow-sm dark:bg-slate-900/70 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Assets</p>
          <h1 className="text-2xl font-semibold">Company Asset Inventory</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={openNewAsset}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            <Plus className="h-4 w-4" />
            Add Asset
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <Download className="h-4 w-4" />
            Download CSV
          </button>
        </div>
      </header>

      <section className="rounded-3xl bg-white/80 p-4 shadow-sm dark:bg-slate-900/70">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left dark:divide-slate-700">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-3 py-3">Name</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3">Serial</th>
                <th className="px-3 py-3">Purchase Date</th>
                <th className="px-3 py-3">Value</th>
                <th className="px-3 py-3">Location</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {assets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-500">
                    {loading ? "Loading assets..." : "No assets found."}
                  </td>
                </tr>
              ) : (
                assets.map((asset) => (
                  <tr key={asset._id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="px-3 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{asset.name}</td>
                    <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">{asset.category || "—"}</td>
                    <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">{asset.serialNumber || "—"}</td>
                    <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">{asset.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString() : "—"}</td>
                    <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">{asset.currentValue?.toLocaleString?.() || 0}</td>
                    <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">{asset.location || "—"}</td>
                    <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">{asset.status}</td>
                    <td className="px-3 py-3 text-right text-slate-600 dark:text-slate-300">
                      <div className="inline-flex items-center gap-2">
                        <button type="button" onClick={() => openEditAsset(asset)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => deleteAsset(asset._id)} className="rounded-full p-2 text-rose-500 hover:bg-rose-100 hover:text-rose-700 dark:hover:bg-rose-900/30 dark:hover:text-rose-300">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {formOpen ? (
        <section className="rounded-3xl bg-white/90 p-4 shadow-sm dark:bg-slate-900/80">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{editing ? "Edit Asset" : "Add Asset"}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Keep assets separate from fuel, cash, and stock entries.</p>
            </div>
            <button type="button" onClick={() => setFormOpen(false)} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {[
              { label: "Name", key: "name", type: "text" },
              { label: "Category", key: "category", type: "text" },
              { label: "Serial Number", key: "serialNumber", type: "text" },
              { label: "Location", key: "location", type: "text" },
              { label: "Purchase Price", key: "purchasePrice", type: "number" },
              { label: "Current Value", key: "currentValue", type: "number" },
              { label: "Purchase Date", key: "purchaseDate", type: "date" },
            ].map((field) => (
              <label key={field.key} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                {field.label}
                <input
                  type={field.type}
                  value={form[field.key] ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, [field.key]: field.type === "number" ? Number(event.target.value) : event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
            ))}
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Status
              <select
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status.toLowerCase()}>{status}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 md:col-span-2">
              Description
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                className="mt-2 h-24 w-full rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
          </div>

          <div className="mt-4 flex gap-3">
            <button type="button" onClick={saveAsset} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700">
              <Save className="h-4 w-4" />
              Save Asset
            </button>
            <button type="button" onClick={() => setFormOpen(false)} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
              Cancel
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
