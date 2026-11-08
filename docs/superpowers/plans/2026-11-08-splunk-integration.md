# ThreatLedger Splunk Integration Implementation Plan

**Goal:** Package the existing editor as a Splunk app with shared reports, finding references, and linked searches.

**Architecture:** Preserve the versioned portable report envelope and add validated reference metadata. Keep the Splunk Web transport separate from React and expose report records through a KV Store lookup. Package Vite assets and Splunk navigation and metadata together.

**Tech stack:** React, TypeScript, Vite, Splunk Enterprise app configuration and App KV Store.

## Constraints

- Preserve existing workspaces, report data, images, editing, and exports.
- Store full reports and references under explicit user action, with Splunk permissions and visible errors.
- Never execute a search when adding a reference; link it for the user to open.
- Treat imported references as untrusted; preserve unknown workspace properties.
- No live ES synchronization or unsupported claim of per-report ACL or atomic concurrency.
- Produce an installable package and document live Splunk and AppInspect verification limits.

## Tasks

1. **Portable references and presentation:** Add typed finding and search references to `src/report.ts`, validate imported metadata, preserve version 1 and unknown properties, render in `src/presentation.ts`, and test `tests/report.test.ts` and `tests/export.test.ts` with round trips and malformed data.
2. **Splunk storage and links:** Add `src/splunk.ts` for locale-aware same-origin paths, CSRF-protected requests, KV Store CRUD, conflict/size checks and safe search links. Add `tests/splunk.test.ts` with an injected transport, successful storage, authorization failures, collisions, size limits and URL encoding.
3. **Analyst UI:** Add `src/components/References.tsx` and catalog components, integrate them into `src/main.tsx`, preserve browser recovery, support shared open/save and deep links, and cover representative user flows in `tests/ui.test.tsx`.
4. **Splunk package:** Create app metadata, navigation, view, collection, lookup and permission files under `splunk-app/threatledger/`; implement a reproducible package script and tests for package paths and asset references. Verify compatibility with Splunk Web serving and avoid configuring external services or credentials.
5. **Documentation and verification:** Update README, architecture, ADR, changelog and usage instructions. Run the full suite, build, package inspection, browser QA, and AppInspect/live Splunk checks when available. Report every unavailable check and the consequences.
