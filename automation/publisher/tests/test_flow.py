"""End-to-end flow with fake DB and fake platforms (no network)."""
import datetime as dt, sys, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import publisher as p

class FakeDB:
    def __init__(self, rows): self.rows = rows; self.events = []
    def _match(self, r, f):
        for k, cond in f.items():
            if k in ("select", "order"): continue
            if k == "or": continue  # lock check: treat as free
            op, _, val = cond.partition(".")
            cur = r.get(k)
            if op == "eq" and str(cur) != val: return False
            if op == "is" and cur is not None: return False
            if op == "in" and str(cur) not in val.strip("()").split(","): return False
            if op == "lte" and not (cur and cur <= val): return False
        return True
    def get(self, t, f): return [dict(r) for r in self.rows if self._match(r, f)]
    def patch(self, t, f, body):
        out = []
        for r in self.rows:
            if self._match(r, f): r.update(body); out.append(dict(r))
        return out
    def log(self, *a): self.events.append(a)

def video(**kw):
    base = dict(id="v1", title="Sugar myth", brief="", client_id="du", stage="content", item_type="video",
        drive_link="https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrSt/view", caption="", hashtags="",
        pinned_comment="", yt_title="", yt_description="", duration_seconds=60, scheduled_post_date=None,
        scheduled_publish_at=None, publication_source=None, publish_attempts=0, publish_error="",
        publish_locked_until=None, yt_video_id="", ig_media_id="", fb_video_id="", youtube_url="",
        instagram_url="", facebook_url="", writer_id=None, ai_prepared_at=None, posted_at=None)
    base.update(kw); return base

CLIENTS = {"du": {"id": "du", "name": "Doctor Uncle", "auto_publish_time": "19:00:00",
                  "auto_publish_platforms": ["facebook", "instagram", "youtube"], "caption_style": ""}}

class Flow(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(__file__).parent / "fake.mp4"; self.tmp.write_bytes(b"0" * 200_000)
        p.download_video = lambda v: self.tmp
        p.write_caption = lambda v, c, path: {"caption": "cap", "hashtags": "#DoctorUncle", "pinned_comment": "pin",
                                               "yt_title": "t", "yt_description": "d"}
        self.calls = []
        p.publish_facebook = lambda v, path, s: (self.calls.append("fb") or ("F1", "https://fb/F1"))
        p.publish_instagram = lambda v, path: (self.calls.append("ig") or ("I1", "https://ig/I1"))
        p.comment_meta = lambda *a: None
        import os; os.environ["KEEP_FILES"] = "true"; os.environ.pop("YOUTUBE_ENABLED", None)
    def tearDown(self): self.tmp.unlink(missing_ok=True)

    def test_prepare_then_publish(self):
        db = FakeDB([video(), video(id="v2", client_id="other")])
        res = p.prepare(db, CLIENTS, dry=False)
        self.assertEqual(len(res), 1); r = db.rows[0]
        self.assertEqual((r["stage"], r["publication_source"], r["caption"]), ("scheduled", "auto_pending", "cap"))
        self.assertEqual(db.rows[1]["stage"], "content")  # other client untouched
        r["scheduled_publish_at"] = "2000-01-01T00:00:00+00:00"  # make it due
        out = p.publish(db, CLIENTS, dry=False)
        self.assertEqual(out[0]["published"], ["facebook", "instagram"])  # YouTube off until audit
        self.assertEqual((r["stage"], r["publication_source"], r["facebook_url"]), ("published", "auto_api", "https://fb/F1"))

    def test_retry_skips_done_platform(self):
        db = FakeDB([video(stage="scheduled", publication_source="auto_pending", scheduled_publish_at="2000-01-01T00:00:00+00:00")])
        def boom(v, path): raise RuntimeError("IG down")
        p.publish_instagram = boom
        out = p.publish(db, CLIENTS, dry=False)
        self.assertIn("IG down", out[0]["error"]); self.assertEqual(db.rows[0]["stage"], "scheduled")
        self.assertEqual(db.rows[0]["fb_video_id"], "F1")
        p.publish_instagram = lambda v, path: (self.calls.append("ig") or ("I1", "https://ig/I1"))
        p.publish(db, CLIENTS, dry=False)
        self.assertEqual(self.calls, ["fb", "ig"])  # Facebook NOT posted twice
        self.assertEqual(db.rows[0]["stage"], "published")

    def test_stops_after_max_attempts(self):
        db = FakeDB([video(stage="scheduled", publication_source="auto_pending", publish_attempts=3,
                           scheduled_publish_at="2000-01-01T00:00:00+00:00")])
        out = p.publish(db, CLIENTS, dry=False)
        self.assertIn("needs a human", out[0]["error"]); self.assertEqual(self.calls, [])

if __name__ == "__main__": unittest.main()
