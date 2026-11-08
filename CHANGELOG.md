# Changelog

## Unreleased

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
