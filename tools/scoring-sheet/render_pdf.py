#!/usr/bin/env python3
"""Rasterize a one-page PDF directly to 1920×1080 with macOS system frameworks.

No GUI app, capture enlargement, network, or third-party Python package is used.
"""
import argparse
import ctypes as C
from ctypes.util import find_library
import hashlib
import json
from pathlib import Path
import sys


class Point(C.Structure):
    _fields_ = [("x", C.c_double), ("y", C.c_double)]


class Size(C.Structure):
    _fields_ = [("width", C.c_double), ("height", C.c_double)]


class Rect(C.Structure):
    _fields_ = [("origin", Point), ("size", Size)]


def render(source, target, allowed_dir=None):
    if sys.platform != "darwin":
        raise ValueError("此 PDF 渲染辅助脚本需要 macOS 系统框架")
    import build
    build.inside(target, allowed_dir if allowed_dir is not None else build.QA)
    cf=C.CDLL(find_library("CoreFoundation"))
    cg=C.CDLL(find_library("CoreGraphics"))
    imageio=C.CDLL(find_library("ImageIO"))
    def api(lib,name,result,args):
        function=getattr(lib,name); function.restype=result; function.argtypes=args
        return function
    ptr=C.c_void_p; size=C.c_size_t; double=C.c_double
    url=api(cf,"CFURLCreateFromFileSystemRepresentation",ptr,[ptr,C.c_char_p,C.c_long,C.c_bool])
    string=api(cf,"CFStringCreateWithCString",ptr,[ptr,C.c_char_p,C.c_uint32])
    release=api(cf,"CFRelease",None,[ptr])
    document=api(cg,"CGPDFDocumentCreateWithURL",ptr,[ptr])
    count=api(cg,"CGPDFDocumentGetNumberOfPages",size,[ptr])
    page_at=api(cg,"CGPDFDocumentGetPage",ptr,[ptr,size])
    box_at=api(cg,"CGPDFPageGetBoxRect",Rect,[ptr,C.c_int])
    color_space=api(cg,"CGColorSpaceCreateDeviceRGB",ptr,[])
    context=api(cg,"CGBitmapContextCreate",ptr,[ptr,size,size,size,size,ptr,C.c_uint32])
    set_fill=api(cg,"CGContextSetRGBFillColor",None,[ptr,double,double,double,double])
    fill=api(cg,"CGContextFillRect",None,[ptr,Rect])
    scale=api(cg,"CGContextScaleCTM",None,[ptr,double,double])
    translate=api(cg,"CGContextTranslateCTM",None,[ptr,double,double])
    draw=api(cg,"CGContextDrawPDFPage",None,[ptr,ptr])
    image=api(cg,"CGBitmapContextCreateImage",ptr,[ptr])
    destination=api(imageio,"CGImageDestinationCreateWithURL",ptr,[ptr,ptr,size,ptr])
    add=api(imageio,"CGImageDestinationAddImage",None,[ptr,ptr,ptr])
    finish=api(imageio,"CGImageDestinationFinalize",C.c_bool,[ptr])
    document_release=api(cg,"CGPDFDocumentRelease",None,[ptr])
    space_release=api(cg,"CGColorSpaceRelease",None,[ptr])
    context_release=api(cg,"CGContextRelease",None,[ptr])
    image_release=api(cg,"CGImageRelease",None,[ptr])
    refs=[]
    def keep(value,releaser=release):
        if not value: raise ValueError("系统 PDF 渲染器未创建所需对象")
        refs.append((value,releaser)); return value
    try:
        raw=str(source.resolve()).encode(); src_url=keep(url(None,raw,len(raw),False))
        doc=keep(document(src_url),document_release)
        if count(doc)!=1: raise ValueError("PDF 必须为一页")
        page=page_at(doc,1); box=box_at(page,0)
        width, height = round(box.size.width*4/3), round(box.size.height*4/3)
        if width<=0 or height<=0 or width>20000 or height>50000: raise ValueError("PDF 尺寸超出栅格化范围")
        space=keep(color_space(),space_release); pixels=C.create_string_buffer(width*height*4)
        bitmap=keep(context(pixels,width,height,8,width*4,space,1),context_release)
        set_fill(bitmap,1,1,1,1); fill(bitmap,Rect(Point(0,0),Size(width,height)))
        scale(bitmap,width/box.size.width,height/box.size.height)
        translate(bitmap,-box.origin.x,-box.origin.y); draw(bitmap,page)
        pixel_sha256 = hashlib.sha256(pixels.raw).hexdigest()
        rendered=keep(image(bitmap),image_release)
        target.parent.mkdir(parents=True,exist_ok=True)
        raw=str(target.resolve()).encode(); dst_url=keep(url(None,raw,len(raw),False))
        png_type=keep(string(None,b"public.png",0x08000100))
        dest=keep(destination(dst_url,png_type,1,None)); add(dest,rendered,None)
        if not finish(dest): raise ValueError("无法写入 PDF 栅格预览")
    finally:
        for value,releaser in reversed(refs): releaser(value)
    return {"path":str(target),"width":width,"height":height,"pixel_sha256":pixel_sha256,
            "method":"CoreGraphics direct PDF rasterization"}


if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf",type=Path); parser.add_argument("png",type=Path)
    args=parser.parse_args()
    try:
        print(json.dumps(render(args.pdf,args.png),ensure_ascii=False))
    except (OSError,ValueError) as error:
        raise SystemExit(f"PDF 渲染失败：{error}")
