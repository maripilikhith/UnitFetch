"""Download official portable dependencies. No PATH changes or admin rights required."""
import hashlib
import io
import json
from pathlib import Path
import urllib.request
import zipfile
import subprocess
import sys
from version import VERSION

ROOT = Path(__file__).resolve().parent
BIN = ROOT / 'bin'
BIN.mkdir(parents=True, exist_ok=True)
HEADERS = {'User-Agent': f'UniFetch-local-setup/{VERSION}'}
def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=90) as response:
        return response.read()

def install(repo, asset_name, files):
    if all((BIN / name).is_file() for name in files):
        print(f'{repo}: already present', flush=True)
        return
    release = json.loads(fetch(f'https://api.github.com/repos/{repo}/releases/latest'))
    asset = next((a for a in release['assets'] if a['name'] == asset_name), None)
    if not asset:
        raise RuntimeError(f'Expected asset {asset_name} missing from {repo}')
    print(f'Downloading {repo} {release["tag_name"]}: {asset_name}', flush=True)
    data = fetch(asset['browser_download_url'])
    digest = hashlib.sha256(data).hexdigest()
    expected = asset.get('digest')
    if expected and expected != 'sha256:' + digest:
        raise RuntimeError('Release checksum did not match')
    if asset_name.endswith('.zip'):
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            for filename in files:
                matches = [n for n in archive.namelist() if n.split('/')[-1] == filename]
                if len(matches) != 1:
                    raise RuntimeError(f'Ambiguous or missing {filename}')
                (BIN / filename).write_bytes(archive.read(matches[0]))
    else:
        (BIN / files[0]).write_bytes(data)
    record = {'repository': repo, 'version': release['tag_name'], 'url': asset['browser_download_url'], 'sha256': digest, 'verified_release_digest': bool(expected)}
    (BIN / (files[0] + '.source.json')).write_text(json.dumps(record, indent=2), encoding='utf-8')
    print(f'Installed {", ".join(files)}', flush=True)

if __name__ == '__main__':
    if not (ROOT/'vendor'/'yt_dlp'/'__init__.py').is_file() or not (ROOT/'vendor'/'yt_dlp_ejs').is_dir():
        subprocess.run([sys.executable,'-m','pip','install','--disable-pip-version-check','--no-deps','--target',str(ROOT/'vendor'),'yt-dlp==2026.10.26','yt-dlp-ejs==0.8.0'],check=True)
    install('denoland/deno', 'deno-x86_64-pc-windows-msvc.zip', ['deno.exe'])
    install('yt-dlp/FFmpeg-Builds', 'ffmpeg-master-latest-win64-gpl.zip', ['ffmpeg.exe'])
