"""Render four scale-locked orthographic views of one local GLB.

Run: /Applications/Blender.app/Contents/MacOS/Blender -b -P render_turnaround.py -- model.glb output_dir
The four images show the pose present in the GLB; this script does not invent a T-pose.
"""
import bpy
import json
import sys
from pathlib import Path
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
source, out = Path(args[0]).resolve(), Path(args[1]).resolve()
out.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
if not meshes:
    raise RuntimeError('GLB contains no mesh')
bpy.context.view_layer.update()
points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
lo = Vector(tuple(min(p[i] for p in points) for i in range(3)))
hi = Vector(tuple(max(p[i] for p in points) for i in range(3)))
center = (lo + hi) / 2
size = hi - lo
# One uniform transform and one orthographic scale for all four views.
for obj in bpy.context.scene.objects:
    if obj.parent is None and obj.type != 'CAMERA':
        obj.location -= center
bpy.context.view_layer.update()
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1024
scene.render.resolution_y = 1024
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.view_settings.view_transform = 'Standard'
world = bpy.data.worlds.new('Turnaround world')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.75
scene.world = world
light_data = bpy.data.lights.new('Large softbox', 'AREA')
light = bpy.data.objects.new('Large softbox', light_data)
scene.collection.objects.link(light)
light.location = (2, -3, 6)
light_data.energy = 900
light_data.shape = 'DISK'
light_data.size = 6
camera_data = bpy.data.cameras.new('Fixed orthographic camera')
camera = bpy.data.objects.new('Fixed orthographic camera', camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
camera_data.type = 'ORTHO'
ortho = max(size.x, size.y, size.z) * 1.18
camera_data.ortho_scale = ortho
radius = max(size) * 2.5
views = {'front': (0, -radius, 0), 'left': (-radius, 0, 0),
         'back': (0, radius, 0), 'right': (radius, 0, 0)}
for name, xyz in views.items():
    camera.location = xyz
    camera.rotation_euler = (Vector((0, 0, 0)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(out / f'{name}.png')
    bpy.ops.render.render(write_still=True)
metadata = {'input': str(source), 'mesh_bounds': [list(lo), list(hi)],
            'mesh_dimensions': list(size), 'camera': 'orthographic',
            'orthographic_scale': ortho, 'resolution': [1024, 1024],
            'views': list(views), 'pose': 'as supplied by input GLB'}
(out / 'dimensions.json').write_text(json.dumps(metadata, indent=2))
print('TURNAROUND_DONE', out)
