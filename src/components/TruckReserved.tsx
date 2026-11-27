"use client";

import { useState, useTransition } from "react";
import { setTruckReserved } from "@/app/jobs/truck-actions";
import { Icon } from "./Icon";
import { Switch } from "./Toggle";

/** Our-truck jobs: has the rental truck been booked? Zach and the crew lead can flip it. */
export function TruckReserved({ jobId, reservedAt, canEdit }: { jobId: string; reservedAt: string | null; canEdit: boolean }) {
  const [on, setOn] = useState(!!reservedAt);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const flip = () =>
    start(async () => {
      const next = !on;
      setOn(next);
      setError("");
      const res = await setTruckReserved(jobId, next);
      if (res.error) {
        setOn(!next);
        setError(res.error);
      }
    });

  return (
    <section className={`flex flex-col gap-1 rounded-2xl border p-4 ${on ? "border-line bg-card" : "border-warn/40 bg-warn/8"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Icon name="truck" className={`h-6 w-6 shrink-0 ${on ? "text-ok" : "text-warn"}`} />
          <div className="min-w-0">
            <p className="font-semibold text-ink">{on ? "Truck reserved" : "Truck not reserved yet"}</p>
            <p className="text-sm text-muted">{on ? "The rental truck is booked for this job." : canEdit ? "Book the U-Haul, then flip this on." : "Zach is booking the rental truck."}</p>
          </div>
        </div>
        {canEdit && <Switch on={on} onClick={flip} label="Truck reserved" disabled={pending} />}
      </div>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
    </section>
  );
}
