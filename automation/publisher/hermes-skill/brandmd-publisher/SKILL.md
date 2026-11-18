---
name: brandmd-publisher
description: Upload and schedule Doctor Uncle's approved videos on Facebook + Instagram (Meta Business Suite) and YouTube Studio through the logged-in Chrome browser, exactly like a social media staff member, then report to Dr. Manzoor. Use for the daily 5 PM posting run, "schedule today's video", "posting status", "did today's video go out", or publisher errors.
---

# Brand MD publisher — Hermes does the posting like a staff member

Folder on this PC: `C:\Users\User\Documents\BrandMD-Publisher` (run commands from here with `.venv\Scripts\python.exe`).

## Who does what
- **Mafeed** edits → pastes the Drive link in the Brand MD console → a **doctor approves** (or sends back).
- **Windows task "BrandMD Publisher"** (every 10 min, already running) downloads each approved video, writes the
  Malayalam caption / hashtags / first comment / YouTube title, and books the next free **7:00 PM IST** slot
  (console stage "Scheduled", 🤖). Staff may edit that text in the console until upload time.
- **You (Hermes)** upload and schedule it on the platforms through Chrome — **no APIs** — and record it.

## Daily run — every day at 5:00 PM IST (and again at 6:15 PM if anything is left)
1. Get the work list:
   `.venv\Scripts\python.exe publisher.py browser-queue --json --days 3`
   Each item has: `video_file` (local mp4), `schedule_date` (DD/MM/YYYY), `schedule_time` (e.g. 07:00 PM),
   `facebook_instagram_text`, `first_comment`, `youtube_title`, `youtube_description`, `done` flags, `in_past`.
   Items with `error` → report to Dr. Manzoor (usually the Drive file is not shared "Anyone with the link").
2. For every item, oldest first, do **A** (if `done.facebook_instagram` is false) and **B** (if `done.youtube` is false).
   If `in_past` is true, post it now instead of scheduling and say so in the report.

**Posters** (`type` = `poster`, made by the doctoruncle-posters skill) go to Facebook + Instagram only — use **A-poster**
below instead of A, and skip B (YouTube). `video_file` is then the PNG.

### A-poster. Poster — Meta Business Suite post
1. Open `https://business.facebook.com/latest/composer?asset_id=555118008306562&business_id=914354423117314`
   ("Create post"). Post to: both *Doctor UNCLE* and *doctor_uncle_*.
2. **Add photo** → set the file input to `video_file`. Paste `facebook_instagram_text` in the text box.
3. Scheduling options → **Schedule** → `schedule_date` / `schedule_time` → **Schedule**. Confirm it in Planner.
4. `.venv\Scripts\python.exe publisher.py mark --id <id> --platform meta --link "<link or planner>"`

### A. Facebook + Instagram together — Meta Business Suite
1. Open `https://business.facebook.com/latest/reels_composer?asset_id=555118008306562&business_id=914354423117314`
2. **Post to** must show *Doctor UNCLE and doctor_uncle_* (both). If not, open the dropdown and tick both.
3. **Add video**: set the hidden file input to `video_file` (use your browser's file-upload command on the
   `input[type=file]`; never try to operate the Windows file-picker window).
4. Click the **Text** box and paste `facebook_instagram_text` exactly. Press Escape if a hashtag suggestion list opens.
5. Wait until the upload finishes (preview plays / progress gone). **Next** → **Next** until the Share step.
6. Choose **Schedule** (not "Share now"), set date = `schedule_date`, time = `schedule_time`, then press **Schedule**.
7. Open **Planner** (`https://business.facebook.com/latest/planner?asset_id=555118008306562`) and confirm the reel
   shows at that date/time for both Facebook and Instagram. Copy its link if shown.
8. Record it: `.venv\Scripts\python.exe publisher.py mark --id <id> --platform meta --link "<link or planner>"`

### B. YouTube — YouTube Studio (Doctor Uncle channel)
1. Open `https://studio.youtube.com` → **Create → Upload videos** → set the file input to `video_file`.
2. **Title** = `youtube_title`; **Description** = `youtube_description`.
3. Audience: **No, it's not made for kids**. Click **Next** (Video elements) → **Next** (Checks).
4. Visibility: **Schedule** → date `schedule_date`, time `schedule_time` (time zone India), → **Schedule**.
5. Copy the video link shown in the final dialog (`https://youtu.be/...`).
6. Record it: `.venv\Scripts\python.exe publisher.py mark --id <id> --platform youtube --link "<youtu.be link>"`

When both are recorded the item leaves the queue, and the console moves it to **Published** at its slot time.

## Evening check — 7:30 PM IST
- Open the Doctor Uncle Facebook Page, Instagram @doctor_uncle_ and the YouTube channel; confirm today's video is live.
- Post `first_comment` (from this morning's queue output, or the console's "Pinned comment") as the first comment
  on each platform and pin it where the platform allows (YouTube, Facebook).
- Send Dr. Manzoor one short Malayalam message: what went live, with links, or what failed.

## If something fails
- Record it so it shows in the console: `.venv\Scripts\python.exe publisher.py mark --id <id> --platform error --link "<what went wrong>"`
- Retry once. If it fails again, stop and message Dr. Manzoor with the title and the problem. Never retry in a loop.
- Logged out of Meta / YouTube, a login or 2-step page, or a CAPTCHA → **stop and ask Dr. Manzoor to log in**.
  Never type passwords or codes yourself.

## Rules
- Only upload items that come from `browser-queue` (they were approved by a doctor). Never post anything else.
- Never change captions on your own; staff edit them in the console. Use the text exactly as given.
- Never press "Share now"/"Publish" for a future slot — always **Schedule**.
- Never delete or edit existing posts, change Page/Channel settings, or boost/advertise.
- Before uploading, check the platform does not already show a scheduled/live post with the same title for that
  date (avoid double posting after a crash).
- Write to Dr. Manzoor in Malayalam unless he writes in English. Keep messages short.
