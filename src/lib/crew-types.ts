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
};

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  lead: "Crew lead",
  mover: "Mover",
};
