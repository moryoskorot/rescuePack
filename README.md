# Rescue Pack: City Drive

A small browser town to explore in a Kenney firetruck. Downtown and the town square sit in the center, with suburbs to the west, factories and tightly packed yards to the east, and a harbor walk along the south edge.

## Play

The published game is hosted at [moryoskorot.github.io/rescuePack](https://moryoskorot.github.io/rescuePack/).

For local development, use Node.js 24 and pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm dev --port 5174
```

Open [localhost:5174](http://127.0.0.1:5174/). Use **WASD** or **arrow keys** to drive, **Space** to handbrake and drift, **drag the mouse** to change the camera angle, and **scroll** to zoom. Drifting leaves tire marks on the ground.

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
