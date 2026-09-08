# Contributing

Thanks for your interest in contributing to the Currency Fieldtype addon for Statamic!

## Prerequisites

- PHP 8.3+ with the `intl` extension
- Composer
- Node 22+ and npm

## Getting started

This repository is fully self-contained and doesn't require a Statamic site or Laravel Sail to develop against — it's tested standalone via [Orchestra Testbench](https://packagist.org/packages/orchestra/testbench).

```bash
git clone git@github.com:builtnoble/currency-fieldtype.git
cd currency-fieldtype
composer install
npm install
```

## Running the test suites

```bash
composer test          # Pest (PHP)
composer test:feature  # Pest, feature-grouped only
npm run test            # Vitest (JS)
```

## Code style and static analysis

```bash
composer lint      # Pint, check only (CI mode)
composer format     # Pint, auto-fix
composer analyse    # PHPStan (via Larastan)
npm run lint         # Biome, check only
npm run format       # Biome, auto-fix
composer check       # lint + analyse + test, all at once
```

Pint's rules live in `pint.json` and Biome's live in `biome.json` — check those files rather than guessing at style, and don't hand-copy config from other repos.

## Branching and PR workflow

- Branch off `develop` (the default branch) using `feature/`, `fix/`, or `hotfix/` prefixes.
- Open pull requests against `develop`, not `main`. `main` only receives PRs from `develop` at release time.
- Apply exactly one type label to your PR — `feat`, `fix`, `refactor`, `chore`, or `docs`. This drives the category your change appears under in the auto-generated release notes (see `.github/release.yml`); GitHub only categorizes by label, not by commit message, so this step matters even if your commits already follow Conventional Commits.

> **Looking ahead:** this addon currently supports a single Statamic major version and uses a simple `develop`/`main` flow. Once a future Statamic major version requires this addon to support multiple Statamic versions concurrently, we'll introduce versioned maintenance branches (e.g. `6.x`) similar to how other mature Statamic addons handle it. That's not needed yet, but don't be surprised if it shows up later.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`, etc.). Commits authored by the maintainer don't include AI co-author trailers — that's this project's house style for its own commits, not a requirement placed on your commits or tooling.

## Recommended branch protection

Once this repository is public, the following branch protection rules are recommended for both `main` and `develop`:

- Require a pull request before merging (a required approving review count of 0 is acceptable for a solo maintainer — raise it as the contributor base grows)
- Require status checks to pass before merging: `PHP 8.3`, `PHP 8.4`, `phpstan`, `js-tests`, `lint-code-styling`
- Require branches to be up to date before merging
- Do not allow force pushes
- Do not allow branch deletion

## Releasing

1. Open a PR merging `develop` into `main`.
2. Once merged, tag the release on `main`: `git tag vX.Y.Z && git push origin vX.Y.Z`
3. Create the GitHub release with auto-generated notes: `gh release create vX.Y.Z --generate-notes` — this picks up the label categorization from `.github/release.yml` automatically.
