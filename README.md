# Adventure Uncartridged

_From ROM to DOM_

This project is my attempt to recreate the Atari 2600 game _Adventure_ in TypeScript so it's easily playable in a browser. My goal is complete fidelity with the original assembled game, the source code of which is included in this repository.

## Contributing

### Setup

Clone the repository and install dependencies:

```sh
vp install
```

This also runs the `prepare` script, which calls `vp config` to install the Git hooks in `.vite-hooks/` automatically.

### Development

Start the dev server:

```sh
vp dev
```

### Before Committing

The pre-commit hook runs `vp staged`, which lints and formats only the files you have staged. It does **not** run the test suite. To catch test failures before pushing, run the full check locally:

```sh
vp check && vp test
```

Commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification and `commitlint` enforces this on every commit.

### Build

To verify a production build locally:

```sh
vp build
```

### Branch Protection

The `main` branch requires linear history. When working on a feature branch, rebase onto `main` rather than merging it:

```sh
git fetch origin
git rebase origin/main
```

Standard merge commits will be rejected. GitHub will only offer "Rebase and merge" or "Squash and merge" when submitting a pull request.
