"use client";

import { useEffect, useState } from "react";
import { Gauge, Play } from "lucide-react";
import { toast } from "sonner";

export function PumpSelector() {
  const [pumps, setPumps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState("");

  useEffect(() => {
    async function loadPumps() {
      try {
        const response = await fetch("/api/pumps?page=1&limit=100");
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || "Unable to load pumps");
        }
        setPumps(payload.data.items || []);
      } catch (error) {
        toast.error(error.message);
      } finally {
        setLoading(false);
      }
    }

    void loadPumps();
  }, []);

  async function selectPump(pumpId) {
    setSwitchingId(pumpId);
    try {
      const response = await fetch("/api/auth/switch-pump", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pumpId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "Unable to switch pump");
      }
      const currentPumpName = payload.data?.pump?.name || "Pump";
      const meResponse = await fetch("/api/auth/me");
      const mePayload = await meResponse.json();
      if (!meResponse.ok) {
        throw new Error(mePayload.message || "Pump selected, but session could not be refreshed");
      }
      toast.success(`${currentPumpName} selected`);
      window.location.assign("/dashboard");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSwitchingId("");
    }
  }

  if (loading) {
    return <div className="rounded-4xl border border-white/10 bg-white/70 p-6 text-sm text-slate-500 dark:bg-white/5">Loading pumps...</div>;
  }

  return (
    <div className="space-y-4">
      {pumps.map((pump) => (
        <div key={pump._id} className="flex flex-col gap-4 rounded-4xl border border-white/10 bg-white/70 p-5 shadow-sm dark:bg-white/5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand)">
              <Gauge className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{pump.name}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Code: {pump.code}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{pump.address || "No address set"}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => selectPump(pump._id)}
            disabled={switchingId === pump._id}
            className="inline-flex items-center gap-2 rounded-2xl bg-(--brand) px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-green-950/20 disabled:opacity-60"
          >
            <Play className="h-4 w-4" />
            {switchingId === pump._id ? "Opening..." : "Open Pump"}
          </button>
        </div>
      ))}

      {!pumps.length ? <div className="rounded-4xl border border-white/10 bg-white/70 p-6 text-sm text-slate-500 dark:bg-white/5">No pumps found.</div> : null}
    </div>
  );
}
