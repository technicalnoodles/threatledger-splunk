# ThreatLedger design

Build a local-first React and TypeScript authoring application for the four CTI Blueprints report templates. Derive fields, types, option lists, section order and guidance from the upstream definitions. Existing report data remains a JSON object; preserve unknown properties on import and save. A versioned workspace envelope holds editor-specific information such as template identity and images; provide an upstream-compatible JSON export with a warning where rich content is not representable.

The interface provides a template chooser, document tabs, report outline, structured field and table editors, Markdown editing and preview, image insertion, undo/redo, local recovery, and keyboard access. Table operations include add, duplicate, delete, reorder, CSV import and the upstream ATT&CK/D3FEND and Attack Flow behaviors. Generate PDF and DOCX in the application with a section-selection step. Rendering must preserve text, formatting, tables, and embedded images.

Keep report state and schema interpretation independent of UI components. Keep file parsing, table imports and document generation isolated. Reject malformed inputs without overwriting a report; never silently discard unknown report fields. Test upstream sample imports and round trips, table changes, import handling, image persistence, section filtering and exported document content, then exercise representative workflows in a real browser.

Upstream: https://github.com/center-for-threat-informed-defense/cti-blueprints, Apache-2.0. Retain required notices for reused material. Existing external plugins depend on the original runtime; inspect the API and document compatibility honestly rather than promising unchanged execution.
