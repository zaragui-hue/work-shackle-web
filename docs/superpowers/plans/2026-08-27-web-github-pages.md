# Web GitHub Pages Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish only the standalone `web/` project to a public `work-shackle-web` GitHub repository and expose it through GitHub Pages.

**Architecture:** The source workspace remains the owner of `web/`, while `git subtree split` creates a Web-only branch for the public repository. A GitHub Actions workflow tests and builds Vite, uploads `dist`, and deploys Pages with the repository subpath as the production base URL.

**Tech Stack:** Git, GitHub, GitHub Actions, GitHub Pages, npm, Vite

---

### Task 1: Add production base-path and Pages workflow

**Files:**
- Modify: `web/vite.config.ts`
- Create: `web/.github/workflows/pages.yml`
- Modify: `web/README.md`

- [ ] **Step 1: Record the expected repository base path**

Run: `npm --prefix web run build`

Expected before the change: `web/dist/index.html` references assets from `/assets/`, which would fail under `/work-shackle-web/`.

- [ ] **Step 2: Configure Vite and GitHub Pages**

```ts
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/work-shackle-web/" : "/",
  plugins: [react()],
  server: { port: 1430 },
  test: { environment: "jsdom", setupFiles: "./src/test/setup.ts", css: true },
});
```

```yaml
name: Deploy Web to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run check:isolation
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Verify production asset paths and Web checks**

Run: `cd web && GITHUB_ACTIONS=true npm run build && rg '/work-shackle-web/assets/' dist/index.html && npm test && npm run check:isolation`

Expected: the built HTML uses `/work-shackle-web/assets/`; all 13 tests and isolation check pass.

- [ ] **Step 4: Commit the deployment configuration**

```bash
git add web/vite.config.ts web/.github/workflows/pages.yml web/README.md
git commit -m "ci(web): deploy standalone app to github pages"
```

### Task 2: Create and push the Web-only public repository

**Files:**
- No working-tree files modified.

- [ ] **Step 1: Create the public GitHub repository**

Create `work-shackle-web` under the currently signed-in GitHub account without initializing README, license, or `.gitignore`.

Expected: GitHub displays an empty public repository and its HTTPS clone URL.

- [ ] **Step 2: Generate a Web-only branch**

Run: `git subtree split --prefix=web -b codex/web-pages-release`

Expected: a new branch is created whose repository root contains `package.json`, `src/`, and `.github/`, with no desktop `src-tauri/`.

- [ ] **Step 3: Push the split branch**

Read the signed-in GitHub profile login into `GITHUB_LOGIN`, then run: `git remote add web-origin "https://github.com/${GITHUB_LOGIN}/work-shackle-web.git"`

Run: `git push web-origin codex/web-pages-release:main`

Expected: the public repository `main` branch receives only Web files.

- [ ] **Step 4: Verify public repository isolation**

Run: `git ls-tree -r --name-only codex/web-pages-release | rg '^(src-tauri/|src/services/tauri/)'`

Expected: no output.

### Task 3: Enable Pages and verify the public URL

**Files:**
- No working-tree files modified.

- [ ] **Step 1: Confirm Pages uses GitHub Actions**

Open the new repository Settings → Pages and select GitHub Actions if it is not already selected by the workflow.

Expected: the repository reports GitHub Actions as the Pages source.

- [ ] **Step 2: Wait for the deployment workflow**

Open the repository Actions page and inspect `Deploy Web to GitHub Pages`.

Expected: install, test, isolation, build, artifact upload, and deployment steps all complete successfully.

- [ ] **Step 3: Verify the public site**

Open `https://${GITHUB_LOGIN}.github.io/work-shackle-web/` using the signed-in profile login discovered in Task 2.

Expected: HTTPS loads the folder-selection startup page without missing assets or console errors.

- [ ] **Step 4: Report durable links**

Return the public repository URL, Pages URL, deployment status, and the exact future subtree push command. Confirm that desktop App files were not uploaded.
