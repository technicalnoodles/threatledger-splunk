# ThreatLedger Implementation Plan

**Goal:** Build a local-first React CTI report editor with upstream template coverage and direct document export.

**Architecture:** Extract the upstream template definitions into a static schema. Keep report transformations and import/export independent of the React UI. Save a versioned workspace envelope while preserving upstream report objects.

**Tech Stack:** React, TypeScript, Vite, Vitest and browser-side document generation.

## Work sequence

1. Extract and audit all four upstream schemas and sample report structures.
2. Test and implement report import, immutable editing, table operations and lossless workspace serialization.
3. Build template selection, document tabs, structured editing, Markdown and image support.
4. Implement CSV and Attack Flow imports, D3FEND links, and section-selectable PDF/DOCX generation.
5. Verify the upstream samples, generated exports, browser interactions and responsive layouts. Document supported behavior, limitations and attribution.
