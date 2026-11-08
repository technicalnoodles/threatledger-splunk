# Locally owned shadcn/ui components

## Status

Accepted.

## Decision

Adopt shadcn/ui component source with Radix primitives, Tailwind CSS and semantic CSS variables for the report editor. The component sources are kept in `src/components/ui` so the team can adapt their appearance to the requested Splunk-inspired theme without coupling report logic to a vendor component library.

## Consequences

Dialogs and checkboxes gain accessible interaction primitives, and buttons and form inputs share consistent focus and disabled behavior. The application owns component updates and must keep its Radix, Tailwind and shadcn source versions current. This is a visual adaptation, not a claim of official Splunk UI certification or affiliation.
