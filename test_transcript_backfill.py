import json, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
import transcript_backfill as backfill
import transcripts

class BackfillTest(unittest.TestCase):
    def test_batches_cover_all_records_once(self):
        ids=[str(i) for i in range(821)];groups=backfill.batches(ids)
        self.assertEqual(len(groups),92)
        self.assertEqual([i for g in groups for i in g],ids)
        self.assertTrue(all(len(g)<=9 for g in groups))
    def test_pending_skips_completed_and_unavailable_audio(self):
        with tempfile.TemporaryDirectory() as folder,patch.object(transcripts,'ROOT',Path(folder)):
            root=Path(folder)
            transcripts.save(root/'sermons.json',{'sermons':[{'id':'done','date':'2026-10-06','audio':'https://example.com/1.mp3'},{'id':'pending','date':'2026-10-04','audio':'https://example.com/2.mp3'},{'id':'missing','date':'2026-10-01','audio':''}]})
            transcripts.save(root/'transcripts/done.json',{'sourceAudio':'https://example.com/1.mp3','model':transcripts.MODEL,'segments':[{'text':'Already transcribed'}]})
            self.assertEqual(backfill.pending(),['pending'])

if __name__=='__main__':unittest.main()
