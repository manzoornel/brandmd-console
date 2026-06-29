"use client";

import { useMemo, useState, useEffect } from "react";
import { STAGES, STAGE_INDEX, stageMeta, ITEM_TYPES } from "@/lib/stages";
import { isAdmin, hasRole } from "@/lib/roles";
import { fmt, dueInfo, shortDate } from "@/lib/format";
import {
  addVideo, editVideo, submitDrive, approveVideo, rejectVideo,
  savePost, markPosted, updateViews, startTask, refreshYouTubeViews,
} from "@/app/actions";
import { youTubeEmbed } from "@/lib/youtube";

const roleFor = (t) => (t === "poster" ? "designer" : t === "shoot" ? "shooter" : "editor");

const DUE_COLORS = {
  over:  { bg: "#FDECEC", fg: "#B42318" },
  today: { bg: "#FEF3C7", fg: "#B45309" },
  soon:  { bg: "#FEF3C7", fg: "#92600A" },
  ok:    { bg: "#EEF1F5", fg: "#64748B" },
};
function DueBadge({ due, small }) {
  const info = dueInfo(due);
  if (!info) return null;
  const c = DUE_COLORS[info.level];
  return (
    <span style={{ background: c.bg, color: c.fg, fontSize: small ? 10 : 11, fontWeight: 700,
      padding: small ? "1px 7px" : "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>
      {info.text}
    </span>
  );
}

export default function Board({ roles, myId, myClientId, videos, clients, people }) {
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState(null);
  const [open, setOpen] = useState({}); // user toggles for doctor groups
  const nameOf = (id) => people.find((p) => p.id === id)?.full_name || "—";
  const clientById = (id) => clients.find((c) => c.id === id);
  const clientOf = (id) => clientById(id)?.name || "— No doctor —";
  const topKeyOf = (v) => { const c = clientById(v.client_id); return (c && c.parent_id) || v.client_id; };
  const subNameOf = (v) => { const c = clientById(v.client_id); return c && c.parent_id ? c.name : null; };
  const dueVal = (v) => (v.due_date ? new Date(v.due_date).getTime() : Infinity);

  const shown = useMemo(
    () => (filter === "all" ? videos : videos.filter((v) => v.client_id === filter)),
    [videos, filter]
  );
  const canCreate = isAdmin(roles) || hasRole(roles, "editor") || hasRole(roles, "designer");

  const toggle = (key, count) =>
    setOpen((o) => ({ ...o, [key]: !(o[key] ?? count <= 3) }));

  return (
    <div className="body">
      <div className="head">
        <div>
          <h1>Content pipeline</h1>
          <p className="sub">Grouped by doctor. Click a doctor to open their items.</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select className="input" style={{ width: "auto" }} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All doctors</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {canCreate && <button className="cta" onClick={() => setModal({ type: "new" })}>+ New item</button>}
        </div>
      </div>

      <div className="kanban">
        {STAGES.map((st) => {
          const items = shown.filter((v) => v.stage === st.key);
          // group by firm (parent) if present, else by the doctor
          const groups = {};
          items.forEach((v) => { const k = topKeyOf(v); (groups[k] || (groups[k] = [])).push(v); });
          // sort each group's items by due date (earliest/overdue first), and groups by their earliest due
          Object.values(groups).forEach((arr) => arr.sort((a, b) => dueVal(a) - dueVal(b)));
          const groupList = Object.entries(groups).sort((a, b) => {
            const ea = Math.min(...a[1].map(dueVal)), eb = Math.min(...b[1].map(dueVal));
            return ea - eb;
          });
          return (
            <section className="col" key={st.key}>
              <div className="col-top">
                <span className="cdot" style={{ background: st.color, boxShadow: `0 0 8px ${st.color}` }} />
                <span className="ctitle">{st.label}</span>
                <span className="ccount">{items.length}</span>
              </div>
              <div className="col-body">
                {items.length === 0 && <div className="emptyc">Nothing here</div>}
                {groupList.map(([cid, arr]) => {
                  const key = st.key + ":" + cid;
                  const expanded = open[key] ?? arr.length <= 3;
                  const overdue = arr.filter((v) => dueInfo(v.due_date)?.level === "over").length;
                  return (
                    <div key={cid} className="dgroup">
                      <button className="dgroup-head" onClick={() => toggle(key, arr.length)}>
                        <span className="dgroup-caret">{expanded ? "▾" : "▸"}</span>
                        <span className="dgroup-name">{clientOf(cid)}</span>
                        {overdue > 0 && <span className="dgroup-over">⚠ {overdue}</span>}
                        <span className="dgroup-count">{arr.length}</span>
                      </button>
                      {expanded && (
                        <div className="dgroup-body">
                          {arr.map((v) => (
                            <Card key={v.id} v={v} roles={roles} myId={myId} myClientId={myClientId}
                              editorName={nameOf(v.editor_id)} subName={subNameOf(v)}
                              onAction={(type) => setModal({ type, video: v })} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {modal && (
        <Modal onClose={() => setModal(null)}>
          <ActionPanel modal={modal} roles={roles} clients={clients} people={people} close={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}

function TypeBadge({ type }) {
  const map = {
    poster: { bg: "rgba(244,161,43,.14)", fg: "#B45309", label: "POSTER" },
    shoot:  { bg: "rgba(225,72,108,.12)", fg: "#C13584", label: "🎬 SHOOT" },
    video:  { bg: "rgba(91,71,251,.12)", fg: "#4938D6", label: "VIDEO" },
  };
  const m = map[type] || map.video;
  return <span className="tag" style={{ background: m.bg, color: m.fg, fontSize: 10 }}>{m.label}</span>;
}

function Card({ v, roles, myId, myClientId, editorName, subName, onAction }) {
  const sm = stageMeta(v.stage);
  const idx = STAGE_INDEX[v.stage];
  const total = (v.yt_views || 0) + (v.ig_views || 0) + (v.fb_views || 0);
  const act = cardAction(v, roles, myId, myClientId);
  const canEdit = isAdmin(roles) || v.editor_id === myId;
  const roleForType = roleFor(v.item_type);
  const locked = v.stage === "to_edit" && v.editor_id && v.editor_id !== myId
    && !isAdmin(roles) && hasRole(roles, roleForType);
  return (
    <article className="card" style={{ borderLeft: `3px solid ${sm.color}` }}>
      <div className="card-top">
        <TypeBadge type={v.item_type} />
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {v.stage === "published" && total > 0
            ? <span className="views"><span className="pulse" />{fmt(total)} views</span>
            : <DueBadge due={v.due_date} small />}
          {canEdit && <button className="editpen" title="Edit details" onClick={() => onAction("edit")}>✎</button>}
        </span>
      </div>
      <div className="card-title">{v.title}</div>
      {subName && <div style={{ fontSize: 11.5, fontWeight: 600, color: "#5B47FB", marginBottom: 6 }}>👤 {subName}</div>}
      {v.stage === "to_edit" && v.brief && <div className="brief">📋 {v.brief}</div>}
      <div className="pipe">
        {STAGES.map((s, i) => (
          <span key={s.key} className="seg"
            style={{ background: i <= idx ? s.color : "#E4E6EF", boxShadow: i === idx ? `0 0 9px ${s.color}99` : "none" }} />
        ))}
      </div>
      <div className="card-meta">
        <span>✎ {editorName}</span>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {v.due_date && <span style={{ color: "#94A3B8" }}>📅 {shortDate(v.due_date)}</span>}
          {v.drive_link && <a className="link" href={v.drive_link} target="_blank" rel="noreferrer">File ↗</a>}
        </span>
      </div>
      {v.stage === "to_edit" && v.rejection_note && <div className="rej">↩ Sent back: {v.rejection_note}</div>}
      {act ? (
        <button className="card-btn" style={{ background: sm.color }} onClick={() => onAction(act.type)}>{act.label}</button>
      ) : locked ? (
        <div className="waiting">🔒 Assigned to {editorName}</div>
      ) : v.stage !== "published" ? (
        <div className="waiting">Waiting on {sm.owner}</div>
      ) : null}
    </article>
  );
}

function cardAction(v, roles, myId, myClientId) {
  const adminOrClient = isAdmin(roles) || (hasRole(roles, "client") && v.client_id === myClientId);
  const roleForType = roleFor(v.item_type);
  const canCreatorAct = (isAdmin(roles) || hasRole(roles, roleForType)) &&
    (isAdmin(roles) || !v.editor_id || v.editor_id === myId);
  if (v.stage === "to_edit" && canCreatorAct)
    return { type: "submit", label: v.item_type === "poster" ? "Add file & submit" : v.item_type === "shoot" ? "Submit shoot" : "Add Drive link & submit" };
  if (v.stage === "review" && adminOrClient) return { type: "review", label: "Review" };
  if (v.stage === "content" && (hasRole(roles, "writer") || isAdmin(roles))) return { type: "post", label: "Write content & post" };
  if (v.stage === "published" && isAdmin(roles)) return { type: "views", label: "Views" };
  if (v.stage === "published") return { type: "view", label: "Open" };
  return null;
}

function Modal({ children, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="closeX" onClick={onClose}>×</button>
        {children}
      </div>
    </div>
  );
}

function ActionPanel({ modal, roles, clients, people, close }) {
  const { type, video } = modal;
  if (type === "new") return <NewItem clients={clients} people={people} close={close} />;
  if (type === "edit") return <EditItem v={video} clients={clients} people={people} close={close} />;
  if (type === "submit") return <SubmitDrive v={video} close={close} />;
  if (type === "review") return <Review v={video} close={close} />;
  if (type === "post") return <PostContent v={video} close={close} />;
  if (type === "views") return <Views v={video} close={close} />;
  if (type === "view") return <ViewOnly v={video} close={close} />;
  return null;
}

function PanelHead({ v, label }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="eyebrow">{label} · {ITEM_TYPES[v.item_type] || "Video"}</div>
      <h2 className="mtitle" style={{ marginBottom: 0 }}>{v.title}</h2>
      {v.due_date && <div style={{ marginTop: 6 }}><DueBadge due={v.due_date} /></div>}
    </div>
  );
}

function NewItem({ clients, people, close }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("video");
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [editorId, setEditorId] = useState("");
  const [brief, setBrief] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const roleForType = roleFor(type);
  const creators = people.filter((p) => (p.roles || []).includes(roleForType));
  async function save() {
    if (!title.trim()) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("title", title.trim()); fd.set("item_type", type);
    fd.set("client_id", clientId); fd.set("editor_id", editorId);
    fd.set("brief", brief); fd.set("due_date", due);
    await addVideo(fd); close();
  }
  return (
    <div>
      <div className="eyebrow">New item</div>
      <h2 className="mtitle">Add to the pipeline</h2>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label className="lbl">Type</label>
          <select className="input" value={type} onChange={(e) => { setType(e.target.value); setEditorId(""); }}>
            <option value="video">Video</option>
            <option value="poster">Poster / Image</option>
            <option value="shoot">Shooting</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label className="lbl">{type === "shoot" ? "Shoot date" : "Due date"}</label>
          <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
      </div>
      <label className="lbl">Title</label>
      <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 3 foods that spike sugar" />
      <label className="lbl">Brief — what needs to be done</label>
      <textarea className="textarea" value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Notes for the editor/designer…" />
      <label className="lbl">Doctor / client</label>
      <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <label className="lbl">Assign to ({type === "poster" ? "Designer" : type === "shoot" ? "Videographer" : "Video Editor"})</label>
      <select className="input" value={editorId} onChange={(e) => setEditorId(e.target.value)}>
        <option value="">— Unassigned —</option>
        {creators.length === 0 && <option value="" disabled>No {type === "poster" ? "designer" : type === "shoot" ? "videographer" : "video editor"} yet</option>}
        {creators.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
      </select>
      <div className="mbtns">
        <button className="btn btn-ghost" onClick={close}>Cancel</button>
        <button className="cta" disabled={busy} onClick={save}>{busy ? "Adding…" : "Add to pipeline"}</button>
      </div>
    </div>
  );
}

function EditItem({ v, clients, people, close }) {
  const [f, setF] = useState({
    title: v.title || "", item_type: v.item_type || "video",
    due_date: v.due_date || "", brief: v.brief || "",
    client_id: v.client_id || "", editor_id: v.editor_id || "",
  });
  const roleForType = roleFor(f.item_type);
  const creators = people.filter((p) => (p.roles || []).includes(roleForType));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function save() {
    if (!f.title.trim()) return;
    setBusy(true); setErr("");
    const fd = new FormData();
    fd.set("id", v.id);
    Object.entries(f).forEach(([k, val]) => fd.set(k, val));
    try { await editVideo(fd); close(); } catch (e) { setErr(e.message); setBusy(false); }
  }
  return (
    <div>
      <div className="eyebrow">Edit item</div>
      <h2 className="mtitle">Edit details</h2>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label className="lbl">Type</label>
          <select className="input" value={f.item_type} onChange={(e) => setF({ ...f, item_type: e.target.value, editor_id: "" })}>
            <option value="video">Video</option>
            <option value="poster">Poster / Image</option>
            <option value="shoot">Shooting</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label className="lbl">Due date</label>
          <input className="input" type="date" value={f.due_date} onChange={set("due_date")} />
        </div>
      </div>
      <label className="lbl">Title</label>
      <input className="input" value={f.title} onChange={set("title")} />
      <label className="lbl">Brief</label>
      <textarea className="textarea" value={f.brief} onChange={set("brief")} />
      <label className="lbl">Doctor / client</label>
      <select className="input" value={f.client_id} onChange={set("client_id")}>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <label className="lbl">Assigned to (reassign / forward)</label>
      <select className="input" value={f.editor_id} onChange={set("editor_id")}>
        <option value="">— Unassigned —</option>
        {creators.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
      </select>
      {err && <p className="hint" style={{ color: "#B42318" }}>{err}</p>}
      <div className="mbtns">
        <button className="btn btn-ghost" onClick={close}>Cancel</button>
        <button className="cta" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save changes"}</button>
      </div>
    </div>
  );
}

function SubmitDrive({ v, close }) {
  const [link, setLink] = useState(v.drive_link || "");
  const [busy, setBusy] = useState(false);
  async function go() { if (!link.trim()) return; setBusy(true); await submitDrive(v.id, link.trim()); close(); }
  return (
    <div>
      <PanelHead v={v} label="Submit for approval" />
      {v.brief && <div className="brief" style={{ marginBottom: 10 }}>📋 {v.brief}</div>}
      <label className="lbl">{v.item_type === "poster" ? "Link to the finished poster (Drive/file)" : "Google Drive link to the edited video"}</label>
      <input className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://drive.google.com/..." />
      <p className="hint">Once submitted it goes to the approver.</p>
      <div className="mbtns">
        <button className="btn btn-ghost" onClick={close}>Cancel</button>
        <button className="cta" disabled={busy} onClick={go}>{busy ? "Submitting…" : "Submit"}</button>
      </div>
    </div>
  );
}

function Review({ v, close }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function ok() { setBusy(true); await approveVideo(v.id); close(); }
  async function back() { setBusy(true); await rejectVideo(v.id, note.trim()); close(); }
  return (
    <div>
      <PanelHead v={v} label="Review" />
      {v.drive_link && <a className="drivebox" href={v.drive_link} target="_blank" rel="noreferrer">▶ Open the file ↗</a>}
      <label className="lbl">If sending back, say what to fix</label>
      <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Trim the intro…" />
      <div className="mbtns">
        <button className="btn btn-danger" disabled={busy} onClick={back}>Send back</button>
        <button className="cta" disabled={busy} onClick={ok}>Approve →</button>
      </div>
    </div>
  );
}

function PostContent({ v, close }) {
  const [f, setF] = useState({
    caption: v.caption || "", hashtags: v.hashtags || "", pinned: v.pinned_comment || "",
    youtube: v.youtube_url || "", instagram: v.instagram_url || "", facebook: v.facebook_url || "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const embed = youTubeEmbed(f.youtube);
  useEffect(() => { startTask(v.id, "content"); }, [v.id]);

  async function draft() { setBusy(true); await savePost(v.id, f); close(); }
  async function post() {
    if (v.item_type !== "shoot") {
      const missing = [];
      if (!f.youtube.trim()) missing.push("YouTube");
      if (!f.instagram.trim()) missing.push("Instagram");
      if (!f.facebook.trim()) missing.push("Facebook");
      if (missing.length) { setErr(`Please paste the ${missing.join(", ")} link before publishing.`); return; }
    }
    setErr(""); setBusy(true);
    try { await markPosted(v.id, f); close(); } catch (e) { setErr(e.message); setBusy(false); }
  }
  return (
    <div style={{ maxHeight: "78vh", overflowY: "auto" }}>
      <PanelHead v={v} label="Content & posting" />
      <TaskTimerPill />
      {v.drive_link && <a className="drivebox" href={v.drive_link} target="_blank" rel="noreferrer">▶ Approved file ↗</a>}
      <label className="lbl">Caption / content</label>
      <textarea className="textarea" value={f.caption} onChange={set("caption")} placeholder="Write the post caption…" />
      <label className="lbl">Hashtags</label>
      <input className="input" value={f.hashtags} onChange={set("hashtags")} placeholder="#diabetes #doctoruncle" />
      <label className="lbl">Pinned comment</label>
      <input className="input" value={f.pinned} onChange={set("pinned")} placeholder="e.g. Book an appointment — link in bio" />
      <p className="hint" style={{ marginTop: 14, fontWeight: 600, color: "#1A1730" }}>
        {v.item_type === "shoot" ? "Links are optional for a shoot:" : "All three links are required to publish:"}
      </p>
      <label className="lbl">YouTube link *</label>
      <input className="input" value={f.youtube} onChange={set("youtube")} placeholder="https://youtu.be/…" />
      {embed && (
        <div style={{ position: "relative", paddingTop: "56%", marginTop: 10, borderRadius: 10, overflow: "hidden" }}>
          <iframe src={embed} title="YouTube" allowFullScreen style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
        </div>
      )}
      <label className="lbl">Instagram link *</label>
      <input className="input" value={f.instagram} onChange={set("instagram")} placeholder="https://instagram.com/…" />
      <label className="lbl">Facebook link *</label>
      <input className="input" value={f.facebook} onChange={set("facebook")} placeholder="https://facebook.com/…" />
      {err && <p className="hint" style={{ color: "#B42318", fontWeight: 600 }}>{err}</p>}
      <div className="mbtns">
        <button className="btn btn-ghost" disabled={busy} onClick={draft}>Save draft</button>
        <button className="cta" disabled={busy} onClick={post}>{v.item_type === "shoot" ? "Mark done ✓" : "Mark posted ✓"}</button>
      </div>
    </div>
  );
}

function Views({ v, close }) {
  const [yt, setYt] = useState(v.yt_views || 0);
  const [ig, setIg] = useState(v.ig_views || 0);
  const [fb, setFb] = useState(v.fb_views || 0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function save() { setBusy(true); await updateViews(v.id, { yt, ig, fb }); close(); }
  async function auto() {
    setMsg("Fetching…");
    const r = await refreshYouTubeViews(v.id, v.youtube_url);
    if (r.ok) { setYt(r.views); setMsg("YouTube views updated ✓"); }
    else setMsg("Auto-pull not active yet (add YOUTUBE_API_KEY — Phase 3).");
  }
  return (
    <div>
      <PanelHead v={v} label="Performance" />
      <label className="lbl">YouTube views {v.youtube_url && <button onClick={auto} style={linkBtn}>↻ auto-pull</button>}</label>
      <input className="input" type="number" value={yt} onChange={(e) => setYt(e.target.value)} />
      <label className="lbl">Instagram views</label>
      <input className="input" type="number" value={ig} onChange={(e) => setIg(e.target.value)} />
      <label className="lbl">Facebook views</label>
      <input className="input" type="number" value={fb} onChange={(e) => setFb(e.target.value)} />
      {msg && <p className="hint" style={{ color: "#4938D6" }}>{msg}</p>}
      <div className="mbtns">
        <button className="btn btn-ghost" onClick={close}>Cancel</button>
        <button className="cta" disabled={busy} onClick={save}>Save views</button>
      </div>
    </div>
  );
}

function ViewOnly({ v, close }) {
  const embed = youTubeEmbed(v.youtube_url);
  return (
    <div>
      <PanelHead v={v} label="Published" />
      {embed && (
        <div style={{ position: "relative", paddingTop: "56%", marginBottom: 12, borderRadius: 10, overflow: "hidden" }}>
          <iframe src={embed} title="YouTube" allowFullScreen style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
        </div>
      )}
      {v.caption && <p style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{v.caption}</p>}
      {v.hashtags && <p style={{ fontSize: 13, color: "#5B47FB" }}>{v.hashtags}</p>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
        {v.youtube_url && <a className="link" href={v.youtube_url} target="_blank" rel="noreferrer">YouTube ↗</a>}
        {v.instagram_url && <a className="link" href={v.instagram_url} target="_blank" rel="noreferrer">Instagram ↗</a>}
        {v.facebook_url && <a className="link" href={v.facebook_url} target="_blank" rel="noreferrer">Facebook ↗</a>}
      </div>
      <div className="mbtns"><button className="cta" onClick={close}>Close</button></div>
    </div>
  );
}

let TIMER_START = 0;
function TaskTimerPill() {
  const [s, setS] = useState(0);
  useEffect(() => {
    TIMER_START = Date.now();
    const t = setInterval(() => setS(Math.floor((Date.now() - TIMER_START) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return (
    <div className="timer" style={{ marginBottom: 12 }}>
      <span className="dot" /> Working · {mm}:{ss}
      <span style={{ fontWeight: 500, color: "#6B7280" }}>(saved when posted)</span>
    </div>
  );
}
const linkBtn = { background: "none", border: "none", color: "#5B47FB", fontWeight: 700, fontSize: 12, cursor: "pointer", marginLeft: 6 };
