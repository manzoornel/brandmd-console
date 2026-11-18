"""Poster helpers for the Hermes "doctoruncle-posters" skill.

  render  : brand-safe poster PNG = AI background (no text) + real Malayalam text laid out in HTML,
            screenshotted by the installed Chrome (AI image models garble Malayalam letters).
  submit  : upload the PNG and put it in the Brand MD console as a POSTER waiting for doctor approval.
"""
from __future__ import annotations

import datetime as dt
import html
import json
import os
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
FONT = "'Noto Sans Malayalam','Nirmala UI','Kartika',sans-serif"
THEMES = {
    "health":   {"accent": "#0E9F9A", "dark": "#0B2E4F", "badge": "ആരോഗ്യ ടിപ്പ്"},
    "festival": {"accent": "#E8A317", "dark": "#5B1A1A", "badge": "ആശംസകൾ"},
    "service":  {"accent": "#2563EB", "dark": "#0B2E4F", "badge": "Doctor Uncle"},
    "day":      {"accent": "#16A34A", "dark": "#0B2E4F", "badge": "ആരോഗ്യ ദിനം"},
}


def chrome_path() -> str:
    for p in (os.environ.get("CHROME_PATH", ""),
              r"C:\Program Files\Google\Chrome\Application\chrome.exe",
              r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
              r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
              shutil.which("chrome") or "", shutil.which("google-chrome") or "", shutil.which("chromium") or ""):
        if p and Path(p).exists():
            return p
    raise RuntimeError("Chrome/Edge not found — set CHROME_PATH in .env")


def poster_html(spec: dict) -> str:
    t = THEMES.get(spec.get("theme", "health"), THEMES["health"])
    e = lambda k: html.escape(str(spec.get(k, "") or ""))
    bg = spec.get("background")
    bg_css = f"url('{Path(bg).resolve().as_uri()}') center/cover no-repeat" if bg else f"linear-gradient(160deg,{t['dark']},{t['accent']})"
    logo = spec.get("logo") or os.environ.get("LOGO_PATH", "")
    logo_html = f"<img class=logo src='{Path(logo).resolve().as_uri()}'>" if logo and Path(logo).exists() else "<div class=brand>DOCTOR UNCLE</div>"
    points = "".join(f"<li>{html.escape(p)}</li>" for p in spec.get("points", [])[:4])
    doctor = f"<div class=doctor>{e('doctor')}</div>" if spec.get("doctor") else ""
    return f"""<!doctype html><html><head><meta charset=utf-8>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Malayalam:wght@500;700;900&display=swap" rel="stylesheet">
<style>
*{{margin:0;box-sizing:border-box}} html,body{{width:1080px;height:1350px;overflow:hidden}}
body{{font-family:{FONT};background:{bg_css};color:#fff;position:relative}}
.shade{{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05) 25%,{t['dark']}EE 68%,{t['dark']} 100%)}}
.top{{position:absolute;top:44px;left:56px;right:56px;display:flex;justify-content:space-between;align-items:center}}
.logo{{height:96px}} .brand{{font:900 40px/1 {FONT};letter-spacing:2px;background:#fff;color:{t['dark']};padding:14px 22px;border-radius:14px}}
.badge{{background:{t['accent']};padding:12px 26px;border-radius:40px;font:700 30px/1 {FONT}}}
.body{{position:absolute;left:64px;right:64px;bottom:250px}}
h1{{font:900 76px/1.25 {FONT};text-shadow:0 4px 18px rgba(0,0,0,.35)}}
h2{{font:500 40px/1.45 {FONT};margin-top:22px;opacity:.95}}
ul{{margin-top:26px;padding-left:44px;font:600 36px/1.55 {FONT}}} li::marker{{color:{t['accent']}}}
.doctor{{margin-top:24px;display:inline-block;background:rgba(255,255,255,.14);padding:10px 22px;border-radius:12px;font:600 32px/1.3 {FONT}}}
.foot{{position:absolute;left:0;right:0;bottom:0;height:190px;background:#fff;color:{t['dark']};padding:30px 64px;display:flex;align-items:center;justify-content:space-between;gap:24px}}
.foot b{{display:block;font:900 32px/1.25 {FONT}}} .foot span{{font:600 27px/1.5 {FONT};color:#334}}
.cta{{flex:none;background:{t['accent']};color:#fff;padding:18px 26px;border-radius:16px;font:800 34px/1 {FONT}}}
</style></head><body><div class=shade></div>
<div class=top>{logo_html}<div class=badge>{e('badge') or t['badge']}</div></div>
<div class=body><h1>{e('headline')}</h1>{f"<h2>{e('subline')}</h2>" if spec.get('subline') else ""}{f"<ul>{points}</ul>" if points else ""}{doctor}</div>
<div class=foot><div><b>Doctor Uncle<br>The Complete Family Clinic</b><span>Vakkad (24×7) &amp; Unniyal, Tirur</span></div>
<div class=cta>📞 99615 88880</div></div>
</body></html>"""


def render(spec: dict, out: Path) -> Path:
    out = Path(out).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as d:
        page = Path(d) / "poster.html"
        page.write_text(poster_html(spec), encoding="utf-8")
        cmd = [chrome_path(), "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
               "--virtual-time-budget=4000", "--window-size=1080,1350", f"--screenshot={out}", page.as_uri()]
        subprocess.run(cmd, check=True, capture_output=True, timeout=120)
    if not out.exists() or out.stat().st_size < 5000:
        raise RuntimeError("Poster render failed")
    return out


def submit(db, clients: dict, file: Path, title: str, brief: str, post_date: str | None) -> dict:
    """Upload to Supabase storage (public bucket 'posters') and create a POSTER item waiting for approval."""
    import requests
    if not clients:
        raise SystemExit("No auto-publish client")
    client_id = next(iter(clients))
    base = db.url.replace("/rest/v1", "")
    h = {k: v for k, v in db.h.items() if k != "Content-Type"}
    requests.post(f"{base}/storage/v1/bucket", headers={**h, "Content-Type": "application/json"},
                  data=json.dumps({"id": "posters", "name": "posters", "public": True}), timeout=30)  # ok if it exists
    name = f"{dt.date.today():%Y-%m}/{uuid.uuid4().hex[:10]}{Path(file).suffix.lower()}"
    ctype = "image/png" if Path(file).suffix.lower() == ".png" else "image/jpeg"
    with open(file, "rb") as fh:
        r = requests.post(f"{base}/storage/v1/object/posters/{name}", headers={**h, "Content-Type": ctype,
                          "x-upsert": "true"}, data=fh, timeout=120)
    r.raise_for_status()
    url = f"{base}/storage/v1/object/public/posters/{name}"
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    row = {"title": title[:200], "brief": brief, "item_type": "poster", "client_id": client_id, "stage": "review",
           "drive_link": url, "submitted_at": now, "current_stage_entered_at": now, "last_saved_at": now}
    if post_date:
        row["scheduled_post_date"] = post_date
    res = requests.post(f"{db.url}/videos", headers={**db.h, "Prefer": "return=representation"},
                        data=json.dumps(row), timeout=30)
    res.raise_for_status()
    got = res.json()[0]
    db.log(got["id"], "stage_transition", {"to_stage": "review", "created_by": "hermes_posters"})
    return {"id": got["id"], "title": got["title"], "image": url, "post_date": post_date, "stage": "review"}
