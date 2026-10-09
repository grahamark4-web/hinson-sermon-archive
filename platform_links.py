"""Match public platform episodes to sermons; retain verified links as feeds rotate."""
import base64, datetime as dt, html, json, re, unicodedata, urllib.request
from urllib.parse import unquote, urlparse
APPLE_ID = 509448288
SPOTIFY_ID = '5K1tGao0YJfapg97suw7Y5'
def normalize(value):
    text=unicodedata.normalize('NFKD',html.unescape(value)).lower()
    return re.sub(r'[^a-z0-9]+','',text)
def filename(url): return unquote(urlparse(url).path.rsplit('/',1)[-1]).lower()
def read_url(url):
    req=urllib.request.Request(url,headers={'User-Agent':'HinsonSermonCatalog/1.0'})
    with urllib.request.urlopen(req,timeout=40) as response: return response.read().decode()
def spotify_episodes(page):
    m=re.search(r'<script[^>]*id="initialState"[^>]*>(.*?)</script>',page,re.S)
    if not m: raise ValueError('Spotify public metadata unavailable')
    body=m[1]; data=json.loads(body if body.lstrip().startswith('{') else base64.b64decode(body))
    show=data['entities']['items']['spotify:show:'+SPOTIFY_ID]
    result=[]
    for item in show['pages']['items']:
        e=item['entity']['data']; uri=e.get('uri','')
        if re.fullmatch(r'spotify:episode:[A-Za-z0-9]{22}',uri):
            result.append({'title':e['name'],'url':'https://open.spotify.com/episode/'+uri.rsplit(':',1)[1], 'date':e['releaseDate']['isoString'][:10]})
    return result
def match_sermon(episode,sermons):
    audio=filename(episode.get('episodeUrl',''))
    if audio:
        candidates=[s for s in sermons if s.get('audio') and filename(s['audio'])==audio]
        if len(candidates)==1: return candidates[0]
    title=normalize(episode.get('trackName','')); date=dt.date.fromisoformat(episode['releaseDate'][:10])
    candidates=[s for s in sermons if normalize(s['title'])==title and abs((dt.date.fromisoformat(s['date'])-date).days)<=14]
    return candidates[0] if len(candidates)==1 else None
def update_links(sermons,root,apple=None,spotify=None):
    target=root/'podcast-links.json'
    old=json.loads(target.read_text()) if target.exists() else {'links':{}}
    valid_ids={s['id'] for s in sermons}
    links={key:value for key,value in old.get('links',{}).items() if key in valid_ids}
    failures=[]
    if apple is None:
        try: apple=json.loads(read_url(f'https://itunes.apple.com/lookup?id={APPLE_ID}&entity=podcastEpisode&limit=200'))['results']
        except Exception as error: failures.append('Apple: '+type(error).__name__);apple=[]
    if spotify is None:
        try: spotify=spotify_episodes(read_url('https://open.spotify.com/show/'+SPOTIFY_ID))
        except Exception as error: failures.append('Spotify: '+type(error).__name__);spotify=[]
    # A platform's display title may differ from the church title; first associate
    # Spotify with Apple's episode, then match its original MP3 filename to the sermon.
    for episode in apple:
        if episode.get('kind')!='podcast-episode' or episode.get('collectionId')!=APPLE_ID:continue
        sermon=match_sermon(episode,sermons)
        if sermon is None:continue
        urls=links.setdefault(sermon['id'],{})
        url=episode.get('trackViewUrl','')
        if url.startswith('https://podcasts.apple.com/') and re.search(r'[?&]i=\d+',url):urls['apple']=url
        matches=[e for e in spotify if normalize(e['title'])==normalize(episode['trackName']) and (not e.get('date') or abs((dt.date.fromisoformat(e['date'])-dt.date.fromisoformat(episode['releaseDate'][:10])).days)<=3)]
        if len(matches)==1 and re.fullmatch(r'https://open\.spotify\.com/episode/[A-Za-z0-9]{22}',matches[0]['url']):urls['spotify']=matches[0]['url']
    payload={'updatedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'links':links}
    temp=target.with_suffix('.tmp');temp.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n');temp.replace(target)
    report={'appleEpisodeLinks':sum('apple' in x for x in links.values()),'spotifyEpisodeLinks':sum('spotify' in x for x in links.values()),'platformLookupWarnings':failures}
    print(json.dumps(report),flush=True)
    return report
