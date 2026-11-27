"use client";

import { useState } from "react";
import { markConfirmSent } from "@/app/jobs/actions";
import { TextLink } from "./TextButtons";

/** 7-day or 2-day confirmation: opens Messages and ticks it off as sent. */
export function ConfirmLink({ jobId, phone, body, sent, days }: { jobId: string; phone: string; body: string; sent: boolean; days: 7 | 2 }) {
  const [done, setDone] = useState(sent);
  return (
    <TextLink
      phone={phone}
      body={body}
      label={done ? `${days}-day sent` : `${days}-day confirmation`}
      done={done}
      onTap={() => {
        setDone(true);
        void markConfirmSent(jobId, days);
      }}
    />
  );
}
