// The crew "Get set up" checklist. Server only. Each item checks itself off from what's saved.

type Db = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

export type Profile = {
  crew_id: string;
  address: string;
  emergency_name: string;
  emergency_relation: string;
  emergency_phone: string;
  has_license: boolean | null;
  shirt_size: string;
  /** New hire packet (Nov 2026). */
  birth_date: string | null;
  shoe_size: string;
  /** Finished the "Welcome to ZMC Hub" walkthrough. */
  onboarded_at: string | null;
  updated_at: string;
};
export const PROFILE_COLUMNS = "crew_id, address, emergency_name, emergency_relation, emergency_phone, has_license, shirt_size, birth_date, shoe_size, onboarded_at, updated_at";

export type SetupItem = { key: string; title: string; sub: string; href: string; done: boolean };

export const SHIRT_SIZES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL"];
/** US men's shoe sizes (for work boots). */
export const SHOE_SIZES = ["6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12", "12.5", "13", "14", "15", "16"];

function items(phone: string | null, p: Profile | undefined, hasSchedule: boolean, hasPush: boolean): SetupItem[] {
  return [
    {
      key: "schedule",
      title: "Your regular schedule",
      sub: "Days you can't work, or when you need to be off by",
      href: "/my-schedule",
      done: hasSchedule,
    },
    {
      key: "contact",
      title: "About you and emergency contact",
      sub: "Your phone, address, birthday, and who to call in an emergency",
      href: "/my-info",
      done: !!(phone?.trim() && p?.address.trim() && p.birth_date && p.emergency_name.trim() && p.emergency_phone.trim()),
    },
    {
      key: "extra",
      title: "Driver's license, shirt and shoe size",
      sub: "So Zach knows who can drive and what shirts and boots to order",
      href: "/my-info#extra",
      done: !!(p && p.has_license !== null && p.shirt_size && p.shoe_size),
    },
    {
      key: "push",
      title: "Notifications and home screen",
      sub: "Get told the moment you're put on a job",
      href: "/notifications",
      done: hasPush,
    },
  ];
}

/** One crew member's checklist. */
export async function setupFor(supabase: Db, me: { id: string; phone: string | null }) {
  const [{ data: prof }, { data: sched }, { data: push }] = await Promise.all([
    supabase.from("crew_profile").select(PROFILE_COLUMNS).eq("crew_id", me.id).maybeSingle(),
    supabase.from("weekly_schedules").select("id").eq("crew_id", me.id).limit(1),
    supabase.from("push_subscriptions").select("id").eq("crew_id", me.id).limit(1),
  ]);
  return items(me.phone, (prof ?? undefined) as Profile | undefined, !!sched?.length, !!push?.length);
}

/** Everyone's progress, for Zach ("3 of 4 done"). */
export async function setupForAll(supabase: Db, crew: { id: string; phone: string | null }[]) {
  const [{ data: profs }, { data: scheds }, { data: pushes }] = await Promise.all([
    supabase.from("crew_profile").select(PROFILE_COLUMNS),
    supabase.from("weekly_schedules").select("crew_id"),
    supabase.from("push_subscriptions").select("crew_id"),
  ]);
  const prof = new Map(((profs ?? []) as Profile[]).map((p) => [p.crew_id, p]));
  const sched = new Set(((scheds ?? []) as { crew_id: string }[]).map((r) => r.crew_id));
  const push = new Set(((pushes ?? []) as { crew_id: string }[]).map((r) => r.crew_id));
  return new Map(
    crew.map((c) => {
      const list = items(c.phone, prof.get(c.id), sched.has(c.id), push.has(c.id));
      return [c.id, { done: list.filter((i) => i.done).length, total: list.length, list }];
    }),
  );
}
