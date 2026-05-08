# Lab 14: Deploy a React + TypeScript app to S3 with GitHub Actions

## Goal

Build two GitHub Actions workflows around a real Vite + React + TypeScript app:

1. **CI** — on every pull request targeting `main`: install dependencies (cached), lint, type-check, run unit tests, and produce a production build.
2. **CD** — on every merge (push) to `main`: rebuild and deploy the static `dist/` output to an AWS S3 bucket configured for static website hosting, then run a **post-deploy smoke test** against the live URL.

You will learn the conventional shape of CI/CD on GitHub Actions, how to authenticate to AWS from a workflow, post-deploy verification, and the minimum guardrails (pinned actions, least-privilege secrets, concurrency, environments) that keep a deploy pipeline safe.

---

## Prerequisites

Before you start, make sure you have:

- **Node.js 20** installed (`node --version` should print `v20.x`). Use [nvm](https://github.com/nvm-sh/nvm) (`nvm install 20 && nvm use 20`) or [Volta](https://volta.sh/).
- **Git** + a **GitHub account** (with `gh` CLI optional but recommended).
- An **AWS account access pack** from your instructor — they will give you:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_REGION` (default for this lab: `us-east-1`)
  - `S3_BUCKET` (the bucket name your work will deploy to)

> **Never commit AWS keys to git.** If `git status` ever shows a file containing them, stop and rotate immediately.

---

## Step 1 — Get your own copy of the repo

1. Fork this repository to your own GitHub account (top-right **Fork** button), **or** create a new empty repo and push the starter code into it.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/<your-username>/lab14-s3-html-deploy.git
   cd lab14-s3-html-deploy
   ```

---

## Step 2 — Run the starter project locally

This confirms the baseline is green before you start touching workflows.

```bash
nvm use            # picks Node 20 from .nvmrc
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

All five commands must pass. If any fail, fix the environment before continuing — you cannot debug CI on top of a broken local baseline.

The starter ships these files (already working):

```
.
├── index.html
├── package.json          # scripts: lint, typecheck, test, build
├── eslint.config.js
├── .prettierrc.json
├── tsconfig*.json
├── vite.config.ts
├── public/
└── src/
    ├── App.tsx           # tiny demo page
    ├── App.test.tsx      # @testing-library/react test
    ├── lib/
    │   ├── greet.ts
    │   └── greet.test.ts # vitest unit test
    ├── main.tsx
    ├── index.css
    └── setupTests.ts
tests/
└── smoke/
    └── site.smoke.test.ts  # Vitest suite — runs against the live deployed URL
```

You do **not** need to modify any source files. Your work is in `.github/workflows/` only.

---

## Step 3 — Configure GitHub repository secrets and environment

The workflows you are about to write need credentials. Add them as **repository secrets** (not environment files, not code):

1. Open your repo on GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
2. Add each of the following exactly as named:

   | Name                    | Value                                              |
   | ----------------------- | -------------------------------------------------- |
   | `AWS_ACCESS_KEY_ID`     | Provided by your instructor                        |
   | `AWS_SECRET_ACCESS_KEY` | Provided by your instructor                        |
   | `AWS_REGION`            | `us-east-1`                                        |
   | `S3_BUCKET`             | Bucket name provided by your instructor            |

3. Create the deployment environment:
   - Repo → **Settings** → **Environments** → **New environment** → name it exactly `production`.
   - (Optional but recommended) Add a **Required reviewers** rule so deploys must be approved before they run.

If you accidentally name a secret differently, the workflow will fail with `Error: Could not load credentials...` — check the names match exactly.

---

## Step 4 — Write the workflows

Create the workflow directory and two files:

```bash
mkdir -p .github/workflows
touch .github/workflows/ci.yml
touch .github/workflows/deploy.yml
```

The acceptance criteria below define exactly what each file must do. **You must write them yourself** — do not copy from another lab.

### Acceptance criteria

#### CI workflow (`.github/workflows/ci.yml`)

- [ ] Triggers on `pull_request` events whose **base** branch is `main`
- [ ] Runs on `ubuntu-latest`
- [ ] Uses Node.js **20** via `actions/setup-node@v4` with npm dependency caching enabled (`cache: 'npm'`)
- [ ] Installs dependencies with `npm ci` (not `npm install`)
- [ ] Runs, **in order**: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- [ ] Sets top-level `permissions:` to the minimum needed (`contents: read`)

#### CD workflow (`.github/workflows/deploy.yml`)

The CD workflow has **two jobs** — `deploy` and `smoke-test`.

**`deploy` job:**

- [ ] Triggers on `push` to `main` **only** (not tags, not PRs)
- [ ] Top-level `permissions: contents: read`
- [ ] Top-level `concurrency` group keyed to the branch with `cancel-in-progress: false` so deploys queue rather than overlap
- [ ] Job runs inside a GitHub **Environment** named `production`
- [ ] Installs deps and builds: `npm ci` → `npm run build`
- [ ] Configures AWS credentials with `aws-actions/configure-aws-credentials@v4`, reading `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION` from secrets
- [ ] Syncs the build output to S3: `aws s3 sync ./dist s3://$S3_BUCKET --delete` (where `S3_BUCKET` comes from the secret)

**`smoke-test` job:**

- [ ] Declared with `needs: deploy` so it only runs after a successful deploy
- [ ] Checks out the repo, sets up Node 20 (with npm cache), and runs `npm ci`
- [ ] Runs the dedicated smoke suite via `npm run smoke`, with the live site URL passed in the `SITE_URL` env var (built as `http://<S3_BUCKET>.s3-website-<AWS_REGION>.amazonaws.com`)
- [ ] **Do not** inline `curl`+`grep` in shell — the project ships a real Vitest suite under `tests/smoke/`. Your job is to execute it, not reimplement it. The suite asserts: HTTP 200, `text/html` content-type, expected `<title>`, root mount node, and that the linked JS/CSS bundles are reachable.

**Pinning rule (applies to both files):**

- [ ] All third-party actions pinned to a major version tag (`@v4`) **or** a full commit SHA — no `@main`, `@master`, or unpinned references.

---

## Step 5 — Test your workflows

1. Create a feature branch (do **not** push directly to `main`):
   ```bash
   git checkout -b feat/ci-cd
   git add .github/workflows
   git commit -m "ci: add CI and CD workflows"
   git push -u origin feat/ci-cd
   ```
2. Open a **pull request** from `feat/ci-cd` → `main` on GitHub.
3. Watch the **Actions** tab. Your `CI` workflow should run on the PR. It must turn green before you continue.
4. Once CI is green, **merge the PR** to `main`. This triggers `Deploy to S3`. Watch both jobs (`deploy` then `smoke-test`) — both must succeed.
5. Visit your site:
   ```
   http://<S3_BUCKET>.s3-website-us-east-1.amazonaws.com
   ```
   Replace `<S3_BUCKET>` with your bucket name. The page should show **"Hello, IITC!"**.

You're done when:

- ✅ CI runs green on your PR
- ✅ `deploy` job succeeds on merge to `main`
- ✅ `smoke-test` job succeeds
- ✅ The S3 website URL serves your app

---

## Hints

- The CI workflow only needs **read** permissions; tighten the top-level `permissions:` block accordingly. The CD workflow does **not** need `id-token: write` for this lab (we use static keys, not OIDC).
- `actions/setup-node@v4` has a built-in npm cache — read the action's README for the right input. You should not need a separate `actions/cache@v4` step.
- A `concurrency` group of `${{ github.workflow }}-${{ github.ref }}` is the conventional shape. Decide whether to cancel or queue (hint: queue for prod deploys).
- `aws s3 sync --delete` removes files in the bucket that are not in `dist/`. That is what you want for a SPA — but think about why before you copy it.
- For SPAs on S3 static hosting, the website's **error document** should be `index.html` so client-side routes resolve. The bucket has already been configured this way for you.
- The `aws` CLI is preinstalled on `ubuntu-latest` runners. You do not need a separate setup step after `configure-aws-credentials`.
- For the smoke test, build the URL as `http://<S3_BUCKET>.s3-website-<AWS_REGION>.amazonaws.com` and pass it via `SITE_URL` to `npm run smoke`. The suite under `tests/smoke/` already handles retry/backoff for S3's brief eventual-consistency window. You can run it locally too: `SITE_URL=http://... npm run smoke`.

---

## Best-practice checklist (graded informally)

- [ ] Every `uses:` line is pinned (`@v4` minimum, full SHA preferred for third-party actions you don't control)
- [ ] Top-level `permissions:` block on both workflows
- [ ] Step `name:` fields are human-readable
- [ ] No secrets are echoed (never `echo $AWS_SECRET_ACCESS_KEY` or print `${{ secrets.* }}`)
- [ ] The CD `deploy` job uses `environment: production`
- [ ] The CD workflow has a top-level `concurrency:` block
- [ ] Smoke test exists, runs **after** deploy via `needs:`, and fails the workflow on a bad probe

---

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `Could not load credentials from any providers` | Secret name typo — check `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` exact spelling |
| `AccessDenied` on `aws s3 sync` | IAM user missing `s3:PutObject` / `s3:DeleteObject` on the bucket |
| `NoSuchBucket` | `S3_BUCKET` secret value is wrong, or bucket is in a different region than `AWS_REGION` |
| Smoke test fails with 404 | Sync ran against wrong bucket, or `aws s3 sync` source path is wrong (must be `./dist`, not `.`) |
| Smoke test fails with timeout | Static website hosting not enabled on the bucket — instructor problem, raise it |
| `SITE_URL env var is required` | Smoke job did not pass `SITE_URL` to `npm run smoke` — check the `env:` block on the step |
| Workflow doesn't trigger | Wrong `on:` block — recheck `pull_request: branches: [main]` for CI and `push: branches: [main]` for CD |

---

## Where the workflows go

```
.github/workflows/ci.yml
.github/workflows/deploy.yml
```

Nothing else in the repo should change. Good luck.
