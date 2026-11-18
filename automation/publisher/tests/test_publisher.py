import datetime as dt, sys, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import publisher as p

UTC = dt.timezone.utc
class Slots(unittest.TestCase):
    def test_same_day_when_lead_allows(self):
        now = dt.datetime(2026, 11, 18, 6, 0, tzinfo=UTC)  # 11:30 IST
        self.assertEqual(p.next_slot(now, "19:00", set()), dt.datetime(2026, 11, 18, 13, 30, tzinfo=UTC))
    def test_next_day_when_too_close(self):
        now = dt.datetime(2026, 11, 18, 12, 0, tzinfo=UTC)  # 17:30 IST, only 90 min left
        self.assertEqual(p.next_slot(now, "19:00", set()).astimezone(p.IST).date(), dt.date(2026, 11, 19))
    def test_skips_taken_days(self):
        now = dt.datetime(2026, 11, 18, 6, 0, tzinfo=UTC)
        taken = {dt.date(2026, 11, 18), dt.date(2026, 11, 19)}
        self.assertEqual(p.next_slot(now, "19:00", taken).astimezone(p.IST).date(), dt.date(2026, 11, 20))
    def test_preferred_date(self):
        now = dt.datetime(2026, 11, 18, 6, 0, tzinfo=UTC)
        self.assertEqual(p.next_slot(now, "19:00", set(), preferred=dt.date(2026, 11, 25)).astimezone(p.IST).date(), dt.date(2026, 11, 25))
    def test_past_preferred_ignored(self):
        now = dt.datetime(2026, 11, 18, 6, 0, tzinfo=UTC)
        self.assertEqual(p.next_slot(now, "19:00", set(), preferred=dt.date(2026, 11, 1)).astimezone(p.IST).date(), dt.date(2026, 11, 18))

class Drive(unittest.TestCase):
    def test_links(self):
        fid = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345"
        for link in (f"https://drive.google.com/file/d/{fid}/view?usp=sharing",
                     f"https://drive.google.com/open?id={fid}", f"https://drive.google.com/uc?id={fid}&export=download"):
            self.assertEqual(p.drive_file_id(link), fid)
    def test_folder_rejected(self):
        with self.assertRaises(ValueError):
            p.drive_file_id("https://drive.google.com/drive/folders/abc")

class Caption(unittest.TestCase):
    def test_clean(self):
        raw = '```json\n{"caption":"ഷുഗർ കൂടിയോ?","hashtags":"#DoctorUncle #Tirur #DoctorUncle #ഷുഗർ","pinned_comment":"x","yt_title":"' + "a"*150 + '","yt_description":"d <b>"}\n```'
        out = p.clean_caption_json(raw)
        self.assertEqual(out["hashtags"], "#DoctorUncle #Tirur #ഷുഗർ")
        self.assertEqual(len(out["yt_title"]), 100)
        self.assertNotIn("<", out["yt_description"])
    def test_empty_caption_fails(self):
        with self.assertRaises(ValueError):
            p.clean_caption_json('{"caption":""}')

if __name__ == "__main__":
    unittest.main()
