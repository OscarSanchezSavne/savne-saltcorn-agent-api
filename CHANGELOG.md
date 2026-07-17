# Changelog

All notable changes to `savne-saltcorn-agent-api` are documented here.

## 0.2.55 - 2026-07-17

- Protected Swagger UI and OpenAPI JSON behind Saltcorn user API token authentication.
- Updated documentation and tests so discovery endpoints are authenticated, not public.

## 0.2.54 - 2026-07-17

- Added public page creation support with explicit public role resolution.
- Added advanced Saltcorn action/trigger discovery and trigger creation endpoints.
- Added a webhook trigger shortcut for installations with a compatible webhook action.
- Expanded the agent skill with database naming conventions and advanced automation safety guidance.

## 0.2.53 - 2026-07-16

- Prepared the package for direct GitHub distribution.
- Added repository metadata and compatibility constraints.
- Added MIT license and security policy files.
- Replaced instance-specific OpenAPI servers and README examples with portable
  configuration.
- Added automatic smoke tests before packaging and publishing.

## 0.2.52 - 2026-07-16

- Made Swagger UI and OpenAPI JSON public discovery endpoints.
- Kept administrative operations protected by Saltcorn administrator tokens.
- Added documentation links to the module information page.
- Renamed the diagnostic function to `savne_agent_api_diagnostics`.

## Earlier development versions

Versions `0.1.0` through `0.2.51` established schema, data, view, page, menu,
locale, capability-discovery, authentication, advanced-form, Kanban, calendar,
chart, attachment, Tabulator, and many-to-many operations while the API was
validated against a live Saltcorn instance.
