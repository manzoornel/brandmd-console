// Extract a YouTube video id from any common URL shape (for inline playback).
export function youTubeId(url = "") {
  const m = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{6,})/
  );
  return m ? m[1] : null;
}
export function youTubeEmbed(url = "") {
  const id = youTubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

// PHASE 3 — auto-pull view counts. Needs YOUTUBE_API_KEY in env.
// Returns view count number, or null if unavailable.
export async function fetchYouTubeViews(url) {
  const id = youTubeId(url);
  const key = process.env.YOUTUBE_API_KEY;
  if (!id || !key) return null;
  try {
    const r = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${id}&key=${key}`
    );
    const j = await r.json();
    return Number(j?.items?.[0]?.statistics?.viewCount) || 0;
  } catch (_) {
    return null;
  }
}
