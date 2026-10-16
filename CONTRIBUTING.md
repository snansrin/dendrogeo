# Contributing to DendroGeo

Contributions are welcome through GitHub issues and pull requests.

## Before opening a pull request

1. Open an issue for a new feature or a change affecting scientific methods, stored data, access control, or public reports.
2. Keep changes within the relevant domain, application, adapter, UI, or documentation module. Preserve service boundaries and generated-file workflows.
3. Never commit credentials, private measurements, photographs, precise private locations, or unpublished research data. Use synthetic fixtures and obtain explicit publication permission for proposed data releases.
4. Add focused tests for behavior changes and document scientific assumptions, sources, uncertainty, and limitations.
5. Run npm ci and npm run check. For client packages, follow clients/README.md.

## Pull request contents

Describe the user-visible change, affected modules, scientific or privacy implications, and checks performed. Link related issues. Keep unrelated formatting out of the change. Generated assets must follow the documented build command and include its deterministic output.

## Scientific and data changes

Separate observed measurements, external source data, derived values, and editorial interpretation. Do not silently replace an accepted analysis or change a published DGR artifact. New analysis versions must preserve provenance and create a new immutable report identity. Public release of user-contributed data requires rights, consent, and a clear dataset-specific license.

## Support and reporting problems

Use GitHub Issues for reproducible software problems and feature requests. For security issues, follow SECURITY.md and avoid posting exploitable details publicly.

By participating, you agree to follow CODE_OF_CONDUCT.md.
