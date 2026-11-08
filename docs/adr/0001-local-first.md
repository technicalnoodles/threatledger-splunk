# Local-first report authoring and publishing

## Status

Accepted for the initial implementation.

## Decision

Use React and a versioned browser-side report workspace. Preserve upstream JSON data in a separate object and store embedded images as workspace assets. Generate PDF and Word documents in the browser. Do not require a server to author or export.

## Consequences

Reports do not need to be uploaded to a service, and the static app is straightforward to host. Browser storage has capacity limits and is not a durable backup, so the UI supports workspace-file downloads and warns on recovery-storage failures. Existing Vue plugin modules are coupled to the original runtime and require a separate compatibility effort. Document fidelity and font coverage depend on the client-side export implementation and must be verified independently.
