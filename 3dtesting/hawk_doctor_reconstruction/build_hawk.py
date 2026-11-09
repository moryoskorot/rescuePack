"""Reference-guided solid reconstruction. Run via Blender MCP, or Blender --python.

Coordinates: +Z up, -Y face, +X character left. Front image landmarks are
normalized by its 1,154-pixel character height. Physical height is set to the
300 mm target documented in bunny_firefighter_package/README.txt.
The original Hawk_Doctor_Rig and any other open scene remain untouched.
"""
from pathlib import Path
import math, json
import numpy as np
import bpy, bmesh
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '3dtesting/hawk_doctor_reconstruction'
OUT.mkdir(exist_ok=True)
HEIGHT = .300  # 300 mm target from bunny_firefighter_package/README.txt


def material(name, rgb, rough=.48):
    m = bpy.data.materials.new('HD • ' + name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Specular IOR Level'].default_value = .20
    return m


def mesh(name, verts, faces, mat, sub=0):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces)); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); CHAR.objects.link(o)
    o.data.materials.append(mat)
    for p in me.polygons: p.use_smooth = True
    if sub:
        mod = o.modifiers.new('Silhouette smoothing', 'SUBSURF'); mod.levels = sub; mod.render_levels = sub
    return o


def assign(o, name, mat):
    o.name = name
    for c in list(o.users_collection): c.objects.unlink(o)
    CHAR.objects.link(o)
    o.data.materials.append(mat)
    if hasattr(o.data, 'polygons'):
        for p in o.data.polygons: p.use_smooth = True
    return o


def ellipsoid(name, loc, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=40, location=loc)
    o = assign(bpy.context.object, name, mat); o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return o


def box(name, loc, dims, mat, bevel=.01):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = assign(bpy.context.object, name, mat); o.scale = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    b = o.modifiers.new('Soft sewn edges', 'BEVEL'); b.width=bevel; b.segments=5
    n = o.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
    return o


def spline(points, steps=6, closed=True):
    pts = [Vector(p) for p in points]; result=[]
    count=len(pts) if closed else len(pts)-1
    for i in range(count):
        a=pts[(i-1)%len(pts)] if closed or i else pts[0]
        b=pts[i]; c=pts[(i+1)%len(pts)]
        d=pts[(i+2)%len(pts)] if closed or i+2<len(pts) else pts[-1]
        for j in range(steps):
            t=j/steps
            result.append(tuple(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)))
    if not closed: result.append(tuple(pts[-1]))
    return result


def tube(name, pts, radius, mat, closed=False):
    cu=bpy.data.curves.new(name, 'CURVE'); cu.dimensions='3D'
    cu.resolution_u=16; cu.bevel_depth=radius; cu.bevel_resolution=5; cu.use_fill_caps=True
    sp=cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts)-1)
    for b,p in zip(sp.bezier_points,pts):
        b.co=p; b.handle_left_type='AUTO'; b.handle_right_type='AUTO'
    sp.use_cyclic_u=closed
    o=bpy.data.objects.new(name,cu); CHAR.objects.link(o); cu.materials.append(mat)
    return o


def dome(name, loc, scale, mat):
    vs=[]; fs=[]; n=64; rows=20
    # Domed upper surface with a flat sole, suitable for rounded toy toes.
    for j in range(rows):
        a=(j+.5)/rows*math.pi/2
        for i in range(n):
            t=i*math.pi*2/n
            vs.append((loc[0]+scale[0]*math.sin(a)*math.cos(t),loc[1]+scale[1]*math.sin(a)*math.sin(t),loc[2]+scale[2]*math.cos(a)))
    top=len(vs); vs.append((loc[0],loc[1],loc[2]+scale[2]))
    for j in range(rows-1):
        for i in range(n):
            k=j*n+i; l=j*n+(i+1)%n; fs.append((k,l,l+n,k+n))
    for i in range(n): fs.append((top,i,(i+1)%n))
    # Last ring is lowered onto the sole before closing it.
    for i in range(n):
        p=list(vs[(rows-1)*n+i]); p[2]=loc[2]; vs[(rows-1)*n+i]=tuple(p)
    fs.append(tuple((rows-1)*n+i for i in reversed(range(n))))
    return mesh(name,vs,fs,mat)


def feather_leaf(name, root, tip, width, thickness, mat):
    root=Vector(root); tip=Vector(tip); direction=(tip-root).normalized()
    u=(Vector((1,0,0))-direction*direction.x).normalized(); v=direction.cross(u).normalized(); vs=[]; fs=[]; n=48; rows=32
    for j in range(1,rows):
        t=j/rows; c=root.lerp(tip,t)
        c.y+=.018*math.sin(math.pi*t)
        r=math.sin(math.pi*t)**.78
        for i in range(n):
            a=i*2*math.pi/n
            p=c+u*(width*r*math.cos(a))+v*(thickness*r*math.sin(a))
            vs.append(tuple(p))
    for j in range(rows-2):
        for i in range(n):
            k=j*n+i; l=j*n+(i+1)%n; fs.append((k,l,l+n,k+n))
    a=len(vs);vs.extend([tuple(root),tuple(tip)])
    for i in range(n):
        fs.append((a,(i+1)%n,i)); k=(rows-2)*n;fs.append((a+1,k+i,k+(i+1)%n))
    return mesh(name,vs,fs,mat,1)


def P(px,py): return ((px-597)/1154, (1230-py)/1154)


def pillow(name, outline, center, yedge, frontdepth, backdepth, mat, rings=20, steps=5):
    """Watertight rounded volume following an arbitrary XZ contour.
    The rim may sweep in depth. Full front/back curved surfaces, not cards.
    """
    contour=spline(outline,steps); n=len(contour); verts=[]; faces=[]
    cx,cz=center
    # Sphere latitude distribution avoids a pinch at the perimeter.
    for j in range(1,2*rings):
        ang=math.pi*j/(2*rings)
        r=math.sin(ang); side=-1 if ang<math.pi/2 else 1
        bulge=abs(math.cos(ang))
        for x,z in contour:
            xx=cx+(x-cx)*r; zz=cz+(z-cz)*r
            ey=yedge(xx,zz,r) if callable(yedge) else yedge
            depth=frontdepth if side<0 else backdepth
            verts.append((xx, ey+side*depth*bulge, zz))
    a=len(verts); ey=yedge(cx,cz,0) if callable(yedge) else yedge
    verts.extend([(cx,ey-frontdepth,cz),(cx,ey+backdepth,cz)])
    for j in range(2*rings-2):
        for i in range(n):
            k=j*n+i; l=j*n+(i+1)%n
            faces.append((k,l,l+n,k+n))
    for i in range(n):
        faces.append((a,(i+1)%n,i))
        k=(2*rings-2)*n; faces.append((a+1,k+i,k+(i+1)%n))
    return mesh(name,verts,faces,mat)


def inflated_contour(name, outline, yedge, frontdepth, backdepth, mat, h=.0025):
    """Inflate a planar silhouette with a Poisson field, avoiding radial folds.
    Opposing faces share their boundary vertices: this is a closed solid mesh.
    """
    contour=np.array(spline(outline,6))
    xs=np.arange(contour[:,0].min()-h,contour[:,0].max()+2*h,h)
    zs=np.arange(contour[:,1].min()-h,contour[:,1].max()+2*h,h)
    X,Z=np.meshgrid(xs,zs); inside=np.zeros(X.shape,dtype=bool)
    for a,b in zip(contour,np.roll(contour,-1,axis=0)):
        if abs(b[1]-a[1])<1e-12: continue
        inside^=((a[1]>Z)!=(b[1]>Z)) & (X<(b[0]-a[0])*(Z-a[1])/(b[1]-a[1])+a[0])
    # A source term produces softly inflated feathers while retaining the outline.
    phi=np.zeros(X.shape)
    base=yedge(X,Z)
    base=np.array(base)+np.zeros(X.shape)
    fixed=base.copy()
    for it in range(4800):
        nxt=(np.roll(phi,1,0)+np.roll(phi,-1,0)+np.roll(phi,1,1)+np.roll(phi,-1,1)+h*h)*.25
        phi=np.where(inside,nxt,0)
        if it<2400:
            avg=(np.roll(base,1,0)+np.roll(base,-1,0)+np.roll(base,1,1)+np.roll(base,-1,1))*.25
            base=np.where(inside,avg,fixed)
    cells=inside[:-1,:-1]&inside[1:,:-1]&inside[:-1,1:]&inside[1:,1:]
    edges={}; used=set()
    quads=[]
    for j,i in zip(*np.where(cells)):
        q=[(j,i),(j,i+1),(j+1,i+1),(j+1,i)]; quads.append(q)
        used.update(q)
        for a,b in zip(q,q[1:]+q[:1]):
            k=tuple(sorted((a,b))); edges[k]=edges.get(k,0)+1
    boundary=set(p for e,n in edges.items() if n==1 for p in e)
    phi_max=phi.max(); verts=[]; index={}
    for side in [-1,1]:
        for j,i in sorted(used):
            if side==1 and (j,i) in boundary:
                index[(side,j,i)]=index[(-1,j,i)]; continue
            bulge=0 if (j,i) in boundary else math.sqrt(max(0,phi[j,i]/phi_max))
            dep=frontdepth if side<0 else backdepth
            index[(side,j,i)]=len(verts)
            verts.append((xs[i],float(base[j,i])+side*dep*bulge,zs[j]))
    faces=[]
    for side in [-1,1]:
        for q in quads:
            f=[index[(side,*p)] for p in q]
            if side<0: f.reverse()
            faces.append(tuple(f))
    o=mesh(name,verts,faces,mat)
    sm=o.modifiers.new('Sculpted surface relaxation','SMOOTH'); sm.factor=.75; sm.iterations=8
    rem=o.modifiers.new('Smooth voxel sculpt','REMESH'); rem.mode='VOXEL'; rem.voxel_size=h*.9; rem.use_smooth_shade=True
    sm=o.modifiers.new('Polish sculpt','SMOOTH'); sm.factor=.95; sm.iterations=60
    sub=o.modifiers.new('Final surface','SUBSURF'); sub.levels=1; sub.render_levels=1
    dec=o.modifiers.new('Export surface reduction','DECIMATE'); dec.ratio=.12
    return o


def fit_head_profile(obj):
    """Constrain the head's depth by normalized side-view silhouette landmarks.
    X and Z are retained, so the front silhouette does not change.
    """
    bpy.context.view_layer.update()
    ev=obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    me=bpy.data.meshes.new_from_object(ev)
    obj.modifiers.clear();obj.data=me
    co=np.array([v.co[:] for v in me.vertices]); z=co[:,2]; y=co[:,1]
    zz=np.linspace(z.min(),z.max(),220); bins=np.clip(np.searchsorted(zz,z)-1,0,len(zz)-1)
    lo=np.full(len(zz),np.inf);hi=np.full(len(zz),-np.inf)
    np.minimum.at(lo,bins,y);np.maximum.at(hi,bins,y)
    valid=np.isfinite(lo)&np.isfinite(hi)
    lo=np.interp(zz,zz[valid],lo[valid]);hi=np.interp(zz,zz[valid],hi[valid])
    lo=np.convolve(np.pad(lo,3,mode='edge'),np.ones(7)/7,mode='valid')
    hi=np.convolve(np.pad(hi,3,mode='edge'),np.ones(7)/7,mode='valid')
    a=np.interp(z,zz,lo);b=np.interp(z,zz,hi)
    t=np.clip((y-a)/np.maximum(.003,b-a),0,1)
    # Side contour (pixel X minus the 400 px body center, divided by height).
    profile=[(.54,-.03,.045),(.57,-.11,.137),(.60,-.15,.249),(.63,-.17,.277),(.65,-.174,.275),(.70,-.195,.245),(.75,-.197,.215),(.77,-.195,.241),(.80,-.189,.283),(.82,-.182,.309),(.84,-.174,.329),(.86,-.160,.321),(.89,-.136,.226),(.90,-.126,.159),(.91,-.115,.229),(.94,-.082,.253),(.97,-.01,.275),(.985,.04,.269),(1.0,.108,.181)]
    zs=np.array([p[0] for p in profile])
    low=np.interp(z,zs,[p[1] for p in profile]);high=np.interp(z,zs,[p[2] for p in profile])
    co[:,1]=low*(1-t)+high*t
    me.vertices.foreach_set('co',co.reshape(-1));me.update()
    sm=obj.modifiers.new('Polish side profile','SMOOTH');sm.factor=.6;sm.iterations=6
    sm.use_x=False;sm.use_z=False
    rem=obj.modifiers.new('Unify fitted head surface','REMESH');rem.mode='VOXEL';rem.voxel_size=.003;rem.use_smooth_shade=True
    sm=obj.modifiers.new('Polish fitted head','SMOOTH');sm.factor=.95;sm.iterations=55
    su=obj.modifiers.new('Fine head finish','SUBSURF');su.levels=1;su.render_levels=1
    dec=obj.modifiers.new('Head export reduction','DECIMATE');dec.ratio=.16
    for p in me.polygons:p.use_smooth=True


def disc(name, x,y,z,r,depth,mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=80, radius=r, depth=depth,
        location=(x,y,z),rotation=(math.pi/2,0,0))
    o=assign(bpy.context.object,name,mat)
    b=o.modifiers.new('Rounded metal rim','BEVEL'); b.width=min(.003,depth*.35); b.segments=4
    o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o


def sleeve(sign):
    verts=[]; faces=[]; n=64
    profile=[(.125,.055,.083),(.135,.065,.096),(.16,.068,.100),(.235,.069,.098),(.269,.070,.096),(.277,.065,.092)]
    for x,rz,ry in profile:
        for i in range(n):
            a=2*math.pi*i/n
            verts.append((sign*x,math.cos(a)*ry,.483+math.sin(a)*rz))
    for j in range(len(profile)-1):
        for i in range(n):
            k=j*n+i; l=j*n+(i+1)%n; faces.append((k,l,l+n,k+n))
    o=mesh('Coat • short sleeve '+str(sign),verts,faces,WHITE,1)
    mod=o.modifiers.new('Cuff fabric thickness','SOLIDIFY'); mod.thickness=.006
    for x in [.268]:
        tube('Sleeve • stitched cuff '+str(sign),[(sign*x,.096*math.cos(i*math.pi/12),.483+.068*math.sin(i*math.pi/12)) for i in range(24)],.0013,SEAM,True)


def coat():
    # Continuous open coat wraps around the body; front panels are part of the shell.
    vs=[]; fs=[]; n=112; rows=24
    for j in range(rows+1):
        t=j/rows
        rx=.204-.066*t+.012*t*t; ry=.156-.052*t
        opening=.38+.07*t+.085*math.exp(-t/.025)
        for i in range(n+1):
            theta=opening+(2*math.pi-2*opening)*i/n
            x=rx*math.sin(theta); y=-ry*math.cos(theta)
            bottom=.195+.022*math.sin(theta)**2
            edge=min(theta-opening,2*math.pi-opening-theta)
            bottom+=.014*math.exp(-edge/.07)
            top=.55-.022*math.sin(theta)**2
            z=bottom*(1-t)+top*t
            vs.append((x,y,z))
    for j in range(rows):
        for i in range(n):
            k=j*(n+1)+i; fs.append((k,k+1,k+n+2,k+n+1))
    o=mesh('Coat • continuous flared open shell',vs,fs,WHITE,2)
    s=o.modifiers.new('Fabric thickness','SOLIDIFY'); s.thickness=.008; s.offset=0
    b=o.modifiers.new('Rounded coat hems','BEVEL'); b.width=.004; b.segments=3
    # Shallow sculpted patch pockets follow the front slope.
    for sign in [-1,1]:
        outline=[(.121,.333),(.183,.337),(.191,.272),(.181,.252),(.144,.249),(.129,.259)]
        outline=[(sign*x,z) for x,z in outline]
        yfun=lambda x,z,r: -.156*math.sqrt(max(.12,1-(x/.216)**2))-.006
        pocket=pillow('Coat • patch pocket '+str(sign),outline,(sign*.157,.291),yfun,.005,.0015,WHITE,rings=10)
        tube('Pocket • folded opening '+str(sign),[(sign*.123,-.129,.325),(sign*.15,-.113,.327),(sign*.182,-.092,.329)],.0035,SEAM)
    # Raised collar/lapels in the shape seen beside the neck.
    for sign in [-1,1]:
        pts=[(.077,.55),(.126,.549),(.15,.514),(.139,.498),(.103,.506),(.086,.489)]
        pillow('Coat • collar '+str(sign),[(sign*x,z) for x,z in pts],(sign*.116,.525),-.100,.008,.003,WHITE,12)


def setup():
    global CHAR, SCENE
    # Replace only earlier iterations created by this script in this isolated session.
    for old in list(bpy.data.scenes):
        if old.name.startswith('Hawk Doctor • reference reconstruction'):
            for obj in list(old.objects): bpy.data.objects.remove(obj,do_unlink=True)
            bpy.data.scenes.remove(old)
    for coll in list(bpy.data.collections):
        if coll.users==0: bpy.data.collections.remove(coll)
    SCENE=bpy.data.scenes.new('Hawk Doctor • reference reconstruction')
    bpy.context.window.scene=SCENE
    SCENE.unit_settings.system='METRIC'; SCENE.unit_settings.scale_length=1
    CHAR=bpy.data.collections.new('Hawk Doctor • model'); SCENE.collection.children.link(CHAR)
    return SCENE


def build():
    global BROWN,CREAM,WHITE,SEAM,TEAL,NAVY,BLUE,PALE,GOLD,CLAW,RED,DARK
    BROWN=material('warm russet feathers',(.25,.055,.022))
    CREAM=material('ivory facial plumage',(.96,.72,.50),.6)
    WHITE=material('warm white coat',(.88,.83,.91))
    SEAM=material('coat seams',(.80,.74,.84))
    TEAL=material('teal medical scrubs',(.003,.235,.25))
    NAVY=material('navy rubber tubing',(.018,.035,.083),.37)
    BLUE=material('periwinkle stethoscope housing',(.31,.43,.68),.32)
    PALE=material('pale blue diaphragm',(.58,.74,.93),.3)
    GOLD=material('golden yellow beak and feet',(1,.40,.006),.40)
    CLAW=material('rounded chocolate talons',(.16,.073,.056))
    DARK=material('espresso oval eyes',(.018,.003,.005),.55)
    RED=material('red medical cross',(.90,.018,.045))
    # Swept crest integrated into the main head volume. These are front-view landmarks.
    outline=[(842,485),(850,424),(841,339),(813,257),(762,185),(692,130),(603,95),(507,78),(413,78),(327,89),(309,102),(315,131),(346,163),(395,177),(447,177),(372,192),(302,215),(239,235),(225,246),(233,272),(263,310),(301,332),(326,334),(295,380),(260,429),(236,466),(239,485),(268,505),(322,525),(391,555),(482,588),(614,591),(742,554),(810,518)]
    # Crest silhouette at the left is swept rearward in 3D as in the side image.
    def head_edge(x,z,r):
        sweep=max(0,min(1,(-x+.02)/.34))
        return .025 + .255*sweep**1.1*r**3
    head=inflated_contour('Head • continuous swept three-feather crest',[P(*p) for p in outline],lambda x,z: .02+.255*np.clip((-x-.02)/.30,0,1)**2.5*(1+.45*np.clip((z-.93)/.05,0,1)),.218,.150,BROWN,h=.0023)
    fit_head_profile(head)
    # One continuous cream cheek bib, without a central seam.
    face=[(841,471),(836,438),(815,408),(785,391),(752,389),(714,397),(667,412),(598,426),(532,413),(488,398),(454,390),(416,390),(380,403),(350,430),(337,464),(340,497),(361,533),(396,559),(447,579),(511,592),(594,598),(681,591),(754,572),(807,542),(834,507)]
    def face_edge(x,z,r): return -.040-.020*(1-r)
    pillow('Face • unbroken cream cheek bib',[P(*p) for p in face],(0,.634),face_edge,.128,.025,CREAM,28)
    ellipsoid('Neck • cream plumage',(0,-.005,.545),(.077,.078,.064),CREAM)
    for sign in [-1,1]:
        # Eye plane follows the curve of the head and is proud of the cream bib.
        o=ellipsoid('Eye • '+str(sign),(sign*.114,-.196,.731),(.0305,.0085,.067),DARK)
        o.rotation_euler[2]=sign*-.12
    lower=ellipsoid('Beak • lower golden bill',(0,-.198,.641),(.063,.047,.029),GOLD)
    beak=[(598,364),(627,374),(652,402),(672,439),(682,471),(677,486),(658,494),(640,506),(621,518),(603,530),(592,528),(578,515),(560,504),(536,495),(518,482),(514,466),(523,430),(545,391),(572,370)]
    inflated_contour('Beak • rounded hooked upper bill',[P(*p) for p in beak],lambda x,z: -.175-.090*np.clip((.75-z)/.15,0,1)**1.5,.055,.014,GOLD,h=.0015)
    # Scrub shirt, V neckline and two separate shorts legs.
    ellipsoid('Scrubs • soft torso',(0,0,.385),(.125,.098,.175),TEAL)
    for sign in [-1,1]:
        box('Scrubs • shorts leg '+str(sign),(sign*.089,.0,.179),(.163,.196,.132),TEAL,.034)
        box('Scrubs • shorts cuff '+str(sign),(sign*.089,-.001,.133),(.165,.199,.029),TEAL,.009)
        box('Feet • yellow ankle '+str(sign),(sign*.090,.005,.086),(.115,.105,.092),GOLD,.027)
        dome('Feet • soft golden foot '+str(sign),(sign*.093,-.026,0),(.087,.105,.079),GOLD)
        for k,dx in enumerate([-.037,.037]):
            dome('Feet • rounded talon '+str(sign)+' '+str(k),(sign*.093+dx,-.116,0),(.026,.024,.055),CLAW)
    # The exposed triangular neck creates the actual V opening.
    pillow('Scrubs • cream V inset',[(-.075,.553),(.075,.553),(0,.487)],(0,.527),-.099,.006,.002,CREAM,12)
    for sign in [-1,1]:
        tube('Scrubs • V neckline binding '+str(sign),[(sign*.073,-.107,.551),(sign*.048,-.112,.520),(0,-.114,.479)],.009,TEAL)
    coat()
    for sign in [-1,1]:
        sleeve(sign)
        wp=[(284,598),(227,597),(158,600),(101,612),(55,634),(28,661),(30,680),(52,696),(94,704),(98,724),(119,741),(163,743),(181,758),(219,760),(258,752),(284,743)]
        # Reference left wing mapped to either side, keeping symmetrical T-pose.
        pts=[(sign*abs(P(x,z)[0]),P(x,z)[1]) for x,z in wp]
        pillow('Wing • scalloped flight silhouette '+str(sign),pts,(sign*.367,.477),0,.047,.049,BROWN,22)
        for j,(xa,za,xb,zb) in enumerate([(.295,.450,.402,.433),(.322,.482,.456,.471)]):
            # Soft valleys between flight feathers, rather than black drawn lines.
            tube('Wing • feather valley '+str(sign)+' '+str(j),[(sign*xa,-.040,za),(sign*((xa+xb)/2),-.044,(za+zb)/2+.005),(sign*xb,-.017,zb)],.0007,BROWN)
        # Warm scalloped covert feathers where the wing exits its sleeve.
        covert=material('wing coverts '+str(sign),(.30,.073,.025))
        for j in range(3):
            ellipsoid('Wing • small covert '+str(sign)+' '+str(j),(sign*.282,-.008,.526-j*.035),(.019,.041,.024),covert)
    # Volumetric swept feathers: elliptical sections retain thickness in side view.
    for i,(x,tipz,tipy,width) in enumerate([(-.075,.151,.307,.061),(.0,.110,.327,.068),(.075,.151,.307,.061)]):
        feather_leaf('Tail • layered feather '+str(i),(x,.105,.325),(x,tipy,tipz),width,.057,BROWN)
    for sign in [-1,1]:
        feather_leaf('Tail • outer fan upper '+str(sign),(sign*.120,.105,.338),(sign*.238,.215,.206),.031,.025,BROWN)
        feather_leaf('Tail • outer fan lower '+str(sign),(sign*.125,.120,.285),(sign*.201,.236,.148),.029,.025,BROWN)
    # Navy stethoscope runs behind the neck and ends in two visible blue pieces.
    tube('Stethoscope • continuous neck tubing',[(-.107,-.142,.424),(-.108,-.108,.50),(-.100,-.073,.552),(-.095,.027,.565),(0,.091,.555),(.095,.027,.565),(.100,-.073,.552),(.108,-.108,.50),(.111,-.142,.424)],.0145,NAVY)
    for sign in [-1,1]:
        x=sign*.110; z=.410
        disc('Stethoscope • blue housing '+str(sign),x,-.146,z,.046,.018,BLUE)
        disc('Stethoscope • navy inset '+str(sign),x,-.158,z,.030,.008,NAVY)
        disc('Stethoscope • blue diaphragm '+str(sign),x,-.164,z,.024,.006,PALE)
    # One raised, rounded cross on the character's right sleeve.
    box('Medical badge • upright',(-.216,-.097,.529),(.022,.004,.046),RED,.003)
    box('Medical badge • crossbar',(-.216,-.098,.529),(.057,.004,.018),RED,.003)


def normalize_height():
    global MODEL_SCALE, GROUND_OFFSET
    bpy.context.view_layer.update(); dg=bpy.context.evaluated_depsgraph_get()
    zs=[]
    for o in CHAR.objects:
        if o.type not in {'MESH','CURVE'}: continue
        ev=o.evaluated_get(dg); me=ev.to_mesh()
        zs.extend((o.matrix_world@v.co).z for v in me.vertices)
        ev.to_mesh_clear()
    MODEL_SCALE=HEIGHT/(max(zs)-min(zs)); GROUND_OFFSET=-min(zs)*MODEL_SCALE
    root=bpy.data.objects.new('Hawk_Doctor • 300mm placement',None); CHAR.objects.link(root)
    for o in list(CHAR.objects):
        if o!=root: o.parent=root
    root.scale=(MODEL_SCALE,)*3; root.location.z=GROUND_OFFSET
    # The side silhouette gives an inferred depth/height ratio, not a physical measurement.
    bpy.context.view_layer.update()
    coords=[]
    for o in CHAR.objects:
        if o.type not in {'MESH','CURVE'}: continue
        ev=o.evaluated_get(dg); me=ev.to_mesh(); coords.extend((o.matrix_world@v.co).y for v in me.vertices); ev.to_mesh_clear()
    root.scale.y*=HEIGHT*(823/1383)/(max(coords)-min(coords))
    root['target_height_mm']=300.0
    root['scale_source']='bunny_firefighter_package/README.txt: target 300 mm'
    bpy.context.view_layer.update()


def add_references():
    coll=bpy.data.collections.new('References • packed front side back'); SCENE.collection.children.link(coll)
    coll.hide_render=True; coll.hide_viewport=True
    for view,loc,rot in [('front',(0,.42,.50),(math.pi/2,0,0)),('back',(0,.46,.50),(math.pi/2,0,math.pi)),('side',(.65,0,.50),(math.pi/2,0,math.pi/2))]:
        img=bpy.data.images.load(str(ROOT/'3dtesting'/('hawk-doctor-tpose-'+view+'.png')),check_existing=True); img.pack()
        o=bpy.data.objects.new('Reference • '+view,None); coll.objects.link(o)
        o.empty_display_type='IMAGE'; o.data=img; o.empty_display_size=1.138*MODEL_SCALE
        o.color[3]=.55; o.location=tuple(v*MODEL_SCALE+(GROUND_OFFSET if i==2 else 0) for i,v in enumerate(loc)); o.rotation_euler=rot; o.hide_render=True


def lighting():
    stage=bpy.data.collections.new('Studio • cameras and lights'); SCENE.collection.children.link(stage)
    def aim(o,p): o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
    for name,loc,power,size in [('Key',(-1.7,-2.5,3.1),170,2.1),('Fill',(2.0,-1.5,1.5),85,2.0),('Rim',(0,1.8,2.4),145,1.8)]:
        data=bpy.data.lights.new('Studio • '+name,'AREA'); data.energy=power; data.shape='DISK'; data.size=size
        o=bpy.data.objects.new('Studio • '+name,data); stage.objects.link(o); o.location=loc; aim(o,(0,0,.52))
    world=bpy.data.worlds.new('Studio • soft neutral world'); world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.34,.37,.43,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.45; SCENE.world=world
    cams={}
    for name,loc in [('front',(0,-3,.5)),('back',(0,3,.5)),('side',(3,0,.5)),('three_quarter',(1.6,-2.8,1.05))]:
        data=bpy.data.cameras.new('Camera • '+name); data.type='ORTHO'; data.ortho_scale=1.13
        o=bpy.data.objects.new('Camera • '+name,data); stage.objects.link(o); o.location=loc; aim(o,(0,0,.5)); cams[name]=o
    SCENE.render.engine='CYCLES'; SCENE.cycles.samples=40; SCENE.cycles.use_denoising=True
    SCENE.render.resolution_x=1200; SCENE.render.resolution_y=1200; SCENE.render.resolution_percentage=100
    SCENE.render.image_settings.file_format='PNG'; SCENE.render.film_transparent=True
    SCENE.view_settings.view_transform='Standard'; SCENE.view_settings.exposure=.6
    for o in stage.objects:
        o.location*=MODEL_SCALE
        o.location.z+=GROUND_OFFSET
        if o.type=='CAMERA': o.data.ortho_scale*=MODEL_SCALE
        if o.type=='LIGHT': o.data.energy*=MODEL_SCALE**2
    SCENE.camera=cams['three_quarter']
    return cams


def validate_and_save():
    bpy.context.view_layer.update()
    dg=bpy.context.evaluated_depsgraph_get()
    pts=[]; nonmanifold={}; faces=0
    for o in CHAR.objects:
        if o.type not in {'MESH','CURVE'}: continue
        ev=o.evaluated_get(dg)
        me=ev.to_mesh(); pts.extend([o.matrix_world@v.co for v in me.vertices]); faces+=len(me.polygons)
        if o.type=='MESH':
            bm=bmesh.new(); bm.from_mesh(me)
            bad=sum(1 for e in bm.edges if not e.is_manifold)
            if bad: nonmanifold[o.name]=bad
            bm.free()
        ev.to_mesh_clear()
    low=[min(v[i] for v in pts) for i in range(3)]; high=[max(v[i] for v in pts) for i in range(3)]
    report={'dimensions_m':dict(zip(['width','depth','height'],[high[i]-low[i] for i in range(3)])), 'bounds_min':low,'bounds_max':high,'objects':len(CHAR.objects),'evaluated_polygons':faces,'non_manifold_edges':nonmanifold,'physical_scale':'300 mm chosen target, matching bunny_firefighter_package/README.txt; height matched exactly; depth inferred from side silhouette; soles at Z=0.','orientation':'+Z up, -Y forward','reference_height_px':1154,'reference_front_wingspan_px':1144,'limitations':['Three rendered views are not calibrated orthographic measurements.','Side wing pose and back face/foot details conflict with the front view.','Reference-guided reconstruction; not an exact scan, not rigged.']}
    (OUT/'dimensions.json').write_text(json.dumps(report,indent=2)+'\n')
    SCENE['reference_notes']=json.dumps(report['limitations'])
    SCENE['physical_scale']=report['physical_scale']
    bpy.data.libraries.write(str(OUT/'Hawk_Doctor_Reference.blend'),{SCENE},path_remap='RELATIVE',fake_user=True,compress=True)
    bpy.ops.object.select_all(action='DESELECT')
    for o in CHAR.objects: o.select_set(True)
    bpy.context.view_layer.objects.active=next(o for o in CHAR.objects if o.type=='MESH')
    bpy.ops.export_scene.gltf(filepath=str(OUT/'Hawk_Doctor_Reference.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_apply=True,export_cameras=False,export_lights=False)
    return report


def main():
    setup(); build(); normalize_height(); add_references(); lighting()
    return validate_and_save()

if __name__=='__main__':
    result=main()
