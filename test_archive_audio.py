import unittest
from archive_audio import parse_archive,apply_overrides

def page(subjects,dates):
    return '<table><td><li>Subject</li>'+subjects+'</td><td><li>Date</li>'+dates+'</td></table>'
def a(name='hnsn201311124.mp3'):
    return '<li><a href="http://www.hinsonchurch.net/audio/'+name+'">Romans 6-8</a></li>'
class ArchiveAudioTests(unittest.TestCase):
    def test_displayed_date_handles_filename_typo(self):
        entries=parse_archive(page(a(),'<li>Nov 24, 2013</li>'))
        self.assertIn('2013-11-24',entries)
    def test_duplicate_file_is_not_assigned_to_two_sermons(self):
        self.assertEqual(parse_archive(page(a()+a(),'<li>Nov 24, 2013</li><li>Nov 17, 2013</li>')), {})
    def test_misaligned_columns_rejected(self):
        with self.assertRaises(ValueError):parse_archive(page(a(),''))
    def test_unique_date_overrides_and_unmatched_preserved(self):
        rows=[{'date':'2013-11-24','audio':'https://example.org/old.mp3','legacyAudio':False},{'date':'2026-10-04','audio':'https://example.org/new.mp3','legacyAudio':False}]
        entries=parse_archive(page(a(),'<li>Nov 24, 2013</li>'))
        self.assertEqual(apply_overrides(rows,entries),1)
        self.assertEqual(rows[0]['audio'],'/archive-audio/hnsn201311124.mp3')
        self.assertEqual(rows[0]['originalAudio'],'https://example.org/old.mp3')
        self.assertEqual(rows[1]['audio'],'https://example.org/new.mp3')
    def test_ambiguous_catalog_date_not_overridden(self):
        rows=[{'date':'2013-11-24','audio':'one'},{'date':'2013-11-24','audio':'two'}]
        self.assertEqual(apply_overrides(rows,{'2013-11-24':{'url':'http://www.hinsonchurch.net/audio/test.mp3'}}),0)
if __name__=='__main__':unittest.main()
