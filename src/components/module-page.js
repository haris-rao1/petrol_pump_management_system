"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Plus, Search, Download, FileText, Pencil, Trash2, Filter, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/components/cn";
import { moduleConfigs, getModuleConfig } from "@/utils/module-config";
import { moduleSchemas, resourceFormDefaults } from "@/utils/schemas";
import { formatCurrency, formatDate, formatNumber, toCsvValue } from "@/utils/format";

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 250;
const pumpScopedResources = new Set(["fuel-purchases", "fuel-sales", "tanks", "nozzles", "expenses", "customers", "payments", "employees", "stock-adjustments"]);

export function ModulePage({ resource }) {
  const config = getModuleConfig(resource) || moduleConfigs[resource];
  const schema = moduleSchemas[resource];
  const defaults = resourceFormDefaults[resource];

  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState(() =>
    Object.fromEntries((config?.filters || []).map((item) => [item.name, ""])),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [dynamicOptions, setDynamicOptions] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const selectedPumpId = currentUser?.activePumpId || currentUser?.pumpId || "";

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  const { setValue, control } = form;
  const watchedOpeningMeterReading = useWatch({ control, name: "openingMeterReading" });
  const watchedClosingMeterReading = useWatch({ control, name: "closingMeterReading" });
  const watchedFuelPricePerLiter = useWatch({ control, name: "fuelPricePerLiter" });
  const watchedAmountReceived = useWatch({ control, name: "amountReceived" });
  const watchedCustomer = useWatch({ control, name: "customer" });

  const computedSoldLiters = Math.max(0, Number(watchedClosingMeterReading || 0) - Number(watchedOpeningMeterReading || 0));
  const computedTotalSaleAmount = computedSoldLiters * Number(watchedFuelPricePerLiter || 0);
  const computedPendingAmount = Math.max(computedTotalSaleAmount - Number(watchedAmountReceived || 0), 0);

  useEffect(() => {
    if (config.endpoint === "fuel-sales") {
      setValue("totalSaleAmount", computedTotalSaleAmount, { shouldDirty: true });
      setValue("pendingAmount", computedPendingAmount, { shouldDirty: true });
    }
  }, [config.endpoint, computedPendingAmount, computedTotalSaleAmount, setValue]);

  useEffect(() => {
    if (config.endpoint === "payments" && watchedCustomer && watchedCustomer.length >= 1) {
      const searchCustomers = async () => {
        try {
          const response = await fetch(`/api/customers?search=${encodeURIComponent(watchedCustomer)}&limit=10`);
          const payload = await response.json();
          const customers = payload.data?.items || [];
          setCustomerSearchResults(customers);
          setShowCustomerDropdown(customers.length > 0);
        } catch (error) {
          setCustomerSearchResults([]);
          setShowCustomerDropdown(false);
        }
      };
      searchCustomers();
    } else {
      setCustomerSearchResults([]);
      setShowCustomerDropdown(false);
    }
  }, [config.endpoint, watchedCustomer]);

  function selectCustomer(customer) {
    setValue("customer", customer.name, { shouldDirty: true });
    setValue("vehicleNumber", customer.vehicleNumber || "", { shouldDirty: false });
    setShowCustomerDropdown(false);
  }

  async function fetchRecords() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), search: debouncedSearch });
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        }
      });

      const response = await fetch(`/api/${config.endpoint}?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Unable to load records");
      }

      setRecords(payload.data.items || []);
      setTotal(payload.data.total || 0);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchDynamicOptions() {
    const optionFields = (config?.fields || []).filter((field) => field.optionsSource);
    if (!optionFields.length) {
      return;
    }

    if (optionFields.some((field) => field.optionsSource === "nozzles") && !selectedPumpId) {
      return;
    }

    const nextOptions = {};
    try {
      await Promise.all(
        optionFields.map(async (field) => {
          if (field.optionsSource === "pumps") {
            const response = await fetch("/api/pumps?page=1&limit=1000");
            const payload = await response.json();
            if (!response.ok) {
              throw new Error(payload.message || "Unable to load pumps");
            }
            nextOptions[field.name] = (payload.data?.items || []).map((item) => ({
              label: `${item.name} (${item.code})`,
              value: item._id,
            }));
          }

          if (field.optionsSource === "products") {
            const response = await fetch("/api/products?page=1&limit=1000");
            const payload = await response.json();
            if (!response.ok) {
              throw new Error(payload.message || "Unable to load products");
            }
            nextOptions[field.name] = (payload.data?.items || []).map((item) => ({
              label: item.name,
              value: item.name,
            }));
          }

          if (field.optionsSource === "nozzles") {
            const response = await fetch("/api/nozzles?page=1&limit=1000");
            const payload = await response.json();
            if (!response.ok) {
              throw new Error(payload.message || "Unable to load nozzles");
            }
            nextOptions[field.name] = (payload.data?.items || []).map((item) => ({
              label: `${item.nozzleName}${item.machineName ? ` (${item.machineName})` : ""}`,
              value: item.nozzleName,
            }));
          }
        }),
      );

      setDynamicOptions(nextOptions);
    } catch (error) {
      // Surface dynamic option load errors but don't block the page
      toast.error(error?.message || "Unable to load form options");
    }
  }

  async function fetchCurrentUser() {
    try {
      const response = await fetch("/api/auth/me");
      const payload = await response.json();
      if (response.ok) {
        const user = payload.data?.user || null;
        setCurrentUser(user);
        return user;
      }
    } catch {
      setCurrentUser(null);
    }

    return null;
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    void fetchRecords();
  }, [resource, page, debouncedSearch, JSON.stringify(filters)]);

  useEffect(() => {
    void fetchDynamicOptions();
  }, [resource, selectedPumpId]);

  useEffect(() => {
    void fetchCurrentUser();
  }, []);

  function openCreateModal() {
    setEditing(null);
    form.reset(defaults);
    setOpen(true);
  }

  function openEditModal(record) {
    setEditing(record);
    form.reset(mapRecordToForm(record, defaults));
    setOpen(true);
  }

  async function onSubmit(values) {
    setSaving(true);
    try {
      const method = editing ? "PATCH" : "POST";
      const url = editing ? `/api/${config.endpoint}?id=${editing._id}` : `/api/${config.endpoint}`;
      const resolvedUser = currentUser || (await fetchCurrentUser());
      const selectedPumpId = resolvedUser?.activePumpId || resolvedUser?.pumpId || "";
      const body = pumpScopedResources.has(resource) && selectedPumpId ? { ...values, pumpId: selectedPumpId } : values;
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Unable to save record");
      }

      toast.success(editing ? "Record updated" : "Record created");
      setOpen(false);
      setEditing(null);
      form.reset(defaults);
      fetchRecords();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord(record) {
    if (!window.confirm("Delete this record?")) {
      return;
    }

    try {
      const resolvedUser = currentUser || (await fetchCurrentUser());
      const selectedPumpId = resolvedUser?.activePumpId || resolvedUser?.pumpId || "";
      const pumpQuery = pumpScopedResources.has(resource) && selectedPumpId ? `&pumpId=${encodeURIComponent(selectedPumpId)}` : "";
      const response = await fetch(`/api/${config.endpoint}?id=${record._id}${pumpQuery}`, { method: "DELETE" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Unable to delete record");
      }

      toast.success("Record deleted");
      fetchRecords();
    } catch (error) {
      toast.error(error.message);
    }
  }

  function downloadCSV() {
    const headers = ["#", ...config.columns.map((column) => column.label)];
    const rows = records.map((record, index) => [
      String(index + 1),
      ...config.columns.map((column) => formatExportValue(record, column)),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => toCsvValue(cell)).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${config.endpoint}-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function downloadPDF() {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.text(config.title, 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [["#", ...config.columns.map((column) => column.label)]],
      body: records.map((record, index) => [
        index + 1,
        ...config.columns.map((column) => formatExportValue(record, column)),
      ]),
      styles: { fontSize: 9 },
    });
    doc.save(`${config.endpoint}-${Date.now()}.pdf`);
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <section className="glass-panel rounded-4xl p-6 md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.35em] text-(--brand)">{config.endpoint}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{config.title}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{config.description}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={fetchRecords} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/70 px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-white dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10">
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
            <button onClick={downloadCSV} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/70 px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-white dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10">
              <Download className="h-4 w-4" />
              CSV
            </button>
            <button onClick={downloadPDF} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/70 px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-white dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10">
              <FileText className="h-4 w-4" />
              PDF
            </button>
            <button onClick={openCreateModal} className="inline-flex items-center gap-2 rounded-2xl bg-(--brand) px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-green-950/20 transition hover:opacity-95">
              <Plus className="h-4 w-4" />
              New Record
            </button>
          </div>
        </div>
      </section>

      <section className="glass-panel rounded-4xl p-5">
        <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/70 px-4 py-3 dark:bg-white/5">
            <Search className="h-4 w-4 text-slate-500" />
            <input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder="Search records" className="w-full bg-transparent outline-none placeholder:text-slate-400" />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            {(config.filters || []).map((filter) => (
              <label key={filter.name} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/70 px-4 py-3 dark:bg-white/5">
                <Filter className="h-4 w-4 text-slate-500" />
                <select
                  value={filters[filter.name] || ""}
                  onChange={(event) => {
                    setPage(1);
                    setFilters((current) => ({ ...current, [filter.name]: event.target.value }));
                  }}
                  className="w-full bg-transparent outline-none"
                >
                  {(filter.options || []).map((option) => (
                    <option key={option || "all"} value={option}>{option || filter.label}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="glass-panel overflow-hidden rounded-4xl">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200/70 text-sm dark:divide-white/10">
            <thead className="bg-white/40 text-left text-xs uppercase tracking-[0.2em] text-slate-500 dark:bg-white/5 dark:text-slate-400">
              <tr>
                <th className="px-6 py-4">#</th>
                {config.columns.map((column) => (
                  <th key={column.key} className="px-6 py-4">{column.label}</th>
                ))}
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
              {loading ? (
                <tr><td colSpan={config.columns.length + 2} className="px-6 py-12 text-center text-slate-500">Loading records...</td></tr>
              ) : records.length ? (
                records.map((record, index) => (
                  <tr key={record._id} className="bg-transparent transition hover:bg-slate-50/60 dark:hover:bg-white/5">
                    <td className="px-6 py-4 font-medium">{(page - 1) * PAGE_SIZE + index + 1}</td>
                    {config.columns.map((column) => (
                      <td key={column.key} className="px-6 py-4">{renderCell(record, column)}</td>
                    ))}
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => openEditModal(record)} className="inline-flex items-center gap-1 rounded-xl border border-slate-300/70 px-3 py-2 text-xs font-semibold hover:bg-white dark:border-white/10 dark:hover:bg-white/5">
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button onClick={() => deleteRecord(record)} className="inline-flex items-center gap-1 rounded-xl border border-rose-300/70 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-400/30 dark:text-rose-300 dark:hover:bg-rose-500/10">
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={config.columns.length + 2} className="px-6 py-14 text-center text-slate-500">No records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200/70 px-6 py-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
          <span>{total} total records</span>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-xl border border-white/10 bg-white/70 px-3 py-2 disabled:opacity-40 dark:bg-white/5">Prev</button>
            <span>Page {page} of {pageCount}</span>
            <button disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="rounded-xl border border-white/10 bg-white/70 px-3 py-2 disabled:opacity-40 dark:bg-white/5">Next</button>
          </div>
        </div>
      </section>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-8 backdrop-blur-sm">
          <div className="glass-panel max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-4xl p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-(--brand)">{editing ? "Edit record" : "Create record"}</p>
                <h2 className="text-2xl font-semibold">{editing ? `Update ${config.title}` : `New ${config.title}`}</h2>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-2xl border border-white/10 bg-white/70 px-4 py-2 text-sm dark:bg-white/5">Close</button>
            </div>

                    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
                {config.fields.map((field) => {
                  if (config.endpoint === "payments" && field.name === "customer") {
                    return (
                      <div key={field.name} className="relative space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">{field.label}</label>
                        <div className="relative">
                          <input
                            type="text"
                            className="w-full rounded-2xl border border-slate-300/70 bg-white/80 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-(--brand) dark:border-white/10 dark:bg-white/5"
                            placeholder={field.label}
                            {...form.register(field.name)}
                            onFocus={() => watchedCustomer && customerSearchResults.length > 0 && setShowCustomerDropdown(true)}
                          />
                          {showCustomerDropdown && customerSearchResults.length > 0 ? (
                            <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-2xl border border-slate-300/70 bg-white/90 dark:border-white/10 dark:bg-slate-900">
                              {customerSearchResults.map((customer) => (
                                <button
                                  key={customer._id}
                                  type="button"
                                  onClick={() => selectCustomer(customer)}
                                  className="w-full px-4 py-3 text-left text-sm transition hover:bg-slate-100 dark:hover:bg-white/10"
                                >
                                  <div className="font-medium">{customer.name}</div>
                                  <div className="text-xs text-slate-500">{customer.vehicleNumber || "No vehicle"}</div>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        {form.formState.errors[field.name] ? <span className="text-xs text-rose-500">{form.formState.errors[field.name].message}</span> : null}
                      </div>
                    );
                  }
                  return (
                    <FormField
                      key={field.name}
                      field={field}
                      options={field.optionsSource ? dynamicOptions[field.name] || [] : field.options || []}
                      register={form.register}
                      error={form.formState.errors[field.name]}
                    />
                  );
                })}

                {config.endpoint === "fuel-sales" ? (
                  <div className="md:col-span-2 grid gap-4 rounded-3xl border border-slate-200/70 bg-slate-50/80 p-5 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <span className="block text-xs uppercase tracking-[0.25em] text-slate-500">Sold Liters</span>
                        <p className="mt-2 text-lg font-semibold">{formatNumber(computedSoldLiters)}</p>
                      </div>
                      <div>
                        <span className="block text-xs uppercase tracking-[0.25em] text-slate-500">Total Amount</span>
                        <p className="mt-2 text-lg font-semibold">{formatCurrency(computedTotalSaleAmount)}</p>
                      </div>
                      <div>
                        <span className="block text-xs uppercase tracking-[0.25em] text-slate-500">Pending Amount</span>
                        <p className="mt-2 text-lg font-semibold">{formatCurrency(computedPendingAmount)}</p>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-2xl border border-white/10 bg-white/70 px-5 py-3 text-sm dark:bg-white/5">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-2xl bg-(--brand) px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-green-950/20 disabled:opacity-60">
                  {saving ? "Saving..." : editing ? "Update Record" : "Create Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FormField({ field, options, register, error }) {
  const base = "w-full rounded-2xl border border-slate-300/70 bg-white/80 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[var(--brand)] dark:border-white/10 dark:bg-white/5";

  return (
    <label className={cn("space-y-2", field.type === "textarea" ? "md:col-span-2" : "") }>
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{field.label}</span>
      {field.type === "select" ? (
        <select className={base} {...register(field.name)}>
          {options.map((option) => (
            <option key={option.value || option} value={option.value || option}>{option.label || option || field.label}</option>
          ))}
        </select>
      ) : field.type === "textarea" ? (
        <textarea rows={4} className={base} {...register(field.name)} />
      ) : (
        <input
          type={field.type === "date" ? "date" : field.type || "text"}
          step={field.type === "number" ? "any" : undefined}
          className={cn(base, field.readOnly ? "cursor-not-allowed bg-slate-100/80 dark:bg-slate-800/80" : "")}
          readOnly={field.readOnly}
          disabled={field.readOnly}
          {...register(field.name)}
        />
      )}
      {error ? <span className="text-xs text-rose-500">{error.message}</span> : null}
    </label>
  );
}

function mapRecordToForm(record, defaults) {
  const output = { ...defaults };
  Object.keys(defaults).forEach((key) => {
    const value = record[key];
    if (value === undefined || value === null) {
      return;
    }
    if (key.toLowerCase().includes("date") && value) {
      output[key] = new Date(value).toISOString().slice(0, 10);
      return;
    }
    // If a field (like `pumpId`) was populated with an object, normalize
    // it to the string id so form selects bind correctly.
    if (typeof value === "object") {
      if (value._id) {
        output[key] = String(value._id);
      } else {
        output[key] = value;
      }
    } else {
      output[key] = value;
    }
  });
  return output;
}

function renderCell(record, column) {
  const value = record[column.key];
  if (column.formatter) {
    return column.formatter(value, record);
  }
  if (column.key === "customerName") {
    return record.customerName || record.customer?.name || record.customer || "-";
  }
  if (column.key === "pumpId") {
    return record.pumpId?.name || record.pumpId?.code || record.pumpId || "-";
  }
  if (column.key === "updatedAt") {
    return formatDate(record.updatedAt);
  }
  return value ?? "-";
}

function formatExportValue(record, column) {
  if (column.formatter) {
    return column.formatter(record[column.key], record);
  }
  if (column.key === "customerName") {
    return record.customerName || record.customer?.name || record.customer || "-";
  }
  if (column.key === "pumpId") {
    return record.pumpId?.name || record.pumpId?.code || record.pumpId || "-";
  }
  if (column.key === "updatedAt") {
    return formatDate(record.updatedAt);
  }
  return record[column.key] ?? "-";
}