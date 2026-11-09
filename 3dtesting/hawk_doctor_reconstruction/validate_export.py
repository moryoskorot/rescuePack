"""Execute through Blender MCP after building. Reimport the GLB into a fresh scene."""
from pathlib import Path
import bpy, bmesh, json, math, struct, tempfile, shutil
from mathutils import Vector

HERE=Path(__file__).resolve().parent
source=bpy.context.scene
report={}

with tempfile.TemporaryDirectory(prefix='hawk_blend_check_') as temp:
    copy=Path(temp)/'saved_hawk.blend'
    shutil.copy2(HERE/'Hawk_Doctor_Reference.blend',copy)
    with bpy.data.libraries.load(str(copy),link=False) as (a,b):
        report['blend_scenes_in_file']=list(a.scenes)
        b.scenes=list(a.scenes)
loaded=[s for s in b.scenes if s]
report['blend_model_mesh_count']=sum(o.type=='MESH' for s in loaded for o in s.objects)
report['packed_reference_images']=len({o.data.name for s in loaded for o in s.objects if o.type=='EMPTY' and o.empty_display_type=='IMAGE' and o.data and o.data.packed_file})

check=bpy.data.scenes.new('Hawk validation • GLB roundtrip')
bpy.context.window.scene=check
bpy.ops.import_scene.gltf(filepath=str(HERE/'Hawk_Doctor_Reference.glb'))
bpy.context.view_layer.update()
pts=[]; meshes=[]; bad_edges={}; finite=0; zero=0; triangles=0; zero_by_mesh={}
for o in check.objects:
    if o.type!='MESH':continue
    meshes.append(o)
    pts.extend([o.matrix_world@v.co for v in o.data.vertices])
    finite+=sum(not all(math.isfinite(c) for c in v.co) for v in o.data.vertices)
    nz=sum(p.area<1e-15 for p in o.data.polygons)
    zero+=nz
    if nz:zero_by_mesh[o.name]=nz
    o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
    # glTF splits vertices at material/normal/UV boundaries, so weld before manifold check.
    bm=bmesh.new();bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7)
    bad=sum(not e.is_manifold for e in bm.edges)
    if bad:bad_edges[o.name]=bad
    bm.free()
low=[min(v[i] for v in pts) for i in range(3)];high=[max(v[i] for v in pts) for i in range(3)]
dims=[(high[i]-low[i])*1000 for i in range(3)]
report.update({'glb_meshes':len(meshes),'glb_triangles':triangles,'glb_dimensions_mm':dict(zip(['width','depth','height'],dims)), 'height_target_mm':300,'height_error_mm':abs(dims[2]-300),'ground_z_mm':low[2]*1000,'nonfinite_vertices':finite,'zero_area_faces':zero,'zero_area_by_mesh':zero_by_mesh,'nonmanifold_after_weld':bad_edges})
with open(HERE/'Hawk_Doctor_Reference.glb','rb') as f:
    head=f.read(12);n,kind=struct.unpack('<II',f.read(8));gltf=json.loads(f.read(n))
report['glb_scenes']=len(gltf['scenes'])
report['glb_cameras']=len(gltf.get('cameras',[]))
report['glb_animations']=len(gltf.get('animations',[]))
report['glb_materials']=len(gltf.get('materials',[]))
report['passes']=report['height_error_mm']<.001 and finite==0 and zero==0 and len(bad_edges)==0 and report['glb_scenes']==1 and report['packed_reference_images']==3
(HERE/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
bpy.context.window.scene=source
for o in list(check.objects):bpy.data.objects.remove(o,do_unlink=True)
bpy.data.scenes.remove(check)
for sc in loaded:
    for o in list(sc.objects):bpy.data.objects.remove(o,do_unlink=True)
    bpy.data.scenes.remove(sc)
result=report
assert report['passes'], report
