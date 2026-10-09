import json, tempfile, unittest
from pathlib import Path
from platform_links import match_sermon, spotify_episodes, update_links
class PlatformLinksTests(unittest.TestCase):
    def setUp(self):
        self.sermons=[{'id':'new','title':'A church title','date':'2026-10-06','audio':'https://church.example/audio/sermon20261004.mp3'}, {'id':'old','title':'A church title','date':'2025-10-06','audio':''}]
        self.episode={'kind':'podcast-episode','collectionId':509448288,'trackName':'A platform title','releaseDate':'2026-10-04T18:00:00Z','episodeUrl':'https://podcast.example/different/path/sermon20261004.mp3','trackViewUrl':'https://podcasts.apple.com/us/podcast/id509448288?i=123'}
    def test_audio_identity_handles_different_titles(self):
        self.assertEqual(match_sermon(self.episode,self.sermons)['id'],'new')
    def test_repeated_titles_use_date(self):
        episode={**self.episode,'episodeUrl':'','trackName':'A church title'}
        self.assertEqual(match_sermon(episode,self.sermons)['id'],'new')
    def test_ambiguous_matches_are_omitted(self):
        duplicate={**self.sermons[0],'id':'duplicate'}
        self.assertIsNone(match_sermon({**self.episode,'trackName':'A church title'},self.sermons+[duplicate]))
    def test_platform_failure_retains_cached_links(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'podcast-links.json').write_text(json.dumps({'links':{'new':{'spotify':'https://open.spotify.com/episode/5Rachi6s5f0BIHt8itsFmx'}}}))
            report=update_links(self.sermons,root,apple=[],spotify=[])
            self.assertEqual(report['spotifyEpisodeLinks'],1)
    def test_direct_urls_and_unknown_title(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            update_links(self.sermons,root,apple=[self.episode],spotify=[{'title':'Other sermon','url':'https://open.spotify.com/episode/5Rachi6s5f0BIHt8itsFmx'}])
            self.assertNotIn('spotify',json.loads((root/'podcast-links.json').read_text())['links']['new'])
    def test_public_spotify_metadata(self):
        show={'entities':{'items':{'spotify:show:5K1tGao0YJfapg97suw7Y5':{'pages':{'items':[{'entity':{'data':{'name':'A sermon','uri':'spotify:episode:5Rachi6s5f0BIHt8itsFmx','releaseDate':{'isoString':'2026-10-04T18:00:00Z'}}}}]}}}}}
        page='<script id="initialState">'+json.dumps(show)+'</script>'
        self.assertEqual(spotify_episodes(page)[0]['url'],'https://open.spotify.com/episode/5Rachi6s5f0BIHt8itsFmx')
if __name__=='__main__':unittest.main()
