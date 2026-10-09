"""Prefer verified hinsonchurch.net audio on unique matching dates."""
import concurrent.futures, datetime as dt, json, subprocess
from collections import Counter
from html.parser import HTMLParser
from urllib.parse import urlparse
SOURCE='http://www.hinsonchurch.net/'
class ArchiveParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.columns=[]; self.column=None; self.item=None
    def handle_starttag(self,tag,attrs):
        if tag=='td': self.column=[]
        if tag=='li': self.item={'text':'','url':''}
        if tag=='a' and self.item is not None: self.item['url']=dict(attrs).get('href','')
    def handle_data(self,data):
        if self.item is not None: self.item['text']+=data
    def handle_endtag(self,tag):
        if tag=='li' and self.item is not None:
            if self.column is not None: self.column.append(self.item)
            self.item=None
        if tag=='td' and self.column: self.columns.append(self.column); self.column=None
def parse_archive(markup):
    p=ArchiveParser(); p.feed(markup)
    cols={c[0]['text'].strip():c[1:] for c in p.columns}
    subjects,dates=cols.get('Subject',[]),cols.get('Date',[])
    if not subjects or len(subjects)!=len(dates): raise ValueError('Incomplete archive columns')
    urls=Counter(s['url'] for s in subjects if s['url']); candidates={}; conflicts=set()
    for s,d in zip(subjects,dates):
        url=s['url']; u=urlparse(url)
        if u.scheme!='http' or u.hostname!='www.hinsonchurch.net' or not u.path.startswith('/audio/') or not u.path.endswith('.mp3') or u.query or urls[url]!=1: continue
        date=dt.datetime.strptime(d['text'].strip(),'%b %d, %Y').date().isoformat()
        if date in candidates: conflicts.add(date)
        candidates[date]={'url':url,'subject':s['text'].strip()}
    return {d:v for d,v in candidates.items() if d not in conflicts}
def verify_audio(entry):
    try:
        output=subprocess.check_output(['curl','--fail','--silent','--show-error','--max-time','20','--head',entry['url']],stderr=subprocess.DEVNULL).decode()
        headers={k.strip().lower():v.strip() for line in output.splitlines() if ':' in line for k,v in [line.split(':',1)]}
        return headers.get('content-type','').split(';')[0].lower() in ('audio/mpeg','audio/mp3','application/octet-stream') and int(headers.get('content-length','0'))>1024
    except Exception: return False
def apply_overrides(rows,entries):
    counts=Counter(r['date'] for r in rows); applied=0
    for r in rows:
        e=entries.get(r['date'])
        if not e or counts[r['date']]!=1: continue
        r['originalAudio']=r.get('originalAudio',r['audio']); r['audioSource']=e['url']
        r['audio']='/archive-audio/'+urlparse(e['url']).path.rsplit('/',1)[-1]
        r['legacyAudio']=False; applied+=1
    return applied
def update_archive_audio(rows,root,markup=None):
    target=root/'archive-audio.json'; previous=json.loads(target.read_text()).get('byDate',{}) if target.exists() else {}; warnings=[]
    try:
        if markup is None:
            markup=subprocess.check_output(['curl','--fail','--silent','--show-error','--max-time','30',SOURCE]).decode('latin1')
        wanted={r['date'] for r in rows}; candidates={d:e for d,e in parse_archive(markup).items() if d in wanted}
        pending=[(d,e) for d,e in candidates.items() if previous.get(d,{}).get('url')!=e['url']]
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool: checks=list(pool.map(lambda pair:verify_audio(pair[1]),pending))
        verified={d:e for d,e in candidates.items() if previous.get(d,{}).get('url')==e['url']}; failed=[]
        for (d,e),ok in zip(pending,checks):
            if ok: verified[d]=e
            else: failed.append(d)
        if failed: warnings.append('Unavailable archive MP3 dates: '+', '.join(failed))
        entries={**previous,**verified}
    except Exception as exc: entries=previous; warnings.append('Archive lookup failed; retained verified audio: '+str(exc))
    target.write_text(json.dumps({'source':SOURCE,'byDate':entries},indent=2)+'\n')
    return {'archiveAudioOverrides':apply_overrides(rows,entries),'archiveAudioWarnings':warnings}
