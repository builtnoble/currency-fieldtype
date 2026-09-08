## Description

<!-- What does this PR do, and why? -->

Closes #

## Type of change

<!-- Check one — this determines the release-notes category (see .github/release.yml). Apply the matching label before merging. -->

- [ ] `feat` — new feature
- [ ] `fix` — bug fix
- [ ] `refactor` — code change that neither fixes a bug nor adds a feature
- [ ] `chore` — tooling/build/dependency maintenance
- [ ] `docs` — documentation only

## Checklist

- [ ] `composer test` passes (Pest)
- [ ] `composer lint` passes (Pint)
- [ ] `composer analyse` passes (PHPStan)
- [ ] `npm run test` passes (Vitest), if `resources/js` was touched
- [ ] `npm run lint` passes (Biome), if `resources/js` was touched
- [ ] If `resources/js` changed, compiled assets were rebuilt with `npm run build` and the resulting `resources/dist/` changes are included in this PR
- [ ] A matching label (`feat`/`fix`/`refactor`/`chore`/`docs`) has been applied to this PR
