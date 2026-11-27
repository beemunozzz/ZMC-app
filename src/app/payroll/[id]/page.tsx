import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { PageLoading } from "@/components/PageLoading";
import { EMPLOYMENT, roleLabel, requireMember, type CrewMember } from "@/lib/crew";
import { fmtDayLong, fmtShort, mondayOf, todayISO } from "@/lib/dates";
import { telUrl } from "@/lib/jobs";
import { money } from "@/lib/pricing";
import { TIME_COLUMNS, entryHours, fmtDuration, weekBounds, type TimeEntry } from "@/lib/time";
import { WeekView } from "@/components/WeekView";
import { ScheduleHistory } from "@/components/ScheduleHistory";
import { decideWeek } from "@/app/my-schedule/actions";
import { WEEKDAY_LABEL, WEEKLY_COLUMNS, cleanWeek, currentOf, weekChanges, type WeeklySchedule } from "@/lib/regular";
import { setupForAll, PROFILE_COLUMNS, type Profile } from "@/lib/setup";
import { InfoForm, RaiseForm, RehireBox, TerminateBox, type PrivateInfo } from "./EmployeeForms";

export default function EmployeePage({ params }: PageProps<"/payroll/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Employee params={params} />
    </Suspense>
  );
}

type PayRow = PrivateInfo & {
  hourly_rate: number | null;
  terminated_at: string | null;
  termination_date: string | null;
  termination_reason: string;
};

async function Employee({ params }: Pick<PageProps<"/payroll/[id]">, "params">) {
  const { id } = await params;
  const { supabase, me } = await requireMember();
  if (!me || me.role !== "owner") redirect("/");

  const today = todayISO();
  const [{ data: m }, { data: p }, { data: history }, { data: jobs }] = await Promise.all([
    supabase.from("crew_members").select("id, user_id, email, full_name, phone, role, active, employment, is_dev").eq("id", id).maybeSingle(),
    supabase.from("crew_pay").select("hourly_rate, address, emergency_name, emergency_phone, hire_date, notes, terminated_at, termination_date, termination_reason").eq("crew_id", id).maybeSingle(),
    supabase.from("pay_changes").select("id, old_rate, new_rate, effective_date, note").eq("crew_id", id).order("effective_date", { ascending: false }),
    supabase.from("jobs").select("id, lead_id, crew_ids, job_date, status").gte("job_date", today).in("status", ["booked", "confirmed"]),
  ]);
  if (!m) notFound();
  const member = m as CrewMember;
  const pay = (p ?? {}) as Partial<PayRow>;
  const info: PrivateInfo = {
    address: pay.address ?? "",
    emergency_name: pay.emergency_name ?? "",
    emergency_phone: pay.emergency_phone ?? "",
    hire_date: pay.hire_date ?? null,
    notes: pay.notes ?? "",
  };
  const rate = pay.hourly_rate == null ? null : Number(pay.hourly_rate);
  const terminated = !member.active && !!pay.terminated_at;
  const upcoming = (jobs ?? []).filter((j) => j.lead_id === id || (j.crew_ids as string[]).includes(id)).length;
  const emp = member.employment ?? "full_time";

  // Hours: this week and the last 4 weeks.
  const [weekStart] = weekBounds(mondayOf(today));
  const fourWeeksAgo = weekBounds(mondayOf(today))[0];
  const since = new Date(Date.parse(fourWeeksAgo) - 21 * 86_400_000).toISOString();
  const { data: t } = await supabase.from("time_entries").select(TIME_COLUMNS).eq("crew_id", id).gte("clock_in", since);
  const entries = (t ?? []) as TimeEntry[];
  const weekHours = entries.filter((e) => e.clock_in >= weekStart).reduce((s, e) => s + entryHours(e), 0);
  const monthHours = entries.reduce((s, e) => s + entryHours(e), 0);

  // What they filled in themselves: info, regular schedule, and the setup checklist.
  const [{ data: prof }, { data: wk }] = await Promise.all([
    supabase.from("crew_profile").select(PROFILE_COLUMNS).eq("crew_id", id).maybeSingle(),
    supabase.from("weekly_schedules").select(WEEKLY_COLUMNS).eq("crew_id", id).order("created_at"),
  ]);
  const profile = (prof ?? null) as Profile | null;
  const weeks = (wk ?? []) as WeeklySchedule[];
  const current = currentOf(weeks);
  const week = current ? cleanWeek(current.days) : null;
  const pendingWeek = weeks.find((w) => w.status === "pending") ?? null;
  const pendingChanges = pendingWeek ? weekChanges(week, cleanWeek(pendingWeek.days)) : [];
  const setup = (await setupForAll(supabase, [member])).get(member.id)!;

  const card = "flex flex-col gap-3 rounded-2xl border border-line bg-card p-4";
  const h2 = "font-display text-lg font-extrabold uppercase text-ink";

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="Employee" isOwner name={me.full_name} roleLabel={roleLabel(me)} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4">
        <Link href="/payroll" className="text-sm font-semibold text-primary">
          ‹ Payroll
        </Link>

        <section className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 break-words font-display text-3xl font-extrabold uppercase leading-tight text-ink">{member.full_name}</h1>
            {terminated ? (
              <span className="rounded-full bg-bad/10 px-2.5 py-0.5 text-xs font-semibold text-bad">Terminated</span>
            ) : emp === "leave" ? (
              <span className="rounded-full bg-warn/12 px-2.5 py-0.5 text-xs font-semibold text-warn">On leave</span>
            ) : (
              <span className="rounded-full bg-ok/12 px-2.5 py-0.5 text-xs font-semibold text-ok">{EMPLOYMENT[emp].label}</span>
            )}
          </div>
          <p className="text-sm text-muted">
            {roleLabel(member)}
            {info.hire_date ? ` · since ${fmtShort(info.hire_date)}, ${info.hire_date.slice(0, 4)}` : ""}
            {member.phone && (
              <>
                {" · "}
                <a href={telUrl(member.phone)} className="font-semibold text-primary">
                  {member.phone}
                </a>
              </>
            )}
          </p>
          {terminated && (
            <p className="mt-1 rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">
              Terminated{pay.termination_date ? ` · last day ${fmtDayLong(pay.termination_date)}` : ""}
              {pay.termination_reason ? ` · ${pay.termination_reason}` : ""}. They can&apos;t log in.
            </p>
          )}
        </section>

        {/* Pay */}
        <section className={card}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className={h2}>Pay</h2>
            <span className="font-display text-3xl font-extrabold tabular-nums text-ink">{rate != null ? `${money(rate)}/hr` : "Not set"}</span>
          </div>
          <dl className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-bg p-3">
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted">This week</dt>
              <dd className="font-display text-xl font-extrabold tabular-nums text-ink">{fmtDuration(weekHours)}</dd>
              {rate != null && weekHours > 0 && <dd className="text-xs tabular-nums text-muted">≈ {money(Math.round(weekHours * rate * 100) / 100)}</dd>}
            </div>
            <div className="rounded-xl bg-bg p-3">
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Last 4 weeks</dt>
              <dd className="font-display text-xl font-extrabold tabular-nums text-ink">{fmtDuration(monthHours)}</dd>
              {rate != null && monthHours > 0 && <dd className="text-xs tabular-nums text-muted">≈ {money(Math.round(monthHours * rate * 100) / 100)}</dd>}
            </div>
          </dl>
          {!terminated && <RaiseForm id={member.id} rate={rate} today={today} />}
          {(history ?? []).length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Pay history</p>
              <ul className="divide-y divide-line">
                {(history ?? []).map((h) => (
                  <li key={h.id as string} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 text-ink">
                      {fmtShort(h.effective_date as string)}, {(h.effective_date as string).slice(0, 4)}
                      {h.note ? <span className="text-muted"> · {h.note as string}</span> : null}
                    </span>
                    <span className="shrink-0 tabular-nums text-ink">
                      {h.old_rate != null ? `${money(Number(h.old_rate))} → ` : ""}
                      <b>{money(Number(h.new_rate))}</b>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {member.role !== "owner" && (
          <>
            {/* Setup checklist progress */}
            <section className={card}>
              <div className="flex items-baseline justify-between gap-2">
                <h2 className={h2}>Set up</h2>
                <span className={`text-sm font-semibold tabular-nums ${setup.done === setup.total ? "text-ok" : "text-warn"}`}>
                  {setup.done} of {setup.total} done
                </span>
              </div>
              <ul className="grid gap-1 text-sm">
                {setup.list.map((i) => (
                  <li key={i.key} className={i.done ? "text-muted" : "text-ink"}>
                    {i.done ? "✓" : "○"} {i.title}
                  </li>
                ))}
              </ul>
            </section>

            {/* What they filled in */}
            <section className={card}>
              <h2 className={h2}>Filled in by {member.full_name.split(" ")[0]}</h2>
              {profile ? (
                <dl className="grid gap-2 text-sm">
                  {(
                    [
                      ["Address", profile.address],
                      ["Emergency", [profile.emergency_name, profile.emergency_relation && `(${profile.emergency_relation})`, profile.emergency_phone].filter(Boolean).join(" ")],
                      ["License", profile.has_license == null ? "" : profile.has_license ? "Has a driver's license" : "No driver's license"],
                      ["Shirt", profile.shirt_size],
                      ["Shoes", profile.shoe_size],
                      ["Birthday", profile.birth_date ? new Date(profile.birth_date + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" }) : ""],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <dt className="w-24 shrink-0 text-muted">{k}</dt>
                      <dd className="min-w-0 break-words text-ink">{v || <span className="text-muted">Not filled in</span>}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-muted">Nothing yet. It shows up here once they fill in &ldquo;My info&rdquo; in the app.</p>
              )}
            </section>

            {/* Regular schedule */}
            <section id="schedule" className={`${card} scroll-mt-20`}>
              <h2 className={h2}>Regular schedule</h2>
              {week ? <WeekView week={week} /> : <p className="text-sm text-muted">Not filled in yet.</p>}
              {pendingWeek && (
                <div className="flex flex-col gap-2 rounded-xl border border-warn/40 p-3">
                  <p className="text-[15px] font-semibold text-ink">Wants to change:</p>
                  <ul className="text-sm">
                    {pendingChanges.map((c) => (
                      <li key={c.day}>
                        {WEEKDAY_LABEL[c.day]}: <span className="text-muted line-through">{c.before}</span> → <b>{c.after}</b>
                      </li>
                    ))}
                  </ul>
                  {pendingWeek.note && <p className="text-xs text-muted">&ldquo;{pendingWeek.note}&rdquo;</p>}
                  <form action={decideWeek} className="grid grid-cols-2 gap-2">
                    <input type="hidden" name="id" value={pendingWeek.id} />
                    <button name="answer" value="approve" className="press h-11 rounded-xl bg-ok font-semibold text-white dark:text-navy">
                      Approve
                    </button>
                    <button name="answer" value="deny" className="press h-11 rounded-xl border border-bad/50 font-semibold text-bad">
                      Deny
                    </button>
                  </form>
                </div>
              )}
            </section>
            {weeks.length > 0 && <ScheduleHistory rows={weeks} />}
          </>
        )}

        <InfoForm member={member} info={info} isMe={member.id === me.id} />

        {/* Danger zone */}
        {member.id !== me.id && (
          <section className="flex flex-col gap-2 rounded-2xl border border-bad/30 bg-card p-4">
            <h2 className={h2}>{terminated ? "Rehire" : "End employment"}</h2>
            {terminated ? <RehireBox id={member.id} /> : <TerminateBox id={member.id} name={member.full_name} upcoming={upcoming} today={today} />}
            {!terminated && (
              <p className="text-xs text-muted">
                Just taking a break? Set <b>Employment</b> to <b>Leave of absence</b> above instead. They keep their login but can&apos;t see jobs.
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
