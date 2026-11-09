# Hawk doctor — reference reconstruction

Created in Blender 5.2.2 through Blender MCP from the supplied front, back, and side T-pose images.

## Files

- `Hawk_Doctor_Reference.blend`: editable separated meshes, colored materials, packed references, studio lights, and four cameras.
- `Hawk_Doctor_Reference.glb`: self-contained static model with 14 PBR materials; no cameras, lights, skeleton, or animation.
- `front.png`, `back.png`, `side.png`, `three_quarter.png`: 1200 × 1200 transparent renders of the same model.
- `*_comparison.png`: reference/model comparisons with silhouette difference maps.
- `dimensions.json`, `validation.json`, `likeness.json`: measurements and checks.
- `build_hawk.py`, `validate_export.py`, `compare_views.py`: reproducible construction and verification.

## Scale

The requested height comes from `3dtesting/bunny_firefighter_package/README.txt`, which specifies a **300 mm target**. That file reports the bunny's measured height as 299.9981 mm. This hawk uses the same 300 mm target.

Reimported GLB dimensions:

| Dimension | Millimetres |
| --- | ---: |
| Height, soles to crest | 300.000012 |
| Width, wing tip to wing tip | 298.096 |
| Depth, complete model | 178.525 |

Height export error: 0.00001192 mm. Soles are at Z = 0. Source coordinates are metres, +Z up, -Y forward. GLB uses the glTF coordinate convention and imports back into Blender at the verified dimensions.

Only the height is a supplied physical target. Width and depth are inferred from image proportions, with front-view priority and depth guided by the side silhouette. They are not independently measured physical dimensions of an original object.

## Likeness and remaining differences

This is a reconstruction, **not a pixel-identical replica or a scan**. The references are not calibrated turnarounds. In particular, the side image extends the wing rearward while the front/back show lateral T-pose wings; tail spread, head shape, and foot details also differ between views. A single solid T-pose model cannot reproduce all of those conflicting projections exactly.

Silhouette intersection-over-union after uniform height alignment and horizontal bounds centering:

| View | Overlap |
| --- | ---: |
| Front | 93.76% |
| Back | 85.96% |
| Side | 85.32% |

The comparison images show the differences directly: grey is overlap, red is reference only, blue is model only. No nonuniform image warping is used. The mask retains the largest connected opaque component and ignores disconnected background fringe. This metric measures silhouette only; it does not measure exact material or surface-detail fidelity.

The crest and beak volumes, feather layering, coat/pocket construction, stethoscope, tail arrangement, and material/lighting response remain approximate. The front T-pose is preserved rather than copying the conflicting side wing pose. This is a static multi-part model, not a rigged or game-budget asset. It has 638,326 exported triangles across 62 mesh nodes.

## Verification

- Saved Blender file reloaded: one scene, 51 model meshes, three packed reference images.
- GLB reimported into a fresh Blender scene: one scene, no cameras or animations.
- Nonfinite vertices: 0. Zero-area faces: 0.
- Nonmanifold edges after welding glTF seam splits: 0.
- Height is within 0.001 mm of the requested target after reimport.
- Repository checks: 77 tests passed; production build passed.

The model consists of overlapping, individually closed parts. The topology checks do not claim that the assembled character is a single fused printing solid.

## Rebuild

Run `build_hawk.py` in Blender or execute it through Blender MCP. It uses Blender's bundled NumPy. Run `validate_export.py` in the resulting scene for the saved-file and GLB checks. The comparison script uses Python with Pillow and NumPy. The three input images remain in `3dtesting/`; packed copies are included in the Blender file.

The final Blender file caches the completed head and beak sculpt as mesh geometry. The construction script retains the full reconstruction procedure. Existing character packages and unrelated repository work were preserved.
