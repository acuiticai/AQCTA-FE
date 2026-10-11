function toTimestampMs(value) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

/** Latest actual delivery activity for a campaign (matches backend computeLastActivityAt). */
export function computeLastActivityAt(broadcast) {
  if (!broadcast) return null;

  let maxMs = 0;
  const consider = (value) => {
    const ms = toTimestampMs(value);
    if (ms > maxMs) maxMs = ms;
  };

  consider(broadcast.lastActivityAt);
  consider(broadcast.lastRunAt);
  consider(broadcast.sentAt);

  for (const recipient of broadcast.recipients || []) {
    consider(recipient.emailSentAt);
    consider(recipient.whatsappSentAt);
  }

  for (const run of broadcast.whatsappRuns || []) {
    consider(run.startedAt);
    consider(run.completedAt);
    for (const delivery of run.deliveries || []) {
      consider(delivery.sentAt);
    }
  }

  const current = broadcast.whatsappCurrentRun;
  if (current) {
    consider(current.startedAt);
    consider(current.completedAt);
    for (const delivery of current.deliveries || []) {
      consider(delivery.sentAt);
    }
  }

  return maxMs > 0 ? new Date(maxMs).toISOString() : null;
}
