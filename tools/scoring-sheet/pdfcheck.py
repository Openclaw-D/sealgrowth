#!/usr/bin/env python3
"""Read local Chrome PDFs using only the standard library (not a general PDF editor).

Checks page count/MediaBox and decodes text through embedded ToUnicode CMaps.
Unsupported content raises an error instead of reporting an empty, clean PDF.
"""
import argparse
import json
from pathlib import Path
import re
import zlib


class PDFError(ValueError):
    pass


class Name(str):
    pass


class Ref(tuple):
    pass


TOKEN = re.compile(rb"\s+|%[^\r\n]*|<<|>>|[\[\]]|/[^\s<>\[\]()/%%]+|[+-]?(?:\d+\.\d*|\.\d+|\d+)|[^\s<>\[\]()/%%]+")


def tokens(raw):
    pos = 0
    while pos < len(raw):
        if raw[pos:pos+1] == b"(":
            pos += 1
            result, depth = bytearray(), 1
            while pos < len(raw) and depth:
                c = raw[pos]
                pos += 1
                if c == 92:
                    if pos >= len(raw):
                        break
                    c = raw[pos]
                    pos += 1
                    if 48 <= c <= 55:
                        octal = bytes([c])
                        for _ in range(2):
                            if pos < len(raw) and 48 <= raw[pos] <= 55:
                                octal += raw[pos:pos+1]
                                pos += 1
                        result.append(int(octal, 8) % 256)
                    elif c in (10, 13):
                        if c == 13 and raw[pos:pos+1] == b"\n":
                            pos += 1
                    else:
                        result.append({110:10,114:13,116:9,98:8,102:12}.get(c,c))
                elif c == 40:
                    depth += 1
                    result.append(c)
                elif c == 41:
                    depth -= 1
                    if depth:
                        result.append(c)
                else:
                    result.append(c)
            yield bytes(result)
        elif raw[pos:pos+1] == b"<" and raw[pos:pos+2] != b"<<":
            end = raw.find(b">", pos)
            if end < 0:
                raise PDFError("PDF 十六进制文字不完整")
            value = re.sub(rb"\s", b"", raw[pos+1:end])
            if len(value) % 2:
                value += b"0"
            yield bytes.fromhex(value.decode("ascii"))
            pos = end + 1
        else:
            match = TOKEN.match(raw, pos)
            if not match:
                raise PDFError("PDF 中有不支持的标记")
            value, pos = match[0], match.end()
            if value.isspace() or value.startswith(b"%"):
                continue
            if value.startswith(b"/"):
                yield Name(value[1:].decode("latin1"))
            elif re.fullmatch(rb"[+-]?(?:\d+\.\d*|\.\d+|\d+)", value):
                yield float(value) if b"." in value else int(value)
            else:
                yield value.decode("latin1")


def value_at(items, index=0):
    value = items[index]
    index += 1
    if value == "<<":
        result = {}
        while items[index] != ">>":
            key = items[index]
            if not isinstance(key, Name):
                raise PDFError("PDF 字典字段无效")
            result[key], index = value_at(items, index+1)
        return result, index+1
    if value == "[":
        result = []
        while items[index] != "]":
            item, index = value_at(items, index)
            result.append(item)
        return result, index+1
    if type(value) is int and index+1 < len(items) and type(items[index]) is int and items[index+1] == "R":
        return Ref((value, items[index])), index+2
    return value, index


def stream_bytes(raw):
    match = re.search(rb"\bstream\r?\n", raw)
    if not match:
        return None
    dictionary, _ = value_at(list(tokens(raw[:match.start()])))
    stream = raw[match.end():raw.rfind(b"endstream")]
    filters = dictionary.get("Filter")
    if filters == Name("FlateDecode") or filters == [Name("FlateDecode")]:
        try:
            return zlib.decompress(stream)
        except zlib.error as error:
            raise PDFError("无法解压 PDF 文字流") from error
    if filters:
        raise PDFError("PDF 流使用了非 Chrome 预期的压缩方式")
    return stream.rstrip(b"\r\n")


def cmap(raw):
    result = {}
    for block in re.findall(rb"beginbfchar(.*?)endbfchar", raw, re.S):
        for source, target in re.findall(rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", block):
            result[bytes.fromhex(source.decode())] = bytes.fromhex(target.decode()).decode("utf-16-be")
    for block in re.findall(rb"beginbfrange(.*?)endbfrange", raw, re.S):
        for match in re.finditer(rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<([0-9A-Fa-f]+)>|\[(.*?)\])", block, re.S):
            start, end = int(match[1],16), int(match[2],16)
            width = len(match[1]) // 2
            if match[4]:
                target = int(match[4],16)
                size = len(match[4]) // 2
                outputs = [(target+i-start).to_bytes(size,"big") for i in range(start,end+1)]
            else:
                outputs = [bytes.fromhex(v.decode()) for v in re.findall(rb"<([0-9A-Fa-f]+)>", match[5])]
            if len(outputs) != end-start+1:
                raise PDFError("PDF 字体映射长度不匹配")
            for source, output in zip(range(start,end+1), outputs):
                result[source.to_bytes(width,"big")] = output.decode("utf-16-be")
    return result


def decode_text(raw, mapping):
    if raw.startswith(b"\xfe\xff"):
        return raw[2:].decode("utf-16-be")
    if not mapping:
        if any(c > 127 for c in raw):
            raise PDFError("PDF 含无 ToUnicode 映射的非 ASCII 文字")
        return raw.decode("ascii")
    sizes = sorted({len(k) for k in mapping}, reverse=True)
    output, pos = [], 0
    while pos < len(raw):
        for size in sizes:
            part = raw[pos:pos+size]
            if part in mapping:
                output.append(mapping[part])
                pos += size
                break
        else:
            raise PDFError("PDF 含无法解码的字形，不能判定文字隔离通过")
    return "".join(output)


def inspect_pdf(path, expected_size=(1440,810)):
    raw = path if isinstance(path, bytes) else Path(path).read_bytes()
    if not raw.startswith(b"%PDF-"):
        raise PDFError("不是 PDF 文件")
    if b"startxref" in raw:
        from pdf_unicode import document
        objects, _ = document(raw)
    else:
        # Small inspection-only unit fixtures predate the valid-xref rewriter.
        objects = {(int(m[1]),int(m[2])):m[3].strip() for m in re.finditer(rb"(\d+)\s+(\d+)\s+obj\b(.*?)\bendobj\b", raw, re.S)}
    parsed = {}
    for key, content in objects.items():
        header = re.split(rb"\bstream\r?\n",content,maxsplit=1)[0]
        if header.startswith(b"<<"):
            parsed[key], _ = value_at(list(tokens(header)))
    if any(item.get("Type") == Name("ObjStm") for item in parsed.values()):
        raise PDFError("不支持压缩对象流；请用约定的 Chrome 生成 PDF")
    def resolve(value):
        return parsed.get(tuple(value), {}) if isinstance(value, Ref) else value
    pages = [item for item in parsed.values() if item.get("Type") == Name("Page")]
    if not pages:
        raise PDFError("未找到 PDF 页面")
    text_parts, boxes = [], []
    for page in pages:
        inherited = dict(page)
        current = page
        for _ in range(20):
            if "Parent" not in current:
                break
            current = resolve(current["Parent"])
            for key in ("MediaBox", "Resources"):
                if key not in inherited and key in current:
                    inherited[key] = current[key]
        box = resolve(inherited.get("MediaBox"))
        if not isinstance(box, list) or len(box) != 4:
            raise PDFError("PDF 缺少页面尺寸")
        boxes.append(box)
        resources = resolve(inherited.get("Resources", {}))
        fonts = resolve(resources.get("Font", {}))
        maps = {}
        for alias, font in fonts.items():
            font = resolve(font)
            mapping = font.get("ToUnicode")
            maps[alias] = cmap(stream_bytes(objects[tuple(mapping)])) if isinstance(mapping, Ref) else {}
        contents = page.get("Contents", [])
        if isinstance(contents, Ref):
            contents = [contents]
        for reference in contents:
            content = stream_bytes(objects[tuple(reference)])
            operands, active = [], None
            for token in tokens(content):
                if isinstance(token, str) and not isinstance(token, Name) and token not in ("[", "]", "<<", ">>"):
                    if token == "Tf":
                        active = operands[-2]
                    elif token in ("Tj", "'", '"', "TJ"):
                        if active is None:
                            raise PDFError("PDF 文字缺少字体")
                        for item in operands:
                            if isinstance(item, bytes):
                                text_parts.append(decode_text(item,maps.get(active,{})))
                    operands = []
                else:
                    operands.append(token)
    metadata = []
    for item in parsed.values():
        for key in ("Title", "Author", "Subject", "Keywords", "Creator", "Producer"):
            if isinstance(item.get(key), bytes):
                value = item[key]
                metadata.append(value[2:].decode("utf-16-be") if value.startswith(b"\xfe\xff") else value.decode("utf-8",errors="replace"))
        if item.get("Type") == Name("Metadata"):
            for key, candidate in parsed.items():
                if candidate is item:
                    metadata.append(stream_bytes(objects[key]).decode("utf-8",errors="replace"))
    text = "".join(text_parts)
    if not text.strip():
        raise PDFError("PDF 无可验证文字，不能判定文字隔离通过")
    return {"pages":len(pages),"boxes":boxes,
            "size_ok":all(abs((box[2]-box[0])-expected_size[0])<.5 and abs((box[3]-box[1])-expected_size[1])<.5 for box in boxes),
            "text":text,"metadata":"\n".join(metadata),"extraction_complete":True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", type=Path)
    args = parser.parse_args()
    print(json.dumps(inspect_pdf(args.file),ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, IndexError) as error:
        raise SystemExit(f"PDF 检查失败：{error}")
