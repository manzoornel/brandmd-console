// Production credit follows the editor; posting credit follows the writer.
export function workerOutput(items, userId, inRange, now) {
  const published = v => v.stage === "published" && inRange(v.posted_at) && new Date(v.posted_at) <= new Date(now);
  const owned = items.filter(v => v.editor_id === userId);
  const counts = type => {
    const edits = owned.filter(v => v.item_type === type && inRange(v.submitted_at));
    return {
      edited: edits.length,
      scheduled: edits.filter(v => v.stage === "scheduled").length,
      publishedFromEdits: edits.filter(published).length,
      published: owned.filter(v => v.item_type === type && published(v)),
    };
  };
  return { video: counts("video"), poster: counts("poster"),
    posting: items.filter(v => v.writer_id === userId && ["video", "poster"].includes(v.item_type) && published(v)) };
}
