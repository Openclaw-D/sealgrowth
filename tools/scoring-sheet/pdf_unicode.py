"""Repair Skia ToUnicode radicals, without touching any painted glyph/content.

Only fresh Chrome PDFs with a classic xref are supported. A full rewrite keeps
all object numbers/generations, emits new stream lengths and recomputes xref
offsets. Unsupported PDF structures fail closed. Python standard library only.
"""
from pathlib import Path
from functools import lru_cache
import re
import zlib

from pdfcheck import PDFError, Name, Ref, cmap, stream_bytes, tokens, value_at

TABLE = Path(__file__).with_name("EquivalentUnifiedIdeograph-18.0.0.txt")


@lru_cache(maxsize=1)
def equivalents():
    result = {}
    for line in TABLE.read_text(encoding="utf-8").splitlines():
        fields = line.split("#", 1)[0].strip()
        if not fields:
            continue
        source, target = (field.strip() for field in fields.split(";"))
        bounds = source.split("..")
        for code in range(int(bounds[0], 16), int(bounds[-1], 16) + 1):
            if 0x2E80 <= code <= 0x2FDF:
                result[code] = int(target, 16)
    return result


def normalize(value, preserve=()):
    """Equivalent_Unified_Ideograph, restricted to the contracted radical block.

    Privacy comparisons deliberately pass no exclusions; a public radical must
    not provide an escape hatch for an internal sentence in text or metadata.
    """
    excluded = set(preserve)
    mapping = {source: target for source, target in equivalents().items()
               if chr(source) not in excluded}
    return value.translate(mapping)


def radicals(value):
    return {char for char in value if 0x2E80 <= ord(char) <= 0x2FDF}


def document(raw):
    """Read xref offsets, not regex-delimited binary streams."""
    if not raw.startswith(b"%PDF-"):
        raise PDFError("不是 PDF 文件")
    endings = list(re.finditer(rb"startxref\s+(\d+)\s+%%EOF", raw))
    if not endings:
        raise PDFError("PDF 缺少 startxref，不能安全重写")
    xref = int(endings[-1][1])
    if raw[xref:xref + 4] != b"xref":
        raise PDFError("仅支持 Chrome 的传统 xref；不支持压缩对象表")
    tail = raw[xref + 4:]
    marker = re.search(rb"\btrailer\b", tail)
    if not marker:
        raise PDFError("PDF 缺少 trailer")
    lines = iter(tail[:marker.start()].splitlines())
    entries = {}
    for line in lines:
        if not line.strip():
            continue
        header = re.fullmatch(rb"\s*(\d+)\s+(\d+)\s*", line)
        if not header:
            raise PDFError("PDF xref 分段无效")
        start, count = map(int, header.groups())
        for number in range(start, start + count):
            entry = re.fullmatch(rb"\s*(\d+)\s+(\d+)\s+([nf])\s*", next(lines, b""))
            if not entry:
                raise PDFError("PDF xref 条目无效")
            if entry[3] == b"n":
                if number in entries:
                    raise PDFError("PDF xref 对象重复")
                entries[number] = (int(entry[1]), int(entry[2]))
    trailer, _ = value_at(list(tokens(tail[marker.end():])))
    if any(key in trailer for key in ("Prev", "XRefStm", "Encrypt")):
        raise PDFError("不支持增量、混合或加密 PDF")
    ordered = sorted((offset, number, generation) for number, (offset, generation) in entries.items())
    objects = {}
    for i, (offset, number, generation) in enumerate(ordered):
        end = ordered[i + 1][0] if i + 1 < len(ordered) else xref
        segment = raw[offset:end].strip()
        header = re.match(rb"(\d+)\s+(\d+)\s+obj\b", segment)
        if not header or (int(header[1]), int(header[2])) != (number, generation) or not segment.endswith(b"endobj"):
            raise PDFError("PDF xref 与对象位置不符")
        objects[(number, generation)] = segment[header.end():-6].strip()
    if not isinstance(trailer.get("Root"), Ref) or tuple(trailer["Root"]) not in objects:
        raise PDFError("PDF 缺少有效 Root")
    return objects, trailer


def serialize(value):
    if isinstance(value, Name):
        name = value.encode("latin1")
        return b"/" + b"".join(bytes([c]) if 33 <= c <= 126 and c not in b"#%()/<>[]{}" else f"#{c:02X}".encode() for c in name)
    if isinstance(value, Ref):
        return f"{value[0]} {value[1]} R".encode()
    if isinstance(value, dict):
        return b"<< " + b" ".join(serialize(Name(key)) + b" " + serialize(item) for key, item in value.items()) + b" >>"
    if isinstance(value, list):
        return b"[" + b" ".join(map(serialize, value)) + b"]"
    if isinstance(value, bytes):
        return b"<" + value.hex().upper().encode() + b">"
    if type(value) in (int, float):
        return str(value).encode("ascii")
    if value in ("true", "false", "null"):
        return value.encode("ascii")
    raise PDFError("PDF 含无法安全写出的字典值")


def rewrite(objects, trailer):
    result = bytearray(b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n")
    offsets = {}
    for key, body in sorted(objects.items()):
        offsets[key[0]] = (len(result), key[1])
        result.extend(f"{key[0]} {key[1]} obj\n".encode() + body + b"\nendobj\n")
    xref = len(result)
    size = max(offsets, default=0) + 1
    free = [number for number in range(1, size) if number not in offsets]
    following = dict(zip(free, free[1:] + [0]))
    result.extend(f"xref\n0 {size}\n{free[0] if free else 0:010d} 65535 f \n".encode())
    for number in range(1, size):
        if number in offsets:
            offset, generation = offsets[number]
            result.extend(f"{offset:010d} {generation:05d} n \n".encode())
        else:
            result.extend(f"{following[number]:010d} 00000 f \n".encode())
    trailer = dict(trailer, Size=size)
    result.extend(b"trailer\n" + serialize(trailer) + b"\nstartxref\n" + str(xref).encode() + b"\n%%EOF\n")
    return bytes(result)


def repair_cmap(raw, preserve=()):
    mapping = cmap(raw)
    changed = {source: normalize(target, preserve) for source, target in mapping.items()}
    count = sum(changed[source] != target for source, target in mapping.items())
    if not count:
        return raw, 0
    # Expanding bfrange into bfchar also handles non-consecutive replacements,
    # array targets, multi-character values and supplementary unified ideographs.
    pairs = list(sorted(changed.items()))
    blocks = []
    for i in range(0, len(pairs), 100):
        group = pairs[i:i + 100]
        blocks.append(str(len(group)).encode() + b" beginbfchar\n" + b"\n".join(
            b"<" + source.hex().upper().encode() + b"> <" + target.encode("utf-16-be").hex().upper().encode() + b">"
            for source, target in group) + b"\nendbfchar")
    replacement = b"\n".join(blocks)
    pattern = rb"\d+\s+beginbfchar\b.*?\bendbfchar\b|\d+\s+beginbfrange\b.*?\bendbfrange\b"
    matches = list(re.finditer(pattern, raw, re.S))
    if not matches:
        raise PDFError("ToUnicode 映射未找到可重写定义")
    result = raw[:matches[0].start()] + replacement
    position = matches[0].end()
    for match in matches[1:]:
        result += raw[position:match.start()]
        position = match.end()
    result += raw[position:]
    if cmap(result) != changed:
        raise PDFError("ToUnicode 重写后的映射核验失败")
    return result, count


def repair_pdf(raw, public_text):
    objects, trailer = document(raw)
    references = set()
    for body in objects.values():
        header = re.split(rb"\bstream\r?\n", body, maxsplit=1)[0]
        if not header.startswith(b"<<"):
            continue
        dictionary, _ = value_at(list(tokens(header)))
        if dictionary.get("Type") == Name("ObjStm"):
            raise PDFError("不支持压缩对象流")
        if isinstance(dictionary.get("ToUnicode"), Ref):
            references.add(tuple(dictionary["ToUnicode"]))
    preserved = radicals(public_text)
    changed_streams = changed_glyphs = 0
    for key in sorted(references):
        if key not in objects:
            raise PDFError("ToUnicode 引用了缺失的对象")
        body = objects[key]
        decoded = stream_bytes(body)
        if decoded is None:
            raise PDFError("ToUnicode 不是有效数据流")
        fixed, count = repair_cmap(decoded, preserved)
        if not count:
            continue
        header = re.split(rb"\bstream\r?\n", body, maxsplit=1)[0]
        dictionary, _ = value_at(list(tokens(header)))
        if dictionary.get("DecodeParms"):
            raise PDFError("不支持带预测参数的 ToUnicode 流")
        compressed = zlib.compress(fixed)
        dictionary.update(Length=len(compressed), Filter=Name("FlateDecode"))
        objects[key] = serialize(dictionary) + b"\nstream\n" + compressed + b"\nendstream"
        changed_streams += 1
        changed_glyphs += count
    result = rewrite(objects, trailer) if changed_streams else raw
    # Parse our actual xref again; a stale offset cannot pass by regex extraction.
    reread, _ = document(result)
    if reread != objects:
        raise PDFError("PDF 重写后的 xref/对象核验失败")
    return result, {"cmap_streams": len(references), "changed_streams": changed_streams,
                    "changed_glyphs": changed_glyphs,
                    "preserved_public_radicals": sorted(f"U+{ord(c):04X}" for c in preserved)}
