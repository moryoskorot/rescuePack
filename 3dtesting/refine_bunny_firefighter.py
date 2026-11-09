"""Refine the reference-matched bunny rig and export a game-ready GLB.

Run with Blender's Python interpreter in background mode. The source rig stays
untouched; this script saves a separate Blender project and GLB.
"""
import bpy
from math import radians
from mathutils import Vector
from pathlib import Path

HERE = Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(HERE / "Bunny_Firefighter_Rig.blend"))
rig = bpy.data.objects["Bunny_Firefighter_Rig"]
materials = {m.name: m for m in bpy.data.materials}


def attach(obj, bone):
    world = obj.matrix_world.copy()
    obj.parent = rig
    obj.parent_type = "BONE"
    obj.parent_bone = bone
    obj.matrix_world = world
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def ellipsoid(name, center, radii, material, bone):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = radii
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(materials[material])
    return attach(obj, bone)


def box(name, center, half_size, material, bone, bevel=0.04):
    bpy.ops.mesh.primitive_cube_add(location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = half_size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(materials[material])
    mod = obj.modifiers.new("Rounded corners", "BEVEL")
    mod.width = bevel
    mod.segments = 3
    obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return attach(obj, bone)


def stroke(name, points, radius, material, bone):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for p, position in zip(spline.bezier_points, points):
        p.co = position
        p.handle_left_type = "AUTO"
        p.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(materials[material])
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj.select_set(False)
    return attach(obj, bone)


# The reference has a broad, continuous helmet brim and pronounced crown ribs.
brim = bpy.data.objects["Helmet_Brim"]
brim.scale = (1.13, 1.06, 0.68)
ellipsoid("Helmet_Brim_Front", (0, -0.70, 5.69), (1.34, 0.50, 0.095), "Firefighter_Red", "head")
for x in (-0.76, -0.42, 0.42, 0.76):
    stroke("Helmet_Crown_Rib", [(x, -0.76, 5.76), (x * 0.88, -0.76, 6.03),
           (x * 0.50, -0.58, 6.43)], 0.035, "Helmet_Shadow_Red", "head")
stroke("Helmet_Center_Rib", [(0, -0.95, 5.78), (0, -0.82, 6.09),
       (0, -0.56, 6.62)], 0.057, "Firefighter_Red", "head")

# Make the badge read as a shield and give the flame a distinct silhouette.
bpy.data.objects["Helmet_Badge"].hide_render = True
bpy.data.objects["Helmet_Badge"].hide_viewport = True
box("Shield_Badge", (0, -0.99, 6.17), (0.36, 0.09, 0.30),
    "Reflective_Yellow", "head", 0.15)
ellipsoid("Badge_Flame_Base", (0, -1.095, 6.12), (0.12, 0.025, 0.13),
          "Firefighter_Red", "head")
ellipsoid("Badge_Flame_Tip", (-0.025, -1.105, 6.24), (0.055, 0.02, 0.13),
          "Firefighter_Red", "head")

# Rounded jacket, two distinct reflective patches, and the collar.
bpy.data.objects["Torso"].scale = (1.08, 1.12, 1.0)
bpy.data.objects["Chest_Reflector"].hide_render = True
bpy.data.objects["Chest_Reflector"].hide_viewport = True
for side in (-1, 1):
    box("Chest_Reflector_Patch", (side * 0.43, -0.57, 3.77),
        (0.31, 0.036, 0.105), "Reflective_Yellow", "chest", 0.025)
    box("Jacket_Collar", (side * 0.21, -0.51, 4.34),
        (0.19, 0.11, 0.10), "Firefighter_Red", "chest", 0.06)
    box("Trouser_Pocket", (side * 0.73, -0.11, 2.23),
        (0.055, 0.27, 0.21), "Navy_Rubber", f"thigh.{ 'L' if side == 1 else 'R'}", 0.04)
    ellipsoid("Soft_Cheek", (side * 0.72, -0.72, 5.04),
              (0.18, 0.025, 0.10), "Fur_White", "head")

# The tank is a rounded yellow cylinder held by two dark bands.
tank = bpy.data.objects["Backpack_Tank"]
tank.scale = (1.08, 1.25, 1.0)
for z in (3.45, 3.95):
    box("Tank_Wrap", (0, 0.87, z), (0.50, 0.055, 0.075),
        "Navy_Rubber", "spine", 0.04)
for side, sign in (("L", 1), ("R", -1)):
    box("Boot_Cuff_" + side, (0.42 * sign, 0, 0.78),
        (0.34, 0.37, 0.10), "Navy_Rubber", "shin." + side, 0.06)
    box("Glove_Cuff_" + side, (2.13 * sign, 0, 4.25),
        (0.09, 0.31, 0.30), "Navy_Rubber", "forearm." + side, 0.04)

# Save the editable rig and a self-contained glTF binary for the game.
blend_path = HERE / "Bunny_Firefighter_Refined.blend"
glb_path = HERE / "Bunny_Firefighter_Refined.glb"
bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
bpy.ops.object.select_all(action="DESELECT")
rig.select_set(True)
for obj in bpy.data.objects:
    if obj.parent == rig and obj.type == "MESH" and not obj.hide_render:
        obj.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(filepath=str(glb_path), export_format="GLB",
    use_selection=True, export_yup=True, export_apply=False)

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 800
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
camera = scene.camera
camera.data.type = "ORTHO"
camera.data.ortho_scale = 8.5
for name, position in (("Front", (0, -16.5, 4)),
                       ("Side", (16.5, 0, 4)),
                       ("Back", (0, 16.5, 4))):
    camera.location = position
    camera.rotation_euler = (Vector((0, 0, 3.65)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = str(HERE / f"Bunny_Firefighter_Refined_{name}.png")
    bpy.ops.render.render(write_still=True)
print("EXPORTED", glb_path)
