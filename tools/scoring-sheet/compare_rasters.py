"""Compare rendered pixels (never PDF bytes), allowing rasterizer antialiasing.

Reports dimensions, RGBA mean error and 4px block-mean error. The block gate
penalises missing/reflowed content while tolerating font edge raster differences.
"""
import argparse
import json
from pathlib import Path
from derive_brand import rgba_png


def compare(first, second):
    width,height,a=rgba_png(Path(first).read_bytes())
    w,h,b=rgba_png(Path(second).read_bytes())
    if (width,height)!=(w,h):
        return {'pass':False,'first':[width,height],'second':[w,h],'reason':'图像尺寸不同'}
    error=0;changed=0;blocks=0;block_error=0;large=0
    for y in range(0,height,4):
        for x in range(0,width,4):
            sums=[0,0,0];count=0
            for yy in range(y,min(y+4,height)):
                for xx in range(x,min(x+4,width)):
                    i=(yy*width+xx)*4;count+=1
                    delta=[int(a[i+k])-int(b[i+k]) for k in range(3)]
                    error+=sum(abs(n) for n in delta)
                    changed+=int(any(abs(n)>16 for n in delta))
                    for k in range(3):sums[k]+=delta[k]
            cell=sum(abs(n/count) for n in sums)/3
            block_error+=cell;large+=int(cell>32);blocks+=1
    mae=error/(width*height*3);block_mae=block_error/blocks;large_fraction=large/blocks
    return {'pass':mae<=10 and block_mae<=7 and large_fraction<=.06,
            'width':width,'height':height,'mean_absolute_error_255':mae,
            'block_mean_error_255':block_mae,'large_block_fraction':large_fraction,
            'changed_pixel_fraction':changed/(width*height),
            'limits':{'mean':10,'block_mean':7,'large_block_fraction':.06}}


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('first',type=Path);parser.add_argument('second',type=Path)
    args=parser.parse_args();result=compare(args.first,args.second)
    print(json.dumps(result,ensure_ascii=False))
    if not result['pass']:raise SystemExit(1)
