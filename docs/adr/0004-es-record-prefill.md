# Read-only Enterprise Security record prefill

## Status

Accepted for the initial ID-based integration. The deployed 0.2.5 UI flow has not yet been verified.

## Context

Analysts want to paste an Enterprise Security ID and populate a finding entry for review. ES short display IDs and full finding `event_id` values identify different types of records. The app's report collection does not inherit ES queue-level permissions.

## Decision

Use the signed-in Splunk Web session and read-only ES public APIs. Look up `ES-…` display IDs through the public investigations endpoint, validating the returned ID; allow a five-digit padded retry for an unpadded ID. Look up full finding `event_id` values through the public findings endpoint, with an event-time hint when the ID contains a timestamp and a 30-day bound otherwise. Verify the returned ID before mapping.

Copy only selected fields into an editable finding entry and identify its source as a finding, finding group, or investigation. Preserve existing draft fields. Adding the entry and saving the report remain explicit analyst actions. The app does not change the source ES record, import raw events or notes, or auto-populate unrelated report sections.

## Consequences

ES permissions and queue access remain in force during import. Once copied into a report, information follows the app collection's permissions rather than the source queue's permissions. Source data can change after import; the report is a snapshot. Report-level confidentiality, all ES ID formats, other ES versions, and analyst-role behavior require separate validation.
