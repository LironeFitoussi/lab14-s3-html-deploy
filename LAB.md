# Lab 14: Deploy a React + TypeScript app to S3 with GitHub Actions

## Goal

Build two GitHub Actions workflows around a real Vite + React + TypeScript app:

1. **CI** — on every pull request targeting `main`: install dependencies (cached), lint, type-check, run unit tests, and produce a production build.
2. **CD** — on every merge (push) to `main`: rebuild and deploy the static `dist/` output to an AWS S3 bucket configured for static website hosting.

You will learn the conventional shape of CI/CD on GitHub Actions, how to authenticate to AWS from a workflow, and the minimum guardrails (pinned actions, least-privilege secrets, concurrency, environments) that keep a deploy pipeline safe.

## What you have

A working Vite + React + TypeScript starter project:

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
```

Run locally first to confirm the baseline is green:

```bash
nvm use            # Node 20 (.nvmrc)
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

All five commands must pass before you start writing the workflows.

## Acceptance criteria

You must create **two** workflow files under `.github/workflows/`.

### CI workflow (e.g. `ci.yml`)

- [ ] Triggers on `pull_request` events whose **base** branch is `main`
- [ ] Runs on `ubuntu-latest`
- [ ] Uses Node.js **20** via `actions/setup-node@v4` with npm dependency caching enabled (`cache: 'npm'`)
- [ ] Installs dependencies with `npm ci`
- [ ] Runs, in order: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- [ ] Sets top-level `permissions:` to the minimum needed (`contents: read`)

### CD workflow (e.g. `deploy.yml`)

- [ ] Triggers on `push` to `main` **only** (not on tags, not on PRs)
- [ ] Uses a `concurrency` group keyed to the branch with `cancel-in-progress: false` so deploys queue rather than overlap
- [ ] Runs the deploy job inside a GitHub **Environment** named `production`
- [ ] Builds the app the same way CI does (`npm ci` → `npm run build`)
- [ ] Configures AWS credentials with `aws-actions/configure-aws-credentials@v4` using the repository secrets `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION`
- [ ] Syncs `dist/` to the bucket named in secret `S3_BUCKET` using `aws s3 sync ./dist s3://$S3_BUCKET --delete`
- [ ] All third-party actions are pinned to a major version tag (`@v4`) **or** a full commit SHA — no `@main`, `@master`, or unpinned

When the workflow finishes, your site must be reachable at:

```
http://<S3_BUCKET>.s3-website-us-east-1.amazonaws.com
```

## Manual setup you must do (one time, before the workflows can run)

The instructor will give you AWS credentials with **least privilege** (only `s3:ListBucket`, `s3:PutObject`, `s3:DeleteObject`, `s3:GetObject` scoped to the lab bucket). Add them to GitHub as repository secrets:

1. Go to your repo on GitHub → **Settings** → **Secrets and variables** → **Actions**.
2. Click **New repository secret** and add each of the following:

   | Name                    | Value                                              |
   | ----------------------- | -------------------------------------------------- |
   | `AWS_ACCESS_KEY_ID`     | Provided by your instructor                        |
   | `AWS_SECRET_ACCESS_KEY` | Provided by your instructor                        |
   | `AWS_REGION`            | `us-east-1`                                        |
   | `S3_BUCKET`             | Bucket name provided by your instructor            |

3. Create the deployment environment:
   - Repo → **Settings** → **Environments** → **New environment** → name it `production`.
   - (Optional but recommended) Add a **Required reviewers** rule so deploys must be approved.

> **Never commit AWS keys to the repo.** If `git status` ever shows a file with credentials, stop and rotate the keys immediately.

## Hints

- The CI workflow only needs read permissions; tighten the top-level `permissions:` block accordingly. The CD workflow does not need `id-token: write` for this lab (we are using static keys, not OIDC).
- `actions/setup-node@v4` has a built-in npm cache — read the action's README for the right input. You should not need a separate `actions/cache@v4` step.
- A `concurrency` group of `${{ github.workflow }}-${{ github.ref }}` is the conventional shape. Decide whether to cancel or queue.
- `aws s3 sync --delete` removes files in the bucket that are not in `dist/`. That is what you want for a SPA — but think about why before you copy it.
- For SPAs on S3 static hosting, set the website's **error document** to `index.html` so client-side routes resolve. The bucket has already been configured this way for you, but keep it in mind for future labs.
- The `aws` CLI is preinstalled on `ubuntu-latest` runners. You do not need a separate setup step after `configure-aws-credentials`.

## Best-practice checklist (graded informally)

- Every `uses:` line is pinned (`@v4` minimum, full SHA preferred for third-party actions you don't control).
- Top-level `permissions:` block on both workflows.
- Step names (`name:`) are human-readable.
- No secrets are echoed (no `echo $AWS_SECRET_ACCESS_KEY` ever).
- The CD job uses `environment: production`.
- The deploy job has a `concurrency:` block.

## Where the workflows go

```
.github/workflows/ci.yml
.github/workflows/deploy.yml
```

Good luck — when your PR turns green and a merge lights up the bucket, you're done.
