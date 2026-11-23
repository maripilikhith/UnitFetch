"""Generate the original UniFetch mark as PNG without image dependencies."""
from pathlib import Path
import struct
import zlib

ROOT = Path(__file__).resolve().parents[1] / 'UniFetch' / 'assets' / 'icons'
ROOT.mkdir(parents=True, exist_ok=True)
def chunk(kind, data):
    return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
for size in (16, 48, 128):
    pixels = bytearray()
    for y in range(size):
        pixels.append(0)
        for x in range(size):
            u, v = (x + .5) / size, (y + .5) / size
            radius = .22
            dx, dy = max(radius-u, 0, u-(1-radius)), max(radius-v, 0, v-(1-radius))
            inside = dx*dx+dy*dy <= radius*radius
            stem = abs(u-.5)<.042 and .22<v<.62
            arrow = .48<v<.69 and abs(abs(u-.5)-(v-.48))<.045
            cup = (.27<u<.73 and .73<v<.8) or ((.23<u<.3 or .7<u<.77) and .56<v<.76)
            pixels.extend((12,18,32,255) if stem or arrow or cup else (121,168,255,255 if inside else 0))
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size,size,8,6,0,0,0)) + chunk(b'IDAT',zlib.compress(pixels)) + chunk(b'IEND',b'')
    (ROOT / f'icon{size}.png').write_bytes(data)
