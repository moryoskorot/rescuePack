"""Build the hawk doctor from the front/side/back T-pose references.

The assembled character uses separated, bone-parented toy-like parts.  This
keeps the character visually consistent with the generated turnarounds while
providing an immediately usable FK skeleton for animation.
"""
import bpy
from math import radians
from mathutils import Vector

OUT_BLEND = "/Users/moryo/Repos/kids-firefightinggame/3dtesting/Hawk_Doctor_Rig.blend"
OUT_PREVIEW = "/Users/moryo/Repos/kids-firefightinggame/3dtesting/Hawk_Doctor_Rig_Preview.png"


def clean():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def mat(name, color, roughness=0.38):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    bsdf = result.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    return result


def finish(obj, material, bevel=0):
    obj.data.materials.append(material)
    if hasattr(obj.data, "polygons"):
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    if bevel:
        modifier = obj.modifiers.new("Soft_Edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
    return obj


def parent(obj, bone):
    world = obj.matrix_world.copy()
    obj.parent = RIG
    obj.parent_type = "BONE"
    obj.parent_bone = bone
    obj.matrix_world = world


def sphere(name, loc, scale, material, bone):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish(obj, material)
    parent(obj, bone)
    return obj


def cube(name, loc, scale, material, bone, bevel=0.08):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish(obj, material, bevel)
    parent(obj, bone)
    return obj


def cylinder(name, loc, radius, depth, material, bone, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=radius, depth=depth,
                                       location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    finish(obj, material, 0.04)
    parent(obj, bone)
    return obj


def cone(name, loc, radius, depth, material, bone, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=40, radius1=radius, radius2=0.06,
                                   depth=depth, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    finish(obj, material, 0.025)
    parent(obj, bone)
    return obj


def torus(name, loc, major, minor, material, bone, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor,
                                     major_segments=48, minor_segments=12,
                                     location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    finish(obj, material)
    parent(obj, bone)
    return obj


def add_bone(eb, name, head, tail, parent_name=None):
    bone = eb.new(name)
    bone.head = head
    bone.tail = tail
    if parent_name:
        bone.parent = eb[parent_name]
    return bone


def build_rig():
    bpy.ops.object.armature_add(enter_editmode=True)
    rig = bpy.context.object
    rig.name = "Hawk_Doctor_Rig"
    rig.data.name = "Hawk_Doctor_Skeleton"
    eb = rig.data.edit_bones
    eb.remove(eb[0])
    add_bone(eb, "root", (0, 0, 0), (0, 0, 0.4))
    add_bone(eb, "pelvis", (0, 0, 0.4), (0, 0, 2.3), "root")
    add_bone(eb, "spine", (0, 0, 2.3), (0, 0, 3.4), "pelvis")
    add_bone(eb, "chest", (0, 0, 3.4), (0, 0, 4.35), "spine")
    add_bone(eb, "neck", (0, 0, 4.35), (0, 0, 4.8), "chest")
    add_bone(eb, "head", (0, 0, 4.8), (0, 0, 5.9), "neck")
    add_bone(eb, "crest", (0, 0.20, 5.65), (0, 0.5, 6.55), "head")
    add_bone(eb, "tail", (0, 0.3, 2.95), (0, 0.9, 2.35), "pelvis")
    for side, sign in (("L", 1), ("R", -1)):
        add_bone(eb, f"wing_upper.{side}", (0.72 * sign, 0, 4.12), (1.45 * sign, 0, 4.12), "chest")
        add_bone(eb, f"wing_lower.{side}", (1.45 * sign, 0, 4.12), (2.35 * sign, 0, 4.12), f"wing_upper.{side}")
        add_bone(eb, f"thigh.{side}", (0.38 * sign, 0, 2.15), (0.38 * sign, 0, 1.15), "pelvis")
        add_bone(eb, f"shin.{side}", (0.38 * sign, 0, 1.15), (0.38 * sign, 0, 0.38), f"thigh.{side}")
        add_bone(eb, f"foot.{side}", (0.38 * sign, 0, 0.38), (0.38 * sign, -0.42, 0.22), f"shin.{side}")
    bpy.ops.object.mode_set(mode="POSE")
    for bone in rig.pose.bones:
        bone.rotation_mode = "XYZ"
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.show_in_front = True
    rig.data.display_type = "BBONE"
    rig["rig_type"] = "FK character skeleton"
    rig["animation_notes"] = "Select Hawk_Doctor_Rig and pose named bones; character parts are bone-parented."
    return rig


def build_hawk(m):
    brown, dark_brown, cream, yellow, teal, white, navy, blue, red = (
        m[k] for k in ("Feather_Brown", "Talon_Brown", "Face_Cream", "Beak_Yellow",
                        "Scrub_Teal", "Coat_White", "Stethoscope_Navy", "Stethoscope_Blue",
                        "Medical_Red"))
    # Head, facial feather patches and beak.
    sphere("Head", (0, 0.03, 5.34), (1.24, 0.86, 1.02), brown, "head")
    sphere("FacePatch.L", (-0.48, -0.72, 5.19), (0.60, 0.16, 0.53), cream, "head")
    sphere("FacePatch.R", (0.48, -0.72, 5.19), (0.60, 0.16, 0.53), cream, "head")
    sphere("Eye.L", (-0.36, -0.87, 5.45), (0.13, 0.05, 0.31), dark_brown, "head")
    sphere("Eye.R", (0.36, -0.87, 5.45), (0.13, 0.05, 0.31), dark_brown, "head")
    cone("Beak", (0, -0.98, 5.27), 0.32, 0.58, yellow, "head", (radians(90), 0, 0))
    # Crest silhouette: overlapping swept feathers, visible in front/side/back.
    crest_a = sphere("Crest_Main", (-0.18, 0.28, 6.05), (0.86, 0.48, 0.36), brown, "crest")
    crest_a.rotation_euler[1] = radians(-18)
    crest_b = sphere("Crest_Upper", (-0.04, 0.35, 6.30), (0.72, 0.42, 0.27), brown, "crest")
    crest_b.rotation_euler[1] = radians(-28)
    crest_c = sphere("Crest_Rear", (0.18, 0.47, 5.94), (0.72, 0.40, 0.28), brown, "crest")
    crest_c.rotation_euler[1] = radians(22)

    # Scrubs and layered doctor coat.
    cube("Scrub_Torso", (0, 0, 3.65), (0.68, 0.43, 0.83), teal, "spine", 0.15)
    cube("Scrub_V_Neck", (0, -0.46, 4.18), (0.36, 0.035, 0.23), teal, "chest", 0.02)
    cube("Coat_Back", (0, 0.22, 3.67), (0.83, 0.30, 0.88), white, "spine", 0.16)
    cube("Coat_Front.L", (-0.52, -0.39, 3.66), (0.26, 0.07, 0.83), white, "spine", 0.08)
    cube("Coat_Front.R", (0.52, -0.39, 3.66), (0.26, 0.07, 0.83), white, "spine", 0.08)
    cube("Coat_Pocket.L", (-0.55, -0.48, 3.27), (0.15, 0.025, 0.19), white, "spine", 0.025)
    cube("Coat_Pocket.R", (0.55, -0.48, 3.27), (0.15, 0.025, 0.19), white, "spine", 0.025)
    cube("Shorts", (0, 0, 2.55), (0.72, 0.42, 0.34), teal, "pelvis", 0.10)

    # Stethoscope loop and chest piece.
    torus("Stethoscope_Loop", (0, -0.53, 4.02), 0.50, 0.045, navy, "chest", (radians(90), 0, 0))
    sphere("Stethoscope_Chestpiece", (0.0, -0.62, 3.67), (0.15, 0.045, 0.15), blue, "chest")
    torus("Chestpiece_Ring", (0, -0.67, 3.67), 0.09, 0.026, navy, "chest", (radians(90), 0, 0))

    for side, sign in (("L", 1), ("R", -1)):
        cylinder(f"CoatSleeve_{side}", (0.94 * sign, 0, 4.12), 0.32, 0.55, white,
                 f"wing_upper.{side}", (0, radians(90), 0))
        wing = sphere(f"Wing_{side}", (1.62 * sign, 0, 4.12), (0.82, 0.30, 0.36), brown,
                      f"wing_lower.{side}")
        # Rounded feather tips layered on the lower wing edge.
        for index in range(3):
            tip = sphere(f"Wing_{side}_Feather_{index+1}",
                         ((1.48 + index * 0.27) * sign, -0.02, 3.98),
                         (0.22, 0.28, 0.18), brown, f"wing_lower.{side}")
        if side == "L":
            cube("Medical_Cross_V", (0.94, -0.34, 4.23), (0.055, 0.018, 0.17), red, f"wing_upper.{side}", 0.02)
            cube("Medical_Cross_H", (0.94, -0.35, 4.23), (0.17, 0.018, 0.055), red, f"wing_upper.{side}", 0.02)
        cylinder(f"Leg_{side}", (0.38 * sign, 0, 1.35), 0.25, 1.50, yellow, f"shin.{side}")
        foot = sphere(f"Foot_{side}", (0.38 * sign, -0.18, 0.48), (0.40, 0.55, 0.26), yellow, f"foot.{side}")
        for toe in (-0.12, 0.12):
            sphere(f"Talon_{side}_{toe}", (0.38 * sign + toe, -0.54, 0.43), (0.11, 0.12, 0.13), dark_brown, f"foot.{side}")

    # Three layered rear tail feathers, visible below the coat in the back reference.
    for index, x in enumerate((-0.32, 0, 0.32)):
        feather = sphere(f"Tail_Feather_{index+1}", (x, 0.54, 2.55), (0.30, 0.26, 0.62), brown, "tail")
        feather.rotation_euler[1] = radians(-10 * x)


def preview_setup():
    for loc, energy, size in (((4, -5, 7), 700, 5), ((-4, -2, 5), 350, 4), ((0, 3, 6), 450, 3)):
        bpy.ops.object.light_add(type="AREA", location=loc)
        light = bpy.context.object
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
    bpy.ops.object.camera_add(location=(0, -16.5, 4.05))
    camera = bpy.context.object
    camera.name = "Preview_Front_Camera"
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 7.8
    camera.rotation_euler = (Vector((0, 0, 3.65)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = camera


def validate():
    required = {"root", "pelvis", "spine", "chest", "neck", "head", "crest", "tail",
                "wing_upper.L", "wing_upper.R", "wing_lower.L", "wing_lower.R",
                "thigh.L", "thigh.R", "shin.L", "shin.R", "foot.L", "foot.R"}
    missing = required - {bone.name for bone in RIG.data.bones}
    if missing:
        raise RuntimeError(f"Missing required bones: {sorted(missing)}")
    meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"]
    unrigged = [obj.name for obj in meshes if obj.parent != RIG]
    if unrigged:
        raise RuntimeError(f"Unrigged mesh objects: {unrigged}")
    if len(meshes) < 35:
        raise RuntimeError("Incomplete model: expected at least 35 character mesh parts")
    print(f"VALIDATION PASSED: {len(meshes)} rigged meshes, {len(RIG.data.bones)} bones")


clean()
M = {
    "Feather_Brown": mat("Feather_Brown", (0.44, 0.13, 0.06), 0.44),
    "Talon_Brown": mat("Talon_Brown", (0.16, 0.045, 0.022), 0.38),
    "Face_Cream": mat("Face_Cream", (0.96, 0.84, 0.72), 0.48),
    "Beak_Yellow": mat("Beak_Yellow", (1.0, 0.58, 0.015), 0.30),
    "Scrub_Teal": mat("Scrub_Teal", (0.015, 0.47, 0.48), 0.38),
    "Coat_White": mat("Coat_White", (0.96, 0.91, 0.98), 0.46),
    "Stethoscope_Navy": mat("Stethoscope_Navy", (0.025, 0.06, 0.18), 0.35),
    "Stethoscope_Blue": mat("Stethoscope_Blue", (0.50, 0.64, 0.88), 0.30),
    "Medical_Red": mat("Medical_Red", (0.93, 0.03, 0.06), 0.35),
}
RIG = build_rig()
build_hawk(M)
preview_setup()
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
bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
bpy.ops.render.render(write_still=True)
print(f"SAVED: {OUT_BLEND}")
print(f"PREVIEW: {OUT_PREVIEW}")
