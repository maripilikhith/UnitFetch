import concurrent.futures
import json
from pathlib import Path
import struct
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'helper'))
from host import read_message
config=json.loads((ROOT/'helper/com.unifetch.downloader.json').read_text())
process=subprocess.Popen([sys.executable,'-u',str(ROOT/'helper/host.py'),config['allowed_origins'][0]],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
try:
    payload=json.dumps({'requestId':'test','type':'ping'}).encode()
    process.stdin.write(struct.pack('<I',len(payload))+payload);process.stdin.flush()
    with concurrent.futures.ThreadPoolExecutor() as pool:
        task=pool.submit(read_message,process.stdout)
        try:
            result=task.result(timeout=45);print(json.dumps(result),flush=True)
            assert result and result['ok']
        except concurrent.futures.TimeoutError:
            process.kill();print('Native protocol timed out.',flush=True);raise
finally:
    process.terminate()
