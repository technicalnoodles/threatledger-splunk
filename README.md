# ThreatLedger for Splunk

Created by [technicalnoodles](https://github.com/technicalnoodles).

A local-first React editor for structured cyber threat intelligence reports, based on [CTI Blueprints](https://github.com/center-for-threat-informed-defense/cti-blueprints). It uses the upstream four report templates and adds Markdown, embedded images, and direct Word and PDF downloads.

This project includes a Splunk app package alongside the standalone editor. Analysts can save shared reports in the app KV Store, reference findings, and attach searches. The standalone project is available at [technicalnoodles/threatledger](https://github.com/technicalnoodles/threatledger). The Splunk package is an initial implementation. Version 0.2.0 was exercised on Splunk Cloud Platform 10.5.2605.3 for the core save, lookup, and linked SPL workflow. Version 0.2.7 was also exercised on that deployment for ES prefill, clipboard image pasting, shared storage, and fixed-time synthetic search links; see the validation limits below.

## Run locally

Requires Node.js 22 or newer and npm. From this directory:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Run `npm test` for the automated tests and `npm run build` to create a static production build in `dist/`. Serve the build over HTTP; opening `dist/index.html` directly is not supported.

The interface uses locally maintained shadcn/ui components styled as a dark analyst console. Its reusable tokens are informed by the current Splunk by Cisco brand guide. With the development server running, open `/design-system.html` to view the component reference. See [DESIGN.md](DESIGN.md) and [the design-system guide](docs/design-system.md) for source references and usage boundaries.

## Build and install the Splunk app

Requires Node.js 22 or newer and npm. From the project directory:

```sh
npm ci
npm run package:splunk
```

The resulting `outputs/threatledger.spl` is an archive containing the `threatledger` app. The package includes app-list and menu icons at standard and high resolutions in both Splunk static directories, based on the existing ThreatLedger report mark. Version 0.2.9 icon display needs verification after installation. Install it on a **Splunk Enterprise search head** with Splunk Web's Install app from file, or follow your administrator's search-head deployment procedure. For a search-head cluster, use the supported deployer workflow. After installation, open **Apps → ThreatLedger**. KV Store must be enabled and healthy. The installation workflow varies by platform. One Splunk Cloud Platform deployment has been exercised as described below; Splunk Enterprise compatibility has not been tested. Splunk Cloud installation requires its applicable validation and vetting workflow.

The app stores shared workspaces in the `reports` KV Store collection. By default the package grants the `admin`, `sc_admin`, `power`, and `user` roles read access and grants `admin`, `sc_admin`, and `power` write access. **All users with collection access can read every stored report, reference, search, and embedded image.** There is no per-report access control. An administrator must review `metadata/default.meta` and configure role access before sensitive data is stored, especially when source findings are restricted to ES team queues. Lookups and report links do not grant access to the underlying Splunk searches or ES findings.

In Splunk, use **Shared reports** to browse and open reports; use **Save to Splunk** to explicitly save the active report. Workspace downloads still provide portable backups. The app checks whether the shared copy changed since it was opened, but this check and write are separate operations: simultaneous saves can still overwrite one another. Coordinate concurrent editing and retain downloaded copies. After a browser refresh, reopen a shared report from the catalog before updating it. A failed save leaves the current report in the editor; download it if needed.

The app's permissioned lookup exposes report IDs and reference metadata in SPL:

```spl
| inputlookup threatledger_reports
| table report_id title finding_ids updated_at report_path
```

Run this in the ThreatLedger app context, or configure the lookup's sharing explicitly if another app needs it. `report_path` opens the shared report in Splunk Web for a user who has access. `finding_ids` is a display string, not an automatic match or an index of events; use an explicit join strategy appropriate for your own data. The lookup does not expose report content or automatically write findings to indexed data.

See [Splunk operations and limitations](docs/splunk.md) for the storage model, access rules, validation status, and troubleshooting.

## Working with reports

Choose a template or open an existing JSON report. Use the outline to navigate fields, add and reorder table entries, import CSV into tables, or import published Attack Flow JSON into an ATT&CK table. Technique selection populates a D3FEND link. Narrative fields support Markdown and PNG/JPEG images: paste an image directly into the field or use the image upload button. Preview renders the report. The export dialog lets you choose sections for `.docx` and `.pdf` output.

The **Findings and searches** section associates analyst-authored findings, same-origin Splunk finding links, and SPL or saved-report references with the report. Paste an Enterprise Security display ID such as `ES-00123` or a complete finding `event_id` into **Finding ID** and select **Load from ES**. Review the prefilled title and selected context, then choose **Add finding**. An `ES-…` ID can identify an investigation or finding group; the interface identifies the source type. The lookup is read-only and uses the signed-in user’s ES permissions. Search references store fixed earliest and latest times as epoch seconds and display them in UTC. Paste a completed Splunk search URL containing its `sid`, or a job ID, and choose **Import search job** to capture the executed SPL and its original resolved time window while the job remains available. When entering a new relative range, Splunk resolves it at the moment the reference is added; it cannot reconstruct an earlier run. Saved-report references capture the current SPL and specified fixed window, then replay that snapshot. Adding a search does not run it; opening a reference starts a new search. Imported ES data is a snapshot, not a live synchronized object. Review the report’s collection permissions before sharing copied ES details. Search results can change as data and permissions change. References are included in downloadable workspaces and selected document exports.

Open reports appear in the report bar. Untitled reports include a number and blueprint name, and the current report is identified for assistive technology. Table entry actions also identify which entry they affect.

**Download workspace** downloads a `.ctiw.json` workspace containing the report and embedded images. The browser also attempts to retain open reports locally for recovery, but storage is limited and can be cleared by the browser. Download a workspace file as your durable copy, especially when adding large images. The standalone editor does not require an account or backend. In Splunk, browser recovery is local to the browser profile and is not protected by Splunk collection permissions; use a trusted profile and follow local data-handling policy.

If the app cannot read saved browser recovery data, it preserves that data, restores any individually readable reports, and pauses further recovery writes. Use **Download recovery data** to keep a copy of the original data; download each open workspace to preserve any new edits. If browser storage is unavailable or full, the app shows a persistent warning and retries writes on subsequent report changes when recovery was initially readable.

The export dialog also offers Blueprints JSON. Existing upstream files with template metadata open directly; for plain JSON without template metadata, choose a report of the appropriate type first, then open the JSON and confirm the template. Unknown JSON fields are preserved in the saved workspace. Markdown and image references are not native features of the original editor: the compatibility export embeds image data in the JSON text, and the original editor or publisher may display it as text instead of rendering it. Keep the workspace file as the editable source of truth.

## Current limitations

- ES import reads selected fields only; it does not import raw events or notes and does not change the source record. Full finding IDs without an embedded timestamp are searched within the previous 30 days. Enterprise Security API and queue permissions apply. The ES import UI was exercised with one investigation and the signed-in user on Splunk Cloud 10.5.2605.3; other record types and roles need separate verification.
- Old search references that stored relative times cannot recover the original window. They are kept but cannot be opened until an analyst supplies the original absolute range or imports the original unexpired job. Search-window snapshots do not preserve the original results. SPL time modifiers override the picker and must be removed before saving a fixed reference; `savedsearch` and `loadjob` commands must be replaced with their underlying SPL; jobs and saved reports with separate index-time bounds are not supported; `now()`, `time()`, and `relative_time()` must be replaced with fixed values; macros, data changes, and permissions can still change results.

- A synthetic report, finding reference, shared save, KV Store read-back, lookup, and linked SPL search were verified on one Splunk Cloud Platform 10.5.2605.3 deployment. The synthetic shared report was reopened through the catalog by the current user. Saved-report links, real ES finding links, role separation, and other live export layouts have not been verified. Synthetic Word and PDF exports were checked on this deployment. On the same deployment, app metadata showed 0.2.4 while the browser loaded assets matching 0.2.0; 0.2.7 uses a versioned dashboard bootstrap, and its updated frontend loaded after installation. Local AppInspect 4.4.0 reported no failures or errors, with two informational warnings; trusted-library updates were skipped, and the deployment’s Cloud vetting outcome was not independently checked. The app uses a Simple XML extension and browser-side Splunk Web proxy; verify compatibility with the exact Splunk version and security policy before use.
- KV Store limits individual records to 16 MB; ThreatLedger rejects serialized report records above 15 MiB to leave room for server metadata. Embedded images can reach this limit quickly. The app does not split large images across records.
- Word and PDF exports created inside Splunk include clickable same-origin finding and search links when valid. Re-run searches in Splunk to obtain current results.

- This is an initial implementation, not a verified drop-in replacement for every upstream behavior. Existing third-party Vue plugin modules cannot run in the React app, and a replacement public plugin API is not implemented. The built-in CSV import, Attack Flow import, ATT&CK selection and D3FEND link behaviors are implemented.
- Word and PDF exports support report sections, structured rows, common Markdown text and standalone embedded PNG/JPEG images. Complex Markdown, such as nested lists, tables, inline images and exact styling, is not yet faithfully reproduced across both formats. The export dialog explains these limits; review exported documents before distributing them.
- The PDF font covers Latin, Greek and Cyrillic but does not cover every writing system. Very large reports or images can exhaust browser storage or memory. The ATT&CK mappings are the upstream snapshot, not a live ATT&CK feed.
- CSV imports match upstream field names or field IDs. Unknown columns are ignored; malformed CSV and invalid numeric values are rejected.

## Attribution

Template definitions, ATT&CK mapping data, example JSON fixtures, and the Inter font were derived from CTI Blueprints, copyright MITRE, under the Apache License 2.0. Source snapshot: `c412b54af6473d49b43863fa094f3a9d0febaca4`. The shadcn/ui component sources are MIT licensed. See [LICENSE](LICENSE), [LICENSE-Inter.txt](LICENSE-Inter.txt), [LICENSE-Liberation.txt](LICENSE-Liberation.txt), and [LICENSE-shadcn-ui.txt](LICENSE-shadcn-ui.txt). This project is independent and is not an official MITRE or Splunk product.
