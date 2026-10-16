# Projects workspace

User-authorized presentation refinement using existing UI owners and shared theme tokens.

- Full-width create/edit form and responsive project cards.
- Measurement stays visible; secondary actions and metadata use native details with the shared chevron, focus and keyboard behavior.
- Owner and collaborator action boundaries preserved; no database or scientific calculation changes.
- Project headings translated; dynamic counters excluded from text translation.
- Real application browser coverage exercises owner actions, collaborator permissions, disclosure keyboard access, Turkish/English, light/dark and 360/390/430/1280 widths.

Project totals now have a single rendering owner: invite and collaboration park totals cannot overwrite project counts.

Validation: npm run check, full phone regression suite, accessibility checks, and project workspace Chromium/WebKit at all four widths passed locally. Browser fixtures use synthetic accounts and data; no production records were written.
