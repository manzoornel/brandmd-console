"use client";

import { useMemo, useState } from "react";
import styles from "./ReportsDemo.module.css";
import { rolesLabel } from "@/lib/roles";
import { clientVideoCharge, compensationBreakdown, effectiveStaffVideoUnits, effectiveVideoUnits, workingDaysInMonth } from "@/lib/operations";

const ranges = {
  Today: 0,
  "This week": 6,
  "This month": 30,
  "Last 90 days": 90,
};

const asDate = (value) => value ? new Date(value) : null;
const hoursBetween = (start, end) => Math.max(0, (new Date(end) - new Date(start)) / 36e5);
const fmtTime = value => value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

export default function RealReportsView({ generatedAt, people, videos, attendance, attendanceEvents, logs, clients, compensationRules, sundayCredits }) {
  const [period, setPeriod] = useState("This month");
  const [role, setRole] = useState("All roles");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("Overview");

  const { start, end } = useMemo(() => {
    const now = new Date(generatedAt);
    const end = new Date(now);
    let start = new Date(now);
    if (period === "Today") start.setHours(0, 0, 0, 0);
    else if (period === "This week") { start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 6); }
    else if (period === "This month") start = new Date(now.getFullYear(), now.getMonth(), 1);
    else { start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - ranges[period]); }
    return { start, end };
  }, [period, generatedAt]);

  const inRange = (value) => { const d = asDate(value); return d && d >= start && d <= end; };
  const staff = useMemo(() => people.filter(p => p.active !== false && !(p.roles || []).includes("client")), [people]);

  const rows = useMemo(() => staff.map((p) => {
    const edited = videos.filter(v => v.editor_id === p.id && v.item_type === "video" && inRange(v.submitted_at)).length;
    const editItems = videos.filter(v => v.editor_id === p.id && v.item_type === "video" && inRange(v.submitted_at));
    const staffUnits = editItems.reduce((sum, v) => sum + effectiveStaffVideoUnits(v), 0);
    const shoots = videos.filter(v => v.editor_id === p.id && v.item_type === "shoot" && inRange(v.submitted_at)).length;
    const images = videos.filter(v => v.editor_id === p.id && v.item_type === "poster" && inRange(v.submitted_at)).length;
    const published = videos.filter(v => v.writer_id === p.id && inRange(v.posted_at));
    const yt = published.filter(v => v.youtube_url).length;
    const ig = published.filter(v => v.instagram_url).length;
    const fb = published.filter(v => v.facebook_url).length;
    const personAttendance = attendance.filter(a => a.user_id === p.id && inRange(a.clock_in));
    const verifiedClockIns = attendanceEvents.filter(a => a.user_id === p.id && a.event_type === "clock_in" && a.location_verified && inRange(a.occurred_at)).length;
    const hours = personAttendance.reduce((sum, a) => sum + hoursBetween(a.clock_in, a.clock_out || end), 0);
    const activeSeconds = logs.filter(l => l.user_id === p.id && inRange(l.started_at)).reduce((sum, l) => sum + (l.seconds || 0), 0);
    const completed = videos.filter(v => (v.editor_id === p.id || v.writer_id === p.id) && inRange(v.posted_at));
    const turnaround = completed.length ? completed.reduce((sum, v) => sum + hoursBetween(v.created_at, v.posted_at) / 24, 0) / completed.length : 0;
    const rework = videos.filter(v => v.editor_id === p.id && v.rejection_note && (inRange(v.submitted_at) || inRange(v.posted_at))).length;
    return { ...p, role: rolesLabel(p.roles || []), edited, staffUnits, shoots, images, yt, ig, fb, posts: yt + ig + fb, hours, verifiedClockIns, activeSeconds, turnaround, rework };
  }).filter(w => (role === "All roles" || w.role.includes(role)) && w.full_name.toLowerCase().includes(query.toLowerCase())), [staff, videos, attendance, attendanceEvents, logs, start, end, role, query]);

  const doctors = useMemo(() => clients.map(c => {
    const items = videos.filter(v => v.client_id === c.id && inRange(v.posted_at));
    const video = items.filter(v => v.item_type === "video").length;
    const videoItems = items.filter(v => v.item_type === "video");
    const units = videoItems.reduce((sum, v) => sum + effectiveVideoUnits(v), 0);
    const billed = videoItems.reduce((sum, v) => sum + clientVideoCharge(v, c), 0);
    const images = items.filter(v => v.item_type === "poster").length;
    const posts = items.reduce((n, v) => n + !!v.youtube_url + !!v.instagram_url + !!v.facebook_url, 0);
    const quota = (c.quota_videos || 0) + (c.quota_posters || 0);
    return { name: c.name, video, units, billed, images, posts, delivered: video + images, quota, used: quota ? Math.round((video + images) / quota * 100) : 0 };
  }).filter(d => d.video || d.images || d.posts || d.quota), [clients, videos, start, end]);

  const payroll = useMemo(() => staff.map((p) => {
    const saved = compensationRules.find(r => r.user_id === p.id);
    const name = p.full_name.toLowerCase();
    const fallback = name.includes("mufeed") ? {
      base_salary: 20000, monthly_video_unit_target: 50, video_unit_bonus_threshold: 50,
      extra_video_unit_rate: 400,
    } : name.includes("shamil") ? {
      base_salary: 10000, monthly_post_target: 50, post_bonus_threshold: 60,
      missing_post_deduction: 100, extra_post_rate: 100, monthly_creative_target: 20,
      missing_creative_deduction: 200, extra_creative_rate: 200, video_edit_rate: 300,
    } : null;
    const rule = saved || fallback;
    if (!rule) return null;
    const monthVideos = videos.filter(v => v.editor_id === p.id && v.item_type === "video" && inRange(v.submitted_at));
    const videoUnits = monthVideos.reduce((sum, v) => sum + effectiveStaffVideoUnits(v), 0);
    const postingPackages = videos.filter(v => v.writer_id === p.id && inRange(v.posted_at)).length;
    const creatives = videos.filter(v => v.editor_id === p.id && v.item_type === "poster" && inRange(v.submitted_at)).length;
    const approvedSunday = sundayCredits.filter(c => c.user_id === p.id && ["approved","paid"].includes(c.status) && inRange(c.duty_date));
    const breakdown = compensationBreakdown(rule, {
      workingDays: workingDaysInMonth(start.getFullYear(), start.getMonth()),
      unpaidDays: 0,
      posts: postingPackages,
      creatives,
      videoUnits,
      videoEdits: 0,
      sundayCompensation: approvedSunday.filter(c => c.status === "paid").reduce((sum, c) => sum + Number(c.paid_amount || 0), 0),
    });
    return { ...p, rule, videoUnits, postingPackages, creatives, approvedSunday: approvedSunday.length, breakdown, saved: !!saved };
  }).filter(Boolean), [staff, compensationRules, sundayCredits, videos, start, end]);

  const total = key => rows.reduce((sum, row) => sum + row[key], 0);
  const attendanceRows = useMemo(() => attendance.filter(a => inRange(a.clock_in)).map(a => {
    const person = people.find(p => p.id === a.user_id);
    const worked = hoursBetween(a.clock_in, a.clock_out || end);
    return { ...a, name: person?.full_name || "Unknown user", role: rolesLabel(person?.roles || []), worked, live: !a.clock_out };
  }).filter(a => a.name.toLowerCase().includes(query.toLowerCase())).sort((a,b) => new Date(b.clock_in)-new Date(a.clock_in)), [attendance, people, start, end, query]);
  const top = [...rows].sort((a,b) => (b.edited+b.shoots+b.images+b.posts) - (a.edited+a.shoots+a.images+a.posts))[0];
  const events = useMemo(() => videos.flatMap(v => {
    const client = clients.find(c => c.id === v.client_id)?.name || "No doctor";
    const editor = people.find(p => p.id === v.editor_id)?.full_name;
    const writer = people.find(p => p.id === v.writer_id)?.full_name;
    const out = [];
    if (v.submitted_at && inRange(v.submitted_at)) out.push({ at:v.submitted_at, user:editor || "Unassigned", action:v.item_type === "poster" ? "Poster submitted" : v.item_type === "shoot" ? "Shoot submitted" : "Video edit submitted", title:v.title, client });
    if (v.posted_at && inRange(v.posted_at)) out.push({ at:v.posted_at, user:writer || "Unassigned", action:"Published", title:v.title, client });
    return out;
  }).sort((a,b) => new Date(b.at)-new Date(a.at)).slice(0,50), [videos, people, clients, start, end]);

  return <div className="body">
    <div className={styles.heading}><div><p className={styles.eyebrow}>OPERATIONS INTELLIGENCE</p><h1>Team reports</h1><p>Live production, publishing and attendance data from BrandMD.</p></div><button className={styles.export} onClick={() => window.print()}>⇩ Print report</button></div>
    <div className={styles.tabs}>{["Overview","Live attendance","Workers","Doctors & quotas","Salary & incentives","Activity log"].map(t => <button key={t} onClick={() => setTab(t)} className={tab === t ? styles.tabActive : ""}>{t}</button>)}</div>
    <div className={styles.filters}><select value={period} onChange={e => setPeriod(e.target.value)}>{Object.keys(ranges).map(p => <option key={p}>{p}</option>)}</select><select value={role} onChange={e => setRole(e.target.value)}>{["All roles","Editor","Writer","Designer","Shooter","Admin"].map(r => <option key={r}>{r}</option>)}</select><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search worker…"/><span className={styles.updated}>● Live Supabase data</span></div>
    {tab === "Overview" && <><section className={styles.kpis}><Kpi icon="▶" color="violet" value={total("edited")} label="Videos edited"/><Kpi icon="●" color="amber" value={total("shoots")} label="Shoots completed"/><Kpi icon="↗" color="green" value={total("posts")} label="Platform posts"/><Kpi icon="◇" color="coral" value={total("images")} label="Posters / images"/></section><section className={styles.grid2}><div className={styles.panel}><Title title="Output by worker" sub="Completed workflow output in selected period"/>{rows.map(w => <Bar key={w.id} w={w} max={Math.max(1,...rows.map(x=>x.edited+x.shoots+x.images+x.posts))}/>)}</div><div className={styles.panel}><Title title="Publishing mix" sub="Each platform post is counted separately"/><Donut yt={total("yt")} ig={total("ig")} fb={total("fb")}/><div className={styles.legend}><span><i className={styles.yt}/>YouTube <b>{total("yt")}</b></span><span><i className={styles.ig}/>Instagram <b>{total("ig")}</b></span><span><i className={styles.fb}/>Facebook <b>{total("fb")}</b></span></div></div></section>{top && <section className={styles.insight}><span>★</span><div><b>{top.full_name} leads output for this period</b><p>Based on videos, shoots, posters and individual platform posts.</p></div><button onClick={()=>setTab("Workers")}>View worker report →</button></section>}</>}
    {tab === "Workers" && <div className={styles.panel}><Title title="Worker performance" sub="Live output, attendance and staff incentive units"/><table><thead><tr><th>Worker</th><th>Role</th><th>Edits</th><th>Staff units</th><th>Shoots</th><th>Posts</th><th>Images</th><th>Verified days</th><th>Hours</th><th>Rework*</th><th>Avg. turnaround</th></tr></thead><tbody>{rows.map(w=><tr key={w.id}><td><b>{w.full_name}</b></td><td>{w.role}</td><td>{w.edited}</td><td><b>{w.staffUnits.toFixed(1)}</b></td><td>{w.shoots}</td><td>{w.posts}</td><td>{w.images}</td><td>{w.verifiedClockIns}</td><td>{w.hours.toFixed(1)}h</td><td>{w.rework}</td><td>{w.turnaround ? `${w.turnaround.toFixed(1)} days` : "—"}</td></tr>)}</tbody></table><p className="hint">* Staff units are calculated separately from client billing. Existing rejection history starts from the activity-event migration.</p></div>}
    {tab === "Live attendance" && <div className={styles.panel}><Title title="Login & worked-time live view" sub="Every login session recorded during the selected period"/><table><thead><tr><th>Staff</th><th>Date</th><th>Login</th><th>Logout</th><th>Device</th><th>Location</th><th>Worked</th><th>Status</th></tr></thead><tbody>{attendanceRows.map((a,i)=><tr key={`${a.user_id}-${a.clock_in}-${i}`}><td><b>{a.name}</b><br/><small>{a.role}</small></td><td>{new Date(a.clock_in).toLocaleDateString()}</td><td>{fmtTime(a.clock_in)}</td><td>{a.live ? "—" : fmtTime(a.clock_out)}</td><td><b>{a.device_type || "Legacy login"}</b><br/><small>{a.device_label || "Not recorded"}</small></td><td>{a.location_status || "Legacy login"}</td><td><b>{a.worked.toFixed(1)} h</b></td><td>{a.live ? <b style={{color:"#059669"}}>● Live now</b> : "Completed"}</td></tr>)}{!attendanceRows.length&&<tr><td colSpan="8">No attendance sessions in this period.</td></tr>}</tbody></table></div>}
    {tab === "Doctors & quotas" && <div className={styles.panel}><Title title="Doctor delivery, units & billing" sub="Published production compared with current package quotas; discounts are client-specific"/><table><thead><tr><th>Doctor/client</th><th>Videos</th><th>Billable units</th><th>Video value</th><th>Posters</th><th>Platform posts</th><th>Quota</th><th>Used</th></tr></thead><tbody>{doctors.map(d=><tr key={d.name}><td><b>{d.name}</b></td><td>{d.video}</td><td><b>{d.units}</b></td><td>₹{d.billed.toLocaleString("en-IN")}</td><td>{d.images}</td><td>{d.posts}</td><td>{d.quota || "—"}</td><td><div className={styles.quota}><span style={{width:`${Math.min(d.used,100)}%`}}/></div><b>{d.quota ? `${d.used}%` : "—"}</b></td></tr>)}</tbody></table></div>}
    {tab === "Salary & incentives" && <div className={styles.panel}><Title title="Salary & incentive preview" sub="Live output-based calculation. Attendance deduction stays at ₹0 until attendance records are verified and approved."/><table><thead><tr><th>Staff</th><th>Base salary</th><th>Video units</th><th>Posting packages</th><th>Creatives</th><th>Incentives</th><th>Deductions</th><th>Estimated payable</th><th>Status</th></tr></thead><tbody>{payroll.map(p=><tr key={p.id}><td><b>{p.full_name}</b><br/><small>{p.saved ? "Saved rule" : "BrandMD approved default"}</small></td><td>₹{p.breakdown.base.toLocaleString("en-IN")}</td><td>{p.videoUnits.toFixed(1)}</td><td>{p.postingPackages}</td><td>{p.creatives}</td><td><b style={{color:"#15803d"}}>+₹{p.breakdown.incentives.toLocaleString("en-IN")}</b></td><td><b style={{color:"#b91c1c"}}>−₹{p.breakdown.deductions.toLocaleString("en-IN")}</b></td><td><b>₹{Math.round(p.breakdown.payable).toLocaleString("en-IN")}</b></td><td>{p.breakdown.warnings.length ? p.breakdown.warnings.join(" · ") : "On target"}{p.approvedSunday ? ` · ${p.approvedSunday} Sunday credit` : ""}</td></tr>)}</tbody></table><p className="hint">Legacy videos without a saved duration count as 1 staff unit. New videos use the approved duration-based unit rule. Final payroll requires admin approval.</p></div>}
    {tab === "Activity log" && <div className={styles.panel}><Title title="Current-data activity timeline" sub="Derived from submitted and published timestamps"/><div className={styles.timeline}>{events.map((e,i)=><div className={styles.event} key={`${e.at}-${i}`}><span className={styles.eventDot}/><time>{new Date(e.at).toLocaleString()}</time><b>{e.user}</b><strong>{e.action}</strong><p>{e.client} · {e.title}</p><em>Recorded</em></div>)}</div></div>}
  </div>;
}

function Kpi({icon,color,value,label}){return <div className={styles.kpi}><span className={`${styles.kpiIcon} ${styles[color]}`}>{icon}</span><div><strong>{value}</strong><b>{label}</b><small>Selected period</small></div></div>}
function Title({title,sub}){return <div className={styles.panelTitle}><div><h2>{title}</h2><p>{sub}</p></div></div>}
function Bar({w,max}){const n=w.edited+w.shoots+w.images+w.posts;return <div className={styles.workerBar}><span className={styles.avatar}>{w.full_name[0]}</span><div className={styles.workerInfo}><div><b>{w.full_name}</b><small>{w.role}</small><strong>{n}</strong></div><div className={styles.bar}><span style={{width:`${n/max*100}%`}}/></div><p>{w.edited} edits · {w.shoots} shoots · {w.posts} posts · {w.images} images</p></div></div>}
function Donut({yt,ig,fb}){const total=Math.max(yt+ig+fb,1),a=yt/total*360,b=(yt+ig)/total*360;return <div className={styles.donut} style={{background:`conic-gradient(#ff5d5d 0 ${a}deg,#6c4ff8 ${a}deg ${b}deg,#2f80ed ${b}deg 360deg)`}}><div><b>{yt+ig+fb}</b><span>Total posts</span></div></div>}
