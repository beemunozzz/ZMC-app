"use client";

import { useActionState, useState } from "react";
import { EMPLOYMENT, type CrewMember, type Employment } from "@/lib/crew-types";
import { giveRaise, rehireEmployee, saveEmployee, terminateEmployee, type EmpState } from "../employee-actions";

const input = "h-12 w-full min-w-0 rounded-xl border border-line bg-bg px-3 text-base text-ink outline-none focus:border-primary";
const label = "flex min-w-0 flex-col gap-1 text-sm font-medium text-ink";
const section = "flex flex-col gap-3 rounded-2xl border border-line bg-card p-4";
const heading = "font-display text-lg font-extrabold uppercase text-ink";

export type PrivateInfo = {
  address: string;
  emergency_name: string;
  emergency_phone: string;
  hire_date: string | null;
  notes: string;
};

function Msg({ s }: { s: EmpState }) {
  if (s.error) return <p role="alert" className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{s.error}</p>;
  if (s.ok) return <p className="rounded-xl bg-ok/12 px-3 py-2 text-sm font-medium text-ok">✓ {s.ok}</p>;
  return null;
}

export function InfoForm({ member, info, isMe }: { member: CrewMember; info: PrivateInfo; isMe: boolean }) {
  const [state, action, pending] = useActionState<EmpState, FormData>(saveEmployee, {});
  const [emp, setEmp] = useState<Employment>(member.employment ?? "full_time");
  return (
    <form action={action} className={section}>
      <input type="hidden" name="id" value={member.id} />
      <h2 className={heading}>Contact info</h2>
      <label className={label}>
        Name
        <input name="full_name" required defaultValue={member.full_name} className={input} autoComplete="off" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          Phone
          <input name="phone" type="tel" inputMode="tel" defaultValue={member.phone ?? ""} className={input} autoComplete="off" />
        </label>
        <label className={label}>
          Email <span className="font-normal text-muted">(they log in with this)</span>
          <input name="email" type="email" inputMode="email" defaultValue={member.email ?? ""} className={input} autoComplete="off" />
        </label>
      </div>
      <label className={label}>
        Home address
        <input name="address" defaultValue={info.address} placeholder="Street, city, ZIP" className={input} autoComplete="off" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          Emergency contact
          <input name="emergency_name" defaultValue={info.emergency_name} placeholder="Name" className={input} autoComplete="off" />
        </label>
        <label className={label}>
          Emergency phone
          <input name="emergency_phone" type="tel" inputMode="tel" defaultValue={info.emergency_phone} className={input} autoComplete="off" />
        </label>
      </div>

      <h2 className={`${heading} pt-2`}>Job</h2>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          Role
          <select name="role" defaultValue={member.role} className={input} disabled={isMe}>
            <option value="mover">Mover</option>
            <option value="lead">Crew lead</option>
            <option value="owner">Owner</option>
          </select>
          {isMe && <input type="hidden" name="role" value={member.role} />}
        </label>
        <label className={label}>
          Start date
          <input name="hire_date" type="date" defaultValue={info.hire_date ?? ""} className={input} />
        </label>
      </div>
      <label className={label}>
        Employment
        <select name="employment" value={emp} onChange={(e) => setEmp(e.target.value as Employment)} className={input}>
          {(Object.keys(EMPLOYMENT) as Employment[]).map((k) => (
            <option key={k} value={k}>
              {EMPLOYMENT[k].label}
            </option>
          ))}
        </select>
        <span className={`text-xs font-normal ${emp === "leave" ? "text-warn" : "text-muted"}`}>{EMPLOYMENT[emp].access}</span>
      </label>
      <label className={label}>
        Notes <span className="font-normal text-muted">(only you see these)</span>
        <textarea name="notes" defaultValue={info.notes} rows={3} className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-base text-ink outline-none focus:border-primary" />
      </label>
      <Msg s={state} />
      <button disabled={pending} className="press h-12 rounded-xl bg-primary font-semibold text-white disabled:opacity-60 dark:text-navy">
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

export function RaiseForm({ id, rate, today }: { id: string; rate: number | null; today: string }) {
  const [state, action, pending] = useActionState<EmpState, FormData>(saveOrClose, {});
  const [open, setOpen] = useState(false);
  async function saveOrClose(prev: EmpState, form: FormData) {
    const r = await giveRaise(prev, form);
    if (r.ok) setOpen(false);
    return r;
  }
  return (
    <div className="flex flex-col gap-2">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="press h-12 rounded-xl border border-ok/50 font-semibold text-ok">
          {rate == null ? "Set hourly pay" : "Give a raise"}
        </button>
      ) : (
        <form action={action} className="rise flex flex-col gap-3 rounded-xl bg-bg p-3">
          <input type="hidden" name="id" value={id} />
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>
              New hourly pay ($)
              <input name="new_rate" type="number" inputMode="decimal" min={0} step={0.25} required defaultValue={rate != null ? rate + 1 : ""} className={input} />
            </label>
            <label className={label}>
              Starts on
              <input name="effective_date" type="date" defaultValue={today} className={input} />
            </label>
          </div>
          <label className={label}>
            Note <span className="font-normal text-muted">(optional)</span>
            <input name="note" placeholder="e.g. 1 year with ZMC" className={input} autoComplete="off" />
          </label>
          <div className="flex gap-2">
            <button disabled={pending} className="press h-12 flex-1 rounded-xl bg-ok font-semibold text-white disabled:opacity-60 dark:text-navy">
              {pending ? "Saving…" : "Save new pay"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="press h-12 rounded-xl border border-line px-5 font-semibold text-ink">
              Cancel
            </button>
          </div>
        </form>
      )}
      <Msg s={state} />
    </div>
  );
}

export function TerminateBox({ id, name, upcoming, today }: { id: string; name: string; upcoming: number; today: string }) {
  const [state, action, pending] = useActionState<EmpState, FormData>(terminateEmployee, {});
  const [step, setStep] = useState<"button" | "confirm">("button");
  if (state.ok) return <Msg s={state} />;
  if (step === "button") {
    return (
      <button type="button" onClick={() => setStep("confirm")} className="press h-12 rounded-xl bg-bad font-semibold text-white dark:text-navy">
        Terminate employee
      </button>
    );
  }
  return (
    <form action={action} className="rise flex flex-col gap-3 rounded-2xl border-2 border-bad bg-bad/5 p-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="sure" value="yes" />
      <p className="text-lg font-bold text-bad">Are you sure you want to terminate {name}?</p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
        <li>Their login is turned off right away, and they&apos;re signed out of every phone.</li>
        <li>
          They&apos;re taken off {upcoming ? <b>{upcoming} upcoming job{upcoming === 1 ? "" : "s"}</b> : "any upcoming jobs"}. Those jobs will show as needing crew.
        </li>
        <li>If they&apos;re on the clock, they&apos;re clocked out.</li>
        <li>Their past jobs, hours, pay history and invoices are kept.</li>
        <li>You can rehire them later.</li>
      </ul>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          Last day
          <input name="termination_date" type="date" defaultValue={today} className={input} />
        </label>
        <label className={label}>
          Reason <span className="font-normal text-muted">(optional)</span>
          <input name="reason" className={input} autoComplete="off" />
        </label>
      </div>
      <Msg s={state} />
      <div className="flex gap-2">
        <button disabled={pending} className="press h-12 flex-1 rounded-xl bg-bad font-semibold text-white disabled:opacity-60 dark:text-navy">
          {pending ? "Terminating…" : "Yes, terminate"}
        </button>
        <button type="button" onClick={() => setStep("button")} className="press h-12 rounded-xl border border-line px-5 font-semibold text-ink">
          No, keep
        </button>
      </div>
    </form>
  );
}

export function RehireBox({ id }: { id: string }) {
  const [state, action, pending] = useActionState<EmpState, FormData>(rehireEmployee, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <button disabled={pending} className="press h-12 rounded-xl border border-ok/50 font-semibold text-ok disabled:opacity-60">
        {pending ? "Rehiring…" : "Rehire"}
      </button>
      <Msg s={state} />
    </form>
  );
}
