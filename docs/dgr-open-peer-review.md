# DGR open peer-review record

## Purpose and scope

DGR may carry a public, append-only peer-review record tied to one immutable report identifier and result hash. The record documents who contributed each review role and what review material participants have explicitly agreed to publish. It is a transparency record for a DendroGeo report; it does not imply journal review, journal acceptance, or independent scientific certification.

## Public roles

- **Reviewer** — assesses methods, data quality, reproducibility, or interpretation within a stated scope.
- **Handling editor** — coordinates review, records the process state, and summarizes the disposition.
- **Data curator** — checks file structure, metadata, permissions, and repository usability.
- **Author response** — records an author reply linked to a published review item.

Each public item is an append-only event with a DGR identifier, exact result hash, role, event identifier, publication time, text, and an explicit identity-disclosure choice. Open identity requires consent and may include a verified ORCID. Anonymous items omit identity fields. Invitation addresses, declined invitations, private notes, and unpublished review text are never part of the public object.

## Publication and integrity rules

Only completed and explicitly public review items are emitted in the public peerReview metadata object. Every item refers to the same report hash. If a new analysis changes the result hash, the new report starts a separate review record and old review events remain attached to the old identity. Corrections are appended as new events; published events are not overwritten.

The machine-readable contract is docs/schemas/dgr-open-peer-review-v1.schema.json. Current DGR reports do not claim peer review unless their metadata contains a populated, validated object. Reports without external review remain valid DGR reports and must not be labeled peer-reviewed.

## Governance

Reviewers must disclose relevant conflicts of interest. Editors should record assignment and disposition decisions. Authors remain responsible for the data and response. The record identifies review policy and limitations. This schema and renderer do not assign reviewers or grant database access.
