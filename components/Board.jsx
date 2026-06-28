"use client";

import { useMemo, useState, useEffect } from "react";
import { STAGES, STAGE_INDEX, stageMeta, ITEM_TYPES } from "@/lib/stages";
import { isAdmin, hasRole } from "@/lib/roles";
import { fmt } from "@/lib/format";
import {
  addVideo, submitDrive, approveVideo, rejectVideo,
  savePost, markPosted, updateViews, startTask, refreshYouTubeViews,
} from "@/app/actions";
import { youTubeEmbed } from "@/lib/youtube";

export default function Board({ roles, myClientId, videos, clients, people }) {
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState(null);
  const nameOf = (id) => people.find((p) => p.id === id)?.full_name || "—";
  const clientOf = (id) => clients.find((c) => c.id === id)?.name || "—";

  const shown = useMemo(
    () => (filter === "all" ? videos : videos.filter((v) => v.client_id === filter)),
    [videos, filter]
  );
  const canCreate = isAdmin(roles) || hasRole(roles, "editor") || hasRole(roles, "designer");

  return (
    <div className="body">
      <div className="head">
        <div>
          <h1>Content pipeline</h1>
          <p className="sub">Every video and poster from start to live, in one signal.</p>
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
          return (
            <section className="col" key={st.key}>
              <div className="col-top">
                <span className="cdot" style={{ background: st.color, boxShadow: `0 0 8px ${st.color}` }} />
                <span className="ctitle">{st.label}</span>
                <span className="ccount">{items.length}</span>
              </div>
              <div className="col-body">
                {items.length === 0 && <div className="emptyc">Nothing here</div>}
                {items.map((v) => (
                  <Card key={v.id} v={v} roles={roles} myClientId={myClientId}
                    editorName={nameOf(v.editor_id)} clientName={clientOf(v.client_id)}
                    onAction={(type) => setModal({ type, video: v })} />
                ))}
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
  const poster = type === "poster";
  return (
    <span className="tag" style={{ background: poster ? "rgba(244,161,43,.14)" : "rgba(91,71,251,.12)",
      color: poster ? "#B45309" : "#4938D6", fontSize: 10 }}>
      {poster ? "POSTER" : "VIDEO"}
    </span>
  );
}

function Card({ v, roles, myClientId, editorName, clientName, onAction }) {
  const sm = stageMeta(v.stage);
  const idx = STAGE_INDEX[v.stage];
  const total = (v.yt_views || 0) + (v.ig_views || 0) + (v.fb_views || 0);
  const act = cardAction(v, roles, myClientId);
  return (
    <article className="card" style={{ borderLeft: `3px solid ${sm.color}` }}>
      <div className="card-top">
        <span className="client">{clientName}</span>
        {v.stage === "published" && total > 0
          ? <span className="views"><span className="pulse" />{fmt(total)} views</span>
          : <TypeBadge type={v.item_type} />}
      </div>
      <div className="card-title">{v.title}</div>
      {v.stage === "to_edit" && v.brief && <div className="brief">📋 {v.brief}</div>}
      <div className="pipe">
        {STAGES.map((s, i) => (
          <span key={s.key} className="seg"
            style={{ background: i <= idx ? s.color : "#E4E6EF", boxShadow: i === idx ? `0 0 9px ${s.color}99` : "none" }} />
        ))}
      </div>
      <div className="card-meta">
        <span>✎ {editorName}</span>
        {v.drive_link && <a className="link" href={v.drive_link} target="_blank" rel="noreferrer">File ↗</a>}
      </div>
      {v.stage === "to_edit" && v.rejection_note && <div className="rej">↩ Sent back: {v.rejection_note}</div>}
      {act ? (
        <button className="card-btn" style={{ background: sm.color }} onClick={() => onAction(act.type)}>{act.label}</button>
      ) : v.stage !== "published" ? (
        <div className="waiting">Waiting on {sm.owner}</div>
      ) : null}
    </article>
  );
}

function cardAction(v, roles, myClientId) {
  const adminOrClient = isAdmin(roles) || (hasRole(roles, "client") && v.client_id === myClientId);
  if (v.stage === "to_edit" && (hasRole(roles, "editor") || hasRole(roles, "designer") || isAdmin(roles)))
    return { type: "submit", label: v.item_type === "poster" ? "Add file & submit" : "Add Drive link & submit" };
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
    </div>
  );
}

function NewItem({ clients, people, close }) {
  const creators = people.filter((p) => (p.roles || []).some((r) => ["editor", "designer"].includes(r)));
  const [title, setTitle] = useState("");
  const [type, setType] = useState("video");
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [editorId, setEditorId] = useState(creators[0]?.id || "");
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!title.trim()) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("title", title.trim()); fd.set("item_type", type);
    fd.set("client_id", clientId); fd.set("editor_id", editorId); fd.set("brief", brief);
    await addVideo(fd); close();
  }
  return (
    <div>
      <div className="eyebrow">New item</div>
      <h2 className="mtitle">Add to the pipeline</h2>
      <label className="lbl">Type</label>
      <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
        <option value="video">Video</option><option value="poster">Poster / Image</option>
      </select>
      <label className="lbl">Title</label>
      <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 3 foods that spike sugar" />
      <label className="lbl">Brief — what needs to be done</label>
      <textarea className="textarea" value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Notes for the editor/designer: hook, length, key points…" />
      <label className="lbl">Doctor / client</label>
      <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <label className="lbl">Assign to</label>
      <select className="input" value={editorId} onChange={(e) => setEditorId(e.target.value)}>
        {creators.length === 0 && <option value="">No editor/designer yet</option>}
        {creators.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
      </select>
      <div className="mbtns">
        <button className="btn btn-ghost" onClick={close}>Cancel</button>
        <button className="cta" disabled={busy} onClick={save}>{busy ? "Adding…" : "Add to pipeline"}</button>
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
      <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Trim the intro, fix subtitle timing…" />
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
    const missing = [];
    if (!f.youtube.trim()) missing.push("YouTube");
    if (!f.instagram.trim()) missing.push("Instagram");
    if (!f.facebook.trim()) missing.push("Facebook");
    if (missing.length) { setErr(`Please paste the ${missing.join(", ")} link before publishing.`); return; }
    setErr(""); setBusy(true);
    try { await markPosted(v.id, f); close(); }
    catch (e) { setErr(e.message); setBusy(false); }
  }
  return (
    <div style={{ maxHeight: "78vh", overflowY: "auto" }}>
      <PanelHead v={v} label="Content & posting" />
      <TaskTimerPill />
      {v.drive_link && <a className="drivebox" href={v.drive_link} target="_blank" rel="noreferrer">▶ Approved file ↗</a>}
      <label className="lbl">Caption / content</label>
      <textarea className="textarea" value={f.caption} onChange={set("caption")} placeholder="Write the post caption…" />
      <label className="lbl">Hashtags</label>
      <input className="input" value={f.hashtags} onChange={set("hashtags")} placeholder="#diabetes #doctoruncle #malayalam" />
      <label className="lbl">Pinned comment</label>
      <input className="input" value={f.pinned} onChange={set("pinned")} placeholder="e.g. Book an appointment — link in bio" />
      <p className="hint" style={{ marginTop: 14, fontWeight: 600, color: "#1A1730" }}>All three links are required to publish:</p>
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
        <button className="cta" disabled={busy} onClick={post}>Mark posted ✓</button>
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
      <p className="hint">Type counts in, or pull YouTube automatically once the API key is set.</p>
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
