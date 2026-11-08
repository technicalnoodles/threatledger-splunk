# Architecture

The React interface consumes static template definitions extracted from the upstream source. `src/report.ts` owns report objects, safe nested updates, workspace serialization and table imports. `src/presentation.ts` selects report content, while `src/export.ts` turns it into Word or PDF documents and is loaded only when exporting. Browser storage provides recovery; user-downloaded workspace JSON is the durable portable format.

Workspace files are versioned envelopes with `format`, `version`, `id`, `templateId`, `data`, and `assets`. `data` retains the upstream object, including unrecognized fields. Narrative image references use `cti-image:<id>` and point into `assets`; the app resolves them for preview and document export. Compatibility JSON embeds those references as data URLs, with a warning about upstream rendering.

The recovery reader distinguishes an empty store, an unavailable store, and malformed or partially unreadable saved data. If any saved record is unreadable, the app keeps the original raw data unchanged, restores any readable records, pauses automatic recovery writes, and offers the raw data for download. Report changes remain in memory until downloaded as workspace files. Failed writes are reported persistently, and a later change retries the write when the initial recovery data was readable.

Recovery writes remain immediate after report state changes. The recovery serializer caches JSON for unchanged reports and immutable image asset maps, so editing text does not repeatedly serialize unchanged embedded images. The browser storage write still contains the complete recovery data and remains subject to browser storage limits.

Upstream schema extraction is reproducible by running `node scripts/extract-upstream.mjs /absolute/path/to/cti-blueprints/src/cti_authoring_tool/src/assets/configuration`. Review the resulting template diff and upstream license before updating it. The script stubs runtime plugins and extracts configuration only; it does not port the upstream plugin runtime.


## Splunk integration

The Splunk package mounts the existing React application inside a Simple XML view. A generated bootstrap loads Vite's app entry and static styles from the app's `appserver/static` directory. `src/splunk.ts` isolates Splunk Web proxy requests and search-link construction; it uses the current Splunk Web session and CSRF cookie rather than embedding credentials. The `reports` KV Store collection stores each workspace and app metadata in one record. The `threatledger_reports` lookup exposes catalog fields for SPL. Its collection and lookup ACLs are administrator-controlled and apply to the entire collection.

Reference metadata is an optional extension of the version 1 workspace envelope, so older files remain readable and unknown top-level properties survive round trips. Findings and search references have independent IDs and are included in workspace files and selected exports. Shared saves compare a loaded revision with the current record before writing, but the compare and write are not atomic; the UI must not imply safe concurrent editing. Browser recovery remains independent of shared storage and never replaces workspace downloads.

The installed app hosting, shared save, KV Store read-back, lookup, and a linked SPL search were verified for one user on Splunk Cloud Platform 10.5.2605.3. Role separation and the other deployment behaviors remain unverified. See `docs/splunk.md`.

Search references use fixed epoch-second event-time boundaries. Connected clients resolve new relative ranges with Splunk's `search/timeparser` endpoint and can capture the effective bounds and SPL from an existing completed job. Older relative-only references remain readable but are not treated as reproducible; the original window must be supplied. Separate index-time bounds and inline SPL time modifiers are not silently discarded.
