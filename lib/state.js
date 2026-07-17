"use strict";

const optionalRequire = (moduleName) => {
  try {
    const mod = require(moduleName);
    return mod?.default || mod;
  } catch (_error) {
    return null;
  }
};

const readModel = async (moduleName, mapper) => {
  const Model = optionalRequire(moduleName);
  if (!Model) {
    return {
      available: false,
      items: [],
      error: `Module not available: ${moduleName}`,
    };
  }

  try {
    const rows = typeof Model.find === "function" ? await Model.find({}) : [];
    return {
      available: true,
      items: await Promise.all(rows.map(mapper)),
    };
  } catch (error) {
    return {
      available: false,
      items: [],
      error: error.message,
    };
  }
};

const compact = (value) => {
  if (!value) return undefined;
  if (Array.isArray(value) && value.length === 0) return undefined;
  return value;
};

const mapTable = async (table) => {
  let fields = [];
  try {
    if (typeof table.getFields === "function") fields = await table.getFields();
    else if (Array.isArray(table.fields)) fields = table.fields;
  } catch (_error) {
    fields = [];
  }

  return {
    id: table.id,
    name: table.name,
    description: compact(table.description),
    fields: fields.map((field) => ({
      id: field.id,
      name: field.name,
      label: compact(field.label),
      type: field.type?.name || field.type || field.fieldtype,
      required: field.required === true,
      is_unique: field.is_unique === true,
      reftable_name: compact(field.reftable_name || field.reftable?.name),
      attributes: compact(field.attributes),
    })),
  };
};

const mapSimple = (row) => ({
  id: row.id,
  name: row.name,
  title: compact(row.title),
  table_id: compact(row.table_id),
  table_name: compact(row.table_name),
});

const getExtensionState = async () => {
  const stateModule = optionalRequire("@saltcorn/data/db/state");
  const state = stateModule?.getState?.();
  if (state?.refresh_tables) await state.refresh_tables(true);
  if (state?.refresh_views) await state.refresh_views(true);
  if (state?.refresh_pages) await state.refresh_pages(true);

  const [tables, views, pages, roles, plugins] = await Promise.all([
    readModel("@saltcorn/data/models/table", mapTable),
    readModel("@saltcorn/data/models/view", mapSimple),
    readModel("@saltcorn/data/models/page", mapSimple),
    readModel("@saltcorn/data/models/role", mapSimple),
    readModel("@saltcorn/data/models/plugin", mapSimple),
  ]);

  return {
    ok: true,
    capabilities: {
      tables: tables.available,
      views: views.available,
      pages: pages.available,
      roles: roles.available,
      plugins: plugins.available,
    },
    errors: [tables, views, pages, roles, plugins]
      .filter((section) => section.error)
      .map((section) => section.error),
    tables: tables.items,
    views: views.items,
    pages: pages.items,
    roles: roles.items,
    plugins: plugins.items,
  };
};

module.exports = {
  getExtensionState,
  optionalRequire,
};
