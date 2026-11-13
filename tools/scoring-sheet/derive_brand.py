"""Derive the existing seal's transparent background; standard-library PNG only.

The original file and the seal geometry stay unchanged. Near-white background
pixels become transparent, with a short alpha ramp at the antialiased edge.
"""
from pathlib import Path
import struct
import zlib


def rgba_png(raw):
    if not raw.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError("需要 PNG 文件")
    position, compressed = 8, bytearray()
    while position < len(raw):
        size = int.from_bytes(raw[position:position + 4], "big")
        kind, content = raw[position + 4:position + 8], raw[position + 8:position + 8 + size]
        if kind == b"IHDR":
            width, height, depth, color, compression, filtering, interlace = struct.unpack(">IIBBBBB", content)
            if depth != 8 or color not in (2, 6) or compression or filtering or interlace:
                raise ValueError("仅支持既有 RGB/RGBA 8-bit 非交错 PNG")
        elif kind == b"IDAT":
            compressed.extend(content)
        position += size + 12
    channels = 3 if color == 2 else 4
    stride = width * channels
    inflated = zlib.decompress(compressed)
    previous = bytearray(stride)
    pixels = bytearray()
    for y in range(height):
        start = y * (stride + 1)
        mode, row = inflated[start], bytearray(inflated[start + 1:start + 1 + stride])
        if mode not in range(5):
            raise ValueError("PNG 过滤方式无效")
        for x in range(stride):
            a = row[x - channels] if x >= channels else 0
            b = previous[x]
            c = previous[x - channels] if x >= channels else 0
            estimate = a + b - c
            distances = [abs(estimate - v) for v in (a, b, c)]
            predictor = (a, b, c)[distances.index(min(distances))]
            row[x] = (row[x] + (0, a, b, (a + b) // 2, predictor)[mode]) % 256
        if channels == 4:
            pixels.extend(row)
        else:
            for x in range(0, stride, 3):
                pixels.extend(row[x:x + 3] + b"\xff")
        previous = row
    return width, height, pixels


def encode(width, height, pixels):
    def chunk(kind, content):
        return struct.pack(">I", len(content)) + kind + content + struct.pack(">I", zlib.crc32(kind + content))
    rows = b"".join(b"\0" + pixels[y * width * 4:(y + 1) * width * 4] for y in range(height))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b""))


def derive(source, target):
    width, height, pixels = rgba_png(source.read_bytes())
    for i in range(0, len(pixels), 4):
        lightness = sum(pixels[i:i + 3]) / 3
        coverage = max(0, min(1, (240 - lightness) / 32))
        pixels[i + 3] = round(pixels[i + 3] * coverage)
    target.write_bytes(encode(width, height, pixels))
    return width, height


if __name__ == "__main__":
    app = Path(__file__).resolve().parent
    print(derive(app / "brand.png", app / "brand-transparent.png"))
