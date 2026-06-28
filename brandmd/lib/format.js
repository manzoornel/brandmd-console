export const fmt = (n) =>
  n >= 1000 ? (n / 1000).toFixed(1).replace(".0", "") + "k" : String(n || 0);

export const hoursBetween = (a, b) =>
  a && b ? (new Date(b) - new Date(a)) / 36e5 : null;

export const hms = (sec) => {
  if (sec == null) return "—";
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
