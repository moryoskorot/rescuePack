# Bunny local 3D workflow

1. Open `BUNNY_1_Pixal3D_local.json` in local ComfyUI. Its input is `BUNNY_1_idle.png`; the graph uses installed Pixal3D, DINOv3, MoGe, BiRefNet, and TRELLIS VAEs, with no API model nodes.
2. Run the graph and save the GLB. The included API version was validated and queued against local ComfyUI.
3. Render front, left, back, and right from that **one mesh** with `render_turnaround.py`. It uses a single orthographic scale and a uniform 1024 × 1024 canvas. `dimensions.json` records the mesh bounds.

This guarantees equal framing between rendered angles. It cannot guarantee an exact reconstruction from one image, infer unseen costume details, or make an idle mesh into a T-pose. For a true T-pose, rig and pose the generated mesh first, then run the renderer. Use the four resulting views for any later multi-view reconstruction; do not resize views independently.
