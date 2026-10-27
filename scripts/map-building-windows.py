# Regenerate with: python3 scripts/map-building-windows.py
# Requires NumPy. The committed JSON is the runtime catalog; the game and
# buildingsheet do not need Python or NumPy.
import json,struct,numpy as np,collections,sys
GROUPS=[('small','suburban',[f'building-type-{c}' for c in 'abcdefghijklmnopqrstu']),
        ('large','commercial',[f'building-{c}' for c in 'abcdefghijklmn']+[f'building-skyscraper-{c}' for c in 'abcde']+
         [f'low-detail-building-{c}' for c in 'abcdefghijklmn']+[f'low-detail-building-wide-{c}' for c in 'ab']),
        ('industrial','industrial',[f'building-{c}' for c in 'abcdefghijklmnopqrst'])]
def load(path):
 d=open(path,'rb').read();n=struct.unpack_from('<I',d,12)[0];j=json.loads(d[20:20+n]);base=20+n+8
 def acc(i):
  a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];typ={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];dt={5126:'<f4',5121:'<u1',5123:'<u2',5125:'<u4'}[a['componentType']];off=base+v.get('byteOffset',0)+a.get('byteOffset',0);return np.frombuffer(d,dtype=dt,count=a['count']*typ,offset=off).reshape(-1,typ)
 for prim in j['meshes'][0]['primitives']:
  at=prim['attributes'];P=acc(at['POSITION']);UV=acc(at['TEXCOORD_0']);I=acc(prim['indices']).ravel();T=P[I].reshape(-1,3,3);uv=UV[I].reshape(-1,3,2).mean(axis=1);cross=np.cross(T[:,1]-T[:,0],T[:,2]-T[:,0]);A=np.linalg.norm(cross,axis=1)/2;N=cross/(2*A[:,None]+1e-15)
  yield T,uv,N,A

def swatch(pack,u,v):
 if pack=='industrial':return ('light' if .53<u<.66 and .82<v<1.0 else None)
 return ('light' if .65<u<.78 and .25<v<.51 else 'dark' if .53<u<.65 and .25<v<.51 else None)

def overlap(a,b,delta):
 return a[0]<=b[1]+delta and b[0]<=a[1]+delta and a[2]<=b[3]+delta and b[2]<=a[3]+delta

def generate(pack,name):
 T0=[];UV0=[];N0=[];A0=[]
 for T,UV,N,A in load(f'public/assets/{pack}/{name}.glb'):T0.append(T);UV0.append(UV);N0.append(N);A0.append(A)
 T=np.concatenate(T0);UV=np.concatenate(UV0);N=np.concatenate(N0);A=np.concatenate(A0);size=T.max(axis=(0,1))-T.min(axis=(0,1));c=T.mean(axis=1)
 candidates=[]
 for i,(uv,n,a,t) in enumerate(zip(UV,N,A,T)):
  kind=swatch(pack,*uv)
  if not kind or a<1e-6:continue
  ax=np.argmax(abs(n));
  if ax==1 or abs(n[ax])<.95:continue
  sign='+' if n[ax]>0 else '-';side=sign+('X' if ax==0 else 'Z');uAxis=2 if ax==0 else 0
  p=(float(t[:,uAxis].min()),float(t[:,uAxis].max()),float(t[:,1].min()),float(t[:,1].max()))
  if p[1]-p[0]<1e-5 or p[3]-p[2]<1e-5:continue
  candidates.append((side,round(float(c[i,ax]),3),kind,p))
 # connect coplanar same swatch triangles (for each pane), then nearby panes into one window
 clusters=[]
 for key in sorted(set((side,plane,kind) for side,plane,kind,p in candidates)):
  parts=[p for side,plane,kind,p in candidates if (side,plane,kind)==key]
  roots=list(range(len(parts)))
  def find(i):
   while roots[i]!=i:roots[i]=roots[roots[i]];i=roots[i]
   return i
  for i in range(len(parts)):
   for j in range(i):
    a,b=parts[i],parts[j]
    # A mullion between adjacent panes is generally less than 25% of a pane width.
    delta=min(a[1]-a[0],a[3]-a[2],b[1]-b[0],b[3]-b[2])*.28
    if overlap(a,b,delta):roots[find(i)]=find(j)
  groups=collections.defaultdict(list)
  for i,p in enumerate(parts):groups[find(i)].append(p)
  for ps in groups.values():
   b=(min(p[0] for p in ps),max(p[1] for p in ps),min(p[2] for p in ps),max(p[3] for p in ps))
   if (b[1]-b[0])*(b[3]-b[2]) < size[0]*size[1]*.00013:continue
   clusters.append((*key,b,len(ps)))
 if pack=='commercial' and name=='building-skyscraper-e':
  # Its green side window uses the roof/green atlas swatch, so the generic
  # blue-glass classifier deliberately leaves it for this explicit entry.
  clusters.append(('-X',-.585,'green',(-.25,.248,2.051,3.549),2))
 return size,sorted(clusters,key=lambda c:({'+Z':0,'+X':1,'-Z':2,'-X':3}[c[0]],-c[3][2],c[3][0]))

def split_skyscraper(name, cluster):
 side, plane, kind, (x0,x1,y0,y1), count = cluster
 if kind != 'light' or not name.startswith('building-skyscraper-') or y1-y0 < 1: return [cluster]
 suffix=name[-1]
 if suffix in 'ab': start, step, bar = 1.106, .347, .04
 elif suffix in 'cd': start, step, bar = 1.334, .3555, .04
 else: start, step, bar = 1.158, .3835, .05
 intervals=[]; low=y0; i=0
 while start+i*step < y1:
  bar_start=start+i*step
  if bar_start>low+.025: intervals.append((low,bar_start))
  low=bar_start+bar
  i+=1
 if y1>low+.025: intervals.append((low,y1))
 return [(side,plane,kind,(x0,x1,a,b),count) for a,b in intervals]

def serialize(type_id, cluster, index):
 side,plane,kind,(u0,u1,y0,y1),_=cluster
 pad_u=min((u1-u0)*.04,.012);pad_y=min((y1-y0)*.04,.012)
 u0-=pad_u;u1+=pad_u;y0-=pad_y;y1+=pad_y
 if side.endswith('Z'):
  corners=[[u0,y0,plane],[u1,y0,plane],[u1,y1,plane],[u0,y1,plane]]
  center=[(u0+u1)/2,(y0+y1)/2,plane]
 else:
  corners=[[plane,y0,u0],[plane,y0,u1],[plane,y1,u1],[plane,y1,u0]]
  center=[plane,(y0+y1)/2,(u0+u1)/2]
 return {'id':f'{type_id}-W{index:02d}', 'side':side,
         'center':[round(float(v),5) for v in center],
         'width':round(u1-u0,5),'height':round(y1-y0,5),
         'corners':[[round(float(v),5) for v in p] for p in corners]}

def main():
 result={}
 for group_index,(group,pack,names) in enumerate(GROUPS,1):
  for type_index,name in enumerate(names,1):
   type_id=f'B{group_index}-{type_index:02d}'
   _,clusters=generate(pack,name)
   expanded=[part for cluster in clusters for part in split_skyscraper(name,cluster)]
   # Number from top to bottom, then left to right as seen from each face.
   visual_sign={'+Z':1,'+X':-1,'-Z':-1,'-X':1}
   expanded.sort(key=lambda c:({'+Z':0,'+X':1,'-Z':2,'-X':3}[c[0]],-c[3][2],visual_sign[c[0]]*c[3][0]))
   result[f'{pack}/{name}']=[serialize(type_id,c,i) for i,c in enumerate(expanded,1)]
 with open('src/building-windows.json','w') as output:
  json.dump(result,output,indent=2)
  output.write('\n')
 print(f'Mapped {sum(map(len,result.values()))} windows across {len(result)} building types.')

if __name__=='__main__':main()
