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
    price: Number(form.get("price")) || 0,
    self_approver: form.get("self_approver") === "on",
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
  await supabase.from("clients").update({
    name,
    type: form.get("type") || "external",
    package: form.get("package") || "",
    quota_videos: Number(form.get("quota_videos")) || 0,
    quota_posters: Number(form.get("quota_posters")) || 0,
    price: Number(form.get("price")) || 0,
    self_approver: form.get("self_approver") === "on",
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
  const { supabase, profile } = await me();
  if (!["super_admin", "admin", "editor", "designer"].some((r) => has(profile.roles, r)))
    throw new Error("Not allowed");
  await supabase.from("videos").insert({
    title: form.get("title"),
    client_id: form.get("client_id") || null,
    editor_id: form.get("editor_id") || null,
    item_type: form.get("item_type") || "video",
    brief: form.get("brief") || "",
    due_date: form.get("due_date") || null,
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
  revalidatePath("/users");
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
  const { supabase, profile } = await me();
  const id = form.get("id");
  const { data: v } = await supabase.from("videos").select("editor_id").eq("id", id).single();
  const allowed = admin_(profile.roles) || (v && v.editor_id === profile.id);
  if (!allowed) throw new Error("Only the assigned person or an admin can edit this item.");
  await supabase.from("videos").update({
    title: form.get("title"),
    item_type: form.get("item_type") || "video",
    due_date: form.get("due_date") || null,
    brief: form.get("brief") || "",
    client_id: form.get("client_id") || null,
    editor_id: form.get("editor_id") || null,
  }).eq("id", id);
  revalidatePath("/dashboard");
}
