#!/usr/bin/env python3
"""Read the public Squarespace collection without altering posts or audio."""
import concurrent.futures, datetime as dt, html, json, re, time, urllib.request
from html.parser import HTMLParser
from zoneinfo import ZoneInfo
from pathlib import Path
from platform_links import update_links
from urllib.parse import urljoin
BASE = 'https://www.hinsonchurch.org'
SITE_TZ = ZoneInfo('America/Los_Angeles')
BOOKS = 'Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|1 Samuel|2 Samuel|1 Kings|2 Kings|1 Chronicles|2 Chronicles|Ezra|Nehemiah|Esther|Job|Psalms|Proverbs|Ecclesiastes|Song of Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|1 Corinthians|2 Corinthians|Galatians|Ephesians|Philippians|Colossians|1 Thessalonians|2 Thessalonians|1 Timothy|2 Timothy|Titus|Philemon|Hebrews|James|1 Peter|2 Peter|1 John|2 John|3 John|Jude|Revelation'.split('|')
BOOK_PATTERN = '|'.join(re.escape(b) for b in sorted(BOOKS + ['Psalm','Song of Songs'],key=len,reverse=True))
REFERENCE = re.compile(r'(?<![\w])(' + BOOK_PATTERN + r')\s+(\d+(?:\s*:\s*\d+)?(?:\s*[-–]\s*\d+(?:\s*:\s*\d+)?)?(?:\s*,\s*\d+(?:\s*[-–]\s*\d+)?)*)',re.I)
class AudioParser(HTMLParser):
    def __init__(self): super().__init__(); self.players=[]; self.text=[]
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if 'sqs-audio-embed' in a.get('class','') or 'data-author' in a and ('data-url' in a or 'data-asset-url' in a): self.players.append(a)
    def handle_data(self, data): self.text.append(data)
def parse_item(item):
    p=AudioParser(); p.feed(item.get('body','')); player=p.players[0] if p.players else {}
    title=html.unescape(item.get('title','')).strip()
    refs=REFERENCE.findall(title) or REFERENCE.findall(player.get('data-title','')) or REFERENCE.findall(item.get('excerpt',''))
    passages=[]
    for book, nums in refs:
        book=next((b for b in BOOKS if b.lower()==book.lower()), 'Psalms' if book.lower()=='psalm' else 'Song of Solomon')
        passages.append({'book':book,'reference':book+' '+re.sub(r'\s+','',nums.replace('–','-'))})
    tags=item.get('tags',[])
    speaker=html.unescape(player.get('data-author','')).strip()
    if not speaker: speaker=next((t for t in tags if t.lower() not in {b.lower() for b in BOOKS+['Psalm','Song of Songs']} and t.lower() not in {'good friday','unknown'}), '')
    audio=html.unescape(player.get('data-asset-url','') or player.get('data-url','')).strip()
    if audio and not audio.startswith(('https://','http://')): audio=''
    speaker = '' if speaker.lower()=='unknown' else speaker
    if speaker.lower()=='tommie van der walt': speaker='Tommie van der Walt'
    date=dt.datetime.fromtimestamp(item['publishOn']/1000,SITE_TZ).date().isoformat()
    return {'id':item['id'],'title':title,'date':date,'speaker':speaker,'passages':passages,'books':list(dict.fromkeys(r['book'] for r in passages)) or [t for t in tags if t in BOOKS], 'series':item.get('categories',[]),'url':urljoin(BASE,item['fullUrl']),'audio':audio if audio.startswith('https://') else '', 'legacyAudio':bool(audio.startswith('http://'))}
def fetch(url):
    for attempt in range(4):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'HinsonSermonCatalog/1.0 (public archive index)'})
            with urllib.request.urlopen(req,timeout=45) as response: return json.load(response)
        except Exception:
            if attempt==3: raise
            time.sleep(2**attempt)
def crawl_year(year):
    lower=int(dt.datetime(year,1,1,tzinfo=SITE_TZ).timestamp()*1000)
    upper=int(dt.datetime(year+1,1,1,tzinfo=SITE_TZ).timestamp()*1000)
    url=f'{BASE}/oursermons?format=json&offset={upper}'
    rows=[]; offsets=set()
    for page in range(200):
        data=fetch(url); items=data.get('items',[])
        if not items: break
        rows.extend(parse_item(i) for i in items if lower<=i['publishOn']<upper)
        pagination=data.get('pagination',{})
        if min(i['publishOn'] for i in items)<lower or not pagination.get('nextPage'): break
        offset=pagination['nextPageOffset']
        if offset in offsets: raise RuntimeError('Repeated pagination offset')
        offsets.add(offset); url=f'{BASE}/oursermons?format=json&offset={offset}'
        time.sleep(.25)
    else: raise RuntimeError('Pagination limit reached')
    print(f'{year}: {len(rows)} sermons',flush=True)
    return rows
def main():
    root=Path(__file__).parent
    current=dt.datetime.now(dt.timezone.utc).year
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool: batches=list(pool.map(crawl_year,range(2000,current+1)))
    rows=sorted({r['id']:r for batch in batches for r in batch}.values(),key=lambda r:(r['date'],r['id']),reverse=True)
    if len(rows)<100: raise RuntimeError('Incomplete catalog; refusing to overwrite')
    target=root/'sermons.json'
    if target.exists():
        old=json.loads(target.read_text())
        if len(rows)<len(old.get('sermons',[]))*.95: raise RuntimeError('Catalog shrank by more than 5%; refusing to overwrite')
    # Cross-check against the archive landing page, which includes the historical links.
    req=urllib.request.Request(BASE+'/sermonindex',headers={'User-Agent':'HinsonSermonCatalog/1.0'})
    with urllib.request.urlopen(req,timeout=45) as response: index=response.read().decode()
    links={html.unescape(u).split('?')[0].rstrip('/') for u in re.findall(r'href=[\"\x27]([^\"\x27]*?/oursermons/[^\"\x27]*)',index)}
    known={r['url'].replace(BASE,'').rstrip('/') for r in rows}
    missing=sorted(u for u in links if u.replace(BASE,'') not in known)
    if missing: raise RuntimeError(f'{len(missing)} sermon index links missing from crawl: {missing[:5]}')
    payload={'updatedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'source':BASE+'/sermonindex','sermons':rows}
    temp=target.with_suffix('.tmp'); temp.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n'); temp.replace(target)
    report={'count':len(rows),'firstDate':rows[-1]['date'],'lastDate':rows[0]['date'],'indexLinksChecked':len(links),'missingSpeaker':sum(not r['speaker'] for r in rows),'missingPassage':sum(not r['passages'] for r in rows),'legacyAudio':sum(r['legacyAudio'] for r in rows),'noAudio':sum(not r['audio'] and not r['legacyAudio'] for r in rows)}
    report.update(update_links(rows,root))
    (root/'catalog-report.json').write_text(json.dumps(report,indent=2)+'\n'); print(json.dumps(report),flush=True)
if __name__=='__main__': main()
