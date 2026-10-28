# Rescue Pack: City Drive

A small browser town to explore in a Kenney firetruck. Downtown and the town square sit in the center, with suburbs to the west, factories and tightly packed yards to the east, and a harbor walk along the south edge.

## Mission design drafts

The [42-mission library](docs/rescue-pack-missions.json) and [critical design review](docs/rescue-pack-critical-design-review.md) are content and implementation drafts. Fourteen missions are playable Bunny prototypes across Fire, Fix, Rescue, and Collect. The city now has a separate Town Library, Sports Center, and industrial footbridge. Sheep's six books are grouped at three return boxes in different districts. The other 28 missions and optional character switching remain drafts. [Recovered Bunny concept art](docs/concept-art/Bunny%20Firefighter%20Targets%20the%20Blaze.png) is kept with them.

## Play

The published game is hosted at [moryoskorot.github.io/rescuePack](https://moryoskorot.github.io/rescuePack/).

For local development, use Node.js 24 and pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm dev --port 5174
```

Open [localhost:5174](http://127.0.0.1:5174/). Use **WASD** or **arrow keys** to drive, **Space** to handbrake and drift, **Shift** or the **BOOST** button while driving forward to fire the water jets, **drag the mouse** to change the camera angle, and **scroll** to zoom. Drifting leaves tire marks on the ground.

On a touchscreen, driving controls appear automatically: move the **left thumbstick** up to accelerate, down to reverse, and sideways to steer. Hold **B** on the right to brake and drift, or hold **BOOST** above it while driving forward. Drag anywhere outside the controls to change the camera angle.

Water boost starts full and drains at 18% per second while spraying. When idle it refills at **1% per second**, or **25% per second** within range of a fire hydrant. A blue ring and the tank display signal the faster hydrant refill. After running completely dry, release boost to restart once the tank has refilled to 5%.

## Building sheet

Open [`/buildingsheet/`](http://127.0.0.1:5174/buildingsheet/) locally, or `/rescuePack/buildingsheet/` in the production build. The URL without the final slash redirects to the same page. It is an inspection page separate from the driving scene. It lists all **76 source building models** (21 small/suburban, 35 large/commercial, and 20 industrial) with a fixed type ID such as `B1-01`. The commercial group includes 16 low-detail silhouettes, which have no separate window geometry. The ID identifies the asset type, not a location or occurrence in the city. The same type can appear at multiple map sites.

The overview renders each model with red HTML/SVG window outlines. Selecting a type shows all four model-coordinate faces. Each window has an ID such as `B1-01-W02` and a model-local center `(X, Y, Z)`. The window index beneath the views lets you select and highlight an outline. Glazed panels in doors are included. The data lives in [`src/building-windows.json`](src/building-windows.json); the type catalog is [`src/building-catalog.js`](src/building-catalog.js). City instances also carry their `buildingTypeId` in `userData`.

If a source GLB is replaced or edited, regenerate its geometry-based window map with `python3 scripts/map-building-windows.py` (requires NumPy), then review the red outlines in the sheet. Existing IDs are tied to the current source models and should be reviewed before replacing those assets.

### Fire simulation

The sheet's **Simulate fire** button and 0–100% slider preview flames and smoke on the selected source model. This preview does not change a map instance. In the game, each of the 46 placed buildings has a separate `WB-###` world ID in `BUILDING_SITES`; chimneys and tanks are props without fire IDs. `window.buildingFires.onFire` is a `Map` from world ID to integer fire percentage. Scenario code can call `window.buildingFires.set('WB-029', 75)`, and setting it to `0` removes that entry. For a quick game preview, open `/?fire=WB-029:75` locally (or `/rescuePack/?fire=WB-029:75` on Pages); the `fire` parameter can be repeated for multiple buildings.

Each one-second tick gives every burning building a 30% chance to gain 1%. A building at 90% or above has a separate 10% chance per tick to add 5% to every adjacent building. Adjacency means the gap between their placement envelopes is at most 3.5 world units. Window effects follow the model's height thirds: 1–14% gives bottom-third smoke; 15–33% gives bottom-third small flames and middle-third smoke; 34–55% gives medium, small, and smoke from bottom to top; 56–79% gives strong, medium, and small flames; and 80–100% makes every window strong. Flame particles turn into smoke, and larger windows emit more particles across their full width. The large tubular chimneys built into industrial models b, c, e, f, l, m, and n emit smoke at 1–80% and medium flames with smoke at 81–100%, using the same world building fire percentage. Both renderers cap their active particles; the sheet also skips offscreen model views.

## Build and deployment

```sh
pnpm test
pnpm build
pnpm preview --port 4173
```

The production build is written to `dist`. Preview it at [localhost:4173/rescuePack/](http://localhost:4173/rescuePack/). Vite uses `/rescuePack/` as the production base so scripts, the menu image, and models load correctly from GitHub Pages; development stays at `/`.

`.github/workflows/github-pages.yml` installs the exact dependencies from `pnpm-lock.yaml`, runs the driving and city layout tests, and builds pull requests. A push to `main` or a manual run on `main` also deploys the build to GitHub Pages. In the repository's **Settings → Pages**, the source must be **GitHub Actions**. No deployment secrets are required.

## Assets

The Kenney models in `public/assets` are included in the repository with their license texts. The start screen uses `public/assets/MENU.png`.

The original Kenney ZIP downloads, root `MENU.png`, `models`, and `ref` folders are local source material and are excluded from Git. To refresh the runtime assets, place the original five ZIP files and menu image in the project root and run `python3 scripts/extract-assets.py`. A fresh clone can build and run directly from the checked-in assets.
