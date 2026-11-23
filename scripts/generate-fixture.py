"""Create an original three-second video/audio fixture for browser tests."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'test-results'
OUTPUT.mkdir(exist_ok=True)
subprocess.run([
    str(ROOT / 'helper' / 'bin' / 'ffmpeg.exe'),
    '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=24',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
    '-t', '3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-movflags', '+faststart', '-y',
    str(OUTPUT / 'fixture.mp4')
], check=True, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
print('Created test-results/fixture.mp4')
