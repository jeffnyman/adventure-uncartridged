## Pre-Commit: Staged Linting

The `.vite-hooks/pre-commit` hook runs a single command: `vp staged`. This is not a generic "run all checks" step. It executes only against the files currently in the Git staging area, and it dispatches each file through the `staged` map defined in `vite.config.ts`:

```ts
staged: {
  "*.css": "stylelint --fix",
  "*": "vp check --fix",
},
```

- `*.css` files are passed to `stylelint --fix` first.
- Everything else goes through `vp check --fix`, which runs Oxfmt formatting and Oxlint linting with auto-fix enabled.

Both commands attempt to auto-fix what they can and re-stage the result. If the hook still fails after fixing, it's a hard error that cannot be resolved automatically, meaning the underlying issue must be fixed manually before the commit will proceed.

## Quality Check Commands

Two commands cover different parts of the validation pipeline and are intentionally kept separate:

- **`vp check`** — Runs Oxfmt (formatting), Oxlint (linting), and TypeScript type-checking together. This is what the pre-commit hook and CI both use.
- **`vp test`** — Runs the Vitest test suite. This is separate so test failures don't block formatting feedback and vice versa.

In CI they run sequentially (`vp check` then `vp test`). Locally, either can be run independently. The custom `checks` task in `vite.config.ts` runs both together after Fallow and Stylelint complete:

```ts
run: {
  tasks: {
    fallow:    { command: "fallow",           cache: true },
    stylelint: { command: "stylelint **/*.css", cache: true },
    checks:    { dependsOn: ["stylelint", "fallow"], command: "vp check && vp test" },
  },
},
```

`fallow` and `stylelint` tasks are cached, which means that repeated `vp run fallow` or `vp run stylelint` calls skip re-analysis when inputs haven't changed. `vp run checks` runs the full suite including both.

## CI/CD Workflows

Two GitHub Actions workflows handle automated validation and deployment. Both use `voidzero-dev/setup-vp@v1`, which sets up Node, pnpm, and the `vp` CLI in a single step instead of the usual multi-action bootstrap.

### `ci.yml` — Continuous Integration

Triggers on every push and pull request targeting `main`. Runs install → check → test → build. A PR cannot be merged if any of these steps fail.

### `deploy.yml` — GitHub Pages Deployment

Triggers **only when a GitHub release is published**, not on every push to `main`. This means the live site at the `homepage` URL does not update until an explicit release is cut. The workflow builds the app and deploys `dist/` to GitHub Pages using the standard Pages artifact actions.

The `base` in `vite.config.ts` is set to `/adventure-uncartridged/` to match the GitHub Pages subdirectory path, which is required for asset URLs to resolve correctly when served from a subdirectory.

## Release Pipeline

Releases are managed by `release-it` and driven through `vp run release` (which uses pnpm behind the scenes). The full flow:

1. **Pre-flight:** Runs `vp check && vp test` — release is blocked if either fails.
2. **Version bump:** Prompts for the new version (major/minor/patch).
3. **Changelog:** `@release-it/conventional-changelog` generates or appends to `CHANGELOG.md` from commit history since the last tag.
4. **Build:** Runs `vp build` after the version bump.
5. **Commit + tag + push:** Commits `chore: release vX.Y.Z`, creates a git tag, and pushes both to `main`.
6. **GitHub release:** Opens the GitHub web UI to publish the release draft.

Publishing the release on GitHub then triggers the `deploy.yml` workflow, updating the live site.

**Constraints:**

- `release-it` enforces that releases can only be run from the `main` branch.
- `vp run release:dry` runs the full flow including changelog preview without making any commits, tags, or pushes. Use this to verify the changelog looks correct before an actual release.

## TypeScript: `erasableSyntaxOnly`

The `tsconfig.json` enables `erasableSyntaxOnly`, which restricts TypeScript to syntax that can be fully erased at build time with no runtime behavior. This forbids:

- `enum` (generates runtime objects)
- `namespace` / `module` declarations (generates IIFEs)
- Legacy `experimentalDecorators` (generates descriptor mutations)
- Parameter properties in constructors (e.g., `constructor(private x: number)`)

My main focus here is to use plain `const` objects or `satisfies` expressions in place of enums. This aligns with the broader TypeScript direction of treating `.ts` files as type-annotated JavaScript with no emit-time surprises.

## Linting: `vite-plus/prefer-vite-plus-imports`

The `lint` section of `vite.config.ts` loads the Vite+ Oxlint plugin and enables one custom rule:

```ts
lint: {
  jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
  rules: { "vite-plus/prefer-vite-plus-imports": "error" },
},
```

This rule makes importing from `vite` or `vitest` directly a lint error. All imports must go through `vite-plus` and `vite-plus/test` respectively. This ensures the toolchain's version unification in `pnpm-workspace.yaml` cannot be accidentally bypassed by a direct import that resolves outside of Vite+'s managed dependency graph.

## Windows: Smart App Control

Windows 11 includes a feature called **Smart App Control** (SAC) that blocks native executables it can't verify through Microsoft's cloud reputation service. This is entirely separate from antivirus software like Norton or Windows Defender. SAC operates at the kernel level and intercepts `CreateProcess` calls before any scanner sees them.

This matters here because Fallow ships a native Windows binary (`fallow.exe`) distributed as `@fallow-cli/win32-x64-msvc` via npm. It has no Microsoft reputation history, which makes it a SAC target.

### Why It Can Silently Appear to Work at First

SAC has three states: **Evaluation**, **On**, and **Off**. In Evaluation mode it monitors execution without blocking. Windows is gathering data to decide what kind of machine this is. During that window, `fallow` runs fine. At some point Windows makes its decision and transitions to **On**, at which point enforcement begins and previously-working binaries start getting blocked without warning.

### Symptoms

- `fallow` appears to run but produces no output.
- No `.fallow/` cache directory is created.
- Norton or Defender quarantine logs show nothing (SAC blocks before AV runs).
- Adding a Norton exclusion has no effect; it's the wrong layer entirely.

### Diagnosis

Run `fallow.exe` directly via PowerShell:

```powershell
& 'F:\Projects\adventure-uncartridged\node_modules\.pnpm\@fallow-cli+win32-x64-msvc@2.101.0\node_modules\@fallow-cli\win32-x64-msvc\fallow.exe' --version
```

If SAC is the cause, the error is unambiguous:

```
An Application Control policy has blocked this file
```

### Fix

**Windows Security → App & Browser Control → Smart App Control → Off.**

One important caveat: SAC's state transitions are one-way. Once set to Off, Windows will not allow a return to Evaluation mode. Only a full OS reinstall resets it. You can toggle between On and Off, but Evaluation is gone permanently. Turning it Off does not reduce antivirus coverage; Norton and Defender real-time scanning remain fully active.

For any development machine pulling native binaries through npm or pnpm, Off is the correct setting.

## Fallow Toolchain Suppressions

I use **Fallow** for static dead-code and dependency analysis. There are specific root-level configurations in `.fallowrc.json` to handle the setup.

### 1. `unused-catalog-entries: "off"` (Global Rule)

- **Why:** Vite+ unifies and executes testing binaries natively underneath its `vp` CLI toolchain. It manages upstream dependencies directly without forcing sub-packages to explicitly declare them.
- **The Conflict:** Fallow strictly looks for explicit package declarations or local lockfile references. Because Vite+ handles this under the hood, Fallow falsely flags the global `vitest` catalog entry in `pnpm-workspace.yaml` as dead code.
- **Impact:** This architectural rule is turned off globally because workspace catalogs are evaluated repository-wide. Disabling it has **zero impact** on Fallow's ability to scan the actual application source code, components, or module imports.

### 2. `unused-dependency-overrides: "off"` (File-Scoped Override)

- **Why:** Vite+ automatically generates an ecosystem lockdown block in `pnpm-workspace.yaml` that overrides requests for `vitest` and routes them to the official `@voidzero-dev/vite-plus-core` catalog core component.
- **The Conflict:** Since `package.json` no longer contains direct `vitest` dependencies, Fallow flags the override block as an unreferenced, broken override.
- **Impact:** This rule is cleanly isolated and turned off _only_ for `pnpm-workspace.yaml` using the `overrides` array matching block. It remains **100% active** for all other repository modules, ensuring that standard package dependencies stay strictly validated against secure CVE versions.

## Commit Hook Architecture

This project uses Vite+'s `.vite-hooks/` directory for Git hooks instead of Husky or similar tooling. Vite+ installs hooks via `vp config` (also run as the `prepare` script).

### Why `commitlint` is called directly

The `.vite-hooks/commit-msg` hook calls `commitlint` without a package executor:

```sh
commitlint --edit "$1"
```

This works because Vite+ adds `./node_modules/.bin` to the PATH when executing hook scripts, making any dev dependency binary directly callable. Approaches like `npx --no --`, `pnpm exec`, or `vpx --no --` all fail in this context, either because the package manager isn't in the Git Bash PATH on Windows, or because `vpx` doesn't support the `--no` flag (it is a `pnpm dlx` analog, not an `npx` analog).

### Conventional commits

Commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification, enforced by commitlint.

#### Conventional commit types

- **`feat`** — A new feature or capability.
- **`fix`** — A bug fix.
- **`docs`** — Documentation changes only. No logic or formatting changes.
- **`style`** — Code formatting or whitespace changes only. Note that this refers to _code_ style, not visual or CSS styling.
- **`refactor`** — Code restructuring with no feature addition or bug fix. If it also fixes a bug, use `fix`. If it also adds behavior, use `feat`.
- **`perf`** — A change that improves performance with no behavioral change. For a game project this will come up often — rendering loops, collision detection, and canvas operations are all performance-sensitive.
- **`test`** — Adding or correcting tests only.
- **`build`** — Changes to the build system or dependencies.
- **`ci`** — Changes to CI configuration or workflows.
- **`chore`** — Maintenance tasks that don't fit elsewhere. Use sparingly — if you find yourself reaching for `chore` often, it usually means the commit should be broken up or reclassified.
- **`revert`** — Reverts a previous commit.

An optional scope can be added in parentheses to identify the subsystem affected:

```
feat(player): add diagonal movement
fix(collision): correct boundary detection on room wrap
docs(devnotes): document commit hook architecture
```
