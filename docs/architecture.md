# Architecture

The React interface consumes static template definitions extracted from the upstream source. `src/report.ts` owns report objects, safe nested updates, workspace serialization and table imports. `src/presentation.ts` selects report content, while `src/export.ts` turns it into Word or PDF documents and is loaded only when exporting. Browser storage provides recovery; user-downloaded workspace JSON is the durable portable format.

Workspace files are versioned envelopes with `format`, `version`, `id`, `templateId`, `data`, and `assets`. `data` retains the upstream object, including unrecognized fields. Narrative image references use `cti-image:<id>` and point into `assets`; the app resolves them for preview and document export. Compatibility JSON embeds those references as data URLs, with a warning about upstream rendering.

The recovery reader distinguishes an empty store, an unavailable store, and malformed or partially unreadable saved data. If any saved record is unreadable, the app keeps the original raw data unchanged, restores any readable records, pauses automatic recovery writes, and offers the raw data for download. Report changes remain in memory until downloaded as workspace files. Failed writes are reported persistently, and a later change retries the write when the initial recovery data was readable.

Recovery writes remain immediate after report state changes. The recovery serializer caches JSON for unchanged reports and immutable image asset maps, so editing text does not repeatedly serialize unchanged embedded images. The browser storage write still contains the complete recovery data and remains subject to browser storage limits.

Upstream schema extraction is reproducible by running `node scripts/extract-upstream.mjs /absolute/path/to/cti-blueprints/src/cti_authoring_tool/src/assets/configuration`. Review the resulting template diff and upstream license before updating it. The script stubs runtime plugins and extracts configuration only; it does not port the upstream plugin runtime.
