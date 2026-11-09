"""Uniform-scale reference comparisons; never warp either view to fit."""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]


def main_component(mask):
    # Reference fringe and stray opaque pixels must not set the bounding box.
    seen=np.zeros(mask.shape,bool); best=[]
    for y,x in zip(*np.where(mask)):
        if seen[y,x]: continue
        todo=[(int(y),int(x))];seen[y,x]=1;comp=[]
        while todo:
            yy,xx=todo.pop();comp.append((yy,xx))
            for dy,dx in [(0,1),(0,-1),(1,0),(-1,0)]:
                j,i=yy+dy,xx+dx
                if 0<=j<mask.shape[0] and 0<=i<mask.shape[1] and mask[j,i] and not seen[j,i]:
                    seen[j,i]=1;todo.append((j,i))
        if len(comp)>len(best):best=comp
    result=np.zeros_like(mask)
    if best:
        yy,xx=zip(*best);result[yy,xx]=True
    return result


def normalize(path):
    im=Image.open(path).convert('RGBA')
    a=np.array(im)
    mask=main_component(a[:,:,3]>127)
    yy,xx=np.where(mask)
    bounds=(int(xx.min()),int(yy.min()),int(xx.max())+1,int(yy.max())+1)
    a[:,:,3]=mask.astype('uint8')*255
    crop=Image.fromarray(a).crop(bounds)
    size=(round(crop.width*850/crop.height),850)
    crop=crop.resize(size,Image.Resampling.LANCZOS)
    canvas=Image.new('RGBA',(1000,1000),(0,0,0,0))
    canvas.alpha_composite(crop,((1000-size[0])//2,75))
    return canvas,bounds


def run():
    stats={}; panels=[]
    for view in ['front','back','side']:
        ref,bounds=normalize(ROOT/'3dtesting'/f'hawk-doctor-tpose-{view}.png')
        model,mb=normalize(HERE/f'{view}.png')
        r=np.array(ref)[:,:,3]>127;m=np.array(model)[:,:,3]>127
        iou=float((r&m).sum()/(r|m).sum())
        stats[view]={'silhouette_iou':iou,'reference_crop_px':bounds,'render_crop_px':mb,
            'alignment':'Largest opaque component, uniform height of 850 px, horizontal bounds centered; no nonuniform warp.'}
        diff=np.zeros((1000,1000,4),dtype='uint8');diff[:]=[240,242,246,255]
        diff[r&m]=[117,134,152,255];diff[r&~m]=[225,76,83,255];diff[m&~r]=[38,148,207,255]
        panel=Image.new('RGB',(1800,675),'#f1f3f7');d=ImageDraw.Draw(panel)
        for k,(im,title) in enumerate([(ref,'Reference'),(model,'Blender model'),(Image.fromarray(diff),f'Silhouette overlap: {iou:.1%}')]):
            bg=Image.new('RGBA',(1000,1000),'#f1f3f7');bg.alpha_composite(im)
            panel.paste(bg.convert('RGB').resize((600,600)),(k*600,45))
            d.text((k*600+30,18),f'{view.title()} — {title}',fill='#1b2a3b',font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',22))
        d.text((30,650),'Difference key: grey = overlap; red = reference only; blue = model only. Height aligned uniformly.',fill='#344456')
        panel.save(HERE/f'{view}_comparison.png')
        panels.append(panel)
    (HERE/'likeness.json').write_text(json.dumps(stats,indent=2)+'\n')
    print(json.dumps(stats,indent=2))

if __name__=='__main__':run()
