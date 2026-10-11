# Agent instructions

## Commits

Never add a co-author. Do not pass `--trailer` with `Co-authored-by`, and do not put a `Co-authored-by` line in the commit message. If a commit command would include that trailer, do not run it.

## Main branch

The GitHub ruleset **Protect main** applies to everyone.

- Open a pull request to change `main`. Do not push commits straight to `main`.
- Do not force-push `main`, and do not delete it.
- Merge only after the `test-and-build` check has succeeded on a branch that is up to date with `main`.

## Version tags

The GitHub ruleset **Protect version tags** applies to `v*` tags.

- Push a new `v*` tag when a release asks for one.
- Do not delete a `v*` tag, and do not move one that already exists.

## Release

Do this only when the user asks to release. That request allows the version commit, the pull request, the merge, and the tag push. GVault is a Chrome extension. A push to `main` runs `test-and-build` and does not publish. Do not run `npm publish`. After the tag is on `main`, tell the user the tag is ready for a manual Chrome Web Store upload.

From the repo root, with the release changes already committed:

1. Read `version` in `package.json` and `manifest.json`. Stop if they differ.
2. Increment the patch segment (`X.Y.Z` → `X.Y.(Z+1)`, so `0.3.0` becomes `0.3.1`) unless the user asks for a minor or major bump. A minor bump increments `Y` and sets `Z` to `0`. A major bump increments `X` and sets `Y` and `Z` to `0`.
3. Write that version in both `package.json` and `manifest.json`.
4. Run `npm test` and `npm run build`. Stop if either fails.
5. If the current branch is `main`, create `release/vX.Y.Z` from it before committing.
6. Commit only those version edits. The commit message is `Release vX.Y.Z` and nothing else. No `--trailer` and no `Co-authored-by` line.
7. Push that branch and open a pull request into `main`.
8. Merge the pull request after `test-and-build` succeeds.
9. Tag the merge commit on `main` with `vX.Y.Z` (`git tag v0.3.1`). The tag must match `version` and must not already exist. Push that tag only: `git push origin vX.Y.Z`.

Leave an existing tag where it is. Do not upload the extension. Tell the user the tag and that the Chrome Web Store package is published manually.
