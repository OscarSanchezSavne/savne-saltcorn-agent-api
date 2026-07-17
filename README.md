# savne-saltcorn-agent-api

Administrative API plugin for operating Saltcorn safely from agents, scripts,
and automation tools.

Maintained by [Savne](https://savne.net). Support and security reports:
`info@savne.net`.

## Install From GitHub

In Saltcorn, open **Module store** -> **Add another plugin** and use:

```text
Nombre: savne-saltcorn-agent-api
Fuente: github
Ubicacion: OscarSanchezSavne/savne-saltcorn-agent-api
Version: main
```

For a fixed release, use:

```text
Nombre: savne-saltcorn-agent-api
Fuente: github
Ubicacion: OscarSanchezSavne/savne-saltcorn-agent-api
Version: v0.2.55
```

Do not put the full GitHub URL in `Nombre`. For Saltcorn's `github` source,
`Ubicacion` must be `owner/repository`.

## Documentation

After installing and restarting Saltcorn, open these authenticated endpoints with
a Saltcorn admin user API token:

```text
/savne-saltcorn-agent-api/docs
/savne-saltcorn-agent-api/openapi.json
```

The OpenAPI contract is also included in this repository as `openapi.json`.
Agent usage guidance is included as `SKILL.md`. The documentation routes are
not public; they require the same Saltcorn user token as the administrative API.

## Security

The plugin uses native Saltcorn user API tokens:

```http
Authorization: Bearer <saltcorn-user-api-token>
```

Administrative operations require an admin Saltcorn user token. There is no
fixed shared plugin token.

## Route Family

All plugin routes live under:

```text
/savne-saltcorn-agent-api/...
```

The plugin exposes operations for tables, fields, rows, relations, views, pages,
menus, Tabulator grids, Kanban boards, calendars, charts, attachments,
many-to-many relations, locale settings, and advanced form layouts.
