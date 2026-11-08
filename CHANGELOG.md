# Changelog

## Unreleased

- Added app icons to the web static directory as well as the app static directory for Splunk Cloud launcher compatibility.

- Added standard and high-resolution app-list and menu icons using the existing ThreatLedger mark.

- Versioned the Splunk dashboard bootstrap to avoid reusing an older cached frontend after upgrades, and show a loading state while shared reports are fetched.

- Added clipboard PNG and JPEG pasting in narrative fields; pasted images are embedded and saved like uploaded images.

- Added read-only Enterprise Security finding and investigation prefill by ID, with editable review and preserved draft text.

- Rebuilt as version 0.2.4 with a Splunk app manifest and aligned package versions.

- Capture fixed search time windows, including the original effective bounds from completed Splunk search jobs, and prevent legacy relative links from silently drifting.

- Expanded the Splunk-hosted workspace to fill the available app area while retaining Splunk navigation.

- Corrected finding and search reference styling when embedded in Splunk Web.

- Added an initial Splunk app package with shared KV Store reports, a report lookup, finding references, linked searches, and portable workspace compatibility.
- Added shared report conflict warnings, access guidance, and explicit live-deployment limitations.

- Created a separate starting point for future Splunk app development.
- Removed the privacy and normal browser-recovery notes from the editor.
- Aligned the report tab bar and its first tab with the outline drawer.
- Identified the current report and repeated entry actions for assistive technology, and distinguished untitled reports by number and blueprint.
- Kept mobile header controls within narrow screens and removed overridden legacy theme declarations.
- Reused unchanged image serialization during immediate browser recovery writes.
- Renamed the application to ThreatLedger.

- Made the four blueprint choices equal in height across screen sizes.
- Improved mobile editor readability and touch targets, and identified report close buttons by title for assistive technology.
- Removed the workspace box and storage note from the report-selection screen.
- Added reusable design tokens and component guidance based on the 2026 Splunk by Cisco brand guide; updated the interface to use the current gradient, neutral palette, link colors and CTA treatment.
- Updated the workspace to a dark analyst-console design with Splunk-inspired blue and orange accents.
- Restored keyboard focus after hiding or navigating the report outline on mobile.
- Corrected report and export dialog positioning and kept dialog headings visible while scrolling.
- Preserved unreadable recovery data, surfaced recovery failures and clarified workspace downloads.
- Added report-specific writing prompts, example framing and export-format limitations.
- Refreshed the editor with a Splunk-inspired palette and locally maintained shadcn/ui controls.
- Added accessible dialog focus handling, selection states and inline export errors; preserved edits made while images load.

## 0.1.0

- Added a React local-first report editor based on the four CTI Blueprints template definitions.
- Added workspace JSON persistence, Markdown preview, embedded PNG/JPEG images, structured tables, CSV and Attack Flow imports, and D3FEND links.
- Added section-selectable Word and PDF downloads and initial automated and browser verification.
