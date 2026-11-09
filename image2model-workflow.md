# Image-to-model workflow

Use this workflow whenever a game character needs to remain visually consistent
from concept art through to an animatable Blender asset. The order is fixed:

1. Make three orthographic T-pose references.
2. Create, rig, validate, and preview the character in Blender.

Do not start the Blender model from an idle/action sprite alone. The three
turnarounds make the silhouette, color placement, costume construction, and
rear details explicit before modeling begins.

## Asset layout and names

Put all character-specific source, reference, Blender, and preview files under
`3dtesting/` until the asset has been approved for game integration.

For a character key such as `hawk-doctor`, use these file names:

```text
3dtesting/<character>-tpose-front.png
3dtesting/<character>-tpose-side.png
3dtesting/<character>-tpose-back.png
3dtesting/create_<character>_rig.py
3dtesting/<Character>_Rig.blend
3dtesting/<Character>_Rig_Preview.png
```

Use lower-case kebab case for PNG references and UpperCamelCase for the Blender
deliverable. Keep the generation script with the asset so materials, component
names, and rig construction are reproducible.

## 1. Generate the T-pose reference set

### Choose the source image

Use the cleanest processed, transparent idle image as the primary character
reference. It must clearly show the character's face, outfit, color palette,
and main silhouette. Other action sprites can be used only to resolve obscured
details.

### Shared reference rules

Generate one image for each of the following views, as three separate image
generation requests:

- **Front:** exact front orthographic view.
- **Side:** exact right-side profile, character facing image-left.
- **Back:** exact rear orthographic view.

Every request must specify all of the following:

- Transparent background and no ground plane.
- Full body, centered, from highest silhouette feature through the feet.
- Neutral T-pose: limbs straight at shoulder height; legs straight; feet
  parallel and naturally separated.
- Orthographic projection; no perspective or three-quarter view.
- The original's identity-defining visual details: proportions, face, palette,
  materials, clothing layers, props attached to the costume, and rear details.
- No text, watermark, extra limbs, extra characters, cropping, or unrelated
  props.

Keep the wording that describes the character's invariant features identical
between the front, side, and back prompts. Change only the view-specific
requirements. This is the primary control against design drift.

### Reference prompt template

Use this structured prompt and fill every bracketed item from the source image:

```text
Use case: stylized-concept
Asset type: orthographic 3D character-model reference, [front | side | back]
Primary request: Create a clean full-body [VIEW] T-pose reference of the exact
[character] in Image 1.
Input images: Image 1: character identity, palette, outfit, and material reference.
Scene/backdrop: fully transparent background; no ground plane.
Subject: [same identity, species, face, silhouette, outfit, accessories,
color placement, and rear details in each request].
Style/medium: polished soft 3D animated-game render matching Image 1.
Composition/framing: [view-specific orthographic instructions]; centered,
full body from highest feature to feet; neutral T-pose.
Lighting/mood: even neutral studio lighting.
Constraints: preserve exact identity and all visible costume construction.
Avoid: perspective, three-quarter angle, bent limbs, idle pose, props,
background, text, watermark, cropping, extra limbs, extra characters.
```

For the **side** prompt, require a pure 90-degree profile and name the forward
direction. For the **back** prompt, explicitly list expected rear components
(for example, backpack, tail, straps, coat back, or feather layers) and state
which front-only features must not be visible.

### Reference quality gate

Inspect all three PNGs before modeling. Regenerate a single incorrect view if
any of these checks fail:

- The character's height, head/body proportion, and limb locations agree
  across views.
- The side view is a genuine profile rather than a three-quarter pose.
- The back view explains every rear-facing form needed for modeling.
- Costume colors and markings appear in the same logical locations.
- All three views are transparent and uncropped.

## 2. Create the Blender character

### Set up the model

1. Create a new Blender scene and preserve the T-pose as the rest pose.
2. Use the front, side, and back references as image planes or visible guides.
3. Block out head, torso, limbs, feet, and major silhouette features first.
4. Add costume layers and attached details second: coats, helmets, packs,
   reflective bands, stethoscopes, tail/crest feathers, badges, and so on.
5. Use named materials for every recurring color family; do not rely on unnamed
   default materials.

For this project's chibi style, separated rounded components are acceptable and
often desirable. Each component must still meet or slightly overlap its
neighbor in the rest pose so the character does not visually break apart.

### Rig requirements

Create a named armature with a top-level `root`, then build a clear FK hierarchy
appropriate to the character:

```text
root
└─ pelvis → spine → chest → neck → head
   ├─ left/right limbs (upper → lower → hand/foot)
   └─ character-specific bones (ears, wings, crest, tail, backpack, etc.)
```

- Name paired bones with `.L` and `.R` suffixes.
- Parent every visible mesh component to a meaningful bone. A toy-like rigid
  component setup is valid for this project; deforming meshes may use armature
  weights instead when needed.
- Keep the armature in the saved file, show it in front of the meshes, and add
  a short custom note explaining the rig type and animation approach.
- Never apply a pose as the rest pose after the final references are approved.

### Required validation

Before saving the deliverable:

1. Open the saved `.blend` in a fresh headless Blender process.
2. Confirm that all expected bones exist and every character mesh is rigged.
3. Rotate at least one limb pose bone and update the scene to confirm the
   armature evaluates correctly.
4. Render a transparent front preview and visually inspect it beside the front
   turnaround.
5. Correct gaps, detached pieces, mismatched colors, or missing rear detail,
   then rerun validation.

## Tested example: Hawk doctor

This workflow was exercised on the hawk doctor using
`visuals/processed/HAWK_ALT_1_idle.png` as the source image.

Generated turnarounds:

- `3dtesting/hawk-doctor-tpose-front.png`
- `3dtesting/hawk-doctor-tpose-side.png`
- `3dtesting/hawk-doctor-tpose-back.png`

Blender deliverables:

- `3dtesting/Hawk_Doctor_Rig.blend`
- `3dtesting/Hawk_Doctor_Rig_Preview.png`
- `3dtesting/create_hawk_doctor_rig.py`

The validated model contains 43 bone-parented character mesh components and an
18-bone FK skeleton, including separate wing, crest, tail, leg, and foot bones.

## Local TRELLIS.2 experiment: bunny firefighter

The Apple Silicon TRELLIS.2 installation at `~/AI-3D/trellis-mac` was run on
`3dtesting/bunny-firefighter-tpose-front.png` with the `512` pipeline and seed
`42`. `MTL_CAPTURE_ENABLED=1` was needed to avoid a macOS Metal watchdog error
during mesh decoding.

- `3dtesting/Bunny_Firefighter_Trellis2_Local.glb` is the untextured, full
  resolution output (about 2.16 million triangles).
- `3dtesting/Bunny_Firefighter_Trellis2_Colored.glb` is a smaller, static
  200,000-triangle model with vertex colors sampled from TRELLIS.2's generated
  color attributes. It is the practical preview asset; it is not rigged.
- `3dtesting/Bunny_Firefighter_Trellis2_Local_Preview.png` is a front render of
  the colored model.

The local pipeline's UV unwrapping stalled under heavy memory pressure, so the
colored export uses vertex colors rather than baked PBR textures. AutoRemesher
was tested on a simplified mesh, but the TRELLIS.2 output contained thousands
of disconnected pieces and the quad remesh lost most of the character. Its
result was discarded. The existing hand-built bunny rig remains the animatable
asset until a usable retopology and rig are produced.
