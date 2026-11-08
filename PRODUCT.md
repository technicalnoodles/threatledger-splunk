# Product

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
React and TypeScript. The user approved a local-first implementation; exact libraries are delegated.

## Users
Cyber threat intelligence analysts preparing reports for technical and executive consumers.

## Product Purpose
Create structured, actionable CTI reports using the four CTI Blueprints templates, with improved narrative editing and direct document exports.

## Operating Context
Analysts work locally with structured reports, existing Blueprints JSON, ATT&CK mappings, indicators, and supporting images. The primary workflow is creating, editing, saving, reopening, and distributing reports.

## Capabilities and Constraints
Preserve upstream report functionality and compatibility where representable. Support Markdown, embedded images, PDF and Word export. Keep report content local by default. Retain upstream attribution and license notices.

Full upstream feature parity is a goal; the current implementation has documented plugin and document-export limitations. Browser recovery is not a substitute for a downloaded workspace file.

## Brand Commitments
Use the Splunk by Cisco visual-language guidance as a reference for the independently named ThreatLedger. The user requested a dark, technical analyst-console feel and shadcn/ui components. Follow the documented brand-color and asset restrictions; do not imply official affiliation.

## Evidence on Hand
The upstream CTI Blueprints templates and sample JSON reports provide the reference report structure. Product capabilities and current limitations are documented in `README.md`; brand sources and their scope are documented in `docs/design-system.md`.

## Product Principles
- Make structured intelligence easy to inspect and edit.
- Keep authored content portable and preserve unfamiliar fields.
- Make export limitations and errors explicit.
