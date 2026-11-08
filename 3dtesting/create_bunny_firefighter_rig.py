"""Build a clean, rig-ready chibi bunny firefighter in Blender 5.2.

The model intentionally uses separable, bone-parented parts: this preserves the
toy-like hard-surface look while making every character part immediately
animatable.  Run with Blender's Python interpreter, not system Python.
"""
import bpy
from math import radians
from mathutils import Vector


OUT_BLEND = "/Users/moryo/Repos/kids-firefightinggame/3dtesting/Bunny_Firefighter_Rig.blend"
OUT_PREVIEW = "/Users/moryo/Repos/kids-firefightinggame/3dtesting/Bunny_Firefighter_Rig_Preview.png"


def clean_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.materials, bpy.data.meshes, bpy.data.curves,
                       bpy.data.armatures, bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def material(name, color, metallic=0.0, roughness=0.38):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


def finish(obj, mat, bevel=0.0):
    if mat:
        obj.data.materials.append(mat)
    if hasattr(obj.data, "polygons"):
        for poly in obj.data.polygons:
            poly.use_smooth = True
    if bevel:
        mod = obj.modifiers.new("Soft_Edges", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        mod.limit_method = "ANGLE"
    return obj


def sphere(name, loc, scale, mat, bone=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish(obj, mat)
    if bone:
        bone_parent(obj, bone)
    return obj


def cube(name, loc, scale, mat, bevel=0.08, bone=None):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish(obj, mat, bevel)
    if bone:
        bone_parent(obj, bone)
    return obj


def cylinder(name, loc, radius, depth, mat, rotation=(0, 0, 0), bevel=0.04, bone=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=radius, depth=depth,
                                       location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    finish(obj, mat, bevel)
    if bone:
        bone_parent(obj, bone)
    return obj


def torus(name, loc, major, minor, mat, rotation=(0, 0, 0), bone=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor,
                                     major_segments=48, minor_segments=16,
                                     location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    finish(obj, mat)
    if bone:
        bone_parent(obj, bone)
    return obj


def smile(name, mat, bone=None):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 16
    curve.bevel_depth = 0.025
    curve.bevel_resolution = 3
    spline = curve.splines.new("NURBS")
    spline.points.add(2)
    for point, co in zip(spline.points, ((-0.18, -0.89, 4.96, 1),
                                         (0.0, -0.915, 4.88, 1),
                                         (0.18, -0.89, 4.96, 1))):
        point.co = co
    spline.order_u = 3
    spline.use_endpoint_u = True
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    if bone:
        bone_parent(obj, bone)
    return obj


def bone_parent(obj, bone_name):
    world = obj.matrix_world.copy()
    obj.parent = RIG
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    obj.matrix_world = world


def add_bone(edit_bones, name, head, tail, parent=None):
    bone = edit_bones.new(name)
    bone.head = head
    bone.tail = tail
    if parent:
        bone.parent = edit_bones[parent]
    return bone


def make_rig():
    bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
    rig = bpy.context.object
    rig.name = "Bunny_Firefighter_Rig"
    rig.data.name = "Bunny_Firefighter_Skeleton"
    eb = rig.data.edit_bones
    eb.remove(eb[0])

    add_bone(eb, "root", (0, 0, 0), (0, 0, 0.42))
    add_bone(eb, "pelvis", (0, 0, 0.42), (0, 0, 2.35), "root")
    add_bone(eb, "spine", (0, 0, 2.35), (0, 0, 3.45), "pelvis")
    add_bone(eb, "chest", (0, 0, 3.45), (0, 0, 4.3), "spine")
    add_bone(eb, "neck", (0, 0, 4.3), (0, 0, 4.72), "chest")
    add_bone(eb, "head", (0, 0, 4.72), (0, 0, 5.75), "neck")
    add_bone(eb, "ear.L", (-0.38, 0, 5.7), (-0.48, 0, 7.15), "head")
    add_bone(eb, "ear.R", (0.38, 0, 5.7), (0.48, 0, 7.15), "head")

    for side, sign in (("L", 1), ("R", -1)):
        add_bone(eb, f"clavicle.{side}", (0, 0, 4.22), (0.72 * sign, 0, 4.25), "chest")
        add_bone(eb, f"upper_arm.{side}", (0.72 * sign, 0, 4.25), (1.48 * sign, 0, 4.25), f"clavicle.{side}")
        add_bone(eb, f"forearm.{side}", (1.48 * sign, 0, 4.25), (2.15 * sign, 0, 4.25), f"upper_arm.{side}")
        add_bone(eb, f"hand.{side}", (2.15 * sign, 0, 4.25), (2.62 * sign, 0, 4.25), f"forearm.{side}")
        add_bone(eb, f"thigh.{side}", (0.42 * sign, 0, 2.22), (0.42 * sign, 0, 1.25), "pelvis")
        add_bone(eb, f"shin.{side}", (0.42 * sign, 0, 1.25), (0.42 * sign, 0, 0.43), f"thigh.{side}")
        add_bone(eb, f"foot.{side}", (0.42 * sign, 0, 0.43), (0.42 * sign, -0.38, 0.28), f"shin.{side}")

    bpy.ops.object.mode_set(mode="POSE")
    for pose_bone in rig.pose.bones:
        pose_bone.rotation_mode = "XYZ"
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.show_in_front = True
    rig.data.display_type = "BBONE"
    rig["rig_type"] = "FK character skeleton"
    rig["animation_notes"] = "All visible components are bone-parented rigid meshes; animate in Pose Mode."
    return rig


def build_character(m):
    white, pink, red, yellow, navy, black, dark_red = (m[k] for k in (
        "Fur_White", "Ear_Pink", "Firefighter_Red", "Reflective_Yellow",
        "Navy_Rubber", "Face_Black", "Helmet_Shadow_Red"))

    # Head and ears.
    sphere("Head", (0, 0, 5.28), (1.16, 0.86, 0.9), white, "head")
    sphere("Ear.L_Outer", (-0.48, 0.03, 6.55), (0.38, 0.28, 1.12), white, "ear.L")
    sphere("Ear.R_Outer", (0.48, 0.03, 6.55), (0.38, 0.28, 1.12), white, "ear.R")
    sphere("Ear.L_Inner", (-0.48, -0.245, 6.55), (0.20, 0.04, 0.72), pink, "ear.L")
    sphere("Ear.R_Inner", (0.48, -0.245, 6.55), (0.20, 0.04, 0.72), pink, "ear.R")

    # Simple, expressive face; front is negative Y.
    sphere("Eye.L", (-0.38, -0.81, 5.35), (0.13, 0.06, 0.29), black, "head")
    sphere("Eye.R", (0.38, -0.81, 5.35), (0.13, 0.06, 0.29), black, "head")
    sphere("Nose", (0, -0.88, 5.09), (0.16, 0.055, 0.08), pink, "head")
    smile("Mouth", black, "head")

    # Helmet: dome, brim, badge, and red flame.  The full dome is hidden by the head below the brim.
    sphere("Helmet_Dome", (0, 0.02, 6.02), (1.18, 0.95, 0.7), red, "head")
    torus("Helmet_Brim", (0, -0.03, 5.7), 1.12, 0.13, red, bone="head")
    cube("Helmet_Badge", (0, -0.91, 6.15), (0.33, 0.065, 0.30), yellow, 0.08, "head")
    sphere("Helmet_Flame", (0, -0.985, 6.16), (0.125, 0.028, 0.17), red, "head")
    sphere("Helmet_Flame_Tip", (-0.055, -1.00, 6.30), (0.065, 0.024, 0.12), red, "head")

    # Torso and front fire-suit details.
    cube("Torso", (0, 0, 3.62), (0.78, 0.48, 0.86), red, 0.18, "spine")
    cube("Chest_Reflector", (0, -0.50, 3.82), (0.67, 0.035, 0.12), yellow, 0.02, "chest")
    cube("Chest_Zip", (0, -0.535, 3.72), (0.035, 0.025, 0.42), dark_red, 0.01, "chest")
    cube("Belt", (0, 0, 3.12), (0.83, 0.53, 0.105), navy, 0.04, "pelvis")
    cube("Belt_Buckle", (0, -0.545, 3.12), (0.19, 0.045, 0.13), navy, 0.05, "pelvis")
    cube("Radio_Button", (0.14, -0.55, 4.16), (0.08, 0.03, 0.08), yellow, 0.03, "chest")

    # Backpack tank and harness: highly visible in a side/back view.
    sphere("Backpack_Tank", (0, 0.58, 3.7), (0.43, 0.27, 0.80), yellow, "spine")
    cube("Tank_Band_Top", (0, 0.84, 3.94), (0.46, 0.04, 0.055), navy, 0.02, "spine")
    cube("Tank_Band_Bottom", (0, 0.84, 3.45), (0.46, 0.04, 0.055), navy, 0.02, "spine")
    for side, sign in (("L", 1), ("R", -1)):
        strap = cube(f"Harness_{side}", (0.55 * sign, -0.14, 3.78), (0.075, 0.075, 0.70), navy, 0.04, "chest")
        strap.rotation_euler[1] = radians(-10 * sign)

    # Arms are split at elbow/wrist so the armature can pose them naturally.
    for side, sign in (("L", 1), ("R", -1)):
        cylinder(f"UpperArm_{side}", (1.11 * sign, 0, 4.25), 0.30, 0.77, red,
                 rotation=(0, radians(90), 0), bone=f"upper_arm.{side}")
        cylinder(f"UpperArm_Band_{side}", (1.34 * sign, 0, 4.25), 0.315, 0.18, yellow,
                 rotation=(0, radians(90), 0), bone=f"upper_arm.{side}")
        cylinder(f"Forearm_{side}", (1.80 * sign, 0, 4.25), 0.27, 0.62, red,
                 rotation=(0, radians(90), 0), bone=f"forearm.{side}")
        sphere(f"Glove_{side}", (2.32 * sign, 0, 4.25), (0.38, 0.32, 0.29), navy, f"hand.{side}")

    # Separate trouser, reflective band, and boot pieces follow the leg bones.
    for side, sign in (("L", 1), ("R", -1)):
        cube(f"Thigh_{side}", (0.42 * sign, 0, 2.36), (0.34, 0.41, 0.56), red, 0.13, f"thigh.{side}")
        cylinder(f"LowerLeg_{side}", (0.42 * sign, 0, 1.25), 0.32, 0.95, red, bone=f"shin.{side}")
        cylinder(f"Leg_Band_{side}", (0.42 * sign, 0, 0.93), 0.335, 0.16, yellow, bone=f"shin.{side}")
        sphere(f"Boot_{side}", (0.42 * sign, -0.12, 0.42), (0.43, 0.60, 0.31), navy, f"foot.{side}")


def add_lighting_and_camera():
    bpy.ops.object.light_add(type="AREA", location=(4, -5, 7))
    key = bpy.context.object
    key.name = "Preview_Key_Light"
    key.data.energy = 700
    key.data.shape = "DISK"
    key.data.size = 5
    key.rotation_euler = (radians(25), 0, radians(35))
    bpy.ops.object.light_add(type="AREA", location=(-4, -2, 5))
    fill = bpy.context.object
    fill.name = "Preview_Fill_Light"
    fill.data.energy = 380
    fill.data.size = 4
    fill.rotation_euler = (radians(55), 0, radians(-55))
    bpy.ops.object.light_add(type="AREA", location=(0, 3, 6))
    rim = bpy.context.object
    rim.name = "Preview_Rim_Light"
    rim.data.energy = 500
    rim.data.size = 3
    rim.rotation_euler = (radians(-35), 0, radians(180))

    bpy.ops.object.camera_add(location=(0, -16.5, 4.0))
    camera = bpy.context.object
    camera.name = "Preview_Front_Camera"
    bpy.context.scene.camera = camera
    target = Vector((0, 0, 3.65))
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 8.5


def validate():
    expected_bones = {
        "root", "pelvis", "spine", "chest", "neck", "head", "ear.L", "ear.R",
        "clavicle.L", "clavicle.R", "upper_arm.L", "upper_arm.R", "forearm.L", "forearm.R",
        "hand.L", "hand.R", "thigh.L", "thigh.R", "shin.L", "shin.R", "foot.L", "foot.R",
    }
    actual_bones = {bone.name for bone in RIG.data.bones}
    missing = expected_bones - actual_bones
    if missing:
        raise RuntimeError(f"Rig validation failed; missing bones: {sorted(missing)}")
    visible_meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    unrigged = [o.name for o in visible_meshes if o.parent != RIG]
    if unrigged:
        raise RuntimeError(f"Rig validation failed; unparented meshes: {unrigged}")
    if len(visible_meshes) < 35:
        raise RuntimeError("Model validation failed; incomplete character mesh set")
    print(f"VALIDATION PASSED: {len(visible_meshes)} rigged meshes, {len(actual_bones)} bones")


clean_scene()
M = {
    "Fur_White": material("Fur_White", (0.98, 0.89, 0.90), roughness=0.5),
    "Ear_Pink": material("Ear_Pink", (0.96, 0.26, 0.34), roughness=0.38),
    "Firefighter_Red": material("Firefighter_Red", (0.92, 0.025, 0.045), roughness=0.31),
    "Helmet_Shadow_Red": material("Helmet_Shadow_Red", (0.52, 0.006, 0.015), roughness=0.37),
    "Reflective_Yellow": material("Reflective_Yellow", (1.0, 0.64, 0.015), metallic=0.05, roughness=0.28),
    "Navy_Rubber": material("Navy_Rubber", (0.028, 0.04, 0.13), roughness=0.42),
    "Face_Black": material("Face_Black", (0.015, 0.008, 0.012), roughness=0.32),
}
RIG = make_rig()
build_character(M)
add_lighting_and_camera()
validate()

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 700
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.film_transparent = True
scene.render.filepath = OUT_PREVIEW
scene.render.image_settings.color_mode = "RGBA"
bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
bpy.ops.render.render(write_still=True)
print(f"SAVED: {OUT_BLEND}")
print(f"PREVIEW: {OUT_PREVIEW}")
