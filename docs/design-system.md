# ThreatLedger design system

This system translates the Splunk by Cisco brand guidance reviewed on November 8, 2026 into reusable tokens and shadcn/ui styles for ThreatLedger. The brand guide covers corporate communications and marketing; its exact visual rules are identified below. Spacing, component behavior, semantic status colors and the application type scale are **ThreatLedger adaptations**, informed by the separate [Splunk UI Design System](https://splunkui.splunk.com/DesignSystem), not claims that this application is an official Splunk UI implementation.

With the development server running, open `/design-system.html` for an interactive reference of the applied color, typography and component patterns.

## Source map

| Guide section | What was applied or recorded |
| --- | --- |
| [Visual language](https://brand.splunk.com/19231d431/p/04922c-visual-language) | Use light and purposeful visual emphasis to clarify complex information. |
| [Color](https://brand.splunk.com/19231d431/p/2240a4-color) | Current color ramps, neutral surfaces, links and restrictions on solid magenta and orange. |
| [Gradient](https://brand.splunk.com/19231d431/p/37ca7b-gradient) | Magenta-to-orange left-to-right gradient, restricted to less than half of a design. |
| [Glows](https://brand.splunk.com/19231d431/p/4197c6-glows) | Pair magenta and orange glows; Splunk Blue is restricted to dark-mode glow or print-background use. Optional glows are not used in the editor. |
| [Signal trails](https://brand.splunk.com/19231d431/p/14183e-signal-trails) | Signals should support a specific story and stay secondary; avoid decorative grids, dense bundles and full-frame texture. No signal-trail assets are bundled. |
| [Typography](https://brand.splunk.com/19231d431/p/86fab1-typography) | Inter is preferred; use regular/medium for small text and semibold for hierarchy. |
| [Icons](https://brand.splunk.com/19231d431/p/279d6d-icons) | Icons should clarify meaning, use a consistent style and not function as decoration or logos. The app uses a consistent Lucide set as an adaptation, not official Cisco artwork. |
| [Data visualization](https://brand.splunk.com/19231d431/p/86d8c8-data-visualization) | Prioritize clarity and contrast; retain meaningful labels and use brand neutrals for axes. |
| [Brand photography](https://brand.splunk.com/19231d431/p/195228-brand-photography), [event photography](https://brand.splunk.com/19231d431/p/00bb83-event-photography) | Prefer natural, credible color photography. The application does not bundle brand photography. |
| [Logo](https://brand.splunk.com/19231d431/p/22449c-splunk-logo) | Use the current approved full lockup only where authorized; do not recreate or separate its elements. This independent application does not use a Splunk logo. |
| [Report and e-book guidance](https://brand.splunk.com/19231d431/p/08d3c7-data-reports-and-e-books) | Match content depth to the reader; the reporting tool supports technical and executive audiences. |
| [Voice and tone](https://brand.splunk.com/19231d431/p/8957fe-voice-and-tone), [calls to action](https://brand.splunk.com/19231d431/p/90bc3d-calls-to-action) | Be conversational and clear; use specific action verbs and sentence case. |

The review also navigated brand overview and evolution, event and logo variants, decks, report formats, email, environmental and social activations, writing references, and resource/update pages. Long editorial reference pages and event-specific material were skimmed for applicable guidance; linked Brand Exchange downloads and nested asset files were not individually audited or imported. Those sections inform brand governance but do not prescribe the editor's controls or imply that ThreatLedger is an official Cisco product. The brand guide is access-controlled and may change; consult it for the latest restrictions and approved assets.

## Color and usage

The canonical primitive and semantic variables live in [`src/design-system/tokens.css`](../src/design-system/tokens.css); [`brand-components.css`](../src/design-system/brand-components.css) maps them to the current interface. Full magenta, orange, medium-blue and Cisco-blue ramps are available there.

| Token | Value | Role |
| --- | --- | --- |
| `--brand-magenta-50` | `#FF007F` | Left endpoint of the primary gradient. |
| `--brand-orange-50` | `#FF9000` | Right endpoint of the primary gradient. |
| `--brand-medium-blue-50` | `#0A60FF` | Brand link color on light backgrounds. |
| `--brand-medium-blue-40` | `#478EFF` | Brand link color on dark backgrounds. |
| `--brand-cisco-blue-50` | `#02C8FF` | Supporting brand primitive; not an automatic semantic status. |
| `--surface-page` | `#0B1118` | ThreatLedger page background, based on neutral dark 15. |
| `--surface-panel` | `#131A23` | ThreatLedger editor panels, based on neutral dark 25. |
| `--surface-subtle` | `#1B232D` | Secondary surfaces, based on neutral dark 35. |
| `--text-primary` | `#F2F5FA` | Primary text on dark surfaces. |
| `--text-secondary` | `#BBC1C9` | Secondary text on dark surfaces. |
| `--action-primary` / `--action-primary-text` | `#FFFFFF` / `#04070B` | White primary CTA with dark text, adapted to the brand CTA guidance. |

The guide says not to use solid magenta or orange for ordinary backgrounds, text or CTAs. Use the paired gradient sparingly; it runs from magenta on the left to orange on the right and must cover less than 50% of the overall design. Do not use purple or the retired dark-mode gradient. Use black, white or a transparent outlined CTA; links use the appropriate medium blue. Do not use the Splunk Blue primitive as a general application surface.

The guide's data-visualization page asks designers to begin with magenta and orange, while its color page says neither should be the sole or primary data-visualization color. Treat this as a source ambiguity: use multiple distinguishable series, do not make either color the sole series, and consult the current brand team guidance before shipping a branded chart. Yellow `#FFD000` and green `#00C896` are documented as special-use data-visualization colors, not generic branding colors. ThreatLedger success, warning and error colors are separately named product-state adaptations and must never be the only way to convey status.

## Typography and spacing

The bundled Inter variable font is the primary screen face; Arial is the fallback. The guide recommends semibold for primary headings and regular or medium for body, labels and buttons; avoid thin weights at small sizes. For scripts Inter does not support, the brand guide recommends Noto Sans; no Noto font is bundled here, so the browser's installed fallbacks apply. Microsoft Word may need a separately installed static Inter font; the existing DOCX/PDF export pipeline does not yet implement the full brand typography or document templates.

ThreatLedger uses a compact application scale rather than the brand guide's example marketing scale. The 4 px spacing tokens, 4 px control/surface radius and component sizes are application decisions. Avoid relying on font weight, color or icons alone to communicate status.

## Components and implementation

- `Button`, `Input`, `Textarea`, `Checkbox` and `Dialog` are local shadcn/ui components in `src/components/ui`; Radix supplies dialog and checkbox interaction.
- Page chrome, blueprint list, report outline, editor fields, warnings, notifications and export controls are ThreatLedger patterns styled by the same semantic tokens.
- In CSS use `var(--surface-panel)`, `var(--text-primary)` and other semantic values rather than raw brand primitives for application components. Use `var(--brand-gradient)` for permitted accents.
- Tailwind v4 exposes CSS-first utilities such as `bg-brand-panel`, `text-brand-text`, `text-brand-link` and `font-brand`; the existing shadcn mappings use `--background`, `--primary`, `--ring` and related variables.
- Test keyboard focus, dialog containment, status announcements, contrast and both desktop and mobile layouts whenever components change. `tests/design-tokens.test.ts` verifies key text/action contrast pairs.
- On narrow screens, keep editor fields at 16px and provide at least 44px touch targets for primary editor controls. Wrap the editor toolbar to retain readable section names and access to actions.
- Report selectors identify the current report programmatically and distinguish untitled reports; actions on repeated entries include the entry number in their accessible names. Canonical component colors belong in the brand mapping rather than duplicated legacy declarations.

## Export boundaries

The browser editor uses these application tokens. Word and PDF exports still have the existing Markdown, image and font limitations explained in the export dialog, and their document layouts are not represented as official brand templates. Do not assume that an exported document is brand-compliant without reviewing it and applying any required approved template.
