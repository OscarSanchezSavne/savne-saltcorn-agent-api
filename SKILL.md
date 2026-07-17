---
name: savne-saltcorn-agent-api
description: Operate Saltcorn applications through the Savne Saltcorn Agent API plugin. Use when Codex or another agent needs to inspect, create, or modify Saltcorn tables, fields, rows, relations, views, pages, menus, dashboards, Tabulator grids, Kanban boards, calendars, charts, attachment views, many-to-many relations, or advanced form layouts through authenticated HTTP endpoints instead of direct SQL.
---

# Savne Saltcorn Agent API

Use this skill to build or modify Saltcorn apps through the `savne-saltcorn-agent-api` plugin. Treat Saltcorn as the application runtime and this plugin as the stable automation driver.

## Core Rules

- Use HTTP endpoints under `/savne-saltcorn-agent-api/...`.
- Authenticate with a native Saltcorn user API token: `Authorization: Bearer <saltcorn-user-api-token>`.
- Do not use fixed shared tokens, cookies, or direct Saltcorn internal table writes.
- Prefer Saltcorn-native tables, fields, views, pages, menus, and layout components.
- Use small HTML snippets only for headings, helper text, or unavoidable layout polish.
- Run destructive operations only on explicit named objects requested by the user.
- Never call or recreate broad cleanup behavior. There is no safe "delete everything" workflow.
- Default to `dry_run: true` for write planning; execute with `dry_run: false` only after the plan is reasonable.
- After creating or updating views/pages/menus, call `/savne-saltcorn-agent-api/refresh`.

## Request Pattern

Use JSON with explicit content type:

```bash
curl -sS \
  -H "Authorization: Bearer $SALTCORN_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dry_run":true}' \
  "$SALTCORN_BASE_URL/savne-saltcorn-agent-api/health"
```

For GET requests omit `-d`.

## Discovery First

Start every session with:

1. `GET /savne-saltcorn-agent-api/health`
2. `GET /savne-saltcorn-agent-api/openapi.json`
3. `GET /savne-saltcorn-agent-api/capabilities`
4. `GET /savne-saltcorn-agent-api/fields/capabilities`
5. `GET /savne-saltcorn-agent-api/viewtemplates`
6. `GET /savne-saltcorn-agent-api/menus/inspect` when changing navigation

Use `/savne-saltcorn-agent-api/openapi.json` as the contract source for endpoint names,
security, request bodies, dry-run behavior, and response shapes. Use this skill
as the operational playbook for sequencing and decision-making.
The OpenAPI JSON and `/savne-saltcorn-agent-api/docs` are public discovery
endpoints. Every administrative operation still requires an admin Saltcorn
user API token.

Use `/savne-saltcorn-agent-api/capabilities/require` before optional plugin views:

```json
{
  "features": ["tabulator", "kanban", "calendar", "chart", "attachments", "many_to_many"]
}
```

If a required feature is missing, tell the user which Saltcorn plugin must be installed before continuing.

## Build Workflow

Use this order unless the user asks for a narrow edit:

1. Inspect current state and capabilities.
2. Create or update tables.
3. Add fields and relations.
4. Seed enough rows for visual validation.
5. Create basic `List`, `Show`, and `Edit` views for each table that needs CRUD.
6. Create specialized views: Tabulator, Kanban, Calendar, Chart, Attachments, many-to-many helper.
7. Create advanced form layouts when standard edit views become too long.
8. Compose pages from views.
9. Add pages to menus.
10. Refresh Saltcorn and inspect created objects.

## Naming And Language

- Keep internal table and field names stable, ASCII, lowercase, and snake_case.
- Use user-facing labels in the requested language.
- For Spanish apps, use labels such as `Crear`, `Guardar`, `Editar`, `Eliminar`, `Productos`, `Proveedor`, `Calendario`.
- Do not rename internal table names just to translate UI labels.

## Tables

Create tables with `POST /savne-saltcorn-agent-api/tables`.

Minimal pattern:

```json
{
  "name": "productos",
  "label": "Productos",
  "fields": [
    { "name": "codigo", "label": "Codigo", "type": "String", "required": true, "unique": true },
    { "name": "nombre", "label": "Nombre", "type": "String", "required": true },
    { "name": "activo", "label": "Activo", "type": "Bool" }
  ],
  "dry_run": true
}
```

Prefer one call per table. If the table exists, inspect before adding fields.

## Fields

Add fields with `POST /savne-saltcorn-agent-api/fields`.

Common field types:

- `String` for names, codes, statuses, categories.
- `Integer` for counts and positions.
- `Float` or `Decimal` for amounts.
- `Bool` for active flags.
- `Date` for dates and datetimes.
- `Key` for many-to-one relations.
- `File` or `File[]` for attachments when supported.
- `JSON`, `HTML`, `Markdown`, `Money`, `Time` only if the corresponding plugin/type is installed.

Key relation field:

```json
{
  "table": "productos",
  "name": "proveedor",
  "label": "Proveedor",
  "type": "Key",
  "reftable_name": "proveedores",
  "summary_field": "nombre",
  "dry_run": true
}
```

## Rows

Seed data with `POST /savne-saltcorn-agent-api/rows`.

```json
{
  "table": "productos",
  "rows": [
    { "codigo": "P-001", "nombre": "Sensor de temperatura", "activo": true }
  ],
  "dry_run": true
}
```

Only send keys that exist as Saltcorn fields. For Key fields, use valid referenced row IDs unless the endpoint supports name resolution for that specific case.

## Basic CRUD Views

Create native CRUD views with `POST /savne-saltcorn-agent-api/views/basic`.

```json
{
  "table": "productos",
  "viewtemplates": ["List", "Show", "Edit"],
  "names": {
    "List": "Lista de productos",
    "Show": "Ficha producto",
    "Edit": "Editar producto"
  },
  "labels": {
    "codigo": "Codigo",
    "nombre": "Producto",
    "activo": "Activo"
  },
  "actions": {
    "save_label": "Guardar",
    "delete_label": "Eliminar",
    "confirm_delete": true
  },
  "dry_run": true
}
```

Use `replace_existing: true` when intentionally updating a generated view.

## Advanced Form Layouts

Use `POST /savne-saltcorn-agent-api/views/form-layout` when an edit form needs tabs, sections, columns, or grouped fields.

```json
{
  "table": "productos",
  "name": "Editar producto avanzado",
  "popup_title": "Editar producto",
  "popup_width": 90,
  "popup_width_units": "%",
  "save_label": "Guardar",
  "style": "plain",
  "tabs": [
    {
      "label": "Datos",
      "sections": [
        {
          "column_count": 2,
          "fields": ["codigo", "nombre", "proveedor", "categoria", "estado", "activo"]
        }
      ]
    },
    {
      "label": "Inventario",
      "sections": [
        {
          "column_count": 3,
          "fields": ["stock", "stock_minimo", "costo_unitario", "ubicacion", "ultimo_conteo"]
        }
      ]
    },
    {
      "label": "Notas",
      "sections": [
        {
          "column_count": 1,
          "fields": ["notas"]
        }
      ]
    }
  ],
  "dry_run": true
}
```

Use `style: "plain"` when the user does not want cards inside tabs. Add section titles only when they help users scan complex forms.

## Tabulator Grids

Use `POST /savne-saltcorn-agent-api/views/tabulator` for operational tables with sorting, pagination, optional download, and compact actions.

```json
{
  "table": "productos",
  "name": "Grid operativo de productos",
  "show_view": "Ficha producto",
  "edit_view": "Editar producto avanzado",
  "columns": ["codigo", "nombre", "estado", "stock", "stock_minimo", "proveedor"],
  "labels": {
    "codigo": "Codigo",
    "nombre": "Producto",
    "stock_minimo": "Stock minimo"
  },
  "download": true,
  "filters": false,
  "page_size": 20,
  "dry_run": true
}
```

If Tabulator looks visually heavy, reduce visible columns and move detail into Show/Edit views. Do not force all fields into one grid.

## Kanban

Use `POST /savne-saltcorn-agent-api/views/kanban` for status boards. Ensure there is a status/select field and a compact Show/Card view first.

```json
{
  "table": "tareas",
  "name": "Tablero de tareas",
  "column_field": "estado",
  "show_view": "Tarjeta tarea",
  "edit_view": "Editar tarea",
  "position_field": "posicion",
  "create_enabled": true,
  "labels": {
    "estado": "Estado",
    "descripcion": "Descripcion",
    "vencimiento": "Vence"
  },
  "dry_run": true
}
```

For card views, include only the important fields. Avoid card layouts that show labels in narrow columns.

## Calendar

Use `POST /savne-saltcorn-agent-api/views/calendar` for event tables. Required fields: title `String`, start `Date`. Optional fields: end `Date`, all-day `Bool`, color `String`, edit view.

```json
{
  "table": "eventos",
  "name": "Calendario operativo",
  "title_field": "titulo",
  "start_field": "inicio",
  "end_field": "fin",
  "all_day_field": "todo_el_dia",
  "color_field": "color",
  "edit_view": "Editar evento",
  "create_label": "Crear evento",
  "dry_run": true
}
```

If a calendar works alone but not inside a tab/page, prefer rendering it on its own page or inspect the generated page layout. Calendar components often need width and height from their container.

## Charts

Use `POST /savne-saltcorn-agent-api/views/chart` for dashboards. Prefer one chart per panel or full-width section.

Donut/count by category:

```json
{
  "table": "productos",
  "name": "Productos por estado",
  "chart_type": "donut",
  "factor_field": "estado",
  "title": "Productos por estado",
  "show_legend": true,
  "dry_run": true
}
```

Bar with numeric outcome:

```json
{
  "table": "productos",
  "name": "Stock por categoria",
  "chart_type": "bar",
  "factor_field": "categoria",
  "outcomes": [{ "field": "stock", "stat": "sum", "label": "Stock" }],
  "title": "Stock total por categoria",
  "dry_run": true
}
```

If chart labels overflow, place the chart in a wider section or simplify labels. Do not cram multiple full-size charts into a narrow row.

## Relations

Use `POST /savne-saltcorn-agent-api/relations/key` for many-to-one:

```json
{
  "table": "productos",
  "field": "proveedor",
  "reftable": "proveedores",
  "summary_field": "nombre",
  "dry_run": true
}
```

Use `POST /savne-saltcorn-agent-api/relations/many-to-many` for many-to-many helpers:

```json
{
  "left_table": "productos",
  "right_table": "etiquetas",
  "join_table": "producto_etiquetas",
  "left_key": "producto_id",
  "right_key": "etiqueta_id",
  "right_label_field": "nombre",
  "dry_run": true
}
```

Many-to-many is useful when one record can have multiple tags, permissions, categories, users, or linked resources.

## Attachments

Use `POST /savne-saltcorn-agent-api/views/attachments` when a parent record needs related files. The child table must have a Key to the parent and a File/File[] field.

```json
{
  "table": "productos",
  "child_table": "producto_adjuntos",
  "relation_field": "producto_id",
  "file_field": "archivos",
  "name": "Adjuntos producto",
  "dry_run": true
}
```

## Pages

Use `POST /savne-saltcorn-agent-api/pages/crud` for a simple page around a list/grid and create/edit modal.

```json
{
  "name": "productos",
  "title": "Productos",
  "table": "productos",
  "list_view": "Grid operativo de productos",
  "edit_view": "Editar producto avanzado",
  "create_label": "Crear producto",
  "dry_run": true
}
```

Use `POST /savne-saltcorn-agent-api/pages/record-with-relations` for a master-detail page with tabs or sections:

```json
{
  "name": "producto_detalle",
  "title": "Producto con relaciones",
  "record_view": "Ficha producto",
  "record_state": "shared",
  "style": "plain",
  "sections": [
    { "label": "Etiquetas", "view": "Etiquetas producto" },
    { "label": "Adjuntos", "view": "Adjuntos producto" }
  ],
  "dry_run": true
}
```

## Menus

Inspect before changing menus:

```http
GET /savne-saltcorn-agent-api/menus/inspect
```

Prefer adding pages with `POST /savne-saltcorn-agent-api/menus/add-page`:

```json
{
  "group": "Inventario",
  "label": "Productos",
  "page": "productos",
  "icon": "fas fa-box",
  "dry_run": true
}
```

Use `menus/upsert` only when intentionally replacing or restructuring a known menu group. Preserve native Saltcorn admin menu items unless the user explicitly asks to hide them.

## Explicit Deletion Only

Use `POST /savne-saltcorn-agent-api/objects/delete` only with explicit names:

```json
{
  "pages": ["productos"],
  "views": ["Grid operativo de productos", "Editar producto avanzado"],
  "tables": ["productos"],
  "dry_run": true
}
```

Never infer a broad cleanup from vague phrases like "borra todo". Ask for explicit object lists or produce a dry-run plan first.

## Validation Checklist

Before reporting success:

- Confirm `/savne-saltcorn-agent-api/health` responds with the expected plugin.
- Confirm `/savne-saltcorn-agent-api/openapi.json` is available when generating API-aware payloads.
- Confirm optional plugin capabilities for specialized views.
- Inspect created views/pages if endpoint support exists.
- Refresh Saltcorn.
- Give the user exact page or view URLs to verify visually.
- Mention any skipped feature and the missing Saltcorn plugin or required field.

## Common Failures

- `401`: token missing, invalid, or not a Saltcorn user API token.
- `Cannot read property 'main'`: Saltcorn plugin loader cache or install race; restart Saltcorn and reinstall one package identity at a time.
- `Viewtemplate not found`: required Saltcorn plugin is not installed or not loaded.
- `No such view`: page or linked action references an old view name.
- Calendar blank inside page: container sizing issue; test the calendar view alone.
- Kanban card labels wrap badly: card Show view includes too many fields or uses a poor layout.
- Tabulator too wide: reduce columns and move details into Edit/Show.

## Package Identity

The current package/plugin name is `savne-saltcorn-agent-api`. Do not install it alongside the old development package identity. This package exposes only `/savne-saltcorn-agent-api/...` public routes.
