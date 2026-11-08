# Shared report workspaces in Splunk

## Status

Accepted for the initial Splunk integration; live deployment validation is pending.

## Context

The original editor uses browser recovery and portable workspace files. Analysts also need shared reports, finding references, and links to Splunk searches without transferring credentials into the app.

## Decision

Mount the existing React editor in a Splunk Web app and store complete portable workspaces in an app-owned KV Store collection. Add references as optional workspace metadata and expose a limited catalog lookup. Requests use the current Splunk Web session. Shared saves are explicit; local workspace download remains available.

## Consequences

Splunk role and collection permissions govern shared content, not per-report access. Copying ES information into ThreatLedger can change its audience. Full workspaces and embedded images count against the record size limit. Revision checks detect many stale edits but are not atomic concurrency controls. The Simple XML bootstrap, session-proxy behavior, lookup, and support for a particular Splunk version require real deployment testing; Cloud vetting is separate.
