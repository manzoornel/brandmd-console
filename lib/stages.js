export const STAGES = [
  { key: "to_edit",   label: "To Do",              color: "#94A3B8", owner: "creator"  },
  { key: "review",    label: "In Review",          color: "#F4A12B", owner: "approver" },
  { key: "content",   label: "Content & Posting",  color: "#5B47FB", owner: "writer"   },
  { key: "published", label: "Published",          color: "#18B57A", owner: null       },
];
export const STAGE_INDEX = STAGES.reduce((a, s, i) => ((a[s.key] = i), a), {});
export const stageMeta = (k) => STAGES.find((s) => s.key === k) || STAGES[0];

export const ITEM_TYPES = { video: "Video", poster: "Poster / Image" };
