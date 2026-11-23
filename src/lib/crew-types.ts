// Crew types and labels. Safe to use on both the server and the phone.
export type Role = "owner" | "lead" | "mover";

export type CrewMember = {
  id: string;
  user_id: string | null;
  email: string | null;
  full_name: string;
  phone: string | null;
  role: Role;
  active: boolean;
  /** Optional: older rows may not have it loaded. */
  employment?: Employment;
};

/** Employment type. Controls what someone can see when they log in (enforced in the database too). */
export type Employment = "full_time" | "part_time" | "on_call" | "leave";

export const EMPLOYMENT: Record<Employment, { label: string; access: string }> = {
  full_time: { label: "Full-time", access: "Sees their jobs 2–3 weeks ahead, the calendar and clock-in." },
  part_time: { label: "Part-time", access: "Sees their jobs 2–3 weeks ahead, the calendar and clock-in." },
  on_call: {
    label: "On call",
    access: "Only sees a job from the day before to the day after it. Otherwise just their home screen.",
  },
  leave: { label: "Leave of absence", access: "Can log in, but only sees their home screen. No schedule or jobs." },
};

/** Full-time and part-time see the normal schedule. On-call and leave get the limited home screen. */
export const isLimited = (e: Employment | undefined) => e === "on_call" || e === "leave";

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  lead: "Crew lead",
  mover: "Mover",
};
