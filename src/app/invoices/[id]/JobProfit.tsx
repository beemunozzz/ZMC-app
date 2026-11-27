// OWNER ONLY: what ZMC keeps from this job. Customer pays − crew pay − our truck − materials and water.
// Crew pay rates come from the owner-only crew_pay table; never show this to crew or customers.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Invoice } from "@/lib/invoices";
import { money, type Prices } from "@/lib/pricing";
import { getOwnerCosts } from "@/lib/settings";
import { truckCost, type TruckChoices } from "@/lib/truck-cost";

type JobBits = {
  lead_id: string | null;
  crew_ids: string[];
  drive_min: number | null;
  drive_back_min: number | null;
  quote_id: string | null;
  miles_out: number | null;
  miles_between: number | null;
  miles_back: number | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const hrs = (n: number) => String(Math.round(n * 100) / 100);

export async function JobProfit({ supabase, inv, prices }: { supabase: SupabaseClient; inv: Invoice; prices: Prices }) {
  const { data: jobRow } = await supabase
    .from("jobs")
    .select("lead_id, crew_ids, drive_min, drive_back_min, quote_id, miles_out, miles_between, miles_back")
    .eq("id", inv.job_id)
    .maybeSingle();
  const job = jobRow as JobBits | null;
  if (!job) return null;
  const people = [...new Set([job.lead_id, ...(job.crew_ids ?? [])].filter((x): x is string => !!x))];

  const [{ data: members }, { data: pay }, { data: clock }, { data: quote }, costs] = await Promise.all([
    supabase.from("crew_members").select("id, full_name").in("id", people.length ? people : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("crew_pay").select("crew_id, hourly_rate").in("crew_id", people.length ? people : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("time_entries").select("crew_id, clock_in, clock_out").eq("job_id", inv.job_id),
    job.quote_id ? supabase.from("quotes").select("truck_cost").eq("id", job.quote_id).maybeSingle() : Promise.resolve({ data: null }),
    getOwnerCosts(supabase),
  ]);
  const nameOf = new Map((members ?? []).map((m) => [m.id as string, m.full_name as string]));
  const rateOf = new Map((pay ?? []).map((p) => [p.crew_id as string, p.hourly_rate == null ? null : Number(p.hourly_rate)]));

  // Paid hours: what each person clocked on this job; if they didn't clock in, the job hours plus the drive to and from the shop.
  const travel = r2(((Number(job.drive_min) || 0) + (Number(job.drive_back_min) || 0)) / 60);
  const fallbackHours = r2(Number(inv.hours) + travel);
  const clocked = new Map<string, number>();
  for (const e of clock ?? []) {
    if (!e.clock_out) continue;
    const h = (new Date(e.clock_out as string).getTime() - new Date(e.clock_in as string).getTime()) / 3_600_000;
    clocked.set(e.crew_id as string, (clocked.get(e.crew_id as string) ?? 0) + h);
  }
  const crew = people.map((id) => {
    const rate = rateOf.get(id) ?? null;
    const fromClock = clocked.has(id);
    const hours = fromClock ? r2(clocked.get(id)!) : fallbackHours;
    return { id, name: nameOf.get(id) ?? "Removed", rate, hours, fromClock, pay: rate == null ? 0 : r2(rate * hours) };
  });
  const missingRates = crew.filter((c) => c.rate == null);
  const crewPay = r2(crew.reduce((a, c) => a + c.pay, 0));

  // Our truck: the choices saved on the quote, or a one-day round trip for the job's miles.
  let truck = 0;
  if (inv.truck === "ours") {
    const saved = (quote as { truck_cost?: Partial<TruckChoices> } | null)?.truck_cost ?? {};
    const miles = (Number(job.miles_out) || 0) + (Number(job.miles_between) || 0) + (Number(job.miles_back) || 0);
    const choices: TruckChoices = {
      miles: Number(saved.miles) || miles,
      days: Number(saved.days) || 1,
      type: saved.type === "oneway" ? "oneway" : "round",
      oneway_price: Number(saved.oneway_price) || 0,
      fuel: saved.fuel === "diesel" ? "diesel" : "unleaded",
      follow_miles: Number(saved.follow_miles) || 0,
    };
    truck = truckCost(choices, costs).total;
  }
  const supplies = r2((Number(prices.materials) || 0) + (Number(prices.water) || 0));
  const total = Number(inv.total);
  const profit = r2(total - crewPay - truck - supplies);
  const up = profit >= 0;

  const line = (label: React.ReactNode, amount: number, sub?: React.ReactNode) => (
    <div className="flex items-start justify-between gap-3">
      <span className="min-w-0 text-ink">
        {label}
        {sub && <span className="block text-xs tabular-nums text-muted">{sub}</span>}
      </span>
      <span className="shrink-0 tabular-nums text-ink">{money(amount)}</span>
    </div>
  );

  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-extrabold uppercase text-ink">Job profit</h2>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Only you see this</span>
      </div>
      {line("Customer pays", total)}
      {crew.length ? (
        crew.map((c) =>
          line(
            <>− {c.name}</>,
            c.pay,
            c.rate == null ? (
              <span className="text-warn">No pay rate set (Payroll → Employees)</span>
            ) : (
              <>
                {money(c.rate)}/hr × {hrs(c.hours)} hrs {c.fromClock ? "(clocked)" : `(job ${hrs(Number(inv.hours))} + travel ${hrs(travel)})`}
              </>
            ),
          ),
        )
      ) : (
        <p className="text-warn">No crew on this job, so crew pay isn&apos;t counted.</p>
      )}
      {inv.truck === "ours" && line("− Our truck", truck, job.quote_id ? "Rental, gas and pickup time, from the quote" : "Estimate: one-day round trip, rental, gas and pickup time")}
      {line("− Materials and crew water", supplies)}
      <div className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 font-semibold ${up ? "bg-ok/12 text-ok" : "bg-bad/10 text-bad"}`}>
        <span>{up ? "▲ Job profit" : "▼ Loss on this job"}</span>
        <span className="tabular-nums">{money(Math.abs(profit))}</span>
      </div>
      <p className="text-xs text-muted">
        Before payroll taxes and card fees.{missingRates.length ? ` Add pay rates for ${missingRates.map((c) => c.name).join(", ")} to make this exact.` : ""}
      </p>
    </section>
  );
}
