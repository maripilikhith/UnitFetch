"""Opt-in live test of a CC BY Blender film; output stays in test-results.

Film: (c) 2008 Blender Foundation / www.bigbuckbunny.org
License: https://peach.blender.org/about/ (CC BY 3.0)
"""
import json
from pathlib import Path
import sys
import time
import uuid
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'helper'))
from host import Host
ROOT=Path(__file__).resolve().parents[1]
host=Host(ROOT/'test-results'/'live-helper',output=ROOT/'test-results'/'youtube')
host.bin=ROOT/'helper'/'bin'
last=None
def report(message):
    global last
    job=message.get('job',{})
    marker=(job.get('status'),int((job.get('progress') or 0)//20))
    if marker!=last:
        print(json.dumps({k:job.get(k) for k in ('status','progress','error','filename')}),flush=True)
        last=marker
host.send=report
try:
    video=host.inspect('https://www.youtube.com/watch?v=aqz-KE-bpKQ')
    print(f'Inspected: {video["title"]}; {len(video["formats"])} format choices',flush=True)
    chosen=next(f for f in video['formats'] if f['id']=='144-webm')
    job_id=str(uuid.uuid4())
    host.start_download({'id':job_id,'token':video['nativeToken'],'formatId':chosen['id']})
    deadline=time.monotonic()+240
    while host.jobs[job_id]['status'] in ('queued','downloading','processing') and time.monotonic()<deadline:
        time.sleep(.5)
    job=host.jobs[job_id]
    if job['status']!='complete':
        raise RuntimeError(job.get('error') or 'Live test did not complete within four minutes.')
    (ROOT/'test-results'/'live-download.json').write_text(json.dumps(host.public_job(job),indent=2),encoding='utf-8')
    print('PASS: live YouTube download completed and FFmpeg verified video + audio.',flush=True)
finally:
    host.close()
