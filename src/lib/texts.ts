// Text messages to customers. The app writes them; the phone's Messages app sends them.
// Safe to use on the server and the phone.
import { fmtDayLong, fmtMinutes, fmtTime, minutes } from "./dates";
import { jobCrew, type Job } from "./jobs";
import { money } from "./pricing";

export type TextSettings = { business_phone: string; expect_url: string };

const firstName = (name: string) => name.replace(/^example:\s*/i, "").trim().split(/\s+/)[0] || "there";
const expectLine = (s: TextSettings) => (s.expect_url ? `\n\nWhat to expect on moving day: ${s.expect_url}` : "");
const questions = (s: TextSettings) => `Questions? Call or text ${s.business_phone}.`;

/** Opens the phone's Messages app with the number and message filled in. Works on iPhone and Android. */
export function smsHref(phone: string, body: string) {
  let digits = phone.replace(/[^0-9+]/g, "");
  if (/^\d{10}$/.test(digits)) digits = `+1${digits}`;
  return `sms:${digits}?&body=${encodeURIComponent(body)}`;
}

type JobForText = Pick<Job, "customer_name" | "job_date" | "start_time" | "movers_needed" | "lead_id" | "crew_ids" | "truck" | "nte">;

const crewSize = (j: JobForText) => Math.max(j.movers_needed || 2, jobCrew(j).length);
const nteLine = (j: JobForText) => (j.nte != null ? ` Your written not-to-exceed price is ${money(Number(j.nte))}.` : "");
const atTime = (j: JobForText) => (j.start_time ? ` at ${fmtTime(j.start_time)}` : "");

export function bookingText(j: JobForText, s: TextSettings) {
  return (
    `Hi ${firstName(j.customer_name)}, you're booked with Zachery's Moving Co. for ${fmtDayLong(j.job_date)}${atTime(j)}. ` +
    `We'll send ${crewSize(j)} movers${j.truck === "theirs" ? "" : " with our truck"}.${nteLine(j)} ` +
    `We'll text you the day before. ${questions(s)}${expectLine(s)}`
  );
}

export function reminderText(j: JobForText, s: TextSettings) {
  return (
    `Hi ${firstName(j.customer_name)}, this is Zachery's Moving Co. with a reminder that your move is tomorrow, ${fmtDayLong(j.job_date)}. ` +
    `Our crew of ${crewSize(j)} plans to arrive${j.start_time ? ` around ${fmtTime(j.start_time)}` : " in the morning"}, and we'll text you when we're on our way.` +
    `${nteLine(j)} ${questions(s)}${expectLine(s)}`
  );
}

/** "On my way": arrival = now + drive minutes, rounded up to the next 5 minutes (Stockton time). */
export function onMyWayText(customerName: string, senderName: string, driveMinutes: number, now: Date) {
  const nowMin = minutes(
    new Intl.DateTimeFormat("en-GB", { timeZone: "America/Los_Angeles", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now),
  )!;
  const eta = Math.ceil((nowMin + driveMinutes) / 5) * 5;
  const from = senderName.trim().split(/\s+/)[0];
  return (
    `Hi ${firstName(customerName)}, this is ${from} with Zachery's Moving Co. We're on our way and expect to arrive around ${fmtMinutes(eta)}. See you soon!`
  );
}
