"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { fetchYouTubeViews } from "@/lib/youtube";

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

/* ---------------- Attendance ---------------- */
export async function clockIn() {
  const { supabase, user } = await me();
  const { data: open } = await supabase
    .from("attendance").select("id").eq("user_id", user.id).is("clock_out", null).limit(1);
  if (!open || open.length === 0) await supabase.from("attendance").insert({ user_id: user.id });
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
  await supabase.from("clients").insert({
    name,
    type: form.get("type") || "external",
    package: form.get("package") || "",
    quota_videos: Number(form.get("quota_videos")) || 0,
    quota_posters: Number(form.get("quota_posters")) || 0,
    self_approver: form.get("self_approver") === "on",
  });
  revalidatePath("/doctors"); revalidatePath("/dashboard");
}

/* ---------------- Workflow ---------------- */
export async function addVideo(form) {
  const { supabase, profile } = await me();
  if (!["super_admin", "admin", "editor", "designer"].some((r) => has(profile.roles, r)))
    throw new Error("Not allowed");
  await supabase.from("videos").insert({
    title: form.get("title"),
    client_id: form.get("client_id") || null,
    editor_id: form.get("editor_id") || null,
    item_type: form.get("item_type") || "video",
    brief: form.get("brief") || "",
    stage: "to_edit",
  });
  revalidatePath("/dashboard");
}

export async function submitDrive(videoId, link) {
  const { supabase } = await me();
  await supabase.from("videos").update({
    drive_link: link, stage: "review",
    submitted_at: new Date().toISOString(), rejection_note: "",
  }).eq("id", videoId);
  revalidatePath("/dashboard");
}

export async function approveVideo(videoId) {
  const { supabase, profile } = await me();
  const { data: v } = await supabase.from("videos").select("client_id").eq("id", videoId).single();
  const isClientApprover = has(profile.roles, "client") && profile.client_id && v?.client_id === profile.client_id;
  if (!admin_(profile.roles) && !isClientApprover) throw new Error("Not allowed to approve");
  await supabase.from("videos").update({
    stage: "content", approver_id: profile.id,
    approved_at: new Date().toISOString(), rejection_note: "",
  }).eq("id", videoId);
  revalidatePath("/dashboard");
}

export async function rejectVideo(videoId, note) {
  const { supabase, profile } = await me();
  const { data: v } = await supabase.from("videos").select("client_id").eq("id", videoId).single();
  const isClientApprover = has(profile.roles, "client") && profile.client_id && v?.client_id === profile.client_id;
  if (!admin_(profile.roles) && !isClientApprover) throw new Error("Not allowed");
  await supabase.from("videos").update({
    stage: "to_edit", rejection_note: note || "Needs changes", submitted_at: null,
  }).eq("id", videoId);
  revalidatePath("/dashboard");
}

export async function savePost(videoId, fields) {
  const { supabase, profile } = await me();
  await supabase.from("videos").update({
    caption: fields.caption, hashtags: fields.hashtags, pinned_comment: fields.pinned,
    youtube_url: fields.youtube, instagram_url: fields.instagram, facebook_url: fields.facebook,
    writer_id: profile.id,
  }).eq("id", videoId);
  revalidatePath("/dashboard");
}

export async function markPosted(videoId, fields) {
  const { supabase, profile } = await me();
  const missing = [];
  if (!fields.youtube || !fields.youtube.trim()) missing.push("YouTube");
  if (!fields.instagram || !fields.instagram.trim()) missing.push("Instagram");
  if (!fields.facebook || !fields.facebook.trim()) missing.push("Facebook");
  if (missing.length) throw new Error(`Please paste the ${missing.join(", ")} link before publishing.`);
  await supabase.from("videos").update({
    caption: fields.caption, hashtags: fields.hashtags, pinned_comment: fields.pinned,
    youtube_url: fields.youtube, instagram_url: fields.instagram, facebook_url: fields.facebook,
    writer_id: profile.id, stage: "published", posted_at: new Date().toISOString(),
  }).eq("id", videoId);
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
