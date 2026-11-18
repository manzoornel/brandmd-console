"""
Brand MD auto-publisher — runs on the office PC (Windows), driven by Hermes or
Windows Task Scheduler every 5-10 minutes.

  approved video (stage=content) ──prepare──> AI caption + next 7 PM slot (stage=scheduled)
  due scheduled video          ──publish──> Facebook + Instagram (+ YouTube) ──> stage=published

Commands
  python publisher.py check          verify .env, Supabase, Meta and Google access
  python publisher.py google-login   one-time Google sign-in (Drive + YouTube)
  python publisher.py status         show the auto-publish queue
  python publisher.py prepare        only write captions + schedule (no uploads)
  python publisher.py publish        only upload items that are due
  python publisher.py run            prepare + publish (what the scheduler calls)
  add --json for machine-readable output (Hermes), --dry-run to change nothing.

Secrets live only in automation/publisher/.env on this PC. Never commit it.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
IST = dt.timezone(dt.timedelta(hours=5, minutes=30))


# ───────────────────────────── config ─────────────────────────────
def load_env(path: Path = HERE / ".env") -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def env_bool(name: str, default: bool = False) -> bool:
    v = env(name)
    return default if v == "" else v.lower() in ("1", "true", "yes", "on")


# ───────────────────────────── pure helpers (unit-tested) ─────────────────────────────
def drive_file_id(link: str) -> str:
    """Extract the file id from any common Google Drive share link."""
    if not link:
        raise ValueError("No Drive link on this item")
    for pat in (r"/file/d/([A-Za-z0-9_-]{10,})", r"[?&]id=([A-Za-z0-9_-]{10,})", r"/d/([A-Za-z0-9_-]{10,})"):
        m = re.search(pat, link)
        if m:
            return m.group(1)
    if re.fullmatch(r"[A-Za-z0-9_-]{20,}", link.strip()):
        return link.strip()
    if "/folders/" in link:
        raise ValueError("This is a Drive FOLDER link — please paste the link of the video file itself")
    raise ValueError("Could not read the Google Drive file id from the link")


def next_slot(now: dt.datetime, slot: str, taken_ist_dates: set[dt.date],
              min_lead_minutes: int = 120, preferred: dt.date | None = None) -> dt.datetime:
    """First day at `slot` (IST, "HH:MM") that is free and at least min_lead_minutes away.
    `preferred` (from the shooting plan) is used when it is still possible and free."""
    hh, mm = (int(x) for x in slot.split(":")[:2])
    earliest = now.astimezone(IST) + dt.timedelta(minutes=min_lead_minutes)
    day = earliest.date()
    if preferred and preferred > day:
        day = preferred
    for _ in range(400):
        cand = dt.datetime(day.year, day.month, day.day, hh, mm, tzinfo=IST)
        if cand >= earliest and day not in taken_ist_dates:
            return cand.astimezone(dt.timezone.utc)
        day += dt.timedelta(days=1)
    raise RuntimeError("No free slot found in the next 400 days")


CAPTION_KEYS = ("caption", "hashtags", "pinned_comment", "yt_title", "yt_description")


def clean_caption_json(raw: str) -> dict:
    """Parse the model output and enforce platform limits."""
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?|```$", "", raw, flags=re.M).strip()
    start, end = raw.find("{"), raw.rfind("}")
    data = json.loads(raw[start:end + 1])
    out = {k: str(data.get(k, "") or "").strip() for k in CAPTION_KEYS}
    if not out["caption"]:
        raise ValueError("AI returned an empty caption")
    tags = re.findall(r"#[\wഀ-ൿ]+", out["hashtags"])
    out["hashtags"] = " ".join(dict.fromkeys(tags[:15]))  # IG hard limit is 30; keep it tidy
    out["yt_title"] = re.sub(r"[<>]", "", out["yt_title"])[:100]
    out["yt_description"] = re.sub(r"[<>]", "", out["yt_description"])[:4900]
    out["caption"] = out["caption"][:2000]
    out["pinned_comment"] = out["pinned_comment"][:900]
    return out


def ist_date(iso: str | None) -> dt.date | None:
    if not iso:
        return None
    return dt.datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(IST).date()


def full_caption(v: dict) -> str:
    return (v.get("caption") or "").strip() + ("\n\n" + v["hashtags"].strip() if v.get("hashtags") else "")


# ───────────────────────────── Supabase (REST) ─────────────────────────────
class DB:
    def __init__(self):
        import requests
        self.r = requests
        self.url = env("SUPABASE_URL").rstrip("/") + "/rest/v1"
        key = env("SUPABASE_SERVICE_ROLE_KEY")
        self.h = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    def get(self, table: str, params: dict) -> list[dict]:
        res = self.r.get(f"{self.url}/{table}", headers=self.h, params=params, timeout=30)
        res.raise_for_status()
        return res.json()

    def patch(self, table: str, filters: dict, body: dict) -> list[dict]:
        res = self.r.patch(f"{self.url}/{table}", headers={**self.h, "Prefer": "return=representation"},
                           params=filters, data=json.dumps(body), timeout=30)
        res.raise_for_status()
        return res.json()

    def insert(self, table: str, body: dict) -> None:
        res = self.r.post(f"{self.url}/{table}", headers=self.h, data=json.dumps(body), timeout=30)
        res.raise_for_status()

    def log(self, video_id: str, event: str, meta: dict) -> None:
        try:
            self.insert("activity_events", {"user_id": env("BOT_PROFILE_ID") or None, "video_id": video_id,
                                            "event_type": event, "metadata": {**meta, "by": "hermes_publisher"}})
        except Exception:
            pass  # the log must never block publishing


def auto_clients(db: DB) -> dict[str, dict]:
    rows = db.get("clients", {"select": "id,name,auto_publish_time,auto_publish_platforms,caption_style",
                              "auto_publish": "eq.true"})
    return {c["id"]: c for c in rows}


# ───────────────────────────── Google (Drive + YouTube) ─────────────────────────────
GOOGLE_SCOPES = ["https://www.googleapis.com/auth/drive.readonly",
                 "https://www.googleapis.com/auth/youtube.upload",
                 "https://www.googleapis.com/auth/youtube.force-ssl"]
TOKEN_FILE = HERE / "google_token.json"
CLIENT_FILE = HERE / "google_client_secret.json"


def google_creds():
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    if not TOKEN_FILE.exists():
        return None
    creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), GOOGLE_SCOPES)
    if not creds.valid and creds.refresh_token:
        creds.refresh(Request())
        TOKEN_FILE.write_text(creds.to_json(), encoding="utf-8")
    return creds


def google_login() -> None:
    from google_auth_oauthlib.flow import InstalledAppFlow
    if not CLIENT_FILE.exists():
        sys.exit(f"Put the OAuth client file at {CLIENT_FILE} first (see README step 3).")
    flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT_FILE), GOOGLE_SCOPES)
    creds = flow.run_local_server(port=0, prompt="consent", access_type="offline")
    TOKEN_FILE.write_text(creds.to_json(), encoding="utf-8")
    print("Google sign-in saved. Drive download and YouTube upload are ready.")


def download_video(v: dict) -> Path:
    import requests
    folder = Path(env("WORK_DIR") or (HERE / "downloads"))
    folder.mkdir(parents=True, exist_ok=True)
    dest = folder / f"{v['id']}.mp4"
    if dest.exists() and dest.stat().st_size > 100_000:
        return dest
    fid = drive_file_id(v.get("drive_link", ""))
    creds = google_creds()
    tmp = dest.with_suffix(".part")
    if creds:
        url, headers = f"https://www.googleapis.com/drive/v3/files/{fid}?alt=media&supportsAllDrives=true", \
            {"Authorization": f"Bearer {creds.token}"}
    else:  # only works when the file is shared "Anyone with the link"
        url, headers = f"https://drive.usercontent.google.com/download?id={fid}&export=download&confirm=t", {}
    with requests.get(url, headers=headers, stream=True, timeout=120) as res:
        if res.status_code in (401, 403, 404):
            raise RuntimeError("Drive file not reachable — share it with the publisher Google account "
                               "or set it to 'Anyone with the link'")
        res.raise_for_status()
        if "text/html" in res.headers.get("Content-Type", ""):
            raise RuntimeError("Drive returned a web page instead of the video (file not shared?)")
        with open(tmp, "wb") as fh:
            for chunk in res.iter_content(1 << 20):
                fh.write(chunk)
    if tmp.stat().st_size < 100_000:
        tmp.unlink(missing_ok=True)
        raise RuntimeError("Downloaded file is too small to be a video — check the Drive link")
    tmp.replace(dest)
    return dest


def video_seconds(path: Path, fallback: int | None) -> int | None:
    if fallback:
        return int(fallback)
    import shutil
    import subprocess
    if not shutil.which("ffprobe"):
        return None
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of",
                              "default=nw=1:nk=1", str(path)], capture_output=True, text=True, timeout=60)
        return int(float(out.stdout.strip()))
    except Exception:
        return None


# ───────────────────────────── AI caption writer ─────────────────────────────
STYLE = """You write social media text for "Doctor Uncle" (Doctor Uncle Family Clinic, Vakkad & Unniyal, Tirur, Malappuram, Kerala).
Audience: ordinary Malayali families. Tone: warm, trustworthy doctor, simple everyday Malayalam (Malayalam script), a few English medical words are fine.
Rules:
- Only say what the video says. No cure promises, no fear-mongering, no drug doses, no "100%".
- caption: 3-6 short lines. Line 1 is a hook question or surprising fact. End with: "സംശയങ്ങൾക്ക് WhatsApp: 9961588880".
- hashtags: 8-12 tags, mix of English and Malayalam, always include #DoctorUncle #Tirur #MalayalamHealth.
- pinned_comment: one friendly line inviting questions in the comments + WhatsApp 9961588880 for appointments.
- yt_title: under 90 characters, curiosity + keyword, Malayalam with English keyword; add " #shorts" if the video is a Short (under 3 minutes).
- yt_description: 2 short paragraphs summary, then "📍 Doctor Uncle Family Clinic — Vakkad (24x7) & Unniyal, Tirur", "📞 WhatsApp: 9961588880", then the hashtags.
Return ONLY JSON with keys: caption, hashtags, pinned_comment, yt_title, yt_description."""


def write_caption(v: dict, client: dict, path: Path | None) -> dict:
    import requests
    style = STYLE + ("\nExtra style notes for this client:\n" + client["caption_style"] if client.get("caption_style") else "")
    facts = f"Video title (internal): {v.get('title','')}\nBrief / topic notes: {v.get('brief','') or '-'}\n"
    secs = v.get("duration_seconds")
    if secs:
        facts += f"Duration: {secs} seconds\n"

    if env("GEMINI_API_KEY") and path is not None:  # watches and listens to the actual video
        key, model = env("GEMINI_API_KEY"), env("GEMINI_MODEL", "gemini-2.5-flash")
        base = "https://generativelanguage.googleapis.com"
        size = path.stat().st_size
        start = requests.post(f"{base}/upload/v1beta/files?key={key}", timeout=60, headers={
            "X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start",
            "X-Goog-Upload-Header-Content-Length": str(size), "X-Goog-Upload-Header-Content-Type": "video/mp4",
            "Content-Type": "application/json"}, data=json.dumps({"file": {"display_name": v["id"]}}))
        start.raise_for_status()
        with open(path, "rb") as fh:
            up = requests.post(start.headers["X-Goog-Upload-URL"], timeout=900, data=fh, headers={
                "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize"})
        up.raise_for_status()
        f = up.json()["file"]
        for _ in range(60):
            if f.get("state") == "ACTIVE":
                break
            if f.get("state") == "FAILED":
                raise RuntimeError("Gemini could not process the video")
            time.sleep(5)
            f = requests.get(f"{base}/v1beta/{f['name']}?key={key}", timeout=30).json()
        try:
            res = requests.post(f"{base}/v1beta/models/{model}:generateContent?key={key}", timeout=300,
                                headers={"Content-Type": "application/json"}, data=json.dumps({
                    "systemInstruction": {"parts": [{"text": style}]},
                    "contents": [{"parts": [{"file_data": {"mime_type": "video/mp4", "file_uri": f["uri"]}},
                                            {"text": facts + "Watch and listen to the video, then write the JSON."}]}],
                    "generationConfig": {"responseMimeType": "application/json", "temperature": 0.6}}))
            res.raise_for_status()
            text = res.json()["candidates"][0]["content"]["parts"][0]["text"]
        finally:
            requests.delete(f"{base}/v1beta/{f['name']}?key={key}", timeout=30)
        return clean_caption_json(text)

    # Text-only fallback: any OpenAI-compatible API (DeepSeek, OpenAI, OmniRoute...)
    base = env("LLM_BASE_URL", "https://api.deepseek.com").rstrip("/")
    res = requests.post(f"{base}/chat/completions", timeout=180, headers={
        "Authorization": f"Bearer {env('LLM_API_KEY')}", "Content-Type": "application/json"},
        data=json.dumps({"model": env("LLM_MODEL", "deepseek-chat"), "temperature": 0.6,
                         "response_format": {"type": "json_object"},
                         "messages": [{"role": "system", "content": style},
                                      {"role": "user", "content": facts + "Write the JSON."}]}))
    res.raise_for_status()
    return clean_caption_json(res.json()["choices"][0]["message"]["content"])


# ───────────────────────────── Meta (Facebook + Instagram) ─────────────────────────────
def graph() -> str:
    return f"https://graph.facebook.com/{env('META_GRAPH_VERSION', 'v23.0')}"


_PAGE_TOKEN: str | None = None


def page_token() -> str:
    """META_PAGE_TOKEN may be a Page token or a system-user token; resolve to the Page token once."""
    global _PAGE_TOKEN
    if _PAGE_TOKEN is None:
        tok = env("META_PAGE_TOKEN")
        try:
            got = meta_call("GET", f"{graph()}/{env('META_PAGE_ID')}", params={"fields": "access_token", "access_token": tok})
            _PAGE_TOKEN = got.get("access_token") or tok
        except RuntimeError:
            _PAGE_TOKEN = tok
    return _PAGE_TOKEN


def ig_user_id() -> str:
    """META_IG_USER_ID, or the Instagram account linked to the Page when left blank."""
    if not env("META_IG_USER_ID"):
        got = meta_call("GET", f"{graph()}/{env('META_PAGE_ID')}", params={
            "fields": "instagram_business_account", "access_token": page_token()})
        os.environ["META_IG_USER_ID"] = (got.get("instagram_business_account") or {}).get("id", "")
    return env("META_IG_USER_ID")


def meta_call(method: str, url: str, **kw) -> dict:
    import requests
    res = requests.request(method, url, timeout=kw.pop("timeout", 120), **kw)
    try:
        body = res.json()
    except ValueError:
        body = {"raw": res.text[:300]}
    if res.status_code >= 400 or "error" in body:
        msg = body.get("error", {}).get("message") if isinstance(body.get("error"), dict) else body
        raise RuntimeError(f"Meta: {msg}")
    return body


def upload_bytes(url: str, token: str, path: Path) -> dict:
    size = path.stat().st_size
    with open(path, "rb") as fh:
        return meta_call("POST", url, timeout=1800, data=fh, headers={
            "Authorization": f"OAuth {token}", "offset": "0", "file_size": str(size)})


def publish_facebook(v: dict, path: Path, secs: int | None) -> tuple[str, str]:
    token, page = page_token(), env("META_PAGE_ID")
    text = full_caption(v)
    if secs is None or secs <= 90:  # Reels API accepts 3-90 s
        try:
            start = meta_call("POST", f"{graph()}/{page}/video_reels",
                              data={"upload_phase": "start", "access_token": token})
            vid = start["video_id"]
            upload_bytes(start["upload_url"], token, path)
            meta_call("POST", f"{graph()}/{page}/video_reels", data={
                "upload_phase": "finish", "video_id": vid, "video_state": "PUBLISHED",
                "description": text, "access_token": token})
            return vid, wait_fb(vid, token)
        except RuntimeError as e:
            if secs is not None:
                raise
            print(f"  FB Reel refused ({e}); posting as a normal Page video", file=sys.stderr)
    with open(path, "rb") as fh:  # longer videos: normal Page video
        res = meta_call("POST", f"https://graph-video.facebook.com/{env('META_GRAPH_VERSION','v23.0')}/{page}/videos",
                        timeout=3600, data={"description": text, "access_token": token},
                        files={"source": (path.name, fh, "video/mp4")})
    return res["id"], wait_fb(res["id"], token)


def wait_fb(vid: str, token: str) -> str:
    for _ in range(60):
        info = meta_call("GET", f"{graph()}/{vid}", params={"fields": "status,permalink_url", "access_token": token})
        st = (info.get("status") or {}).get("video_status")
        if st == "error":
            raise RuntimeError("Facebook could not process the video")
        if st in ("ready", "published", None) and info.get("permalink_url"):
            link = info["permalink_url"]
            return link if link.startswith("http") else "https://www.facebook.com" + link
        time.sleep(10)
    return f"https://www.facebook.com/{vid}"


def publish_instagram(v: dict, path: Path) -> tuple[str, str]:
    token, ig = page_token(), ig_user_id()
    box = meta_call("POST", f"{graph()}/{ig}/media", data={
        "media_type": "REELS", "upload_type": "resumable", "caption": full_caption(v)[:2200],
        "share_to_feed": "true", "access_token": token})
    upload_bytes(box["uri"], token, path)
    for _ in range(90):
        st = meta_call("GET", f"{graph()}/{box['id']}", params={"fields": "status_code,status", "access_token": token})
        if st.get("status_code") == "FINISHED":
            break
        if st.get("status_code") in ("ERROR", "EXPIRED"):
            raise RuntimeError(f"Instagram could not process the video: {st.get('status')}")
        time.sleep(10)
    else:
        raise RuntimeError("Instagram is still processing after 15 minutes — will retry")
    media = meta_call("POST", f"{graph()}/{ig}/media_publish", data={"creation_id": box["id"], "access_token": token})["id"]
    link = meta_call("GET", f"{graph()}/{media}", params={"fields": "permalink", "access_token": token}).get("permalink", "")
    return media, link


def comment_meta(object_id: str, text: str) -> None:
    if text:
        try:
            meta_call("POST", f"{graph()}/{object_id}/comments", data={"message": text, "access_token": page_token()})
        except RuntimeError as e:
            print(f"  first comment failed on {object_id}: {e}", file=sys.stderr)


# ───────────────────────────── YouTube ─────────────────────────────
def publish_youtube(v: dict, path: Path) -> tuple[str, str]:
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload
    creds = google_creds()
    if not creds:
        raise RuntimeError("YouTube: run `python publisher.py google-login` first")
    yt = build("youtube", "v3", credentials=creds, cache_discovery=False)
    tags = [t.lstrip("#") for t in (v.get("hashtags") or "").split()][:15]
    body = {"snippet": {"title": (v.get("yt_title") or v.get("title") or "Doctor Uncle")[:100],
                        "description": v.get("yt_description") or full_caption(v),
                        "tags": tags, "categoryId": env("YT_CATEGORY_ID", "27"),
                        "defaultLanguage": "ml", "defaultAudioLanguage": "ml"},
            "status": {"privacyStatus": env("YT_PRIVACY", "public"), "selfDeclaredMadeForKids": False}}
    req = yt.videos().insert(part="snippet,status", body=body,
                             media_body=MediaFileUpload(str(path), chunksize=8 << 20, resumable=True))
    resp = None
    while resp is None:
        _, resp = req.next_chunk()
    vid = resp["id"]
    if v.get("pinned_comment"):
        try:
            yt.commentThreads().insert(part="snippet", body={"snippet": {"videoId": vid, "topLevelComment": {
                "snippet": {"textOriginal": v["pinned_comment"]}}}}).execute()
        except Exception as e:
            print(f"  YouTube comment failed: {e}", file=sys.stderr)
    return vid, f"https://youtu.be/{vid}"


# ───────────────────────────── jobs ─────────────────────────────
VIDEO_FIELDS = ("id,title,brief,client_id,stage,item_type,drive_link,caption,hashtags,pinned_comment,yt_title,"
                "yt_description,duration_seconds,scheduled_post_date,scheduled_publish_at,publication_source,"
                "publish_attempts,publish_error,publish_locked_until,yt_video_id,ig_media_id,fb_video_id,"
                "youtube_url,instagram_url,facebook_url,writer_id")


def in_list(ids) -> str:
    return "in.(" + ",".join(ids) + ")"


def prepare(db: DB, clients: dict, dry: bool) -> list[dict]:
    if not clients:
        return []
    todo = db.get("videos", {"select": VIDEO_FIELDS, "stage": "eq.content", "item_type": "eq.video",
                             "ai_prepared_at": "is.null", "client_id": in_list(clients), "order": "approved_at.asc"})
    results = []
    for v in todo:
        c = clients[v["client_id"]]
        try:
            path = download_video(v) if env("GEMINI_API_KEY") or not dry else None
            text = write_caption(v, c, path)
            busy = db.get("videos", {"select": "scheduled_publish_at,posted_at,stage", "client_id": f"eq.{v['client_id']}",
                                     "stage": "in.(scheduled,published)"})
            taken = {ist_date(b["scheduled_publish_at"] if b["stage"] == "scheduled" else b["posted_at"]) for b in busy}
            pref = dt.date.fromisoformat(v["scheduled_post_date"]) if v.get("scheduled_post_date") else None
            slot = next_slot(dt.datetime.now(dt.timezone.utc), str(c.get("auto_publish_time") or "19:00")[:5],
                             taken, int(env("EDIT_WINDOW_MINUTES", "120")), pref)
            now = dt.datetime.now(dt.timezone.utc).isoformat()
            row = dict(text)
            if not dry:
                done = db.patch("videos", {"id": f"eq.{v['id']}", "stage": "eq.content", "ai_prepared_at": "is.null"}, {
                    **row, "stage": "scheduled", "scheduled_publish_at": slot.isoformat(), "posting_prepared_at": now,
                    "ai_prepared_at": now, "publication_source": "auto_pending", "current_stage_entered_at": now,
                    "last_saved_at": now, "publish_error": "", "publish_attempts": 0})
                if done:
                    db.log(v["id"], "stage_transition", {"from_stage": "content", "to_stage": "scheduled",
                                                         "scheduled_for": slot.isoformat(), "auto_publish": True})
            results.append({"id": v["id"], "title": v["title"], "scheduled_ist": slot.astimezone(IST).strftime("%d %b %Y %I:%M %p"),
                            "yt_title": text["yt_title"], "caption": text["caption"]})
        except Exception as e:
            msg = str(e)[:300]
            results.append({"id": v["id"], "title": v["title"], "error": msg})
            if not dry:
                db.patch("videos", {"id": f"eq.{v['id']}"}, {"publish_error": f"Caption step: {msg}"})
    return results


def publish(db: DB, clients: dict, dry: bool) -> list[dict]:
    if not clients:
        return []
    now = dt.datetime.now(dt.timezone.utc)
    due = db.get("videos", {"select": VIDEO_FIELDS, "stage": "eq.scheduled", "publication_source": "eq.auto_pending",
                            "scheduled_publish_at": f"lte.{now.isoformat()}", "client_id": in_list(clients),
                            "order": "scheduled_publish_at.asc"})
    max_tries = int(env("MAX_ATTEMPTS", "3"))
    results = []
    for v in due:
        if v["publish_attempts"] >= max_tries:
            results.append({"id": v["id"], "title": v["title"], "error": "Stopped after repeated failures — needs a human",
                            "last_error": v["publish_error"]})
            continue
        if dry:
            results.append({"id": v["id"], "title": v["title"], "would_publish": True})
            continue
        lock_until = (now + dt.timedelta(minutes=90)).isoformat()
        got = db.patch("videos", {"id": f"eq.{v['id']}", "stage": "eq.scheduled",
                                  "or": f"(publish_locked_until.is.null,publish_locked_until.lt.{now.isoformat()})"},
                       {"publish_locked_until": lock_until, "publish_attempts": v["publish_attempts"] + 1})
        if not got:
            continue  # another run is already on it
        v = got[0]  # fresh row = includes any last-minute edits by staff
        platforms = clients[v["client_id"]].get("auto_publish_platforms") or ["facebook", "instagram", "youtube"]
        if not env_bool("YOUTUBE_ENABLED"):
            platforms = [p for p in platforms if p != "youtube"]
        out = {"id": v["id"], "title": v["title"]}
        try:
            path = download_video(v)
            secs = video_seconds(path, v.get("duration_seconds"))
            def save(fields):
                db.patch("videos", {"id": f"eq.{v['id']}"}, fields)
                v.update(fields)
            if "facebook" in platforms and not v["fb_video_id"]:
                fid, link = publish_facebook(v, path, secs)
                save({"fb_video_id": fid, "facebook_url": link})
                comment_meta(fid, v.get("pinned_comment", ""))
            if "instagram" in platforms and not v["ig_media_id"]:
                mid, link = publish_instagram(v, path)
                save({"ig_media_id": mid, "instagram_url": link})
                comment_meta(mid, v.get("pinned_comment", ""))
            if "youtube" in platforms and not v["yt_video_id"]:
                yid, link = publish_youtube(v, path)
                save({"yt_video_id": yid, "youtube_url": link})
            ts = dt.datetime.now(dt.timezone.utc).isoformat()
            save({"stage": "published", "posted_at": ts, "current_stage_entered_at": ts, "last_saved_at": ts,
                  "publication_source": "auto_api", "publish_locked_until": None, "publish_error": ""})
            db.log(v["id"], "stage_transition", {"from_stage": "scheduled", "to_stage": "published",
                                                 "platform_verified": True, "platforms": platforms})
            if not env_bool("KEEP_FILES"):
                path.unlink(missing_ok=True)
            out.update({"published": platforms, "facebook": v["facebook_url"], "instagram": v["instagram_url"],
                        "youtube": v["youtube_url"] or "(manual — YouTube auto-upload not enabled yet)"})
        except Exception as e:
            msg = str(e)[:300]
            db.patch("videos", {"id": f"eq.{v['id']}"}, {"publish_error": msg, "publish_locked_until": None})
            out["error"] = msg
        results.append(out)
    return results


def status(db: DB, clients: dict) -> list[dict]:
    if not clients:
        return []
    rows = db.get("videos", {"select": "id,title,stage,scheduled_publish_at,publish_error,publication_source",
                             "client_id": in_list(clients), "stage": "in.(review,content,scheduled)",
                             "order": "scheduled_publish_at.asc.nullslast"})
    for r in rows:
        if r.get("scheduled_publish_at"):
            r["scheduled_ist"] = dt.datetime.fromisoformat(r["scheduled_publish_at"].replace("Z", "+00:00")) \
                .astimezone(IST).strftime("%d %b %I:%M %p")
    return rows


def check() -> list[str]:
    import requests
    report = []
    need = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "META_PAGE_ID", "META_PAGE_TOKEN"]
    missing = [k for k in need if not env(k)]
    report.append("❌ Missing in .env: " + ", ".join(missing) if missing else "✅ .env has the required keys")
    if not (env("GEMINI_API_KEY") or env("LLM_API_KEY")):
        report.append("❌ Add GEMINI_API_KEY (best: it watches the video) or LLM_API_KEY (DeepSeek)")
    try:
        cl = auto_clients(DB())
        report.append(f"✅ Supabase OK — auto-publish clients: {', '.join(c['name'] for c in cl.values()) or 'NONE (run the SQL in README step 1)'}")
    except Exception as e:
        report.append(f"❌ Supabase: {e}")
    try:
        p = meta_call("GET", f"{graph()}/{env('META_PAGE_ID')}", params={
            "fields": "name,instagram_business_account{username}", "access_token": page_token()})
        ig = (p.get("instagram_business_account") or {})
        ok = bool(ig.get("id")) and ig.get("id") == ig_user_id()
        report.append(f"✅ Facebook Page: {p.get('name')}")
        report.append(f"{'✅' if ok else '❌'} Instagram linked: @{ig.get('username','?')} (id {ig.get('id')})"
                      + ("" if ok else " — META_IG_USER_ID does not match"))
    except Exception as e:
        report.append(f"❌ Meta: {e}")
    try:
        creds = google_creds()
        report.append("✅ Google sign-in present (Drive" + (" + YouTube)" if env_bool("YOUTUBE_ENABLED") else "; YouTube auto-upload OFF)")
                      if creds else "⚠ No Google sign-in — Drive files must be 'Anyone with the link'; YouTube off")
    except Exception as e:
        report.append(f"❌ Google: {e}")
    return report


def main() -> None:
    load_env()
    ap = argparse.ArgumentParser(description="Brand MD auto-publisher")
    ap.add_argument("command", choices=["run", "prepare", "publish", "status", "check", "google-login"])
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    if a.command == "google-login":
        return google_login()
    if a.command == "check":
        print("\n".join(check()))
        return
    db = DB()
    clients = auto_clients(db)
    result = {"at_ist": dt.datetime.now(IST).strftime("%d %b %Y %I:%M %p")}
    if a.command == "status":
        result["queue"] = status(db, clients)
    if a.command in ("run", "prepare"):
        result["prepared"] = prepare(db, clients, a.dry_run)
    if a.command in ("run", "publish"):
        result["published"] = publish(db, clients, a.dry_run)
    text = json.dumps(result, ensure_ascii=False, indent=2)
    with open(HERE / "publisher.log", "a", encoding="utf-8") as fh:
        if any(result.get(k) for k in ("prepared", "published")):
            fh.write(text + "\n")
    print(text)


if __name__ == "__main__":
    main()
