---
name: doctoruncle-posters
description: Plan and design Doctor Uncle's 10 creative posters a month — festival / special-day greetings and health-tip posters — in the clinic's house style, then send each to the Brand MD console for a doctor's approval. Use on the 22nd of every month (next month's posters), or when Dr. Manzoor says "posters", "festival poster", "make a poster for <day>", or "this month's creatives".
---

# Doctor Uncle creative posters — 10 a month, doctor-approved

Folder: `C:\Users\User\Documents\BrandMD-Publisher` (commands run with `.venv\Scripts\python.exe` from there).
Posters you submit wait in the console (**Review**) until a doctor approves. After approval the existing pipeline
writes the caption, books a **6:00 PM** slot (or the festival date), and your daily 5 PM posting run
(brandmd-publisher skill) schedules it on Facebook + Instagram. **You never post a poster yourself before approval.**

## 1. Learn the house style first (every month, 5 minutes)
Open `https://www.instagram.com/doctor_uncle_/` and look at the last ~30 image posts. What the account already does:
- Health posters tied to a named doctor/department: diabetes (Dr. Iqbal, Dr. Manzoor N), BP / vitamin D
  (Dr. Sumanath), skin & hair (Dr. Bharath), periods / women (Dr. Shaflia Shukkur), ENT & child breathing,
  ear wax, diabetic eye & foot care.
- Service posters: "രാത്രികളിലും കരുതലോടെ Doctor Uncle 24/7", trust / thank-you posters.
- Festival / day greetings — Onam, Nabidinam, Independence Day — these get the **most likes**; never miss one.
- Series promos (Diabetes A to Z, Weight Loss A to Z) with the YouTube playlist link.
Captions follow one format: Malayalam hook `| Doctor Uncle Family Clinic |#tirur`, then the address block. The caption
step already writes this — you only make the image.

## 2. Plan next month — on the 22nd
Make exactly **10** posters:
- **Festival & special days of that month first** (3–5). Look up the exact dates for that year with web search —
  Islamic and Hindu festival dates move every year. Cover all communities the clinic serves: Eid ul-Fitr, Eid ul-Adha,
  Nabidinam, Muharram; Onam, Vishu, Deepavali, Navaratri; Christmas, Easter; New Year; Republic Day, Independence Day,
  Kerala Piravi (1 Nov); plus health days that match the clinic: World Diabetes Day (14 Nov), World Heart Day
  (29 Sep), World Health Day (7 Apr), Doctors' Day (1 Jul), World Kidney Day, World Hypertension Day (17 May),
  Breastfeeding Week (Aug), Mental Health Day (10 Oct).
- **Health-tip posters** (4–5): match the video series running that month and the doctors above; one big idea each.
- **Service poster** (1): 24×7 casualty at Vakkad, Sugar Clinic, lab, new department, or the specialty hospital build.
- No topic repeated from the last 60 days.

Send Dr. Manzoor the plan as one short Malayalam list (date · type · headline) and **wait for his "ok"** (he may
change items). Do not design until he replies.

## 3. Make each poster
1. **Background** with your image tool: 1080×1350 portrait, **no text, no letters, no logos, no real people's faces**,
   calm and premium, lower half darker/plain so text reads. Festival: tasteful motifs (crescent & lanterns, pookkalam,
   star & lights, diya) — respectful, not religious icons of a person. Health: soft clinical scene matching the topic.
   Save as `posters\<yyyy-mm>\<slug>_bg.png`.
2. **Write the spec** `posters\<yyyy-mm>\<slug>.json` (all text in simple Malayalam, short):
   ```json
   {"theme": "health | festival | service | day",
    "background": "posters\\2026-12\\christmas_bg.png",
    "badge": "ആരോഗ്യ ടിപ്പ്",
    "headline": "max ~8 words",
    "subline": "one short line (optional)",
    "points": ["max 3 points, 5–6 words each (health only)"],
    "doctor": "Dr. Name — Department (health posters only, a real Doctor Uncle doctor)"}
   ```
   Festival: headline is the wish, e.g. "എല്ലാവർക്കും ഹൃദയം നിറഞ്ഞ ക്രിസ്മസ് ആശംസകൾ"; no points, no doctor.
3. **Render** (real Malayalam text over your background — never let the image model write Malayalam, it garbles letters):
   `.venv\Scripts\python.exe publisher.py poster-render --spec posters\<yyyy-mm>\<slug>.json --out posters\<yyyy-mm>\<slug>.png`
4. **Look at the PNG yourself.** Check spelling, that nothing is cut off, text is readable over the background.
   Fix the spec / background and render again if needed.
5. **Submit for approval:**
   `.venv\Scripts\python.exe publisher.py poster-submit --file posters\<yyyy-mm>\<slug>.png --title "<console title>" --brief "<what it says, for the caption>" [--date YYYY-MM-DD]`
   Use `--date` for festival / special days (posts at 6 PM **that day**). Health/service posters: leave it out —
   they take the next free 6 PM poster slot after approval.
   Festival posters must be submitted **at least 5 days before** the day.

When all are submitted, message Dr. Manzoor: "Posters ready for approval in Brand MD console — N items" with the list.
Remind once, the day before a festival, if its poster is still not approved.

## Medical and brand rules
- Only general, safe health advice. No drug names or doses, no "cure", no "100%", no fear headlines, no before/after.
- Numbers (sugar levels, BP) only if standard and correct; when unsure, leave numbers out.
- Name only real Doctor Uncle doctors, with the department they actually work in.
- Phone is always 99615 88880 (the template adds it). Do not invent offers, prices or discounts.
- Festival posters: warm, inclusive, same quality for every community. No political or religious opinions.
- Never post, schedule or boost from this skill — approval and posting happen through the console pipeline.
