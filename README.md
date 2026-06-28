# Brand MD Solutions — Content Operations Console

A real, multi-user web app for your content workflow:
**Edit (Mafeed) → Review (Manzoor / Jamsheer) → Content & Posting (Shamil) → Published**,
with per-user logins, five roles, attendance, a per-task timer, doctors/packages,
analytics, and inline YouTube playback.

Stack: **Next.js 14** + **Supabase** (database + auth) + **Vercel** (hosting). Free to start.

---

## What's built (Phase 1)

- **Per-user login** (email + password) — accounts created only by Super Admin / Admin.
- **Five roles:** Super Admin → Admin → Editor → Content & Posting (writer) → Doctor (client, sees only their own videos).
- **Pipeline board** with the four stages and role-based action buttons.
- **Workflow:** editor adds Drive link → admin approves / sends back → writer writes caption + hashtags + pinned comment + platform links → marks posted.
- **Attendance:** logging in clocks you in; "Clock out" button + automatic clock-out after 15 minutes idle.
- **Per-task timer:** starts when the writer opens a task, saved when they mark it posted.
- **Team page (admin):** hours today, output, turnaround per person.
- **Doctors & packages:** add doctors, see per-doctor video & view counts.
- **Analytics:** view totals + published-video table.
- **Inline YouTube playback** inside the app (no API key needed).

**Phase 3 (after launch):** auto-pull view counts from YouTube and Instagram/Facebook.
The YouTube code is already wired — it just needs an API key. See the bottom of this file.

---

## Deploy it — step by step (Phase 2)

You'll need free accounts at **supabase.com**, **github.com**, and **vercel.com**.

### 1. Create the database (Supabase)
1. supabase.com → **New project**. Pick a name and a strong database password. Region: Mumbai/Singapore (closest).
2. When it's ready, open **SQL Editor → New query**. Paste the entire contents of `supabase/schema.sql` and click **Run**.
3. (Optional sample doctors) Run `supabase/seed.sql` the same way.
4. Go to **Project Settings → API** and copy these three values — you'll need them in step 3:
   - Project URL
   - `anon` public key
   - `service_role` key (keep this secret)

### 2. Put the code on GitHub
1. Create a new **empty** GitHub repo.
2. Upload this whole folder to it (or `git init && git add . && git commit && git push`).

### 3. Deploy on Vercel
1. vercel.com → **Add New → Project** → import your GitHub repo.
2. Before deploying, open **Environment Variables** and add (from step 1.4):
   ```
   NEXT_PUBLIC_SUPABASE_URL       = your Project URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY  = your anon public key
   SUPABASE_SERVICE_ROLE_KEY      = your service_role key
   ```
3. Click **Deploy**. In ~2 minutes you'll get a live URL like `brandmd.vercel.app`.

### 4. Create your Super Admin (you)
1. In Supabase → **Authentication → Users → Add user** → enter your email + a password → **Create**. Copy the new user's **UID**.
2. In **SQL Editor**, run (replace the UID and name):
   ```sql
   insert into profiles (id, full_name, role)
   values ('PASTE-UID-HERE', 'Dr. Manzoor', 'super_admin');
   ```
3. Open your live URL, sign in — you're in. Go to **Users** to create Dr. Jamsheer (admin), Mafeed (editor), Shamil (writer), and doctor logins.

### 5. Point your own domain (optional)
In Vercel → your project → **Settings → Domains** → add e.g. `app.doctoruncle.in` and follow the DNS instructions. Done.

---

## Phase 3 — auto-pull view counts (when you're ready)

**YouTube (quick — ~20 min):**
1. console.cloud.google.com → new project → enable **YouTube Data API v3** → create an **API key**.
2. Add it in Vercel env vars as `YOUTUBE_API_KEY` and redeploy.
3. The "↻ auto-pull" button on each published video's Views panel will now fetch real counts.

**Instagram / Facebook (needs setup on Meta's side — can take a few days):**
1. developers.facebook.com → create an app (Business type).
2. Connect each doctor's Instagram (Business/Creator) account to a Facebook Page.
3. Add `META_APP_ID` and `META_APP_SECRET` env vars. (The "Connect accounts" OAuth screen is the next thing to build once your Meta app is approved — ping me and I'll add it.)

Until then, IG/FB views are entered by hand on the Views panel — both work side by side.

---

## Run locally (optional, for a developer)
```bash
cp .env.local.example .env.local   # fill in the three Supabase values
npm install
npm run dev                         # http://localhost:3000
```
