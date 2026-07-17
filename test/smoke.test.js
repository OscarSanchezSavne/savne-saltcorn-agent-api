"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const plugin = require("../index");
const packageJson = require("../package.json");
const {
  getBearerToken,
  isAdminRequest,
  requireExtensionAccess,
} = require("../lib/http");

assert.strictEqual(plugin.plugin_name, "savne-saltcorn-agent-api");
assert.strictEqual(plugin.sc_plugin_api_version, 1);
assert.ok(plugin.description.includes("Saltcorn"));
assert.strictEqual(packageJson.private, false);
assert.ok(packageJson.repository.url.includes("OscarSanchezSavne/savne-saltcorn-agent-api"));
assert.ok(packageJson.engines.saltcorn);
assert.ok(fs.existsSync(path.join(__dirname, "..", "LICENSE")));
assert.ok(fs.existsSync(path.join(__dirname, "..", "SECURITY.md")));
const privateInstanceAddress = ["10", "0", "100", "4"].join(".");
for (const publicFile of ["README.md", "SKILL.md", "openapi.json"]) {
  assert.ok(
    !fs
      .readFileSync(path.join(__dirname, "..", publicFile), "utf8")
      .includes(privateInstanceAddress),
    `${publicFile} must not include private instance addresses`
  );
}
assert.strictEqual(plugin.documentation_url, undefined);
assert.strictEqual(plugin.configuration_workflow, undefined);
assert.ok(Array.isArray(plugin.routes));
const urls = plugin.routes.map((route) => route.url);
assert.ok(urls.every((url) => url.startsWith("/savne-saltcorn-agent-api/")));
assert.ok(urls.every((url) => !url.startsWith("/extension-api/")));
assert.ok(urls.every((url) => !url.startsWith("/plugins/saltcorn-extension-api/")));
assert.ok(urls.every((url) => !url.startsWith("/plugins/savne-saltcorn-agent-api/")));
const routeKeys = plugin.routes.map((route) => `${route.method.toUpperCase()} ${route.url}`);
assert.strictEqual(new Set(routeKeys).size, routeKeys.length);
assert.ok(urls.includes("/savne-saltcorn-agent-api/health"));
assert.ok(urls.includes("/savne-saltcorn-agent-api/openapi.json"));
assert.ok(urls.includes("/savne-saltcorn-agent-api/docs"));
assert.ok(urls.includes("/savne-saltcorn-agent-api/capabilities"));
assert.ok(urls.includes("/savne-saltcorn-agent-api/capabilities/require"));
assert.ok(urls.includes("/savne-saltcorn-agent-api/fields/capabilities"));
assert.ok(urls.includes("/savne-saltcorn-agent-api/relations/key"));
assert.ok(urls.includes("/savne-saltcorn-agent-api/relations/many-to-many"));
assert.ok(urls.includes("/savne-saltcorn-agent-api/refresh"));
assert.ok(urls.includes("/savne-saltcorn-agent-api/rows"));
assert.ok(urls.includes("/savne-saltcorn-agent-api/pages/record-with-relations"));
assert.ok(urls.includes("/savne-saltcorn-agent-api/views/tabulator"));
assert.ok(urls.includes("/savne-saltcorn-agent-api/views/form-layout"));
assert.ok(urls.includes("/savne-saltcorn-agent-api/views/calendar"));
assert.ok(urls.includes("/savne-saltcorn-agent-api/views/chart"));
assert.ok(urls.includes("/savne-saltcorn-agent-api/views/attachments"));
assert.ok(urls.includes("/savne-saltcorn-agent-api/views/kanban"));
assert.ok(urls.includes("/savne-saltcorn-agent-api/menus/inspect"));
assert.ok(urls.includes("/savne-saltcorn-agent-api/menus/upsert"));
assert.ok(urls.includes("/savne-saltcorn-agent-api/menus/add-page"));
assert.ok(plugin.routes.every((route) => typeof route.callback === "function"));
assert.strictEqual(plugin.functions.saltcorn_extension_api_diagnostics, undefined);
assert.ok(plugin.functions.savne_agent_api_diagnostics);
assert.ok(
  plugin.functions.savne_agent_api_diagnostics.description.includes(
    "Open Swagger UI"
  )
);
assert.strictEqual(typeof plugin.extension_api.capabilities, "function");
assert.strictEqual(typeof plugin.extension_api.openapi, "function");
assert.strictEqual(typeof plugin.extension_api.fieldCapabilities, "function");
assert.strictEqual(typeof plugin.extension_api.refreshCaches, "function");
assert.strictEqual(typeof plugin.extension_api.requireCapabilities, "function");
assert.strictEqual(typeof plugin.extension_api.createRows, "function");
assert.strictEqual(typeof plugin.extension_api.createKeyRelation, "function");
assert.strictEqual(typeof plugin.extension_api.createManyToManyRelation, "function");
assert.strictEqual(typeof plugin.extension_api.createRecordWithRelationsPage, "function");
assert.strictEqual(typeof plugin.extension_api.createTabulatorView, "function");
assert.strictEqual(typeof plugin.extension_api.createFormLayoutView, "function");
assert.strictEqual(typeof plugin.extension_api.createKanbanView, "function");
assert.strictEqual(typeof plugin.extension_api.createCalendarView, "function");
assert.strictEqual(typeof plugin.extension_api.createChartView, "function");
assert.strictEqual(typeof plugin.extension_api.createAttachmentView, "function");
assert.strictEqual(typeof plugin.extension_api.inspectMenu, "function");
assert.strictEqual(typeof plugin.extension_api.upsertMenu, "function");
assert.strictEqual(typeof plugin.extension_api.addPageToMenu, "function");
assert.strictEqual(getBearerToken({ headers: { authorization: "Bearer test" } }), "test");
assert.strictEqual(isAdminRequest({ user: { role_id: 1 } }), true);
assert.strictEqual(isAdminRequest({ user: { role_id: 2 } }), false);

Promise.resolve(requireExtensionAccess({}, { public: true })).then((user) => {
  assert.strictEqual(user, null);
});

Promise.resolve(plugin.extension_api.openapi())
  .then((openapi) => {
    assert.strictEqual(openapi.openapi, "3.1.0");
    assert.strictEqual(openapi.info.version, require("../package.json").version);
    assert.ok(openapi.paths["/savne-saltcorn-agent-api/openapi.json"]);
    assert.ok(openapi.paths["/savne-saltcorn-agent-api/docs"]);
    assert.deepStrictEqual(
      openapi.paths["/savne-saltcorn-agent-api/openapi.json"].get.security,
      []
    );
    assert.deepStrictEqual(
      openapi.paths["/savne-saltcorn-agent-api/docs"].get.security,
      []
    );
    console.log("savne-saltcorn-agent-api smoke test passed");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
