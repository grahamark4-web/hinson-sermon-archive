"""Select, transcribe and index public sermon audio. All timestamps are seconds."""
import argparse, json, re, subprocess, tempfile, unicodedata
from pathlib import Path

ROOT=Path(__file__).resolve().parent
MODEL='small.en'
def read(path,default):
    return json.loads(path.read_text()) if path.exists() else default
def save(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
def source(sermon):
    audio=sermon.get('audio','')
    return 'https://hinson-sermon-archive.grahamark4.workers.dev'+audio if audio.startswith('/') else audio
def current(doc,sermon):
    return doc.get('sourceAudio')==sermon.get('audio') and doc.get('model')==MODEL and bool(doc.get('segments'))
def select(count,recent_only=False):
    catalog=read(ROOT/'sermons.json',{})['sermons']
    if recent_only:catalog=sorted(catalog,key=lambda s:s['date'],reverse=True)[:10]
    selected=[]
    for s in sorted(catalog,key=lambda x:x['date'],reverse=True):
        if s.get('audio') and not current(read(ROOT/'transcripts'/f"{s['id']}.json",{}),s):
            selected.append(s['id'])
        if len(selected)>=count:break
    print(json.dumps(selected))
def transcribe(sermon_id):
    from faster_whisper import WhisperModel
    s=next(s for s in read(ROOT/'sermons.json',{})['sermons'] if s['id']==sermon_id)
    audio=source(s)
    if not audio.startswith('https://'):raise ValueError('An HTTPS audio source is required')
    with tempfile.TemporaryDirectory() as folder:
        path=Path(folder)/'sermon.mp3'
        subprocess.run(['curl','--fail','--location','--retry','2','--max-time','600','--max-filesize','250000000','--output',str(path),audio],check=True)
        model=WhisperModel(MODEL,device='cpu',compute_type='int8',cpu_threads=2,num_workers=1)
        segments,info=model.transcribe(str(path),language='en',beam_size=5,vad_filter=True,word_timestamps=True,condition_on_previous_text=False)
        rows=[]
        for seg in segments:
            text=seg.text.strip()
            if text and seg.no_speech_prob<0.8 and seg.avg_logprob>-1.5:
                rows.append({'start':round(seg.start,2),'end':round(seg.end,2),'text':text})
        if len(rows)<10:raise ValueError('Too little speech detected; refusing to publish')
    save(ROOT/'transcripts'/f'{sermon_id}.json',{'sermonId':sermon_id,'sourceAudio':s['audio'],'model':MODEL,'automatic':True,'duration':round(info.duration,2),'segments':rows})
def words(text):return re.findall(r'[a-z0-9]+',unicodedata.normalize('NFKD',text.lower()))
def bucket(term):
    n=2166136261
    for c in term:n=((n^ord(c))*16777619)&0xffffffff
    return n%64
def build():
    catalog=read(ROOT/'sermons.json',{})['sermons'];terms=[{} for _ in range(64)];chunks={};documents={};index=0
    for s in sorted(catalog,key=lambda s:s['id']):
        doc=read(ROOT/'transcripts'/f"{s['id']}.json",{})
        if not current(doc,s):continue
        documents[s['id']]={'sourceAudio':s['audio']}
        segments=doc['segments']
        # Adjacent pairs overlap so quotes crossing segment boundaries still match.
        for i,segment in enumerate(segments):
            pair=segments[i:i+2];text=' '.join(p['text'] for p in pair)
            chunks[index]={'sermonId':s['id'],'text':text,'end':pair[-1]['end'],'segments':pair}
            for term in set(words(text)):
                terms[bucket(term)].setdefault(term,[]).append(index)
            index+=1
    out=ROOT/'transcript-search';out.mkdir(exist_ok=True)
    for p in out.glob('*.json'):p.unlink()
    for b,data in enumerate(terms):save(out/f'terms-{b}.json',data)
    for page in range((index+499)//500):save(out/f'passages-{page}.json',{str(i):chunks[i] for i in range(page*500,min(index,(page+1)*500))})
    save(out/'manifest.json',{'version':1,'coverage':len(documents),'documents':documents,'passages':index})
    print(f'Indexed {len(documents)} sermons and {index} passages')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('command',choices=['select','transcribe','build']);p.add_argument('--count',type=int,default=10);p.add_argument('--id');p.add_argument('--recent-only',action='store_true');a=p.parse_args()
    if a.command=='select':select(max(1,min(a.count,20)),a.recent_only)
    elif a.command=='transcribe':transcribe(a.id)
    else:build()
