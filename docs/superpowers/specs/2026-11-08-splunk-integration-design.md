# ThreatLedger for Splunk: proposed design

Status: approved by the user on 2026-11-08, selecting approach 1 with shared Splunk storage and portable workspaces.

## Goal

Let a threat intelligence analyst author an existing CTI Blueprints report in Splunk, associate findings and searches with it, and navigate between report context and the relevant Splunk investigation. Preserve the existing editor, report content, images, imports, and document exports.

## Approaches considered

1. **Splunk-hosted editor with shared storage and report references (recommended).** Package the existing React editor as a Splunk app. Store reports and references in app-owned KV Store collections and expose an appropriately permissioned lookup for discovery in SPL. Keep workspace download/import for portability. This supports collaboration and native search workflows, at the cost of deployment and authorization complexity.
2. **Local-first editor with Splunk links only.** Package the UI and save references inside local workspaces. This has the smallest footprint but provides no shared report catalog or lookup from searches.
3. **Native dashboards with a separate editor.** Use Splunk dashboards and lookups for discovery and keep authoring outside Splunk. This reduces custom UI within Splunk, but fragments the analyst workflow and creates an external hosting dependency.

## Analyst workflow

- Browse and open permitted reports in a shared catalog, create reports from the existing templates, and explicitly save to Splunk. The existing workspace download/open remains available as a portable backup and exchange format.
- Within a report, create or link a finding with a stable ID, title, narrative, and optional links to the relevant existing report section or indicator. For Splunk Enterprise Security (ES), an analyst can record a finding or investigation ID and paste a link copied from the ES Analyst Queue. Store these as references, not synchronized copies. Opening the link remains subject to the viewer’s ES permissions. The app does not directly query ES restricted collections or claim live ES synchronization; deeper integration would require product/version and permissions validation.
- Add a search reference to a report or a finding: a descriptive label, either SPL with an explicit earliest/latest range and app context or a saved-search reference, and an optional analyst note. Open it in Splunk Search with the current user's permissions. Linking a search does not execute it, grant access, preserve a search job, or guarantee future results.
- View linked findings and searches from the report and retrieve report/finding identifiers through a permissioned KV Store lookup in SPL. Open the report using an app-relative link. A search result references the report; it does not automatically create a finding or modify indexed events.
- Include human-readable finding and search references in report exports, with links where the export format supports them; keep the original workspace round-trip intact. Do not embed search results or event data automatically.

## Boundaries and data

Keep CTI Blueprint data and existing asset IDs in the versioned workspace. Store the complete report and associated reference records with stable IDs; make the portable workspace include those references without discarding unknown properties or breaking older workspace files. Existing workspaces must continue to open. Provide clear migration and validation of newer files.

Use Splunk KV Store collections for application data, with collection/lookup permissions set by the administrator and no hard-coded credentials. KV Store permissions are scoped to collections, not per-report confidentiality: do not promise report-level isolation. Finding titles, IDs, notes, and links copied into the app are governed by the app collection’s permissions, which can differ from the source ES team queue. Administrators must align access and analysts must avoid copying information into a collection with a broader audience than permitted. Make access and deployment assumptions visible. Account for Splunk's per-record size limit; reject oversized saves without damaging the existing stored version and let the analyst download a workspace. Large embedded images may require a later storage design rather than silent truncation.

Warn on failed saves, authorization errors, inaccessible or deleted reports, expired or unavailable searches, and loss of connectivity. Preserve unsaved editor content and offer download. Detect changes since the report was loaded when feasible, and clearly disclose any remaining concurrent-edit limitation; do not claim atomic conflict protection without a supported server-side mechanism.

Only construct links to trusted, same-origin Splunk routes, encode query parameters, and treat imported report text and URLs as untrusted. Search links are opened deliberately by a user and run under that user's Splunk authorization. Sensitive SPL and finding notes inherit collection access permissions.

## Packaging and deployment

Produce an installable Splunk app with app metadata, navigation, the built frontend, collection and lookup definitions, and installation/configuration instructions. Target a specific Splunk Enterprise release first unless the deployment target is confirmed otherwise. Splunk Cloud compatibility and AppInspect acceptance must be verified separately; neither follows from an Enterprise package or a local build.

## Verification

- Test workspace compatibility, unknown-field preservation, stable IDs, finding/search association, safe link construction, and export content.
- Test storage errors, oversized reports, permissions failures, missing references, and concurrent-edit behavior without losing local work.
- Build and inspect the app package, run the available automated tests, and use Splunk AppInspect when available.
- On a real supported Splunk deployment, install the app, verify its navigation and static assets, create and reopen a shared report as two appropriately permissioned users, use a report lookup in SPL, and open linked searches. Verify negative permissions and document the exact product/version and results. If no Splunk instance is available, report this as unverified rather than treating mocks as end-to-end evidence.

## Sources

- Splunk app KV Store and collection permissioning: https://help.splunk.com/en/splunk-cloud-platform/rest-api-reference/10.6/kv-store-endpoints/kv-store-endpoint-descriptions
- KV Store lookup behavior: https://help.splunk.com/en/splunk-enterprise/manage-knowledge-objects/knowledge-management-manual/9.4/use-the-configuration-files-to-configure-lookups/configure-kv-store-lookups
- Splunk app frontend guidance: https://dev.splunk.com/enterprise/docs/developapps/webframework/usewebframework/modifydashboards
- ES Analyst Queue finding and investigation IDs and copy-link action: https://help.splunk.com/en/splunk-enterprise-security-8/administer/8.0/mission-control/manage-analyst-workflows-using-the-analyst-queue-in-splunk-enterprise-security
- ES optional lockdown and its effect on direct searches of finding data: https://help.splunk.com/en/splunk-enterprise-security-8/administer/8.7/mission-control/analyst-and-team-based-queues-in-splunk-enterprise-security/role-based-access-control-lockdown-for-splunk-enterprise-security
- Splunk Cloud private-app vetting: https://help.splunk.com/en/splunk-cloud-platform/administer/admin-manual/10.6/manage-apps-and-add-ons-in-splunk-cloud-platform/manage-private-apps-on-your-splunk-cloud-platform-deployment
