// Quote follow-ups: when to nudge a customer who hasn't signed, and the text to send. Safe on the server and the phone.
import { addDays, fmtDayLong, todayISO } from "./dates";
import type { Quote } from "./quotes";

type Q = Pick<Quote, "status" | "sent_at" | "accepted_at" | "followups" | "last_followup_at" | "valid_until" | "customer_name" | "move_date" | "share_token">;

export type FollowUp = { kind: "first" | "second" | "expiring"; label: string };

/** Whole days between a moment and today, both counted in Stockton time. */
const daysSince = (ts: string, today: string) => Math.round((Date.parse(today + "T12:00:00Z") - Date.parse(todayISO(new Date(ts)) + "T12:00:00Z")) / 86_400_000);

/** Is a follow-up due on this quote today? First after 1 day, second 3 days after that, and before the estimate expires. */
export function followUpDue(q: Q, today: string): FollowUp | null {
  if (!(q.status === "quoted" || q.status === "follow_up") || !q.sent_at || q.accepted_at) return null;
  if (q.valid_until && q.valid_until >= today && q.valid_until <= addDays(today, 2)) {
    const lastTouch = q.last_followup_at ? todayISO(new Date(q.last_followup_at)) : undefined;
    if (!lastTouch || lastTouch < addDays(q.valid_until, -2)) return { kind: "expiring", label: `Expires ${q.valid_until === today ? "today" : fmtDayLong(q.valid_until).split(",")[0]}` };
  }
  const touched = q.last_followup_at ?? q.sent_at;
  const d = daysSince(touched, today);
  if (q.followups === 0 && d >= 1) return { kind: "first", label: "Follow up today" };
  if (q.followups === 1 && d >= 3) return { kind: "second", label: "2nd follow-up due" };
  return null;
}

/** The ready-to-send text for a follow-up. */
export function followUpText(q: Q, kind: FollowUp["kind"], link: string, phone: string) {
  const first = q.customer_name.replace(/^example:\s*/i, "").trim().split(/\s+/)[0] || "there";
  const when = q.move_date ? ` on ${fmtDayLong(q.move_date)}` : "";
  if (kind === "expiring")
    return [
      `Hi ${first}, Zach with Zachery's Moving Co. Your moving estimate is good through ${q.valid_until ? fmtDayLong(q.valid_until) : "soon"}.`,
      `Sign here to lock in your price and your date${when}:`,
      link,
      "",
      `Questions? Call or text ${phone}.`,
    ].join("\n");
  if (kind === "second")
    return [
      `Hi ${first}, Zach with Zachery's Moving Co. again. Your move${when} is still open on our schedule.`,
      "Want me to hold the date for you? You can sign and book here:",
      link,
      "",
      `Or call or text ${phone}.`,
    ].join("\n");
  return [
    `Hi ${first}, just checking that you got your moving estimate from Zachery's Moving Co.:`,
    link,
    "",
    "Happy to answer any questions or adjust anything.",
    `Call or text ${phone}.`,
  ].join("\n");
}
