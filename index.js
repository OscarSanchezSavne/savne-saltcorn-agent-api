"use strict";

const { jsonHandler, requireExtensionAccess } = require("./lib/http");
const { getExtensionState, optionalRequire } = require("./lib/state");
const {
  addField,
  deleteObjects,
  createAttachmentView,
  addPageToMenu,
  createBasicViews,
  createCalendarView,
  createChartView,
  createCrudPage,
  createFormLayoutView,
  createKeyRelation,
  createManyToManyRelation,
  createPublicPage,
  createRecordWithRelationsPage,
  createTrigger,
  createWebhookTrigger,
  createKanbanView,
  createPage,
  createRows,
  createTabulatorView,
  createTable,
  createView,
  getLocaleSettings,
  getCapabilities,
  inspectMenu,
  inspectPages,
  inspectViews,
  listActionsAndTriggers,
  listFieldCapabilities,
  listViewTemplates,
  refreshCaches,
  requireCapabilities,
  setLocaleSettings,
  upsertMenu,
} = require("./lib/operations");

const pluginName = "savne-saltcorn-agent-api";
const pluginVersion = require("./package.json").version;
const openApiDocument = require("./openapi.json");
const pluginDescription =
  "Administrative API for operating Saltcorn safely from agents, scripts, and automation tools.";
const documentationUrl = `/${pluginName}/docs`;
const openApiUrl = `/${pluginName}/openapi.json`;

const commands = [
  {
    name: "health",
    method: "GET",
    url: "/savne-saltcorn-agent-api/health",
    description: "Checks whether the extension API plugin is loaded.",
    destructive: false,
  },
  {
    name: "state",
    method: "GET",
    url: "/savne-saltcorn-agent-api/state",
    description: "Returns tables, views, pages, roles, and installed plugins visible to Saltcorn.",
    destructive: false,
  },
  {
    name: "commands",
    method: "GET",
    url: "/savne-saltcorn-agent-api/commands",
    description: "Lists supported extension API commands.",
    destructive: false,
  },
  {
    name: "openapi",
    method: "GET",
    url: openApiUrl,
    description: "Returns the OpenAPI contract for the extension API.",
    destructive: false,
  },
  {
    name: "docs",
    method: "GET",
    url: documentationUrl,
    description: "Shows a browser-friendly OpenAPI documentation page.",
    destructive: false,
  },
  {
    name: "validate",
    method: "POST",
    url: "/savne-saltcorn-agent-api/validate",
    description: "Validates the plugin access layer and reports current read capabilities.",
    destructive: false,
  },
  {
    name: "viewtemplates",
    method: "GET",
    url: "/savne-saltcorn-agent-api/viewtemplates",
    description: "Lists available Saltcorn viewtemplates and whether they support automatic basic creation.",
    destructive: false,
  },
  {
    name: "field_capabilities",
    method: "GET",
    url: "/savne-saltcorn-agent-api/fields/capabilities",
    description: "Lists Saltcorn field types, fieldviews, fileviews, key fieldviews, and supported field presets.",
    destructive: false,
  },
  {
    name: "capabilities",
    method: "GET",
    url: "/savne-saltcorn-agent-api/capabilities",
    description: "Lists installed plugins, available viewtemplates, and validated feature recipes.",
    destructive: false,
  },
  {
    name: "actions",
    method: "GET",
    url: "/savne-saltcorn-agent-api/actions",
    description: "Lists available Saltcorn actions, trigger event types, and existing triggers.",
    destructive: false,
  },
  {
    name: "require_capabilities",
    method: "POST",
    url: "/savne-saltcorn-agent-api/capabilities/require",
    description: "Checks whether one or more feature recipes are available before creating dependent views.",
    destructive: false,
  },
  {
    name: "refresh",
    method: "POST",
    url: "/savne-saltcorn-agent-api/refresh",
    description: "Refreshes Saltcorn table, view, and page caches and signals other workers.",
    destructive: false,
  },
  {
    name: "get_locale_settings",
    method: "GET",
    url: "/savne-saltcorn-agent-api/settings/locale",
    description: "Returns Saltcorn default locale and available languages.",
    destructive: false,
  },
  {
    name: "set_locale_settings",
    method: "POST",
    url: "/savne-saltcorn-agent-api/settings/locale",
    description: "Sets Saltcorn default_locale after validating it against available languages. Defaults to dry_run.",
    destructive: true,
  },
  {
    name: "delete_objects",
    method: "POST",
    url: "/savne-saltcorn-agent-api/objects/delete",
    description: "Deletes explicitly named pages, views, and tables. No wildcards, no users table, no full workspace reset.",
    destructive: true,
  },
  {
    name: "create_table",
    method: "POST",
    url: "/savne-saltcorn-agent-api/tables",
    description: "Creates a Saltcorn table and optional fields. Defaults to dry_run unless dry_run is false.",
    destructive: true,
  },
  {
    name: "add_field",
    method: "POST",
    url: "/savne-saltcorn-agent-api/fields",
    description: "Adds a field to an existing Saltcorn table. Defaults to dry_run unless dry_run is false.",
    destructive: true,
  },
  {
    name: "create_key_relation",
    method: "POST",
    url: "/savne-saltcorn-agent-api/relations/key",
    description: "Adds a validated Key relation field between two Saltcorn tables, with optional selectize fieldview.",
    destructive: true,
  },
  {
    name: "create_many_to_many_relation",
    method: "POST",
    url: "/savne-saltcorn-agent-api/relations/many-to-many",
    description: "Creates or wires a many-to-many join table, its two Key fields, and an optional checkbox view.",
    destructive: true,
  },
  {
    name: "create_rows",
    method: "POST",
    url: "/savne-saltcorn-agent-api/rows",
    description: "Inserts one or more rows into a Saltcorn table after field validation. Defaults to dry_run.",
    destructive: true,
  },
  {
    name: "create_basic_views",
    method: "POST",
    url: "/savne-saltcorn-agent-api/views/basic",
    description: "Creates basic views for a table by calling each viewtemplate createBasicView helper.",
    destructive: true,
  },
  {
    name: "create_form_layout_view",
    method: "POST",
    url: "/savne-saltcorn-agent-api/views/form-layout",
    description: "Creates an Edit view with native Saltcorn tabs, sections, cards, and multi-column field layouts.",
    destructive: true,
  },
  {
    name: "create_view",
    method: "POST",
    url: "/savne-saltcorn-agent-api/views",
    description: "Creates one view using a selected viewtemplate and explicit or generated configuration.",
    destructive: true,
  },
  {
    name: "create_tabulator_view",
    method: "POST",
    url: "/savne-saltcorn-agent-api/views/tabulator",
    description: "Creates a Tabulator editable grid view with capability checks and practical defaults.",
    destructive: true,
  },
  {
    name: "create_calendar_view",
    method: "POST",
    url: "/savne-saltcorn-agent-api/views/calendar",
    description: "Creates a FullCalendar view with capability checks and practical defaults.",
    destructive: true,
  },
  {
    name: "create_chart_view",
    method: "POST",
    url: "/savne-saltcorn-agent-api/views/chart",
    description: "Creates an Apache ECharts view with capability checks and practical defaults.",
    destructive: true,
  },
  {
    name: "create_attachment_view",
    method: "POST",
    url: "/savne-saltcorn-agent-api/views/attachments",
    description: "Creates a Multi File Upload attachment view wired to a child file table.",
    destructive: true,
  },
  {
    name: "create_kanban_view",
    method: "POST",
    url: "/savne-saltcorn-agent-api/views/kanban",
    description: "Creates a Kanban board view with capability checks and validated fields/views.",
    destructive: true,
  },
  {
    name: "inspect_views",
    method: "POST",
    url: "/savne-saltcorn-agent-api/views/inspect",
    description: "Returns saved configuration for selected views.",
    destructive: false,
  },
  {
    name: "create_page",
    method: "POST",
    url: "/savne-saltcorn-agent-api/pages",
    description: "Creates a Saltcorn page, optionally embedding views and adding a menu item.",
    destructive: true,
  },
  {
    name: "create_public_page",
    method: "POST",
    url: "/savne-saltcorn-agent-api/pages/public",
    description: "Creates a Saltcorn page with public access. Defaults to dry_run unless dry_run is false.",
    destructive: true,
  },
  {
    name: "create_crud_page",
    method: "POST",
    url: "/savne-saltcorn-agent-api/pages/crud",
    description: "Creates or updates a CRUD page with a toolbar create button and an embedded List view.",
    destructive: true,
  },
  {
    name: "create_record_with_relations_page",
    method: "POST",
    url: "/savne-saltcorn-agent-api/pages/record-with-relations",
    description: "Creates or updates a master-detail page with one record view and related sections.",
    destructive: true,
  },
  {
    name: "inspect_pages",
    method: "POST",
    url: "/savne-saltcorn-agent-api/pages/inspect",
    description: "Returns saved layout and attributes for selected pages.",
    destructive: false,
  },
  {
    name: "inspect_menu",
    method: "GET",
    url: "/savne-saltcorn-agent-api/menus/inspect",
    description: "Returns configured and unrolled Saltcorn menu items.",
    destructive: false,
  },
  {
    name: "upsert_menu",
    method: "POST",
    url: "/savne-saltcorn-agent-api/menus/upsert",
    description: "Replaces the Saltcorn menu after validating item references. Defaults to dry_run.",
    destructive: true,
  },
  {
    name: "add_page_to_menu",
    method: "POST",
    url: "/savne-saltcorn-agent-api/menus/add-page",
    description: "Adds or moves a page menu item, optionally inside a Header group. Defaults to dry_run.",
    destructive: true,
  },
  {
    name: "create_trigger",
    method: "POST",
    url: "/savne-saltcorn-agent-api/triggers",
    description: "Creates a Saltcorn trigger/action binding after validating available event and action names. Defaults to dry_run.",
    destructive: true,
  },
  {
    name: "create_webhook_trigger",
    method: "POST",
    url: "/savne-saltcorn-agent-api/triggers/webhook",
    description: "Creates a Saltcorn trigger using an installed webhook action. Defaults to dry_run.",
    destructive: true,
  },
];

const health = async () => ({
  ok: true,
  plugin: pluginName,
  version: pluginVersion,
});

const state = async () => getExtensionState();

const commandList = async () => ({
  ok: true,
  plugin: pluginName,
  commands,
});

const openapi = async () => ({
  ...openApiDocument,
  info: {
    ...openApiDocument.info,
    version: pluginVersion,
  },
});

const openapiDocs = async (_req, res) => {
  if (res?.type) res.type("html");
  return {
    __raw_response: true,
    contentType: "html",
    body: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${pluginName} OpenAPI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .savne-docs-header { padding: 16px 24px; border-bottom: 1px solid #e5e7eb; background: #f8fafc; }
    .savne-docs-header h1 { margin: 0 0 6px; font-size: 22px; }
    .savne-docs-header p { margin: 0; color: #475569; }
    .savne-docs-header a { color: #1d4ed8; }
    #swagger-ui { max-width: 1400px; margin: 0 auto; }
  </style>
</head>
<body>
  <div class="savne-docs-header">
    <h1>${pluginName}</h1>
    <p>${pluginDescription}</p>
    <p>OpenAPI JSON: <a href="./openapi.json">./openapi.json</a></p>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function () {
      if (!window.SwaggerUIBundle) {
        document.getElementById("swagger-ui").innerHTML =
          "<p style='padding:24px'>Swagger UI could not be loaded. Open <a href='./openapi.json'>openapi.json</a> directly.</p>";
        return;
      }
      window.ui = SwaggerUIBundle({
        url: "./openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        persistAuthorization: true,
        tryItOutEnabled: false
      });
    };
</script>
</body>
</html>`,
  };
};

const validate = async () => {
  const currentState = await getExtensionState();
  return {
    ok: true,
    plugin: pluginName,
    read_capabilities: currentState.capabilities,
  };
};

const viewtemplates = async () => listViewTemplates();

const fieldCapabilities = async () => listFieldCapabilities();

const capabilities = async () => getCapabilities();

const actions = async () => listActionsAndTriggers();

const onLoad = async () => {
  console.log(`[${pluginName}] onLoad ${pluginVersion} with ${routes.length} routes`);
  const stateModule = optionalRequire("@saltcorn/data/db/state");
  const state = stateModule?.getState?.();
  if (state?.refresh_tables) await state.refresh_tables(true);
  if (state?.refresh_views) await state.refresh_views(true);
};

const wrap = (handler, options = {}) =>
  jsonHandler(async (req, res) => {
    await requireExtensionAccess(req, options);
    return handler(req, res);
  });

const routeDefinitions = [
  ["get", `/${pluginName}/health`, health],
  ["get", `/${pluginName}/commands`, commandList],
  ["get", openApiUrl, openapi, { allowSession: true }],
  ["get", documentationUrl, openapiDocs, { allowSession: true }],
  ["get", `/${pluginName}/state`, state],
  ["get", `/${pluginName}/viewtemplates`, viewtemplates],
  ["get", `/${pluginName}/fields/capabilities`, fieldCapabilities],
  ["get", `/${pluginName}/capabilities`, capabilities],
  ["get", `/${pluginName}/actions`, actions],
  ["post", `/${pluginName}/validate`, validate],
  [
    "post",
    `/${pluginName}/capabilities/require`,
    (req) => requireCapabilities(req.body || {}),
  ],
  ["post", `/${pluginName}/refresh`, (req) => refreshCaches(req.body || {})],
  ["get", `/${pluginName}/settings/locale`, getLocaleSettings],
  [
    "post",
    `/${pluginName}/settings/locale`,
    (req) => setLocaleSettings(req.body || {}),
  ],
  [
    "post",
    `/${pluginName}/objects/delete`,
    (req) => deleteObjects(req.body || {}),
  ],
  ["post", `/${pluginName}/tables`, (req) => createTable(req.body || {})],
  ["post", `/${pluginName}/fields`, (req) => addField(req.body || {})],
  [
    "post",
    `/${pluginName}/relations/key`,
    (req) => createKeyRelation(req.body || {}),
  ],
  [
    "post",
    `/${pluginName}/relations/many-to-many`,
    (req) => createManyToManyRelation(req.body || {}),
  ],
  ["post", `/${pluginName}/rows`, (req) => createRows(req.body || {})],
  [
    "post",
    `/${pluginName}/views/basic`,
    (req) => createBasicViews(req.body || {}),
  ],
  [
    "post",
    `/${pluginName}/views/form-layout`,
    (req) => createFormLayoutView(req.body || {}),
  ],
  [
    "post",
    `/${pluginName}/views/inspect`,
    (req) => inspectViews(req.body || {}),
  ],
  [
    "post",
    `/${pluginName}/views/tabulator`,
    (req) => createTabulatorView(req.body || {}),
  ],
  [
    "post",
    `/${pluginName}/views/calendar`,
    (req) => createCalendarView(req.body || {}),
  ],
  [
    "post",
    `/${pluginName}/views/chart`,
    (req) => createChartView(req.body || {}),
  ],
  [
    "post",
    `/${pluginName}/views/attachments`,
    (req) => createAttachmentView(req.body || {}),
  ],
  [
    "post",
    `/${pluginName}/views/kanban`,
    (req) => createKanbanView(req.body || {}),
  ],
  ["post", `/${pluginName}/views`, (req) => createView(req.body || {})],
  ["post", `/${pluginName}/pages/crud`, (req) => createCrudPage(req.body || {})],
  [
    "post",
    `/${pluginName}/pages/record-with-relations`,
    (req) => createRecordWithRelationsPage(req.body || {}),
  ],
  ["post", `/${pluginName}/pages/inspect`, (req) => inspectPages(req.body || {})],
  ["post", `/${pluginName}/pages/public`, (req) => createPublicPage(req.body || {})],
  ["post", `/${pluginName}/pages`, (req) => createPage(req.body || {})],
  ["get", `/${pluginName}/menus/inspect`, inspectMenu],
  ["post", `/${pluginName}/menus/upsert`, (req) => upsertMenu(req.body || {})],
  [
    "post",
    `/${pluginName}/menus/add-page`,
    (req) => addPageToMenu(req.body || {}),
  ],
  ["post", `/${pluginName}/triggers`, (req) => createTrigger(req.body || {})],
  [
    "post",
    `/${pluginName}/triggers/webhook`,
    (req) => createWebhookTrigger(req.body || {}),
  ],
];

const routes = routeDefinitions.map(([method, url, handler, options]) => ({
  method,
  url,
  callback: wrap(handler, options),
  apiToken: false,
  noCsrf: true,
}));

const plugin = {
  sc_plugin_api_version: 1,
  plugin_name: pluginName,
  description: pluginDescription,
  routes,
  onLoad,
  functions: {
    savne_agent_api_diagnostics: {
      description:
        `Inspect the installed API and routes. ` +
        `<a href="${documentationUrl}" target="_blank" rel="noopener noreferrer">Open Swagger UI</a> or ` +
        `<a href="${openApiUrl}" target="_blank" rel="noopener noreferrer">OpenAPI JSON</a>.`,
      isAsync: true,
      returns: "Plugin name, version, documentation URLs, and registered routes",
      run: async () => ({
        ok: true,
        plugin: pluginName,
        version: pluginVersion,
        documentation: documentationUrl,
        openapi: openApiUrl,
        routes: routes.map((route) => `${route.method.toUpperCase()} ${route.url}`),
      }),
    },
  },
  extension_api: {
    health,
    openapi,
    state,
    commands: commandList,
    validate,
    viewtemplates,
    fieldCapabilities,
    capabilities,
    actions,
    requireCapabilities,
    refreshCaches,
    getLocaleSettings,
    setLocaleSettings,
    deleteObjects,
    createTable,
    addField,
    createAttachmentView,
    createKeyRelation,
    createManyToManyRelation,
    createPublicPage,
    createRecordWithRelationsPage,
    createTrigger,
    createWebhookTrigger,
    createRows,
    createBasicViews,
    createFormLayoutView,
    createView,
    createTabulatorView,
    createCalendarView,
    createChartView,
    createKanbanView,
    inspectViews,
    listActionsAndTriggers,
    createCrudPage,
    inspectPages,
    createPage,
    inspectMenu,
    upsertMenu,
    addPageToMenu,
  },
};

plugin.default = plugin;

module.exports = plugin;
