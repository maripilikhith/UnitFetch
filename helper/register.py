"""Register only the current user's UniFetch native host; no administrator rights."""
import base64
import hashlib
import json
from pathlib import Path
import sys
import winreg

ROOT = Path(__file__).resolve().parent
MANIFEST = ROOT.parent / 'UniFetch' / 'manifest.json'
KEYS = [r'Software\Google\Chrome\NativeMessagingHosts\com.unifetch.downloader',r'Software\Google\ChromeForTesting\NativeMessagingHosts\com.unifetch.downloader',r'Software\Chromium\NativeMessagingHosts\com.unifetch.downloader']

def extension_id(key):
    digest=hashlib.sha256(base64.b64decode(key)).hexdigest()[:32]
    return ''.join(chr(ord('a')+int(c,16)) for c in digest)

def register():
    config=json.loads(MANIFEST.read_text(encoding='utf-8'));identifier=extension_id(config['key'])
    launcher=ROOT/'host.bat';launcher.write_text(f'@echo off\n"{sys.executable}" -u "%~dp0host.py" %*\n',encoding='utf-8')
    native_manifest=ROOT/'com.unifetch.downloader.json'
    native_manifest.write_text(json.dumps({'name':'com.unifetch.downloader','description':'UniFetch local video download helper','path':str(launcher),'type':'stdio','allowed_origins':[f'chrome-extension://{identifier}/']},indent=2),encoding='utf-8')
    for registry_path in KEYS:
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER,registry_path) as key: winreg.SetValueEx(key,'',0,winreg.REG_SZ,str(native_manifest))
    print(f'Registered UniFetch helper for extension {identifier}');print(f'Load unpacked: {MANIFEST.parent}')

def unregister():
    target=str(ROOT/'com.unifetch.downloader.json')
    for registry_path in KEYS:
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER,registry_path) as key: current=winreg.QueryValueEx(key,'')[0]
            if current==target: winreg.DeleteKey(winreg.HKEY_CURRENT_USER,registry_path)
        except FileNotFoundError: pass
    print('UniFetch helper registration removed. Downloaded videos were kept.')

if __name__=='__main__':
    unregister() if '--uninstall' in sys.argv else register()
