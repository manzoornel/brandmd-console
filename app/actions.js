"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { fetchYouTubeViews } from "@/lib/youtube";
import { effectiveVideoUnits } from "@/lib/operations";

async function me() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: profile } = await supabase
    .from("profiles").select("id, roles, client_id").eq("id", user.id).single();
  return { supabase, user, profile: { ...profile, roles: profile?.roles || [] } };
}
const has = (roles, r) => Array.isArray(roles) && roles.includes(r);
const admin_ = (roles) => has(roles, "super_admin") || has(roles, "admin");

export async function loginWithPassword(email, password) {
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: String(email || "").trim(),
      password: String(password || ""),
    });
    return { error: error?.message || null };
  } catch (_) {
    return { error: "Unable to reach the sign-in service. Please try again." };
  }
}

/* ---------------- Attendance ---------------- */
const earthDistanceM = (aLat, aLng, bLat, bLng) => {
  const rad = n => n * Math.PI / 180, r = 6371000;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(x));
};
export async function clockIn(context = {}) {
  const { supabase, user } = await me();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const { data: office } = await supabase.from("office_settings").select("latitude, longitude, radius_m, minimum_gps_accuracy_m").eq("id", true).maybeSingle();
  const hasLocation = Number.isFinite(Number(context.latitude)) && Number.isFinite(Number(context.longitude));
  const distance = hasLocation && office ? earthDistanceM(Number(context.latitude), Number(context.longitude), office.latitude, office.longitude) : null;
  // Verify the reported point against the configured 20 m geofence. Desktop
  // browsers often report a large accuracy radius even when that point is inside;
  // treating accuracy as a second hard limit caused false "Outside office" results.
  const verified = distance != null && distance <= Number(office.radius_m);
  const location_status = !hasLocation ? "Location unavailable" : verified ? "BrandMD Office" : "Outside office";
  const now = new Date().toISOString();
  const { data: stale } = await supabase.from("attendance").select("id").eq("user_id", user.id).is("clock_out", null).lt("work_date", today);
  if (stale?.length) await supabase.from("attendance").update({ clock_out: now, auto_out: true }).in("id", stale.map(s => s.id));
  const { data: existing } = await supabase.from("attendance").select("id").eq("user_id", user.id).eq("work_date", today).is("clock_out", null).order("clock_in", { ascending: false }).limit(1);
  if (existing?.length) {
    await supabase.from("attendance").update({ device_type: String(context.device_type || "Unknown"), device_label: String(context.device_label || "Unknown device"), location_status, distance_m: distance }).eq("id", existing[0].id);
  } else {
    const { error } = await supabase.from("attendance").insert({ user_id: user.id, work_date: today, device_type: String(context.device_type || "Unknown"), device_label: String(context.device_label || "Unknown device"), location_status, distance_m: distance });
    if (error) throw new Error("Attendance could not be marked. Please retry.");
  }
  await supabase.from("attendance_events").insert({ user_id: user.id, event_type: "clock_in", latitude: hasLocation ? Number(context.latitude) : null, longitude: hasLocation ? Number(context.longitude) : null, accuracy_m: Number(context.accuracy_m) || null, distance_m: distance, location_verified: verified, source: String(context.device_type || "web"), note: String(context.device_label || "") });
  revalidatePath("/reports");
  return { marked: true, verified, locationStatus: location_status };
}

async function logActivity(supabase, userId, videoId, eventType, metadata = {}) {
  await supabase.from("activity_events").insert({ user_id: userId, video_id: videoId, event_type: eventType, metadata });
}
export async function clockOut(auto = false) {
  const { supabase, user } = await me();
  const { data: open } = await supabase
    .from("attendance").select("id").eq("user_id", user.id).is("clock_out", null)
    .order("clock_in", { ascending: false }).limit(1);
  if (open && open.length) {
    await supabase.from("attendance")
      .update({ clock_out: new Date().toISOString(), auto_out: auto }).eq("id", open[0].id);
  }
  const { data: running } = await supabase
    .from("task_time_logs").select("id, started_at").eq("user_id", user.id).is("ended_at", null);
  for (const r of running || []) {
    const secs = Math.round((Date.now() - new Date(r.started_at)) / 1000);
    await supabase.from("task_time_logs")
      .update({ ended_at: new Date().toISOString(), seconds: secs }).eq("id", r.id);
  }
}

/* ---------------- Users + passwords (admin) ---------------- */
export async function createUser(form) {
  const { profile } = await me();
  if (!admin_(profile.roles)) throw new Error("Not allowed");
  const email = form.get("email");
  const password = form.get("password");
  const full_name = form.get("full_name");
  const roles = form.getAll("roles");
  const client_id = form.get("client_id") || null;
  if (!roles.length) throw new Error("Pick at least one role");

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name },
  });
  if (error) throw new Error(error.message);
  await admin.from("profiles").insert({
    id: data.user.id, full_name, roles,
    client_id: roles.includes("client") ? client_id : null,
  });
  revalidatePath("/users");
}

export async function setUserActive(id, active) {
  const { profile } = await me();
  if (!admin_(profile.roles)) throw new Error("Not allowed");
  await createAdminClient().from("profiles").update({ active }).eq("id", id);
  revalidatePath("/users");
}

export async function adminResetPassword(userId, newPassword) {
  const { profile } = await me();
  if (!admin_(profile.roles)) throw new Error("Not allowed");
  if (!newPassword || newPassword.length < 6) throw new Error("Password must be at least 6 characters");
  const { error } = await createAdminClient().auth.admin.updateUserById(userId, { password: newPassword });
  if (error) throw new Error(error.message);
  return { ok: true };
}

/* ---------------- Clients / doctors ---------------- */
export async function addClient(form) {
  const { supabase, profile } = await me();
  if (!admin_(profile.roles)) throw new Error("Not allowed");
  const name = (form.get("name") || "").trim();
  if (!name) throw new Error("Name is required");
  const { data: existing } = await supabase.from("clients").select("id").ilike("name", name);
  if (existing && existing.length) {
    throw new Error(`A doctor named "${name}" already exists. Make it unique, e.g. "${name} (2)".`);
  }
  const pk = await resolvePackage(supabase, form);
  await supabase.from("clients").insert({
    name,
    type: form.get("type") || "external",
    package: form.get("package") || "",
    package_id: pk.package_id, discount: pk.discount,
    quota_videos: pk.quota_videos, quota_posters: pk.quota_posters, price: pk.price,
    self_approver: form.get("self_approver") === "on",
    parent_id: form.get("parent_id") || null,
    is_firm: form.get("is_firm") === "on",
    posting_plan_mode: form.get("posting_plan_mode") || "monthly",
    monthly_video_target: Number(form.get("monthly_video_target")) || pk.quota_videos || 0,
    weekly_video_target: Number(form.get("weekly_video_target")) || 0,
    preferred_weekday: Number(form.get("preferred_weekday")) || 2,
  });
  revalidatePath("/doctors"); revalidatePath("/dashboard");
}

export async function editClient(form) {
  const { supabase, profile } = await me();
  if (!admin_(profile.roles)) throw new Error("Not allowed");
  const id = form.get("id");
  const name = (form.get("name") || "").trim();
  if (!id || !name) throw new Error("Name is required");
  const { data: dup } = await supabase.from("clients").select("id").ilike("name", name).neq("id", id);
  if (dup && dup.length) throw new Error(`Another doctor named "${name}" already exists.`);
  const pk = await resolvePackage(supabase, form);
  await supabase.from("clients").update({
    name,
    type: form.get("type") || "external",
    package: form.get("package") || "",
    package_id: pk.package_id, discount: pk.discount,
    quota_videos: pk.quota_videos, quota_posters: pk.quota_posters, price: pk.price,
    self_approver: form.get("self_approver") === "on",
    parent_id: form.get("parent_id") || null,
    is_firm: form.get("is_firm") === "on",
    posting_plan_mode: form.get("posting_plan_mode") || "monthly",
    monthly_video_target: Number(form.get("monthly_video_target")) || pk.quota_videos || 0,
    weekly_video_target: Number(form.get("weekly_video_target")) || 0,
    preferred_weekday: Number(form.get("preferred_weekday")) || 2,
  }).eq("id", id);
  revalidatePath("/doctors"); revalidatePath("/dashboard");
}

export async function deleteClient(id) {
  const { supabase, profile } = await me();
  if (!admin_(profile.roles)) throw new Error("Not allowed");
  await supabase.from("clients").delete().eq("id", id);
  revalidatePath("/doctors"); revalidatePath("/dashboard");
}

/* ---------------- Workflow ---------------- */
export async function addVideo(form) {
  const { supabase, user, profile } = await me();
  if (!["super_admin", "admin", "editor", "designer", "shooter"].some((r) => has(profile.roles, r)))
    throw new Error("Not allowed");
  const durationSeconds = Number(form.get("duration_seconds"));
  const { data: created, error } = await supabase.from("videos").insert({
    title: form.get("title"),
    client_id: form.get("client_id") || null,
    editor_id: form.get("editor_id") || null,
    item_type: form.get("item_type") || "video",
    brief: form.get("brief") || "",
    due_date: form.get("due_date") || null,
    duration_seconds: Number.isFinite(durationSeconds) && durationSeconds > 0 ? Math.round(durationSeconds) : null,
    stage: "to_edit",
    current_stage_entered_at: new Date().toISOString(),
  }).select("id").single();
  if (error) throw new Error("Unable to add this work item. Please try again.");
  await logActivity(supabase, user.id, created.id, "created", { to_stage: "to_edit" });
  revalidatePath("/dashboard");
}

export async function submitDrive(videoId, link) {
  const { supabase, user, profile } = await me();
  const { data: v } = await supabase.from("videos").select("item_type, editor_id").eq("id", videoId).single();
  const roleNeeded = v?.item_type === "poster" ? "designer" : v?.item_type === "shoot" ? "shooter" : "editor";
  const ok = admin_(profile.roles) ||
    (has(profile.roles, roleNeeded) && (!v?.editor_id || v.editor_id === profile.id));
  if (!ok) throw new Error("You don't have permission to submit this item.");
  const now = new Date().toISOString();
  await supabase.from("videos").update({
    drive_link: link, stage: "review",
    submitted_at: now, current_stage_entered_at: now, last_saved_at: now, rejection_note: "",
  }).eq("id", videoId);
  await logActivity(supabase, user.id, videoId, "stage_transition", { from_stage: "to_edit", to_stage: "review", saved_at: now });
  revalidatePath("/dashboard");
}

export async function approveVideo(videoId) {
  const { supabase, user, profile } = await me();
  const { data: v, error: loadError } = await supabase.from("videos").select("client_id").eq("id", videoId).single();
  if (loadError) throw new Error("Unable to load this item. Please refresh and try again.");
  const isClientApprover = has(profile.roles, "client") && profile.client_id && v?.client_id === profile.client_id;
  if (!admin_(profile.roles) && !isClientApprover) throw new Error("Not allowed to approve");
  const now = new Date().toISOString();
  const { error } = await supabase.from("videos").update({
    stage: "content", approver_id: profile.id,
    approved_at: now, current_stage_entered_at: now, last_saved_at: now, rejection_note: "",
  }).eq("id", videoId);
  if (error) throw new Error("Approval could not be saved. Please try again.");
  await logActivity(supabase, user.id, videoId, "stage_transition", { from_stage: "review", to_stage: "content", decision: "approved" });
  revalidatePath("/dashboard");
}

const dateOnly = (date) => date.toISOString().slice(0, 10);
const atNoonUtc = (value) => new Date(`${value}T12:00:00Z`);
const addDays = (date, days) => { const next = new Date(date); next.setUTCDate(next.getUTCDate() + days); return next; };
const nextWorkingDay = (date) => { let next = new Date(date); while (next.getUTCDay() === 0) next = addDays(next, 1); return next; };
const previousWorkingDays = (date, count) => {
  let next = new Date(date); let left = count;
  while (left > 0) { next = addDays(next, -1); if (next.getUTCDay() !== 0) left -= 1; }
  return next;
};

function postingDates(startValue, count, mode, weekday, weeklyTarget = 1) {
  const start = nextWorkingDay(atNoonUtc(startValue));
  if (mode === "weekly") {
    const target = Number(weekday);
    const perWeek = Math.max(1, Math.min(6, Number(weeklyTarget) || 1));
    const days = Array.from({ length: perWeek }, (_, i) => ((target - 1 + Math.round(i * 6 / perWeek)) % 6) + 1).sort((a,b) => a-b);
    const out = []; let cursor = new Date(start);
    while (out.length < count) { if (days.includes(cursor.getUTCDay())) out.push(new Date(cursor)); cursor = addDays(cursor, 1); }
    return out;
  }
  const candidates = [];
  let cursor = new Date(start);
  const horizon = mode === "spread" ? Math.max(31, count * 4) : count * 2 + 10;
  for (let i = 0; candidates.length < Math.max(count, 30) && i < horizon + 120; i += 1) {
    if (cursor.getUTCDay() !== 0) candidates.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }
  if (mode !== "spread" || count <= 1) return candidates.slice(0, count);
  const monthEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 12));
  const monthCandidates = candidates.filter(d => d <= monthEnd);
  if (monthCandidates.length >= count) {
    return Array.from({ length: count }, (_, i) => monthCandidates[Math.round(i * (monthCandidates.length - 1) / Math.max(1, count - 1))]);
  }
  return candidates.slice(0, count);
}

export async function createShootingPlan(form) {
  const { supabase, profile } = await me();
  if (!["super_admin", "admin", "editor", "shooter"].some((r) => has(profile.roles, r))) throw new Error("Not allowed");
  const topics = String(form.get("topics") || "").split(/\r?\n/)
    .map(v => v.replace(/^\s*\d+[.)-]?\s*/, "").trim()).filter(Boolean).slice(0, 60);
  if (!topics.length) throw new Error("Add at least one topic heading.");
  const clientId = form.get("brand_client_id") || form.get("client_id") || null;
  const presenterClientId = form.get("presenter_client_id") || null;
  if (!clientId) throw new Error("Choose a publishing brand/clinic.");
  const shootDate = String(form.get("shoot_date") || dateOnly(new Date()));
  if (form.get("booking_only") === "1") {
    const { data: client } = await supabase.from("clients").select("name").eq("id", clientId).single();
    const { error } = await supabase.from("videos").insert({
      title: `Shoot · ${client?.name || "Client"}`,
      item_type: "shoot", client_id: clientId, presenter_client_id: presenterClientId,
      editor_id: form.get("shooter_id") || null, shoot_date: shootDate, due_date: shootDate,
      expected_topic_count: Math.max(1, Number(form.get("expected_topic_count")) || 1),
      brief: form.get("brief") || "Capture topic headings during the shoot.", stage: "to_edit",
    });
    if (error) throw new Error("Unable to book this shoot. Please try again.");
    revalidatePath("/dashboard"); return;
  }
  const firstPostDate = String(form.get("first_post_date") || shootDate);
  const { data: brand } = await supabase.from("clients").select("posting_plan_mode, monthly_video_target, weekly_video_target, preferred_weekday").eq("id", clientId).single();
  const requestedMode = String(form.get("schedule_mode") || "auto");
  const mode = requestedMode === "auto" ? (brand?.posting_plan_mode === "daily" ? "daily" : brand?.posting_plan_mode === "weekly" ? "weekly" : "spread") : requestedMode;
  const weekday = requestedMode === "auto" ? (brand?.preferred_weekday || 2) : (form.get("weekday") || 2);
  const { data: existing } = await supabase.from("videos").select("scheduled_post_date").eq("client_id", clientId).not("scheduled_post_date", "is", null).gte("scheduled_post_date", firstPostDate);
  const occupied = new Set((existing || []).map(v => v.scheduled_post_date));
  const weeklyTarget = requestedMode === "auto" ? (brand?.weekly_video_target || 1) : 1;
  const initialDates = postingDates(firstPostDate, topics.length + occupied.size + 14, mode, weekday, weeklyTarget);
  const dates = [];
  for (const candidate of initialDates) {
    const key = dateOnly(candidate);
    if (!occupied.has(key)) dates.push(candidate);
    if (dates.length === topics.length) break;
  }
  if (dates.length < topics.length) throw new Error("Not enough free schedule dates were found. Move the first posting date forward.");
  const editLeadDays = Math.max(1, Math.min(10, Number(form.get("edit_lead_days")) || 2));
  const editors = String(form.get("editor_ids") || "").split(",").filter(Boolean);
  const batchId = crypto.randomUUID();
  const items = topics.map((title, index) => {
    const postDate = dates[index];
    return {
      title, item_type: "video", client_id: clientId, presenter_client_id: presenterClientId,
      source_shoot_id: form.get("shoot_item_id") || null,
      editor_id: editors.length ? editors[Math.floor(index / 2) % editors.length] : null,
      brief: `Shot on ${shootDate} · Topic ${index + 1}/${topics.length}`,
      shoot_date: shootDate, scheduled_post_date: dateOnly(postDate),
      due_date: dateOnly(previousWorkingDays(postDate, editLeadDays)),
      edit_lead_days: editLeadDays, schedule_status: "draft",
      shooting_batch_id: batchId, topic_order: index + 1, stage: "to_edit",
    };
  });
  const { error } = await supabase.from("videos").insert(items);
  if (error) throw new Error("Unable to create the shooting plan. Please try again.");
  if (form.get("shoot_item_id")) await supabase.from("videos").update({ stage: "published", submitted_at: new Date().toISOString(), posted_at: new Date().toISOString() }).eq("id", form.get("shoot_item_id"));
  revalidatePath("/dashboard");
}

export async function approveSchedule(videoId) {
  const { supabase, profile } = await me();
  const { data: video } = await supabase.from("videos").select("client_id").eq("id", videoId).single();
  const allowed = admin_(profile.roles) || (has(profile.roles, "client") && profile.client_id === video?.client_id);
  if (!allowed) throw new Error("Not allowed to approve this schedule.");
  const { error } = await supabase.from("videos").update({
    schedule_status: "approved", schedule_approved_at: new Date().toISOString(), schedule_approved_by: profile.id,
  }).eq("id", videoId);
  if (error) throw new Error("Schedule approval could not be saved.");
  revalidatePath("/dashboard");
}

export async function rejectVideo(videoId, note) {
  const { supabase, user, profile } = await me();
  const { data: v, error: loadError } = await supabase.from("videos").select("client_id").eq("id", videoId).single();
  if (loadError) throw new Error("Unable to load this item. Please refresh and try again.");
  const isClientApprover = has(profile.roles, "client") && profile.client_id && v?.client_id === profile.client_id;
  if (!admin_(profile.roles) && !isClientApprover) throw new Error("Not allowed");
  const now = new Date().toISOString();
  const { error } = await supabase.from("videos").update({
    stage: "to_edit", rejection_note: note || "Needs changes", current_stage_entered_at: now, last_saved_at: now,
  }).eq("id", videoId);
  if (error) throw new Error("The review decision could not be saved. Please try again.");
  await logActivity(supabase, user.id, videoId, "stage_transition", { from_stage: "review", to_stage: "to_edit", decision: "rejected", note: note || "Needs changes" });
  revalidatePath("/dashboard");
}

export async function savePost(videoId, fields) {
  const { supabase, user, profile } = await me();
  const now = new Date().toISOString();
  await supabase.from("videos").update({
    caption: fields.caption, hashtags: fields.hashtags, pinned_comment: fields.pinned,
    youtube_url: fields.youtube, instagram_url: fields.instagram, facebook_url: fields.facebook,
    writer_id: profile.id, last_saved_at: now,
  }).eq("id", videoId);
  await logActivity(supabase, user.id, videoId, "content_saved", { stage: "content", saved_at: now });
  revalidatePath("/dashboard");
}

export async function markPosted(videoId, fields) {
  const { supabase, user, profile } = await me();
  const { data: vt } = await supabase.from("videos").select("item_type").eq("id", videoId).single();
  if (vt?.item_type !== "shoot") {
    const missing = [];
    if (!fields.youtube || !fields.youtube.trim()) missing.push("YouTube");
    if (!fields.instagram || !fields.instagram.trim()) missing.push("Instagram");
    if (!fields.facebook || !fields.facebook.trim()) missing.push("Facebook");
    if (missing.length) throw new Error(`Please paste the ${missing.join(", ")} link before publishing.`);
  }
  const now = new Date().toISOString();
  await supabase.from("videos").update({
    caption: fields.caption, hashtags: fields.hashtags, pinned_comment: fields.pinned,
    youtube_url: fields.youtube, instagram_url: fields.instagram, facebook_url: fields.facebook,
    writer_id: profile.id, stage: "published", posted_at: now, current_stage_entered_at: now, last_saved_at: now,
  }).eq("id", videoId);
  await logActivity(supabase, user.id, videoId, "stage_transition", { from_stage: "content", to_stage: "published" });
  await stopTask(videoId);
  revalidatePath("/dashboard");
}

export async function updateViews(videoId, v) {
  const { supabase } = await me();
  await supabase.from("videos").update({
    yt_views: Number(v.yt) || 0, ig_views: Number(v.ig) || 0,
    fb_views: Number(v.fb) || 0, views_auto: false,
  }).eq("id", videoId);
  revalidatePath("/dashboard"); revalidatePath("/analytics");
}

/* ---------------- Per-task timer ---------------- */
export async function startTask(videoId, stage) {
  const { supabase, user } = await me();
  const { data: open } = await supabase.from("task_time_logs")
    .select("id").eq("user_id", user.id).eq("video_id", videoId).is("ended_at", null).limit(1);
  if (!open || !open.length)
    await supabase.from("task_time_logs").insert({ video_id: videoId, user_id: user.id, stage });
}
export async function stopTask(videoId) {
  const { supabase, user } = await me();
  const { data: open } = await supabase.from("task_time_logs")
    .select("id, started_at").eq("user_id", user.id).eq("video_id", videoId)
    .is("ended_at", null).order("started_at", { ascending: false }).limit(1);
  if (open && open.length) {
    const secs = Math.round((Date.now() - new Date(open[0].started_at)) / 1000);
    await supabase.from("task_time_logs")
      .update({ ended_at: new Date().toISOString(), seconds: secs }).eq("id", open[0].id);
  }
}

/* ---------------- Phase 3: auto-pull YouTube views ---------------- */
export async function refreshYouTubeViews(videoId, url) {
  const { supabase } = await me();
  const views = await fetchYouTubeViews(url);
  if (views == null) return { ok: false, reason: "No API key or no video id" };
  await supabase.from("videos").update({ yt_views: views, views_auto: true }).eq("id", videoId);
  revalidatePath("/dashboard"); revalidatePath("/analytics");
  return { ok: true, views };
}

/* ---------------- v3 Round 2: edit user, payments, follow-up ---------------- */
export async function updateUser(form) {
  const { profile } = await me();
  if (!admin_(profile.roles)) throw new Error("Not allowed");
  const id = form.get("id");
  const full_name = form.get("full_name");
  const roles = form.getAll("roles");
  const client_id = form.get("client_id") || null;
  if (!id) throw new Error("Missing user");
  if (!roles.length) throw new Error("Pick at least one role");
  await createAdminClient().from("profiles").update({
    full_name, roles, client_id: roles.includes("client") ? client_id : null,
  }).eq("id", id);
  revalidatePath("/users"); revalidatePath("/dashboard");
}

export async function recordPayment(form) {
  const { supabase, profile } = await me();
  if (!admin_(profile.roles)) throw new Error("Not allowed");
  const client_id = form.get("client_id");
  const amount = Number(form.get("amount"));
  if (!client_id || !amount) throw new Error("Enter an amount");
  await supabase.from("payments").insert({
    client_id, amount, note: form.get("note") || "", method: form.get("method") || "",
    created_by: profile.id,
  });
  revalidatePath("/accounts");
}

export async function setFollowUp(form) {
  const { supabase, profile } = await me();
  if (!admin_(profile.roles)) throw new Error("Not allowed");
  await supabase.from("clients").update({
    follow_up_date: form.get("follow_up_date") || null,
    follow_up_note: form.get("follow_up_note") || "",
  }).eq("id", form.get("client_id"));
  revalidatePath("/accounts");
}

/* ---------------- v3 Round 3A: edit pipeline item (with assignment lock) ---------------- */
export async function editVideo(form) {
  const { supabase, user, profile } = await me();
  const id = form.get("id");
  const { data: v } = await supabase.from("videos").select("editor_id").eq("id", id).single();
  const allowed = admin_(profile.roles) || (v && v.editor_id === profile.id);
  if (!allowed) throw new Error("Only the assigned person or an admin can edit this item.");
  const durationSeconds = Number(form.get("duration_seconds"));
  const nextEditor = form.get("editor_id") || null;
  const changedEditor = (v?.editor_id || null) !== nextEditor;
  const transferReason = String(form.get("reassignment_reason") || "").trim();
  if (changedEditor && v?.editor_id && !transferReason) throw new Error("Please enter a reason for transferring this task.");
  const now = new Date().toISOString();
  const { error } = await supabase.from("videos").update({
    title: form.get("title"),
    item_type: form.get("item_type") || "video",
    due_date: form.get("due_date") || null,
    brief: form.get("brief") || "",
    client_id: form.get("client_id") || null,
    editor_id: nextEditor,
    reassignment_reason: changedEditor ? transferReason : undefined,
    reassigned_at: changedEditor ? new Date().toISOString() : undefined,
    reassigned_by: changedEditor ? profile.id : undefined,
    duration_seconds: Number.isFinite(durationSeconds) && durationSeconds > 0 ? Math.round(durationSeconds) : null,
    last_saved_at: now,
  }).eq("id", id);
  if (error) throw new Error("Unable to save the video details. Please try again.");
  await logActivity(supabase, user.id, id, "item_saved", { saved_at: now, editor_changed: changedEditor });
  if (changedEditor) await supabase.from("assignment_transfers").insert({ video_id: id, from_user_id: v?.editor_id || null, to_user_id: nextEditor, reason: transferReason || "Initial assignment", transferred_by: profile.id });
  revalidatePath("/dashboard");
}

export async function generateMonthlyInvoices(periodValue) {
  const { supabase, profile } = await me();
  if (!admin_(profile.roles)) throw new Error("Not allowed");
  const match = String(periodValue || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) throw new Error("Choose a valid month.");
  const start = `${match[1]}-${match[2]}-01`;
  const endDate = new Date(Date.UTC(Number(match[1]), Number(match[2]), 0));
  const end = endDate.toISOString().slice(0, 10);
  const [{ data: clients }, { data: videos }] = await Promise.all([
    supabase.from("clients").select("id, name, video_unit_price, video_discount_percent"),
    supabase.from("videos").select("id, title, client_id, duration_seconds, calculated_units, approved_units, item_type, submitted_at, posted_at").eq("item_type", "video").gte("submitted_at", `${start}T00:00:00Z`).lte("submitted_at", `${end}T23:59:59Z`),
  ]);
  for (const client of clients || []) {
    const work = (videos || []).filter(v => v.client_id === client.id && v.duration_seconds);
    if (!work.length) continue;
    const rate = Number(client.video_unit_price || 1500), discountPct = Number(client.video_discount_percent || 0);
    const subtotal = work.reduce((sum,v) => sum + effectiveVideoUnits(v) * rate, 0);
    const discount = subtotal * discountPct / 100, total = subtotal - discount;
    const { data: invoice, error } = await supabase.from("invoices").upsert({ client_id: client.id, period_start: start, period_end: end, subtotal, discount, total, generated_by: profile.id }, { onConflict: "client_id,period_start,period_end" }).select("id").single();
    if (error) throw new Error("Invoice generation failed.");
    await supabase.from("invoice_items").delete().eq("invoice_id", invoice.id);
    await supabase.from("invoice_items").insert(work.map(v => ({ invoice_id: invoice.id, video_id: v.id, description: v.title, quantity: effectiveVideoUnits(v), unit_price: rate, amount: effectiveVideoUnits(v) * rate * (1 - discountPct / 100) })));
  }
  revalidatePath("/accounts");
}

/* ---------------- v3 Round 3B: packages catalog ---------------- */
export async function createPackage(form) {
  const { supabase, profile } = await me();
  if (!admin_(profile.roles)) throw new Error("Not allowed");
  const name = (form.get("name") || "").trim();
  if (!name) throw new Error("Package name is required");
  await supabase.from("packages").insert({
    name,
    price: Number(form.get("price")) || 0,
    quota_videos: Number(form.get("quota_videos")) || 0,
    quota_posters: Number(form.get("quota_posters")) || 0,
  });
  revalidatePath("/packages"); revalidatePath("/doctors");
}

export async function deletePackage(id) {
  const { supabase, profile } = await me();
  if (!admin_(profile.roles)) throw new Error("Not allowed");
  await supabase.from("packages").delete().eq("id", id);
  revalidatePath("/packages");
}

// Resolve package + discount into final quotas/price (used by add/edit client)
async function resolvePackage(supabase, form) {
  const package_id = form.get("package_id") || null;
  const discount = Number(form.get("discount")) || 0;
  let quota_videos = Number(form.get("quota_videos")) || 0;
  let quota_posters = Number(form.get("quota_posters")) || 0;
  let price = Number(form.get("price")) || 0;
  if (package_id) {
    const { data: pk } = await supabase.from("packages").select("*").eq("id", package_id).single();
    if (pk) { quota_videos = pk.quota_videos; quota_posters = pk.quota_posters; price = Number(pk.price) - discount; }
  }
  if (price < 0) price = 0;
  return { package_id, discount, quota_videos, quota_posters, price };
}

/* ---------------- v3 Round 3D: delete pipeline item (admin, confirmed) ---------------- */
export async function deleteVideo(id) {
  const { profile } = await me();
  if (!admin_(profile.roles)) throw new Error("Only an admin can delete items.");
  const admin = createAdminClient();
  await admin.from("task_time_logs").delete().eq("video_id", id);
  await admin.from("videos").delete().eq("id", id);
  revalidatePath("/dashboard");
}

/* ---------------- v3 Round 3D: expenses / assets / partners (accounting) ---------------- */
export async function addExpense(form) {
  const { supabase, profile } = await me();
  if (!admin_(profile.roles)) throw new Error("Not allowed");
  const amount = Number(form.get("amount"));
  if (!amount || amount <= 0) throw new Error("Enter a valid amount");
  await supabase.from("expenses").insert({
    category: form.get("category") || "Other",
    amount,
    note: form.get("note") || "",
    spent_at: form.get("spent_at") || new Date().toISOString().slice(0, 10),
    created_by: profile.id,
  });
  revalidatePath("/accounts");
}
export async function deleteExpense(id) {
  const { supabase, profile } = await me();
  if (!admin_(profile.roles)) throw new Error("Not allowed");
  await supabase.from("expenses").delete().eq("id", id);
  revalidatePath("/accounts");
}

export async function addAsset(form) {
  const { supabase, profile } = await me();
  if (!admin_(profile.roles)) throw new Error("Not allowed");
  const value = Number(form.get("value"));
  if (!form.get("name")) throw new Error("Enter an asset name");
  await supabase.from("assets").insert({
    name: form.get("name"),
    value: value || 0,
    acquired_at: form.get("acquired_at") || new Date().toISOString().slice(0, 10),
    note: form.get("note") || "",
  });
  revalidatePath("/accounts");
}
export async function deleteAsset(id) {
  const { supabase, profile } = await me();
  if (!admin_(profile.roles)) throw new Error("Not allowed");
  await supabase.from("assets").delete().eq("id", id);
  revalidatePath("/accounts");
}

export async function addPartner(form) {
  const { supabase, profile } = await me();
  if (!admin_(profile.roles)) throw new Error("Not allowed");
  if (!form.get("name")) throw new Error("Enter a partner name");
  await supabase.from("partners").insert({
    name: form.get("name"),
    share_pct: Number(form.get("share_pct")) || 0,
  });
  revalidatePath("/accounts");
}
export async function deletePartner(id) {
  const { supabase, profile } = await me();
  if (!admin_(profile.roles)) throw new Error("Not allowed");
  await supabase.from("partners").delete().eq("id", id);
  revalidatePath("/accounts");
}

