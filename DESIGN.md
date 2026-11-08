# Design system

ThreatLedger is a task-focused reporting interface with a dark analyst-console treatment informed by the 2026 Splunk by Cisco brand guidance. The identity remains ThreatLedger; the interface is not an official Splunk product.

The application uses the guide's neutral-dark palette, readable light text, medium-blue links and white primary actions. The magenta-to-orange gradient marks a few small accents; solid magenta and orange are not used for branding, text or calls to action. Green is a separate ThreatLedger product-status adaptation for successful browser recovery. The canvas is `#0B1118`, the main surface is `#131A23`, and the dark-background link is `#478EFF`. `src/design-system/tokens.css` contains the canonical tokens; `src/design-system/brand-components.css` maps them to the interface. Earlier styles in `src/operations.css` and `src/splunk.css` retain structural rules. Inter is the primary typeface, with monospace reserved for compact metadata and report counts.

The blueprint library presents the four report types with distinct functional icons and actual section counts. The workspace is organized into document tabs, a report outline, contextual actions and an editor surface. A narrow viewport turns the outline into a dismissible panel. Dialogs, buttons, inputs, textareas and checkboxes use locally maintained shadcn/ui components; keep their focus, keyboard and screen-reader behavior intact when changing styles. Exported documents retain their own document formatting.

See [the complete design-system guide](docs/design-system.md) for the source pages, component inventory, usage restrictions and export limitations. The separate Splunk product UI reference is https://splunkui.splunk.com/DesignSystem.
