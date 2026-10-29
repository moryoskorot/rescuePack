# Repository instructions

These instructions apply to this repository and its subdirectories.

## Finish and publish

- Unless the user explicitly asks for local-only work or says not to publish, finish each requested change by running the relevant tests and build, committing the completed work, and pushing it to `origin`.
- This repository deploys GitHub Pages from pushes to `main` through `.github/workflows/github-pages.yml`. After pushing, check the deployment result and give the user the clickable test link at `https://moryoskorot.github.io/rescuePack/`. Do not claim the change is live until deployment succeeds. If deployment fails or cannot be checked, report that clearly and give the commit or workflow link instead.
- Stage and commit only files belonging to the completed task. Preserve unrelated uncommitted changes, including another person's work. If they prevent a safe push, explain the blocker instead of silently including or discarding them.
- For a different project, use its configured deployed test URL (for example, its `*.nothing-casual.party` address). Verify that project's actual deployment setup and URL before reporting it.

## Local-only requests

- When the user says to do the work locally, run the local server, keep it running for testing, and include the actual startup output and reachable local URL in the final response. Do not substitute a guessed URL or a build result for a running server.
- For this repository, the development server is `pnpm dev --port 5174` and normally serves `http://127.0.0.1:5174/`. The production preview is `pnpm preview --port 4173` and normally serves `http://127.0.0.1:4173/rescuePack/`. Confirm the URL shown by the running command.
