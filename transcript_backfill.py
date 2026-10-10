"""Bounded batches for the complete archive; preserve completed work on failures."""
import json, os, shutil
from pathlib import Path
import transcripts

def pending():
    sermons=transcripts.read(transcripts.ROOT/'sermons.json',{})['sermons']
    return [s['id'] for s in sorted(sermons,key=lambda s:s['date'],reverse=True)
            if s.get('audio') and not transcripts.current(transcripts.read(transcripts.ROOT/'transcripts'/f"{s['id']}.json",{}),s)]

def batches(ids,size=9):return [ids[i:i+size] for i in range(0,len(ids),size)]

def run(ids):
    out=Path('backfill-output');out.mkdir(exist_ok=True)
    done=[];failed=[]
    for sermon_id in ids:
        try:
            transcripts.transcribe(sermon_id)
            shutil.copyfile(transcripts.ROOT/'transcripts'/f'{sermon_id}.json',out/f'{sermon_id}.json')
            done.append(sermon_id)
            print(f'Completed {sermon_id}',flush=True)
        except Exception as error:
            failed.append({'sermonId':sermon_id,'error':type(error).__name__+': '+str(error)[:300]})
            print(f'Could not transcribe {sermon_id}: {type(error).__name__}',flush=True)
    report=Path('backfill-reports')/f"batch-{os.environ.get('BACKFILL_BATCH','0')}.json"
    transcripts.save(report,{'completed':done,'failed':failed})

if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser();p.add_argument('command',choices=['plan','run']);a=p.parse_args()
    if a.command=='plan':
        groups=batches(pending());transcripts.save(Path('backfill-plan.json'),groups)
        print(json.dumps(list(range(len(groups)))))
    else:run(transcripts.read(Path('backfill-plan.json'),[])[int(os.environ['BACKFILL_BATCH'])])
