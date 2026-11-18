# Brand MD auto-publisher (Doctor Uncle prototype)

Replaces the manual "download from Drive → write caption → post on FB / Insta / YouTube" job.

```
Mafeed edits → pastes Drive link in console → Doctor approves / sends back (unchanged)
          ↓ approved
Publisher (office PC, every 10 min): downloads video, AI writes Malayalam caption + hashtags +
first comment + YouTube title, books next free 7:00 PM IST slot   → console stage "Scheduled 🤖"
          ↓ (anyone can edit the text in the console until the slot, or press
          ↓  "Return to Content & Posting" to hold it)
At 7 PM: uploads to Facebook Page + Instagram Reel (+ YouTube), saves the links → "Published"
Hermes: morning + evening message to Dr. Manzoor, reports any failure
```

Safety built in: nothing posts unless a doctor approved it in the console · a platform that already
succeeded is never posted twice on a retry · after 3 failures it stops and asks a human · the old
pg_cron job no longer marks auto items "Published" — only real platform links do.

---

## 1. Database + console (5 min)
1. Supabase → **SQL Editor** → paste all of `supabase/migration-v10-auto-publish.sql` → **Run**.
2. Find the Doctor Uncle client and switch it on:
   ```sql
   select id, name, auto_publish from clients order by name;
   update clients set auto_publish = true where id = 'PASTE-DOCTOR-UNCLE-ID';
   ```
3. Merge the code to `main` — Vercel redeploys the console automatically.

## 2. Meta: Facebook Page + Instagram token (20 min, once)
1. Make sure Doctor Uncle Instagram is a **Professional (Business/Creator)** account linked to the Doctor Uncle Facebook Page.
2. developers.facebook.com → **My Apps → Create app** → type **Business** → name "Brand MD Publisher".
   Development mode is fine — you are the admin, so it works for your own Page without app review.
3. **Tools → Graph API Explorer** → choose the app → **Get User Access Token** with:
   `pages_show_list, pages_read_engagement, pages_manage_posts, pages_manage_engagement,
   instagram_basic, instagram_content_publish, instagram_manage_comments, business_management`
4. Make it long-lived: **Tools → Access Token Debugger** → paste token → **Extend Access Token**.
5. In Graph API Explorer, with the long-lived token, run `me/accounts` → copy the Doctor Uncle
   `access_token` (this Page token does not expire) → `META_PAGE_TOKEN`.
6. Run `555118008306562?fields=instagram_business_account` → copy the id → `META_IG_USER_ID`.

## 3. Google: Drive download + YouTube (20 min, once)
1. console.cloud.google.com → new project "Brand MD Publisher" → enable **Google Drive API** and **YouTube Data API v3**.
2. **OAuth consent screen** → External → add your email → then press **Publish app** (status "In production").
   In "Testing" status Google logs you out every 7 days. "Unverified app" warning on login is OK — it's only you.
3. **Credentials → Create OAuth client ID → Desktop app** → download JSON → save as
   `automation/publisher/google_client_secret.json` on the PC.
4. On the PC: `.venv\Scripts\python.exe publisher.py google-login` → sign in with the Google account that
   **owns the Doctor Uncle YouTube channel** and can open Mafeed's Drive files
   (ask Mafeed to share the edits folder with that account).

## 4. YouTube audit (submit today — takes days to weeks)
Google forces every video uploaded by a new, unaudited API project to **private** (cannot be made public).
Submit the free audit: https://support.google.com/youtube/contact/yt_api_form
(purpose: "internal tool to publish our own clinic channel's videos").
Until approved keep `YOUTUBE_ENABLED=false`; FB + Insta go automatically and the console flags the
missing YouTube link so staff upload that one by hand. After approval: set `true` — done.

## 5. Office PC setup (10 min)
1. Install **Python 3.11+** (python.org, tick "Add to PATH") and optionally **ffmpeg** (for video length).
2. Get this repo on the PC (`git clone https://github.com/manzoornel/brandmd-console`).
3. Double-click `automation/publisher/setup_windows.bat` → creates `.venv`, installs, copies `.env`,
   and creates the Windows task **"BrandMD Publisher"** (every 10 min).
4. Fill `.env` in Notepad (Supabase service-role key, Meta token + ids, Gemini key). Keep the PC on and awake
   (Settings → Power → Sleep: Never) — posts go out only while the PC is on.
5. `.venv\Scripts\python.exe publisher.py check` → everything ✅.
6. First test without changing anything: `.venv\Scripts\python.exe publisher.py prepare --dry-run --json`.

## 6. Hermes
Copy `hermes-skill/brandmd-publisher/` into Hermes's skills folder (`%USERPROFILE%\.hermes\skills\`)
and tell Hermes: *"Set up the three scheduled checks from the brandmd-publisher skill."*

## 7. First live test
Create a short test video item for Doctor Uncle → Mafeed (or you) submits a Drive link → approve →
within 10 min it shows 🤖 Scheduled with a caption → edit the time to 15 min from now → "Update schedule" →
confirm it appears on Facebook and Instagram and the console shows the links.

---

### Commands
| Command | What it does |
|---|---|
| `publisher.py check` | config + token health |
| `publisher.py status --json` | queue with times and errors |
| `publisher.py run --json` | one full cycle (what the task runs) |
| `publisher.py prepare --dry-run --json` | preview captions, change nothing |
| `publisher.py google-login` | one-time Google sign-in |

### Known limits
- Facebook Reels via API: 3–90 seconds. Longer videos post as a normal Page video automatically.
- No platform lets an API **pin** a comment; the first comment is posted, pin it by hand if wanted.
- Posters / the ~10 special creatives a month are not in this prototype (next phase).
- Tests: `python -m unittest discover -s tests` (12 tests, no network).
