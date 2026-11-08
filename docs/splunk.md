# Splunk operations

## App icon

The app package includes `static/appIcon.png`, `appIcon_2x.png`, and matching `appIconAlt` variants for the Splunk app list and menus. Version 0.2.9 also places identical icons in `appserver/static` for deployments whose icon endpoint resolves web static assets. On the tested Splunk Cloud 10.5.2605.3 deployment, versions 0.2.8 and 0.2.9 were installed but the launcher REST endpoint returned the generic icon even with a cache-busting URL, while the appserver static endpoint served the custom image. The editable source is `assets/threatledger-app-icon.svg`, based on the Lucide FileText icon (ISC) and the existing ThreatLedger colors.

## Dashboard layout

The ThreatLedger dashboard hides the Splunk app navigation rail while preserving the global header and ThreatLedger report outline. The rule is scoped to the app dashboard and uses a Splunk Web selector observed on Splunk Cloud Platform 10.5.2605.3; the 0.2.10 package needs installation and live verification, and other Splunk versions may use different markup.

## Data and access

The `reports` KV Store collection contains one record per report, including the complete versioned workspace, embedded images, findings and search references. The `threatledger_reports` KV Store lookup exposes report ID, title, template ID, update time, report path and a display list of finding IDs. It does not include the full workspace in lookup results. A lookup from another app requires administrator-controlled sharing.

The packaged default ACL allows `admin`, `sc_admin`, `power`, and `user` roles to read the collection and lookup, and `admin`, `sc_admin`, and `power` to write. These are collection-level permissions, not per-report permissions. Browser recovery also stores open reports in the browser profile; it is not protected by Splunk collection permissions, and different users of the same browser profile can access that local data. **Before use, restrict them to roles allowed to see every report and reference in the collection.** Restrict access to the app view as well. Sharing a finding ID, title, or note in ThreatLedger does not inherit Enterprise Security team-queue restrictions. The user's authorization is rechecked when they open a linked Splunk search or ES finding.

## Authoring and searching

1. Open ThreatLedger and create a report, or select **Shared reports** and open an existing one.
2. Under **Findings and searches**, enter an Enterprise Security display ID such as `ES-00123` or a full finding `event_id` in **Finding ID**, then select **Load from ES**. The app reads selected fields using your current Splunk session, fills empty fields, and identifies whether the source is a finding, finding group, or investigation. Review and edit the entry, then select **Add finding**. Existing draft text is kept. For a finding without an embedded timestamp in its `event_id`, the lookup is limited to the previous 30 days. The imported content is a snapshot; it does not update the ES record or automatically refresh.
3. Paste a completed search URL containing its `sid`, or a search job ID, and select **Import search job** to capture its original SPL and resolved bounds. Jobs can expire and remain subject to Splunk permissions. Alternatively, enter SPL or a saved report name and owner together with the intended time window. Relative expressions are resolved by Splunk when the reference is added; use exact ISO 8601 timestamps with a timezone or epoch seconds for a past window. A saved report reference captures its current SPL and the chosen fixed window. Associate it with a finding if useful. Adding a reference does not run it; opening it starts a new search under the current user's permissions.
4. Paste a PNG or JPEG directly into a narrative field, or use its image upload button. Images are embedded in the report. Select **Save to Splunk**. Download a workspace for portable backup. References and images are part of that workspace. Select **Findings and searches** in the export dialog to include the reference details in Word and PDF.
5. Use `| inputlookup threatledger_reports | table report_id title finding_ids report_path` in the app context. `report_path` is an app-relative URL to open the report; use your own SPL to correlate its fields with event fields. To expand the display list into one row per finding ID, start with:

   ```spl
   | inputlookup threatledger_reports
   | makemv delim=", " finding_ids
   | mvexpand finding_ids
   | rename finding_ids AS finding_id
   | table finding_id report_id title report_path
   ```

   Finding IDs without an external source ID are internal ThreatLedger reference IDs.

New references store fixed epoch-second boundaries and show UTC times. Legacy references that contain only relative values cannot reconstruct the original window, so opening is disabled until an analyst supplies the original absolute bounds or imports the unexpired original search job. SPL `earliest`, `latest`, `_index_earliest`, and `_index_latest` modifiers override picker bounds and must be removed before a reference is saved. `savedsearch` and `loadjob` commands can also select changing data or time windows and must be replaced with the underlying SPL. Jobs or saved-report definitions with separate index-time bounds cannot be captured because those bounds are not yet preserved. The `now()`, `time()`, and `relative_time()` functions must also be replaced with fixed values. Macros can hide dynamic logic that the app cannot inspect, and changing data or permissions can still change the results. The app does not preserve event snapshots or automatically ingest ES findings.

## Failure modes

- A 401/403 or missing CSRF token indicates session or role access problems; sign in again or ask an administrator to inspect app and collection permissions.
- A missing collection or KV Store error requires an administrator to check app installation and KV Store health.
- If a report changed since it was opened, the app refuses the save. Download the local workspace, reopen the shared copy, and reconcile changes. This is a best-effort check, not an atomic compare-and-swap: simultaneous saves can still overwrite one another.
- A record above 15 MiB is rejected before writing; download the workspace and reduce embedded images. Splunk's documented maximum is 16 MB per KV Store record.
- A stale or unavailable finding/report link might reflect changed permissions, deletion, or a version-specific Splunk route. The app does not bypass ES lockdown or search underlying restricted collections.
- If an upgraded app still shows older controls, compare the loaded frontend with the installed version. Splunk documents separate client and server caches for app static resources in its [caching guidance](https://help.splunk.com/en/splunk-cloud-platform/developing-views-and-apps-for-splunk-web/9.3.2411/customize-splunk-web/customization-options-and-caching). Version 0.2.7 uses a versioned bootstrap filename to avoid reusing the earlier bootstrap URL; confirm the live dashboard actually loads the new interface after upgrading.

## Deployment verification

On 2026-11-09, a user-provided Splunk Cloud Platform 10.5.2605.3 deployment loaded the installed app. Its time parser resolved `-24h@h` and `now`; the completed synthetic search job exposed resolved epoch bounds, and a second synthetic search using those fixed bounds reported the same window. A labeled synthetic report and finding were saved; the shared catalog and KV Store record contained the report, `inputlookup threatledger_reports` returned its report ID, finding ID and report path, and a linked `makeresults` search completed with one synthetic result. This verifies the path for the active user only. The test report was left in the shared collection. The live check was performed on version 0.2.0; version 0.2.5 adds ES finding and investigation prefill, 0.2.6 adds clipboard image pasting, and 0.2.7 versions the dashboard bootstrap; subsequent 0.2.7 verification is described below. A subsequent read-only check reopened the synthetic shared report and its finding/search association. The browser loaded assets matching 0.2.0 even after app metadata reported 0.2.6; the subsequent 0.2.7 check loaded the new interface.

On 2026-11-09, version 0.2.7 was installed on the same Splunk Cloud deployment and displayed the new frontend. The existing synthetic report reopened from the shared catalog; its legacy relative-time search was disabled with an explanation. A new synthetic search linked to the test finding resolved `-24h` to `now` into epoch bounds `1794090214` and `1794176614`, persisted those bounds in KV Store, and opened in Splunk with the same bounds and one synthetic result. An ES investigation ID populated editable finding fields without adding or saving that ES data. A valid synthetic clipboard PNG was pasted into a narrative, rendered in preview, and saved as a workspace image in KV Store. Word and PDF export of the synthetic report completed in Splunk; downloaded content contained the test finding, search, and fixed times, and the Word document contained an image and fixed-time link. This was tested only with the signed-in user. The updated labeled test report remains in the shared collection.

Access with different roles, a real ES finding link, saved-report links, additional live export formats and layouts, concurrent users, and other Splunk versions remain unverified. The package build and automated tests do not prove deployment compatibility. Before production use, install in a representative non-production Splunk Enterprise search head, verify app navigation and assets, test two users with different read/write roles, save and reopen a report, query the lookup, open an SPL search and an ES finding, check a stale-edit warning, and inspect Splunk Web/splunkd logs. Record the product version and results. Local AppInspect 4.4.0 returned no failures or errors, with two informational warnings for SplunkJS usage and the KV Store collection; trusted-library updates were skipped. Review `outputs/appinspect-0.2.7.json` for the 0.2.7 package. This local result and the live verification above do not establish Cloud vetting status or full deployment compatibility.

## ES import permissions

The import uses the public ES investigations API for `ES-…` display IDs and the public findings API for complete finding `event_id` values. It makes read-only requests in the current Splunk Web session and does not bypass queue access controls. A user who can read an ES record may still need the appropriate public API capability, including `mc_investigation_read` for investigations. Once copied into a ThreatLedger report, the snapshot follows the report collection ACL, which can be broader than the ES source queue. The source record, its status, and its owner are never changed.
