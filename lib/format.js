export const fmt = (n) =>
  n >= 1000 ? (n / 1000).toFixed(1).replace(".0", "") + "k" : String(n || 0);

export const hoursBetween = (a, b) =>
  a && b ? (new Date(b) - new Date(a)) / 36e5 : null;

export const hms = (sec) => {
  if (sec == null) return "—";
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export const dueInfo = (due) => {
  if (!due) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(due); d.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  if (diff < 0) return { text: `Overdue ${-diff}d`, level: "over" };
  if (diff === 0) return { text: "Due today", level: "today" };
  if (diff <= 2) return { text: `${diff}d left`, level: "soon" };
  return { text: `${diff}d left`, level: "ok" };
};
export const shortDate = (d) =>
  d ? new Date(d).toLocaleDateString([], { day: "numeric", month: "short" }) : "";
