# ThreatLedger

Created by [technicalnoodles](https://github.com/technicalnoodles).

A local-first React editor for structured cyber threat intelligence reports, based on [CTI Blueprints](https://github.com/center-for-threat-informed-defense/cti-blueprints). It uses the upstream four report templates and adds Markdown, embedded images, and direct Word and PDF downloads.

## Run locally

Requires Node.js 22 or newer and npm. From this directory:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Run `npm test` for the automated tests and `npm run build` to create a static production build in `dist/`. Serve the build over HTTP; opening `dist/index.html` directly is not supported.

The interface uses locally maintained shadcn/ui components styled as a dark analyst console. Its reusable tokens are informed by the current Splunk by Cisco brand guide. With the development server running, open `/design-system.html` to view the component reference. See [DESIGN.md](DESIGN.md) and [the design-system guide](docs/design-system.md) for source references and usage boundaries.

## Working with reports

Choose a template or open an existing JSON report. Use the outline to navigate fields, add and reorder table entries, import CSV into tables, or import published Attack Flow JSON into an ATT&CK table. Technique selection populates a D3FEND link. Narrative fields support Markdown and PNG/JPEG insertion; Preview renders the report. The export dialog lets you choose sections for `.docx` and `.pdf` output.

Open reports appear in the report bar. Untitled reports include a number and blueprint name, and the current report is identified for assistive technology. Table entry actions also identify which entry they affect.

**Download workspace** downloads a `.ctiw.json` workspace containing the report and embedded images. The browser also attempts to retain open reports locally for recovery, but storage is limited and can be cleared by the browser. Download a workspace file as your durable copy, especially when adding large images. No account or backend is required.

If the app cannot read saved browser recovery data, it preserves that data, restores any individually readable reports, and pauses further recovery writes. Use **Download recovery data** to keep a copy of the original data; download each open workspace to preserve any new edits. If browser storage is unavailable or full, the app shows a persistent warning and retries writes on subsequent report changes when recovery was initially readable.

The export dialog also offers Blueprints JSON. Existing upstream files with template metadata open directly; for plain JSON without template metadata, choose a report of the appropriate type first, then open the JSON and confirm the template. Unknown JSON fields are preserved in the saved workspace. Markdown and image references are not native features of the original editor: the compatibility export embeds image data in the JSON text, and the original editor or publisher may display it as text instead of rendering it. Keep the workspace file as the editable source of truth.

## Current limitations

- This is an initial implementation, not a verified drop-in replacement for every upstream behavior. Existing third-party Vue plugin modules cannot run in the React app, and a replacement public plugin API is not implemented. The built-in CSV import, Attack Flow import, ATT&CK selection and D3FEND link behaviors are implemented.
- Word and PDF exports support report sections, structured rows, common Markdown text and standalone embedded PNG/JPEG images. Complex Markdown, such as nested lists, tables, inline images and exact styling, is not yet faithfully reproduced across both formats. The export dialog explains these limits; review exported documents before distributing them.
- The PDF font covers Latin, Greek and Cyrillic but does not cover every writing system. Very large reports or images can exhaust browser storage or memory. The ATT&CK mappings are the upstream snapshot, not a live ATT&CK feed.
- CSV imports match upstream field names or field IDs. Unknown columns are ignored; malformed CSV and invalid numeric values are rejected.

## Attribution

Template definitions, ATT&CK mapping data, example JSON fixtures, and the Inter font were derived from CTI Blueprints, copyright MITRE, under the Apache License 2.0. Source snapshot: `c412b54af6473d49b43863fa094f3a9d0febaca4`. The shadcn/ui component sources are MIT licensed. See [LICENSE](LICENSE), [LICENSE-Inter.txt](LICENSE-Inter.txt), [LICENSE-Liberation.txt](LICENSE-Liberation.txt), and [LICENSE-shadcn-ui.txt](LICENSE-shadcn-ui.txt). This project is independent and is not an official MITRE or Splunk product.
