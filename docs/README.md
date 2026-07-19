# AllerLeih — Documentation

Documentation for [AllerLeih](https://github.com/share-open-sharing-infrastructure/share-mvp), a community item-sharing platform built with SvelteKit + PocketBase. Diagrams use [Mermaid.js](https://mermaid.js.org/); everything else is plain Markdown.

- [architecture.md](architecture.md) — system overview: tech stack, deployment pipeline, auth flow, AI integrations, and external API boundaries. **Start here.**
- [domain-model.md](domain-model.md) — conceptual model: class diagrams, lending workflow state machine, trust + groups model, and institutional partner model.
- [data-model.md](data-model.md) — ER diagram mapping directly onto PocketBase collections and the `items_public` / `items_searchable` SQL views.
- [search-discovery.md](search-discovery.md) — the `/search` route: URL params, filter building, pagination, and which view it reads.
- [groups.md](groups.md) — the groups feature: sharing items with a chosen circle, the independent trust/group visibility model, backend enforcement, and how to test it.
- [integrations.md](integrations.md) — how partner catalogues are ingested (leihbackend, WINBIAP) and how to add a new integration.
- [leihbackend-integration-spec.md](leihbackend-integration-spec.md) — leihbackend-specific reference: its public API surface and the (not-yet-built) Phase 2 reservation-forwarding plan.
- [best-practices.md](best-practices.md) — SvelteKit form patterns and Svelte 5 reactivity conventions used throughout the codebase.
- [design-system.md](design-system.md) — theme tokens, the shared `Button` component (variants, sizes, loading pattern), and the `[data-theme]` white-labeling mechanism.
- [testing-strategy.md](testing-strategy.md) — testing approach (Vitest unit tests), CI integration, and example patterns.
- [text-management.md](text-management.md) — centralized German UI string system (`src/lib/texts.ts`) and full category reference.
- [operations/onboarding-institutional-partner.md](operations/onboarding-institutional-partner.md) — step-by-step checklist for onboarding a new institutional partner (library, lending shop), including connecting an automatic integration.
- [operations/integration-sync.md](operations/integration-sync.md) — operations runbook for the sync/refresh endpoints: env vars, cron, failure modes.
- [operations/updating-legal-documents.md](operations/updating-legal-documents.md) — how an operator edits the ToS / privacy text and publishes a new version that triggers re-consent (Issue #399).

**Key source files:**
- `src/lib/types/models.ts` — canonical TypeScript types for all PocketBase collections
- `src/lib/texts.ts` — all German UI strings
