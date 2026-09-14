// datetime-local inputs here are explicitly interpreted as India office time.
export function publicationTime(value, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value || "")) throw new Error("Choose a valid date and time (India time).");
  const date = new Date(`${value}:00+05:30`);
  if (!Number.isFinite(date.getTime()) || date.getTime() <= now) throw new Error("Choose a future publishing date and time.");
  if (new Date(date.getTime()+330*60000).toISOString().slice(0,16) !== value) throw new Error("Invalid calendar date.");
  return date.toISOString();
}
