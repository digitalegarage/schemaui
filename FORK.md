# digitalegarage fork

This fork keeps the schemaui UI and fixes config editing paths that could
silently change unrelated data:

- Missing optional fields stay absent until edited. Existing `null`, `false`,
  zero, empty strings, and empty arrays stay intact.
- Existing map values and homogeneous array items are not copied into new-entry
  templates. Explicit schema defaults and positional tuple defaults remain
  available.
- New object variants include required fields and authored defaults; inferred
  optional placeholders stay out of the result.
- Opening a nullable map entry and pressing Done preserves null. Adding or
  renaming a key cannot overwrite a sibling.

Map entries have Add/Edit/Remove controls. Optional scalar fields do not yet
have a separate unset control.

## Builds and releases

The `ARD fork binaries` workflow builds the embedded frontend before compiling
the CLI. It supports Apple Silicon Mac, Intel Mac, and Linux x64, and publishes
archives plus `SHA256SUMS` only after every platform succeeds. It uses this
repository's automatic `GITHUB_TOKEN`; no registry-publishing, cloud, or
1Password token is needed.

Merge the reviewed changes, then create and push an
`ard-v<major>.<minor>.<patch>.<revision>` tag, for example `ard-v0.9.3.1`. The
workflow can also rebuild an existing tag through workflow dispatch. No tag or
public release is created by opening a PR. Upstream registry/package-manager
release automation remains guarded to the upstream repository.

The release tag identifies the fork revision; the CLI's reported upstream
version remains 0.9.3. Consumers should pin the release tag and reviewed source
tree, verify `SHA256SUMS` from this trusted repository, and cache by version and
platform. A local build should check out an exact commit, initialize submodules,
run `pnpm install --frozen-lockfile && pnpm run build:embedded` in `web/ui`,
then build `schemaui-cli` with Cargo's `full` feature.

## Checks

```sh
(cd web/ui && pnpm install --frozen-lockfile && pnpm test && pnpm typecheck && pnpm lint && pnpm run build:embedded)
cargo test --locked --no-default-features --features json,tui,web --lib
cargo build --locked -p schemaui-cli --no-default-features --features full
```
