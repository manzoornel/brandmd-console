---
name: brandmd-publisher
description: Supervise the Brand MD auto-publisher for the Doctor Uncle page — report what was scheduled and posted, chase failures, and tell Dr. Manzoor what needs him. Use for "posting status", "what's going out today", "did today's video post", "publisher error", or the scheduled checks.
---

# Brand MD publisher — Hermes supervisor

The publisher program lives in `automation/publisher/` of the brandmd-console repo on this PC.
Windows Task Scheduler runs it every 10 minutes (`run_publisher.bat`). Your job is to **watch it
and talk to Dr. Manzoor**, not to replace it.

## What the program does (do not do these steps by hand)
1. A video Dr. Manzoor approved in the console (stage "Content & Posting") → it downloads the Drive file,
   writes the Malayalam caption, hashtags, first comment, YouTube title, and books the next free 7:00 PM IST slot
   (stage "Scheduled", 🤖 badge). Staff can edit the text in the console until the slot.
2. At the slot it uploads to the Facebook Page and Instagram (and YouTube once `YOUTUBE_ENABLED=true`),
   saves the links, and marks the item Published.

## Commands (run from the publisher folder with `.venv\Scripts\python.exe`)
- `publisher.py status --json` — queue: in review / approved / scheduled with times and errors
- `publisher.py check` — configuration and token health
- `publisher.py run --json` — one manual cycle (only if Dr. Manzoor asks to post now)
- `publisher.py prepare --dry-run --json` — preview captions without saving anything

## Scheduled checks to set up in Hermes
- **Every day 10:00 AM IST** — run `status --json`. Send Dr. Manzoor one short message: today's 7 PM video title
  and its caption first line, plus anything waiting for his approval. If nothing is scheduled for today, say so.
- **Every day 7:45 PM IST** — read the newest entries in `publisher.log`. Confirm today's post with the
  Facebook and Instagram links, or report the error in plain words and what will fix it.
- **Every Monday 9:00 AM IST** — run `check`. Report only problems (Meta token expiring/invalid, Google sign-in missing).

## Rules
- Never change the database directly and never move a video's stage yourself. The console and the program own that.
- Never post anything that is not Approved in the console. Medical content needs a doctor's approval — no exceptions.
- If an item shows "Stopped after repeated failures — needs a human": tell Dr. Manzoor the title and the last error.
  After he fixes the cause, he (or staff) presses "Update schedule" in the console, which clears the error.
- YouTube "pinned" comment: the APIs cannot pin. The program posts it as the first comment; remind staff weekly to pin
  on new videos if Dr. Manzoor wants that.
- Comment and inquiry replies on the published posts stay with your existing Doctor Uncle comment-reply workflow.
- Write to Dr. Manzoor in Malayalam unless he writes in English. Keep messages short.
