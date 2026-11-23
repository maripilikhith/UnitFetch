"""UniFetch native messaging host. Standard-library Python; no listening network port."""
import concurrent.futures
import ipaddress
import json
import os
from pathlib import Path
import re
import shutil
import socket
import struct
import subprocess
import sys
import threading
import time
import urllib.request
from urllib.parse import urlparse
import uuid

from media import youtube_url, shape_video, clean_error, safe_name
from version import VERSION

ROOT = Path(__file__).resolve().parent
ACTIVE = {'queued', 'downloading', 'processing'}
NO_WINDOW = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
OUT_LOCK = threading.Lock()

def emit(message):
    data = json.dumps(message, ensure_ascii=False, allow_nan=False).encode('utf-8')
    if len(data) > 900_000:
        raise ValueError('Helper response exceeded the size limit.')
    with OUT_LOCK:
        sys.stdout.buffer.write(struct.pack('<I', len(data)) + data)
        sys.stdout.buffer.flush()

def read_exact(stream, size):
    parts = bytearray()
    while len(parts) < size:
        part = stream.read(size - len(parts))
        if not part:
            if not parts:
                return None
            raise ValueError('Incomplete native message.')
        parts.extend(part)
    return bytes(parts)

def read_message(stream):
    header = read_exact(stream, 4)
    if header is None:
        return None
    length = struct.unpack('<I', header)[0]
    if not 1 <= length <= 65536:
        raise ValueError('Native message exceeds the allowed size.')
    data = read_exact(stream, length)
    if data is None:
        raise ValueError('Missing native message body.')
    message = json.loads(data)
    if not isinstance(message, dict):
        raise ValueError('Expected a message object.')
    return message

def default_download_dir():
    if os.name == 'nt':
        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r'Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders') as key:
                return Path(os.path.expandvars(winreg.QueryValueEx(key, '{374DE290-123F-4565-9164-39C4925E467B}')[0])) / 'UniFetch'
        except OSError:
            pass
    return Path.home() / 'Downloads' / 'UniFetch'

class Host:
    def __init__(self, root=ROOT, output=None):
        self.root = Path(root)
        self.bin = self.root / 'bin'
        self.state = self.root / 'state'
        self.state.mkdir(parents=True, exist_ok=True)
        self.output = Path(output) if output else default_download_dir()
        config_path = self.root / 'config.json'
        if config_path.exists() and output is None:
            config = json.loads(config_path.read_text(encoding='utf-8-sig'))
            if config.get('downloadDirectory'):
                self.output = Path(config['downloadDirectory']).resolve()
        self.lock = threading.RLock()
        self.cache = {}
        self.jobs = self.load_jobs()
        self.processes = {}
        self.cancelled = set()
        self.pool = concurrent.futures.ThreadPoolExecutor(max_workers=3)
        self.inspection_lock = threading.Lock()
        self.send = emit
        self.closed = False
        self.versions = None

    def load_jobs(self):
        path = self.state / 'jobs.json'
        try:
            items = json.loads(path.read_text(encoding='utf-8'))
            if not isinstance(items, dict):
                return {}
            for job in items.values():
                if job.get('status') in ACTIVE:
                    job.update(status='interrupted', error='The helper was restarted before this download finished.')
            return items
        except (OSError, ValueError):
            return {}

    def persist(self):
        with self.lock:
            ordered = sorted(self.jobs.values(),key=lambda j:j.get('createdAt',0),reverse=True)
            keep = [j for j in ordered if j.get('status') in ACTIVE] + [j for j in ordered if j.get('status') not in ACTIVE][:100]
            self.jobs = {j['id']:j for j in keep}
            target = self.state / 'jobs.json'
            temporary = self.state / 'jobs.tmp'
            temporary.write_text(json.dumps(self.jobs,ensure_ascii=False),encoding='utf-8')
            temporary.replace(target)

    def update(self, job_id, **values):
        with self.lock:
            if self.closed and values.get('status') != 'complete':
                values.update(status='interrupted',error='Chrome disconnected before this download finished.',progress=None)
            self.jobs[job_id].update(values)
            self.persist()
            job = self.public_job(self.jobs[job_id])
        if not self.closed:
            self.send({'event':'job','job':job})

    @staticmethod
    def public_job(job):
        return {k:v for k,v in job.items() if not k.startswith('_')}

    def base_command(self):
        for name in ('ffmpeg.exe','deno.exe'):
            if not (self.bin / name).is_file():
                raise ValueError(f'{name} is missing. Run helper/setup-tools.py, then reconnect.')
        if not (ROOT/'vendor'/'yt_dlp'/'__init__.py').is_file():
            raise ValueError('The download engine is missing. Run helper/setup-tools.py.')
        return [sys.executable,'-X','utf8',str(ROOT/'run_ytdlp.py'),'--ignore-config','--no-cache-dir','--no-playlist','--no-colors','--no-geo-bypass','--no-remote-components','--socket-timeout','20','--retries','2','--fragment-retries','2','--js-runtimes',f'deno:{self.bin / "deno.exe"}','--ffmpeg-location',str(self.bin)]

    def ping(self):
        self.base_command()
        if not self.versions:
            self.versions = {}
            for key, command in [('ytDlp',[sys.executable,str(ROOT/'run_ytdlp.py'),'--version']),('ffmpeg',[str(self.bin/'ffmpeg.exe'),'-version']),('deno',[str(self.bin/'deno.exe'),'--version'])]:
                run = subprocess.run(command,stdin=subprocess.DEVNULL,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=20,creationflags=NO_WINDOW)
                if run.returncode:
                    raise ValueError(f'{key} could not start.')
                self.versions[key] = run.stdout.splitlines()[0][:150]
        return {'version':VERSION,'tools':self.versions,'downloadDirectory':str(self.output),'jobs':[self.public_job(j) for j in self.jobs.values()]}

    def inspect(self, value):
        url = youtube_url(value)
        if not self.inspection_lock.acquire(blocking=False):
            raise ValueError('Another link is being inspected. Try again in a moment.')
        try:
            run = subprocess.run([*self.base_command(),'--dump-single-json','--skip-download','--no-warnings','--',url],stdin=subprocess.DEVNULL,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=100,creationflags=NO_WINDOW)
            if run.returncode:
                raise ValueError(clean_error(run.stderr))
            result, selectors = shape_video(json.loads(run.stdout))
            token = str(uuid.uuid4())
            with self.lock:
                self.cache = {k:v for k,v in self.cache.items() if time.monotonic()-v['created'] < 900}
                self.cache[token] = {'url':url,'result':result,'selectors':selectors,'created':time.monotonic()}
            return {**result,'nativeToken':token}
        finally:
            self.inspection_lock.release()

    def start_download(self, request):
        job_id = str(request.get('id',''))
        if not re.fullmatch(r'[0-9a-f-]{36}',job_id):
            raise ValueError('Invalid download identifier.')
        with self.lock:
            if job_id in self.jobs or any(j['status'] in ACTIVE for j in self.jobs.values()):
                raise ValueError('A YouTube download is already running. Wait for it to finish or cancel it.')
            cached = self.cache.get(request.get('token'))
            if not cached or time.monotonic()-cached['created'] > 900:
                raise ValueError('The preview expired or the helper restarted. Find the video again.')
            format_id = request.get('formatId')
            if format_id not in cached['selectors']:
                raise ValueError('The selected format is unavailable.')
            result = cached['result']
            choice = next(f for f in result['formats'] if f['id']==format_id)
            self.jobs[job_id] = {'id':job_id,'title':result['title'],'provider':'youtube','hostname':'youtube.com','videoId':result['id'],'createdAt':int(time.time()*1000),'status':'queued','progress':None,'format':choice['label']}
            self.persist()
        self.pool.submit(self.download,job_id,cached,choice)
        return {'id':job_id}

    def download(self, job_id, cached, choice):
        work = self.state / 'work' / job_id
        work.mkdir(parents=True,exist_ok=True)
        process = None
        try:
            if job_id in self.cancelled:
                self.update(job_id,status='cancelled')
                return
            command = [*self.base_command(),'--newline','--no-warnings','--progress','--progress-delta','0.7','--progress-template','download:UF_PROGRESS %(progress)j','--print','after_move:UF_FILE %(filepath)j','--no-simulate','--windows-filenames','--no-overwrites','--merge-output-format',choice['ext'],'-f',cached['selectors'][choice['id']],'-o',str(work / 'media.%(ext)s'),'--',cached['url']]
            self.update(job_id,status='downloading',progress=None)
            process = subprocess.Popen(command,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8',errors='replace',bufsize=1,creationflags=NO_WINDOW)
            with self.lock:
                self.processes[job_id] = process
                if job_id in self.cancelled:
                    self.stop_process(process)
            tail = []
            final_file = None
            for line in process.stdout:
                if line.startswith('UF_PROGRESS '):
                    try:
                        progress = json.loads(line[len('UF_PROGRESS '):])
                        downloaded = progress.get('downloaded_bytes') or 0
                        total = progress.get('total_bytes') or progress.get('total_bytes_estimate')
                        percent = min(100,downloaded/total*100) if total else None
                        self.update(job_id,status='processing' if progress.get('status')=='finished' else 'downloading',progress=percent,bytes=downloaded,totalBytes=total,speed=progress.get('speed'),eta=progress.get('eta'))
                    except (ValueError, TypeError):
                        pass
                elif line.startswith('UF_FILE '):
                    final_file = Path(json.loads(line[len('UF_FILE '):])).resolve()
                else:
                    tail.append(line.rstrip())
                    tail = tail[-15:]
            code = process.wait()
            if job_id in self.cancelled:
                self.update(job_id,status='cancelled',progress=None)
                return
            if code or final_file is None or not final_file.is_file() or not final_file.is_relative_to(work.resolve()):
                raise ValueError(clean_error('\n'.join(tail)))
            self.update(job_id,status='processing',progress=None)
            # Mapping both required tracks makes FFmpeg fail if either is absent.
            # Decode a short portion as a stronger check than merely inspecting a file extension.
            probe = subprocess.run([str(self.bin/'ffmpeg.exe'),'-hide_banner','-loglevel','error','-i',str(final_file),'-map','0:v:0','-map','0:a:0','-t','0.2','-f','null','-'],stdin=subprocess.DEVNULL,capture_output=True,text=True,encoding='utf-8',timeout=30,creationflags=NO_WINDOW)
            if probe.returncode:
                raise ValueError('The output could not be verified as a complete video with sound.')
            if job_id in self.cancelled:
                self.update(job_id,status='cancelled',progress=None)
                return
            self.output.mkdir(parents=True,exist_ok=True)
            filename = f'{safe_name(cached["result"]["title"])} [{cached["result"]["id"]}]-{job_id[:8]}.{choice["ext"]}'
            destination = self.output / filename
            if destination.exists():
                raise ValueError('A file with this download identifier already exists.')
            shutil.move(str(final_file),destination)
            final_size=destination.stat().st_size
            self.update(job_id,status='complete',progress=100,filename=filename,bytes=final_size,totalBytes=final_size,speed=None,eta=None,_path=str(destination),error=None)
        except Exception as error:
            status = 'cancelled' if job_id in self.cancelled else 'failed'
            self.update(job_id,status=status,error=None if status=='cancelled' else clean_error(error),progress=None)
        finally:
            if process and process.poll() is None:
                self.stop_process(process)
            if process and process.stdout:
                process.stdout.close()
            with self.lock:
                self.processes.pop(job_id,None)
                self.cancelled.discard(job_id)
            # Only remove this job's private temporary directory, never a user-supplied path.
            if work.resolve().is_relative_to((self.state/'work').resolve()):
                shutil.rmtree(work,ignore_errors=True)

    @staticmethod
    def stop_process(process):
        if process.poll() is not None:
            return
        if os.name == 'nt':
            subprocess.run(['taskkill','/PID',str(process.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=NO_WINDOW)
        else:
            process.terminate()

    def cancel(self, job_id):
        with self.lock:
            if job_id not in self.jobs or self.jobs[job_id]['status'] not in ACTIVE:
                raise ValueError('This download is no longer running.')
            self.cancelled.add(job_id)
            process = self.processes.get(job_id)
            if process:
                self.stop_process(process)
        return {'ok':True}

    def reveal(self, job_id):
        job = self.jobs.get(job_id)
        if not job or job['status']!='complete' or not job.get('_path'):
            raise ValueError('No completed file is associated with this download.')
        path = Path(job['_path']).resolve()
        if not path.is_relative_to(self.output.resolve()) or not path.is_file():
            raise ValueError('The file was moved or deleted.')
        subprocess.Popen(['explorer.exe','/select,',str(path)],creationflags=NO_WINDOW)
        return {'ok':True}

    def clear_history(self):
        with self.lock:
            self.jobs = {k:v for k,v in self.jobs.items() if v['status'] in ACTIVE}
            self.persist()
        return {'ok':True}

    def dispatch(self, request):
        request_id = request.get('requestId')
        if not isinstance(request_id,str) or len(request_id)>100:
            return
        try:
            kind = request.get('type')
            if kind=='ping': data=self.ping()
            elif kind=='inspect': data=self.inspect(request.get('url'))
            elif kind=='download': data=self.start_download(request)
            elif kind=='probe': data=probe_direct(request.get('url'))
            elif kind=='cancel': data=self.cancel(request.get('id'))
            elif kind=='reveal': data=self.reveal(request.get('id'))
            elif kind=='clear_history': data=self.clear_history()
            else: raise ValueError('Unknown helper operation.')
            if not self.closed: self.send({'requestId':request_id,'ok':True,'data':data})
        except Exception as error:
            if not self.closed: self.send({'requestId':request_id,'ok':False,'error':clean_error(error)})

    def close(self):
        self.closed = True
        with self.lock:
            for job_id, process in list(self.processes.items()):
                self.cancelled.add(job_id)
                self.stop_process(process)
        self.pool.shutdown(wait=False,cancel_futures=True)

def validate_public_url(value):
    if not isinstance(value,str) or len(value)>8192:
        raise ValueError('Invalid file link.')
    parsed = urlparse(value)
    if parsed.scheme not in ('http','https') or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Use a public HTTP or HTTPS video link.')
    for answer in socket.getaddrinfo(parsed.hostname,parsed.port or (443 if parsed.scheme=='https' else 80),type=socket.SOCK_STREAM):
        if not ipaddress.ip_address(answer[4][0]).is_global:
            raise ValueError('Automatic file inspection is limited to public internet addresses.')
    return value

class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        validate_public_url(newurl)
        return super().redirect_request(req,fp,code,msg,headers,newurl)

def probe_direct(value):
    validate_public_url(value)
    opener = urllib.request.build_opener(SafeRedirect())
    with opener.open(urllib.request.Request(value,method='HEAD',headers={'User-Agent':f'UniFetch/{VERSION}'}),timeout=15) as response:
        mime = response.headers.get_content_type()
        ext = {'video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov'}.get(mime)
        if not ext:
            raise ValueError('This website is not supported yet. Use a YouTube video link or a direct MP4/WebM file link.')
        size = response.headers.get('Content-Length')
        return {'provider':'direct','url':value,'title':safe_name(urlparse(value).path.split('/')[-1] or 'video')+'.'+ext,'hostname':urlparse(value).hostname,'duration':None,'thumbnail':None,'formats':[{'id':'direct','label':f'{ext.upper()} · original file','ext':ext,'height':None,'filesize':int(size) if size and size.isdigit() else None}]}

def main():
    if os.name=='nt':
        import msvcrt
        msvcrt.setmode(sys.stdin.fileno(),os.O_BINARY)
        msvcrt.setmode(sys.stdout.fileno(),os.O_BINARY)
    manifest_path = ROOT / 'com.unifetch.downloader.json'
    origin = sys.argv[1] if len(sys.argv)>1 else ''
    allowed = json.loads(manifest_path.read_text(encoding='utf-8-sig')).get('allowed_origins',[]) if manifest_path.exists() else []
    if origin not in allowed:
        print('This helper must be launched by the registered UniFetch extension.',file=sys.stderr)
        return 1
    host = Host()
    try:
        while True:
            message = read_message(sys.stdin.buffer)
            if message is None:
                break
            # Bounded in practice by one inspecting UI; lightweight requests remain responsive during downloads.
            host.pool.submit(host.dispatch,message)
    except (ValueError,OSError) as error:
        print(clean_error(error),file=sys.stderr)
    finally:
        host.close()
    return 0

if __name__=='__main__':
    raise SystemExit(main())
