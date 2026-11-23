"use client";

import { useState } from "react";
import { markReminderSent } from "@/app/jobs/actions";
import { TextLink } from "./TextButtons";

/** Day-before reminder: opens Messages and ticks the job off as reminded. */
export function ReminderLink({ jobId, phone, body, sent }: { jobId: string; phone: string; body: string; sent: boolean }) {
  const [done, setDone] = useState(sent);
  return (
    <TextLink
      phone={phone}
      body={body}
      label={done ? "Reminder sent" : "Text reminder"}
      done={done}
      onTap={() => {
        setDone(true);
        void markReminderSent(jobId);
      }}
    />
  );
}
