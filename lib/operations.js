"use strict";

const { getExtensionState, optionalRequire } = require("./state");

const SQL_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

const normalizeName = (value, label = "name") => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required`);
  }
  const name = value.trim();
  if (!SQL_NAME_RE.test(name)) {
    throw new Error(
      `${label} must start with a letter or underscore and contain only letters, numbers, and underscores`
    );
  }
  return name;
};

const normalizeViewName = (value, label = "view name") => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
};

const bool = (value, defaultValue = false) =>
  typeof value === "undefined" ? defaultValue : value === true || value === "true";

const firstDefined = (...values) => values.find((value) => typeof value !== "undefined");

const boolOption = (body, names, defaultValue = false) =>
  bool(firstDefined(...names.map((name) => body?.[name])), defaultValue);

const uiTextByLocale = {
  en: {
    view: "View",
    edit: "Edit",
    delete: "Delete",
    save: "Save",
    create: "Create",
    createCard: "Create card",
    data: "Data",
    deleteConfirmation: "Are you sure you want to delete this record?",
  },
  es: {
    view: "Ver",
    edit: "Editar",
    delete: "Eliminar",
    save: "Guardar",
    create: "Crear",
    createCard: "Crear tarjeta",
    data: "Datos",
    deleteConfirmation: "Seguro que deseas eliminar este registro?",
  },
};

const localeBase = (locale) => String(locale || "en").split(/[-_]/)[0].toLowerCase();

const uiTextForLocale = (locale) => uiTextByLocale[localeBase(locale)] || uiTextByLocale.en;

const defaultUiLocale = (body = {}) => {
  const explicit = body.ui_language || body.locale || body.default_locale || body.language;
  if (explicit) return explicit;
  try {
    return getModels().getState().getConfig("default_locale", "en");
  } catch {
    return "en";
  }
};

const normalizeTabulatorFit = (value) => {
  const fit = String(value || "Columns").trim();
  const aliases = {
    fitcolumns: "Columns",
    columns: "Columns",
    fitdata: "Data",
    data: "Data",
    fitdatafill: "DataFill",
    datafill: "DataFill",
    fitdatastretch: "DataStretch",
    datastretch: "DataStretch",
    fitdatatable: "DataTable",
    datatable: "DataTable",
  };
  return aliases[fit.toLowerCase()] || fit;
};

const shouldDryRun = (body) => body?.dry_run !== false;

const humanizeLabel = (value) => {
  const text = String(value || "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return text;
  if (text.length <= 3 && text === text.toUpperCase()) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const typeAliases = {
  text: "String",
  string: "String",
  varchar: "String",
  textarea: "String",
  longtext: "String",
  enum: "String",
  select: "String",
  integer: "Integer",
  int: "Integer",
  number: "Integer",
  float: "Float",
  decimal: "Float",
  currency: "Money",
  money: "Money",
  bool: "Bool",
  boolean: "Bool",
  date: "Date",
  datetime: "Date",
  datepicker: "Date",
  flatpickr: "Date",
  time: "Time",
  file: "File",
  json: "JSON",
  jsonb: "JSON",
  markdown: "Markdown",
  md: "Markdown",
  html: "HTML",
  key: "Key",
  reference: "Key",
};

const fieldviewAliases = {
  datepicker: "flatpickr",
  flatpickr_date: "flatpickr",
  richtext: "html",
  wysiwyg: "html",
  multiline: "textarea",
  longtext: "textarea",
  autocomplete: "selectize",
  typeahead: "selectize",
};

const normalizeFieldviewName = (value) => {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const fieldview = value.trim();
  return fieldviewAliases[fieldview.toLowerCase()] || fieldview;
};

const fieldPresetDefaults = (field) => {
  const preset = String(field?.preset || field?.kind || field?.widget || "").trim().toLowerCase();
  if (!preset) return {};
  const presets = {
    select: { type: "String" },
    enum: { type: "String" },
    textarea: { type: "String", fieldview: "textarea" },
    longtext: { type: "String", fieldview: "textarea" },
    markdown: { type: "Markdown" },
    html: { type: "HTML" },
    json: { type: "JSON" },
    money: { type: "Money" },
    currency: { type: "Money" },
    time: { type: "Time" },
    datepicker: { type: "Date", fieldview: "flatpickr" },
    flatpickr: { type: "Date", fieldview: "flatpickr" },
    selectize: { fieldview: "selectize" },
    file: { type: "File" },
  };
  return presets[preset] || {};
};

const normalizeField = (field) => {
  const name = normalizeName(field?.name, "field.name");
  const preset = fieldPresetDefaults(field);
  const rawType =
    field.type || field.fieldtype || preset.type || (field.references ? "Key" : undefined);
  if (!rawType) throw new Error(`field.type is required for ${name}`);
  const type = typeAliases[String(rawType).toLowerCase()] || rawType;
  const rawFieldview = firstDefined(field.fieldview, field.field_view, field.view, preset.fieldview);
  const fieldview = normalizeFieldviewName(rawFieldview);
  const normalized = {
    name,
    label: field.label || humanizeLabel(field.name),
    type,
    required: bool(field.required),
    is_unique: bool(field.is_unique || field.unique),
    calculated: bool(field.calculated),
    stored: bool(field.stored),
    expression: field.expression,
    description: field.description,
    attributes: { ...(field.attributes || {}) },
  };

  const reftable = field.reftable_name || field.reftable || field.references;
  if (type === "Key") {
    if (!reftable) throw new Error(`field ${name} is a Key and needs references/reftable_name`);
    normalized.reftable_name = normalizeName(reftable, `field ${name}.references`);
  }
  if (Array.isArray(field.options)) normalized.attributes.options = field.options.join(",");
  if (typeof field.options === "string") normalized.attributes.options = field.options;
  if (field.summary_field) normalized.attributes.summary_field = field.summary_field;
  if (field.placeholder) normalized.attributes.placeholder = field.placeholder;
  if (field.default !== undefined) normalized.attributes.default = field.default;
  if (field.default_expression) normalized.attributes.default_expression = field.default_expression;
  if (field.where) normalized.attributes.where = field.where;
  if (field.label_formula) normalized.attributes.label_formula = field.label_formula;
  if (field.folder) normalized.attributes.folder = field.folder;
  if (field.min_role_read) normalized.attributes.min_role_read = field.min_role_read;
  if (fieldview) normalized.attributes.extension_fieldview = fieldview;
  return normalized;
};

const getModels = () => {
  const Table = optionalRequire("@saltcorn/data/models/table");
  const Field = optionalRequire("@saltcorn/data/models/field");
  const View = optionalRequire("@saltcorn/data/models/view");
  const Page = optionalRequire("@saltcorn/data/models/page");
  const db = optionalRequire("@saltcorn/data/db");
  const stateModule = optionalRequire("@saltcorn/data/db/state");
  const config = optionalRequire("@saltcorn/data/models/config");
  if (!Table || !Field || !View || !Page || !db || !stateModule) {
    throw new Error("Saltcorn internal models are not available");
  }
  return {
    Table,
    Field,
    View,
    Page,
    db,
    getState: stateModule.getState,
    config,
  };
};

const inTransaction = async (db, callback) => {
  if (typeof db.withTransaction === "function") return db.withTransaction(callback);
  return callback();
};

const tableExists = (Table, name) => !!Table.findOne({ name });

const refreshStateCaches = async (getState, targets = {}) => {
  const state = getState?.();
  if (!state) return;
  const refreshAll = Object.keys(targets).length === 0;
  if ((refreshAll || targets.tables) && state.refresh_tables) await state.refresh_tables();
  if ((refreshAll || targets.views) && state.refresh_views) await state.refresh_views();
  if ((refreshAll || targets.pages) && state.refresh_pages) await state.refresh_pages();
};

const refreshCaches = async (body = {}) => {
  const { getState } = getModels();
  const targets = {
    tables: boolOption(body, ["tables"], true),
    views: boolOption(body, ["views"], true),
    pages: boolOption(body, ["pages"], true),
  };
  await refreshStateCaches(getState, targets);
  return { ok: true, refreshed: targets };
};

const roleAliases = {
  public: ["public", "anonymous", "guest", "anyone"],
};

const parseRoleNumber = (value) => {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim());
  return undefined;
};

const resolveRoleId = async (value, defaultValue, label = "role") => {
  if (typeof value === "undefined" || value === null || value === "") {
    return { min_role: defaultValue, role_name: null, warnings: [] };
  }
  const numeric = parseRoleNumber(value);
  if (typeof numeric !== "undefined") return { min_role: numeric, role_name: null, warnings: [] };

  const raw = String(value).trim();
  const lower = raw.toLowerCase();
  const state = await getExtensionState();
  const roles = Array.isArray(state.roles) ? state.roles : [];
  const candidates = roleAliases[lower] || [raw];
  const role = roles.find((item) =>
    candidates.some((candidate) => String(item.name || "").toLowerCase() === candidate.toLowerCase())
  );
  if (role) return { min_role: role.id, role_name: role.name, warnings: [] };
  if (lower === "public") {
    return {
      min_role: 100,
      role_name: "public",
      warnings: [
        "Could not read a public/anonymous role from Saltcorn state; using Saltcorn's common public role id 100.",
      ],
    };
  }
  throw new Error(`${label} role not found: ${raw}`);
};

const wantsPublicAccess = (body = {}) => {
  const access = String(body.access || body.visibility || "").trim().toLowerCase();
  const minRole = String(body.min_role || "").trim().toLowerCase();
  return bool(body.public) || access === "public" || minRole === "public";
};

const resolvePageMinRole = async (body = {}, defaultValue = 1) =>
  resolveRoleId(
    wantsPublicAccess(body) ? "public" : firstDefined(body.min_role, body.role),
    defaultValue,
    "page min_role"
  );

const getLocaleSettings = async () => {
  const { getState, config } = getModels();
  const available_languages = config?.available_languages || {};
  const default_locale = getState().getConfig("default_locale", "en");
  return {
    ok: true,
    default_locale,
    ui_language: localeBase(default_locale),
    language_name: available_languages[default_locale] || available_languages[localeBase(default_locale)],
    available_languages,
  };
};

const setLocaleSettings = async (body = {}) => {
  const { getState, config } = getModels();
  const dryRun = shouldDryRun(body);
  const available_languages = config?.available_languages || {};
  const rawLocale = body.locale || body.default_locale || body.language;
  if (typeof rawLocale !== "string" || !rawLocale.trim()) {
    throw new Error("locale is required");
  }
  const locale = rawLocale.trim();
  if (!available_languages[locale]) {
    throw new Error(`Unsupported locale: ${locale}`);
  }
  const previous_locale = getState().getConfig("default_locale", "en");
  const plan = [{ action: "set_config", key: "default_locale", from: previous_locale, to: locale }];
  if (dryRun) {
    return {
      ok: true,
      dry_run: true,
      plan,
      previous_locale,
      default_locale: locale,
      available_languages,
    };
  }
  await getState().setConfig("default_locale", locale);
  if (typeof getState().refresh_i18n === "function") await getState().refresh_i18n();
  return {
    ok: true,
    dry_run: false,
    previous_locale,
    default_locale: locale,
    language_name: available_languages[locale],
    restart_recommended: true,
  };
};

const normalizeDeleteList = (body, plural, singular) => {
  const raw = firstDefined(body?.[plural], body?.[singular] ? [body[singular]] : undefined, []);
  if (!Array.isArray(raw)) throw new Error(`${plural} must be an array of names`);
  return raw.map((item) => {
    if (typeof item !== "string" || !item.trim()) {
      throw new Error(`${plural} entries must be non-empty strings`);
    }
    const name = item.trim();
    const lower = name.toLowerCase();
    if (name === "*" || lower === "all" || lower === "__all__") {
      throw new Error(`${plural} does not accept wildcards or all`);
    }
    return name;
  });
};

const uniqueByName = (items) => {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    if (!item?.name || seen.has(item.name)) continue;
    seen.add(item.name);
    out.push(item);
  }
  return out;
};

const deleteObjects = async (body = {}) => {
  const { Table, View, Page, db, getState, config } = getModels();
  const TableConstraint = optionalRequire("@saltcorn/data/models/table_constraints");
  const Trigger = optionalRequire("@saltcorn/data/models/trigger");
  const dryRun = shouldDryRun(body);
  const confirm = body.confirm || body.confirmation;
  if (!dryRun && confirm !== "BORRAR_OBJETOS") {
    throw new Error('deleteObjects requires confirm: "BORRAR_OBJETOS" when dry_run is false');
  }
  const pageNames = normalizeDeleteList(body, "pages", "page");
  const viewNames = normalizeDeleteList(body, "views", "view");
  const tableNames = normalizeDeleteList(body, "tables", "table");
  if (!pageNames.length && !viewNames.length && !tableNames.length) {
    throw new Error("Pass at least one explicit page, view, or table name");
  }
  if (tableNames.includes("users")) throw new Error("The users table cannot be deleted");

  if (getState?.()) {
    await getState().refresh_tables(true);
    await getState().refresh_views(true);
    await getState().refresh_pages(true);
  }

  const pages = [];
  for (const name of pageNames) {
    const page = Page.findOne({ name });
    if (!page) throw new Error(`Page not found: ${name}`);
    pages.push(page);
  }

  const explicitViews = [];
  for (const name of viewNames) {
    const view = await findViewByName(View, name);
    if (!view) throw new Error(`View not found: ${name}`);
    explicitViews.push(view);
  }

  const tables = [];
  for (const name of tableNames) {
    const table = await findTableFresh(Table, getState, name);
    if (!table) throw new Error(`Table not found: ${name}`);
    if (table.name === "users") throw new Error("The users table cannot be deleted");
    tables.push(table);
  }
  const tableIds = new Set(tables.map((table) => Number(table.id)));
  const tableNamesSet = new Set(tables.map((table) => table.name));
  const tableViews = tables.length
    ? (await View.find({})).filter((view) => tableIds.has(Number(view.table_id)))
    : [];
  const views = uniqueByName([...explicitViews, ...tableViews]);

  if (tables.length) {
    const allTables = await Table.find({}, { orderBy: "id", orderDesc: true });
    for (const table of allTables) {
      const fields = table.getFields ? table.getFields() : table.fields || [];
      for (const field of fields) {
        if (
          field.is_fkey &&
          tableNamesSet.has(field.reftable_name) &&
          !tableNamesSet.has(table.name)
        ) {
          throw new Error(
            `Cannot delete table ${field.reftable_name}; it is referenced by ${table.name}.${field.name}. Include ${table.name} or delete that relation first.`
          );
        }
      }
    }
  }

  const plan = [
    ...pages.map((page) => ({ action: "delete_page", id: page.id, name: page.name })),
    ...views.map((view) => ({ action: "delete_view", id: view.id, name: view.name })),
    ...tables.map((table) => ({ action: "delete_table", id: table.id, name: table.name })),
  ];
  if (dryRun) return { ok: true, dry_run: true, plan };

  const deleted = { pages: 0, views: 0, tables: 0 };
  await inTransaction(db, async () => {
    for (const page of pages) {
      if (typeof page.delete === "function") await page.delete();
      else await db.deleteWhere("_sc_pages", { id: page.id });
      deleted.pages += 1;
    }
    for (const view of views) {
      if (typeof view.delete === "function") await view.delete();
      else if (view.id) await View.delete({ id: view.id });
      deleted.views += 1;
    }
    if (tables.length) {
      await db.deleteWhere("_sc_model_instances");
      await db.deleteWhere("_sc_models");
      for (const table of tables) {
        if (TableConstraint?.find) {
          const constraints = await TableConstraint.find({ table_id: table.id });
          for (const constraint of constraints) await constraint.delete();
        }
        if (Trigger?.find) {
          const triggers = await Trigger.find({ table_id: table.id });
          for (const trigger of triggers) await trigger.delete();
        } else {
          await db.deleteWhere("_sc_triggers", { table_id: table.id });
        }
        if (typeof table.update === "function") await table.update({ ownership_field_id: null });
        const fields = table.getFields ? table.getFields() : table.fields || [];
        for (const field of fields) {
          if (field.is_fkey && typeof field.delete === "function") await field.delete();
        }
      }
      for (const table of tables) {
        await table.delete();
        deleted.tables += 1;
      }
    }
    if (config?.save_menu_items) {
      const currentMenu = getState().getConfigCopy("menu_items", []);
      const deletedPages = new Set(pages.map((page) => page.name));
      const menu_items = removeMenuItem(
        currentMenu,
        (item) => item.type === "Page" && deletedPages.has(item.pagename)
      );
      await config.save_menu_items(menu_items);
    }
  });
  await refreshStateCaches(getState, { tables: true, views: true, pages: true });
  return { ok: true, dry_run: false, deleted };
};

const findTableFresh = async (Table, getState, name) => {
  if (getState?.()) await getState().refresh_tables(true);
  const cached = Table.findOne({ name });
  if (cached) return cached;
  const matches = await Table.find({ name });
  return matches[0] || null;
};

const createTable = async (body) => {
  const { Table, Field, db, getState } = getModels();
  const dryRun = shouldDryRun(body);
  const name = normalizeName(body?.name, "table name");
  const fields = (body.fields || []).map(normalizeField);
  const options = {
    min_role_read: body.min_role_read || 1,
    min_role_write: body.min_role_write || 1,
    description: body.description || "",
    versioned: bool(body.versioned),
    has_sync_info: bool(body.has_sync_info),
  };

  const plan = [
    { action: "create_table", name, options },
    ...fields.map((field) => ({ action: "add_field", table: name, field })),
  ];

  if (dryRun) return { ok: true, dry_run: true, plan };
  if (await findTableFresh(Table, getState, name)) {
    throw new Error(`Table already exists: ${name}`);
  }

  let table;
  await inTransaction(db, async () => {
    table = await Table.create(name, options);
    for (const field of fields) {
      await Field.create({ ...field, table, table_id: table.id });
    }
  });
  await refreshStateCaches(getState, { tables: true, views: true });
  return { ok: true, dry_run: false, table: await getTableSummary(name) };
};

const getTableSummary = async (name) => {
  const state = await getExtensionState();
  return state.tables.find((table) => table.name === name);
};

const addField = async (body) => {
  const { Table, Field, db, getState } = getModels();
  const dryRun = shouldDryRun(body);
  const tableName = normalizeName(body?.table || body?.table_name, "table");
  const field = normalizeField(body?.field || body);
  const plan = [{ action: "add_field", table: tableName, field }];

  if (dryRun) return { ok: true, dry_run: true, plan };
  let table = await findTableFresh(Table, getState, tableName);
  if (!table) throw new Error(`Table not found: ${tableName}`);
  if (table.getField && table.getField(field.name)) {
    throw new Error(`Field already exists: ${tableName}.${field.name}`);
  }

  await inTransaction(db, async () => {
    await Field.create({ ...field, table, table_id: table.id });
  });
  await refreshStateCaches(getState, { tables: true, views: true });
  return { ok: true, dry_run: false, table: await getTableSummary(tableName) };
};

const createKeyRelation = async (body) => {
  const { Table, Field, db, getState } = getModels();
  const dryRun = shouldDryRun(body);
  const childName = normalizeName(
    body?.child_table || body?.from_table || body?.table || body?.source_table,
    "child_table"
  );
  const parentName = normalizeName(
    body?.parent_table || body?.to_table || body?.references || body?.target_table,
    "parent_table"
  );
  const fieldName = normalizeName(
    body?.field || body?.field_name || `${parentName}_id`,
    "relation field"
  );
  const child = await findTableFresh(Table, getState, childName);
  if (!child) throw new Error(`Child table not found: ${childName}`);
  const parent = await findTableFresh(Table, getState, parentName);
  if (!parent) throw new Error(`Parent table not found: ${parentName}`);

  const summaryField = body?.summary_field || body?.label_field || body?.display_field;
  if (summaryField && !parent.getField?.(summaryField)) {
    throw new Error(`summary_field not found on parent table ${parentName}: ${summaryField}`);
  }
  if (child.getField?.(fieldName)) {
    if (dryRun || bool(body?.if_exists_ok || body?.replace_existing || body?.replace)) {
      return {
        ok: true,
        dry_run: dryRun,
        existing: true,
        relation: { child_table: childName, parent_table: parentName, field: fieldName },
      };
    }
    throw new Error(`Field already exists: ${childName}.${fieldName}`);
  }

  const useSelectize = body?.selectize !== false && body?.fieldview !== false;
  const field = normalizeField({
    name: fieldName,
    label: body?.label || humanizeLabel(body?.label_field_name || parentName),
    type: "Key",
    references: parentName,
    required: bool(body?.required),
    unique: bool(body?.unique),
    fieldview: body?.fieldview || (useSelectize ? "selectize" : undefined),
    attributes: {
      ...(body?.attributes || {}),
      ...(summaryField ? { summary_field: summaryField } : {}),
      ...(body?.where ? { where: body.where } : {}),
      ...(body?.label_formula ? { label_formula: body.label_formula } : {}),
      ...(body?.placeholder ? { placeholder: body.placeholder } : {}),
    },
  });
  const plan = [{ action: "create_key_relation", child_table: childName, parent_table: parentName, field }];
  if (dryRun) return { ok: true, dry_run: true, plan };

  await inTransaction(db, async () => {
    await Field.create({ ...field, table: child, table_id: child.id });
  });
  await refreshStateCaches(getState, { tables: true, views: true });
  return {
    ok: true,
    dry_run: false,
    relation: {
      child_table: childName,
      parent_table: parentName,
      field: fieldName,
      summary_field: summaryField,
      fieldview: field.attributes?.extension_fieldview,
    },
    child_table: await getTableSummary(childName),
  };
};

const createManyToManyRelation = async (body) => {
  const { Table, getState } = getModels();
  const dryRun = shouldDryRun(body);
  const leftTable = normalizeName(
    body?.left_table || body?.source_table || body?.parent_table,
    "left_table"
  );
  const rightTable = normalizeName(
    body?.right_table || body?.target_table || body?.child_table,
    "right_table"
  );
  const joinTable = normalizeName(
    body?.join_table || body?.through_table || body?.junction_table,
    "join_table"
  );
  const leftKey = normalizeName(body?.left_key || body?.source_key || `${leftTable}_id`, "left_key");
  const rightKey = normalizeName(
    body?.right_key || body?.target_key || `${rightTable}_id`,
    "right_key"
  );
  const leftLabelField = body?.left_label_field || body?.left_summary_field || "nombre";
  const rightLabelField = body?.right_label_field || body?.right_summary_field || "nombre";

  const left = await findTableFresh(Table, getState, leftTable);
  if (!left) throw new Error(`left_table not found: ${leftTable}`);
  const right = await findTableFresh(Table, getState, rightTable);
  if (!right) throw new Error(`right_table not found: ${rightTable}`);
  if (leftLabelField && !left.getField?.(leftLabelField)) {
    throw new Error(`left_label_field not found on ${leftTable}: ${leftLabelField}`);
  }
  if (rightLabelField && !right.getField?.(rightLabelField)) {
    throw new Error(`right_label_field not found on ${rightTable}: ${rightLabelField}`);
  }

  const relation = `${joinTable}.${leftKey}.${rightKey}.${rightLabelField}`;
  const viewName =
    body?.view_name ||
    body?.checkbox_view ||
    `${humanizeLabel(rightTable)} ${humanizeLabel(leftTable)} m2m`;
  const createJoinTable = body?.create_join_table !== false;
  const createCheckboxView = body?.create_checkbox_view !== false && body?.create_view !== false;
  const joinFields = Array.isArray(body?.join_fields) ? body.join_fields : [];
  const plan = [
    ...(createJoinTable
      ? [{ action: "ensure_join_table", table: joinTable, fields: joinFields }]
      : []),
    {
      action: "ensure_key_relation",
      child_table: joinTable,
      parent_table: leftTable,
      field: leftKey,
      summary_field: leftLabelField,
    },
    {
      action: "ensure_key_relation",
      child_table: joinTable,
      parent_table: rightTable,
      field: rightKey,
      summary_field: rightLabelField,
    },
    ...(createCheckboxView
      ? [
          {
            action: "create_many_to_many_checkbox_view",
            name: viewName,
            table: leftTable,
            relation,
          },
        ]
      : []),
  ];
  if (dryRun) return { ok: true, dry_run: true, plan, relation };

  await ensureFeatureAvailable("many_to_many");
  let join = await findTableFresh(Table, getState, joinTable);
  let joinTableResult = null;
  if (!join) {
    if (!createJoinTable) throw new Error(`join_table not found: ${joinTable}`);
    joinTableResult = await createTable({
      dry_run: false,
      name: joinTable,
      fields: joinFields,
    });
    join = await findTableFresh(Table, getState, joinTable);
  }
  if (!join) throw new Error(`Unable to create or load join_table: ${joinTable}`);

  const leftRelation = await createKeyRelation({
    dry_run: false,
    child_table: joinTable,
    parent_table: leftTable,
    field: leftKey,
    label: body?.left_label || humanizeLabel(leftTable),
    summary_field: leftLabelField,
    required: true,
    fieldview: body?.left_fieldview || body?.fieldview || "selectize",
    if_exists_ok: true,
  });
  const rightRelation = await createKeyRelation({
    dry_run: false,
    child_table: joinTable,
    parent_table: rightTable,
    field: rightKey,
    label: body?.right_label || humanizeLabel(rightTable),
    summary_field: rightLabelField,
    required: true,
    fieldview: body?.right_fieldview || body?.fieldview || "selectize",
    if_exists_ok: true,
  });

  let view = null;
  if (createCheckboxView) {
    view = await createView({
      dry_run: false,
      replace_existing: body?.replace_existing !== false,
      name: viewName,
      table: leftTable,
      viewtemplate: "Checkboxes many-to-many",
      configuration: {
        relation,
        ...(body?.view_configuration || body?.configuration || {}),
      },
      min_role: body?.min_role || 1,
      attributes: body?.attributes || {},
    });
  }

  return {
    ok: true,
    dry_run: false,
    relation,
    tables: {
      left: leftTable,
      right: rightTable,
      join: joinTable,
    },
    keys: {
      left: leftRelation.relation,
      right: rightRelation.relation,
    },
    join_table: joinTableResult?.table || (await getTableSummary(joinTable)),
    view: view?.view || null,
  };
};

const rowPayloadFields = (table, row, allowPrimaryKey = false) => {
  const fields = new Set((table.fields || []).map((field) => field.name));
  const pkName = table.pk_name || "id";
  const payload = {};
  for (const [key, value] of Object.entries(row || {})) {
    if (!fields.has(key)) throw new Error(`row field not found on ${table.name}: ${key}`);
    if (!allowPrimaryKey && key === pkName) continue;
    payload[key] = value;
  }
  return payload;
};

const createRows = async (body) => {
  const { Table, db, getState } = getModels();
  const dryRun = shouldDryRun(body);
  const tableName = normalizeName(body?.table || body?.table_name, "table");
  const table = await findTableFresh(Table, getState, tableName);
  if (!table) throw new Error(`Table not found: ${tableName}`);
  const inputRows = body.rows || (body.row ? [body.row] : body.data ? [body.data] : []);
  if (!Array.isArray(inputRows) || inputRows.length === 0) {
    throw new Error("rows must be a non-empty array, or pass row/data");
  }
  const rows = inputRows.map((row) => rowPayloadFields(table, row, bool(body.allow_primary_key)));
  const plan = rows.map((row) => ({ action: "insert_row", table: tableName, row }));
  if (dryRun) return { ok: true, dry_run: true, plan };
  const inserted = [];
  await inTransaction(db, async () => {
    for (const row of rows) {
      const id = await table.insertRow(row, body.user, undefined, bool(body.no_trigger));
      inserted.push({ id, row });
    }
  });
  return { ok: true, dry_run: false, table: tableName, inserted };
};

const listViewTemplates = async () => {
  const { getState } = getModels();
  const state = getState();
  const viewtemplates = Object.values(state.viewtemplates || {})
    .filter((vt) => !vt.singleton)
    .map((vt) => ({
      name: vt.name,
      description: vt.description,
      tableless: !!vt.tableless,
      table_optional: !!vt.table_optional,
      has_create_basic: typeof vt.createBasicView === "function",
      has_initial_config: typeof vt.initial_config === "function",
      deprecated: !!vt.deprecated,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { ok: true, viewtemplates };
};

const listFieldCapabilities = async () => {
  const { getState } = getModels();
  const state = getState();
  const types = Object.entries(state.types || {})
    .map(([name, type]) => ({
      name,
      sql_name: typeof type.sql_name === "string" ? type.sql_name : undefined,
      fieldviews: Object.keys(type.fieldviews || {}).sort(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    ok: true,
    types,
    key_fieldviews: Object.keys(state.keyFieldviews || {}).sort(),
    fileviews: Object.keys(state.fileviews || {}).sort(),
    presets: {
      select: { type: "String", attributes: ["options"] },
      textarea: { type: "String", fieldview: "textarea" },
      markdown: { type: "Markdown" },
      html: { type: "HTML" },
      json: { type: "JSON" },
      money: { type: "Money" },
      time: { type: "Time" },
      datepicker: { type: "Date", fieldview: "flatpickr" },
      flatpickr: { type: "Date", fieldview: "flatpickr" },
      selectize: { fieldview: "selectize" },
      file: { type: "File" },
    },
  };
};

const featureRequirements = {
  crud: {
    description: "Basic CRUD pages with List, Edit, and Show views.",
    viewtemplates: ["List", "Edit", "Show"],
  },
  calendar: {
    description: "Calendar views backed by the fullcalendar plugin.",
    plugins: ["fullcalendar"],
    viewtemplates: ["Calendar"],
  },
  kanban: {
    description: "Kanban board views.",
    plugins: ["kanban"],
    viewtemplates: ["Kanban"],
  },
  kanban_allocator: {
    description: "Kanban allocator views.",
    plugins: ["kanban"],
    viewtemplates: ["KanbanAllocator"],
  },
  chart: {
    description: "Apache ECharts chart views.",
    plugins: ["charts"],
    viewtemplates: ["Chart"],
  },
  visualize: {
    description: "Visualize plugin charts.",
    plugins: ["visualize"],
    viewtemplates: ["DistributionVis", "ProportionsVis", "RelationsVis"],
  },
  pivot: {
    description: "Pivot table views.",
    plugins: ["pivottable"],
    viewtemplates: ["Pivot table"],
  },
  tabulator: {
    description: "Editable grid views backed by Tabulator.",
    plugins: ["tabulator"],
    viewtemplates: ["Tabulator"],
  },
  tabulator_pivot_edit: {
    description: "Tabulator pivot edit views.",
    plugins: ["tabulator"],
    viewtemplates: ["Tabulator Pivot Edit"],
  },
  map: {
    description: "Leaflet map views.",
    plugins: ["leaflet-map"],
    viewtemplates: ["Leaflet map"],
  },
  multi_table_map: {
    description: "Leaflet multi-table map views.",
    plugins: ["leaflet-map"],
    viewtemplates: ["Leaflet map - multi-table"],
  },
  attachments: {
    description: "Multiple file upload views.",
    plugins: ["multi-file-upload"],
    viewtemplates: ["Multi File Upload"],
  },
  many_to_many: {
    description: "Many-to-many checkbox views.",
    plugins: ["many-to-many"],
    viewtemplates: ["Checkboxes many-to-many"],
  },
  date_range_filter: {
    description: "Date range filter views.",
    plugins: ["flatpickr-date"],
    viewtemplates: ["Date Range Filter"],
  },
  markdown: {
    description: "Markdown data type and field rendering.",
    plugins: ["markdown"],
  },
  mermaid: {
    description: "Mermaid diagrams from markup strings.",
    plugins: ["mermaid"],
  },
  qrcode: {
    description: "QR code generator fieldviews.",
    plugins: ["qrcode"],
  },
  selectize: {
    description: "Typeahead fieldviews based on selectize.",
    plugins: ["selectize"],
  },
  json: {
    description: "JSON data type.",
    plugins: ["json"],
  },
  html: {
    description: "HTML field type.",
    plugins: ["html"],
  },
  money: {
    description: "Money field type based on decimals.",
    plugins: ["money"],
  },
  time: {
    description: "Time field type for hour and minute data.",
    plugins: ["time-type"],
  },
  material_design_theme: {
    description: "Material Design theme.",
    plugins: ["material-design"],
  },
};

const getInstalledPluginNames = async () => {
  const state = await getExtensionState();
  return (state.plugins || []).map((plugin) => plugin.name).filter(Boolean).sort();
};

const getViewTemplateNames = () => {
  const { getState } = getModels();
  const state = getState();
  return Object.values(state.viewtemplates || {})
    .filter((vt) => !vt.singleton)
    .map((vt) => vt.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
};

const evaluateFeature = (key, installedPlugins, viewtemplates) => {
  const spec = featureRequirements[key];
  if (!spec) {
    return {
      key,
      available: false,
      missing: [{ type: "feature", name: key }],
      error: `Unknown feature: ${key}`,
    };
  }

  const installed = new Set(installedPlugins);
  const availableTemplates = new Set(viewtemplates);
  const missing = [];
  for (const plugin of spec.plugins || []) {
    if (!installed.has(plugin)) missing.push({ type: "plugin", name: plugin });
  }
  for (const viewtemplate of spec.viewtemplates || []) {
    if (!availableTemplates.has(viewtemplate)) {
      missing.push({ type: "viewtemplate", name: viewtemplate });
    }
  }
  return {
    key,
    description: spec.description,
    available: missing.length === 0,
    missing,
    requirements: {
      plugins: spec.plugins || [],
      viewtemplates: spec.viewtemplates || [],
    },
  };
};

const getCapabilities = async () => {
  const installed_plugins = await getInstalledPluginNames();
  const viewtemplates = getViewTemplateNames();
  const features = Object.fromEntries(
    Object.keys(featureRequirements).map((key) => [
      key,
      evaluateFeature(key, installed_plugins, viewtemplates),
    ])
  );
  return {
    ok: true,
    installed_plugins,
    viewtemplates,
    features,
  };
};

const requireCapabilities = async (body) => {
  const requested = body?.features || body?.feature || body?.recipes || body?.recipe;
  const features = Array.isArray(requested) ? requested : requested ? [requested] : [];
  if (features.length === 0) throw new Error("feature or features is required");

  const capabilities = await getCapabilities();
  const results = features.map((feature) =>
    evaluateFeature(String(feature), capabilities.installed_plugins, capabilities.viewtemplates)
  );
  const missing = results.flatMap((result) =>
    result.missing.map((item) => ({ feature: result.key, ...item }))
  );
  return {
    ok: missing.length === 0,
    features: results,
    missing,
  };
};

const ensureFeatureAvailable = async (feature) => {
  const result = await requireCapabilities({ features: [feature] });
  if (!result.ok) {
    const missing = result.missing
      .map((item) => `${item.type}:${item.name}`)
      .join(", ");
    throw new Error(`Feature is not available: ${feature}. Missing ${missing}`);
  }
};

const defaultViewName = (tableName, viewtemplate) => `${viewtemplate} ${tableName}`;

const createBasicViewArgs = (table, viewname, allViewsCreated = {}) => ({
  table,
  viewname,
  all_views_created: allViewsCreated,
  exttable_name: table.name,
  table_name: table.name,
  table_id: table.id,
});

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escapeJsSingleQuoted = (value) =>
  String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, "\\n");

const tableFieldLabels = (table, extraLabels = {}) => {
  const labels = {};
  for (const field of table.fields || []) {
    const label = extraLabels[field.name] || field.label || field.name;
    labels[field.name] = humanizeLabel(label);
  }
  return labels;
};

const scopedFieldviews = (fieldviews = {}, viewtemplate, applyToAllViews = false) => {
  if (!fieldviews || typeof fieldviews !== "object" || Array.isArray(fieldviews)) return {};
  const lowerViewtemplate = String(viewtemplate || "").toLowerCase();
  const scoped =
    fieldviews[viewtemplate] ||
    fieldviews[lowerViewtemplate] ||
    fieldviews[`${viewtemplate}View`] ||
    fieldviews[`${lowerViewtemplate}_view`];
  if (scoped && typeof scoped === "object" && !Array.isArray(scoped)) return scoped;

  const hasScopedKeys = ["list", "edit", "show"].some((key) =>
    Object.prototype.hasOwnProperty.call(fieldviews, key)
  );
  if (hasScopedKeys) return {};
  if (applyToAllViews || viewtemplate === "Edit") return fieldviews;
  if (!["List", "Show"].includes(viewtemplate)) return fieldviews;
  return {};
};

const tableFieldviews = (table, explicitFieldviews = {}, options = {}) => {
  const fieldviews = {};
  for (const field of table.fields || []) {
    const explicit = explicitFieldviews[field.name];
    const stored = options.includeStoredFieldviews ? field.attributes?.extension_fieldview : undefined;
    const fieldview = normalizeFieldviewName(explicit || stored);
    if (fieldview) fieldviews[field.name] = fieldview;
  }
  return fieldviews;
};

const translateActionColumn = (column, options) => {
  const text = options.text || uiTextByLocale.en;
  if (column.type === "ViewLink") {
    const target = column.view_name || column.view || "";
    if (target.includes("Show ")) {
      column.view_label = text.view;
      column.header_label = text.view;
    }
    if (target.includes("Edit ")) {
      column.view_label = text.edit;
      column.header_label = text.edit;
    }
    column.in_modal = true;
    column.link_style = column.link_style || options.view_link_style;
    column.link_size = column.link_size || options.view_link_size;
  }
  if (
    (column.type === "Action" || column.type === "action") &&
    column.action_name === "Delete"
  ) {
    column.action_label = text.delete;
    column.header_label = text.delete;
    column.in_modal = true;
    column.confirm = options.delete_confirmation;
    column.confirmation = options.delete_confirmation;
  }
  if (
    (column.type === "Action" || column.type === "action") &&
    column.action_name === "Save"
  ) {
    column.action_label = text.save;
    column.action_style = column.action_style || "btn-primary";
  }
};

const walkConfiguration = (node, visitor) => {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) walkConfiguration(item, visitor);
    return;
  }
  if (typeof node !== "object") return;
  visitor(node);
  for (const value of Object.values(node)) walkConfiguration(value, visitor);
};

const normalizeFieldList = (value) => {
  if (!value) return undefined;
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return undefined;
};

const fieldListForView = (options, viewtemplate) => {
  const lower = String(viewtemplate || "").toLowerCase();
  const scopedFields = options.fields && typeof options.fields === "object" && !Array.isArray(options.fields)
    ? options.fields[viewtemplate] || options.fields[lower]
    : undefined;
  return normalizeFieldList(
    firstDefined(
      options[`${lower}_fields`],
      scopedFields,
      Array.isArray(options.fields) || typeof options.fields === "string" ? options.fields : undefined
    )
  );
};

const excludedFieldsForView = (options, viewtemplate) => {
  const lower = String(viewtemplate || "").toLowerCase();
  const excluded = normalizeFieldList(options.exclude_fields || options.hidden_fields) || [];
  const scoped =
    options.exclude_fields && typeof options.exclude_fields === "object" && !Array.isArray(options.exclude_fields)
      ? normalizeFieldList(options.exclude_fields[viewtemplate] || options.exclude_fields[lower])
      : [];
  return new Set([...excluded, ...(scoped || [])]);
};

const fieldOrderForView = (options, viewtemplate, includedFields) => {
  const lower = String(viewtemplate || "").toLowerCase();
  const scopedOrder = options.field_order && typeof options.field_order === "object" && !Array.isArray(options.field_order)
    ? options.field_order[viewtemplate] || options.field_order[lower]
    : undefined;
  return normalizeFieldList(scopedOrder || options[`${lower}_field_order`] || options.field_order) || includedFields || [];
};

const fieldDisplaySpec = (options, viewtemplate) => {
  const include = fieldListForView(options, viewtemplate);
  const exclude = excludedFieldsForView(options, viewtemplate);
  const order = fieldOrderForView(options, viewtemplate, include);
  return {
    include: include ? new Set(include) : null,
    exclude,
    order,
  };
};

const collectFieldNames = (node, fields = new Set()) => {
  if (!node) return fields;
  if (Array.isArray(node)) {
    for (const item of node) collectFieldNames(item, fields);
    return fields;
  }
  if (typeof node !== "object") return fields;
  if (node.field_name) fields.add(node.field_name);
  if (node.labelFor) fields.add(node.labelFor);
  if (node.join_field) fields.add(String(node.join_field).split(".")[0]);
  for (const value of Object.values(node)) collectFieldNames(value, fields);
  return fields;
};

const allowedByFieldSpec = (fieldName, spec) =>
  (!spec.include || spec.include.has(fieldName)) && !spec.exclude.has(fieldName);

const nodeAllowedByFieldSpec = (node, spec) => {
  const fields = [...collectFieldNames(node)];
  if (fields.length === 0) return true;
  return fields.some((fieldName) => allowedByFieldSpec(fieldName, spec));
};

const firstFieldName = (node) => [...collectFieldNames(node)][0];

const filterAndOrderFieldNodes = (items, spec) => {
  if (!Array.isArray(items)) return items;
  const kept = items.filter((item) => item === null || nodeAllowedByFieldSpec(item, spec));
  if (!spec.order.length) return kept;
  const leading = [];
  while (kept[leading.length] === null) leading.push(null);
  const orderIndex = new Map(spec.order.map((field, index) => [field, index]));
  const fieldItems = [];
  const otherItems = [];
  for (const item of kept.slice(leading.length)) {
    const fieldName = firstFieldName(item);
    if (fieldName && orderIndex.has(fieldName)) fieldItems.push(item);
    else otherItems.push(item);
  }
  fieldItems.sort(
    (a, b) => orderIndex.get(firstFieldName(a)) - orderIndex.get(firstFieldName(b))
  );
  return [...leading, ...fieldItems, ...otherItems];
};

const applyFieldDisplaySpec = (configuration, viewtemplate, options) => {
  const spec = fieldDisplaySpec(options, viewtemplate);
  if (!spec.include && spec.exclude.size === 0 && spec.order.length === 0) return;
  if (Array.isArray(configuration.columns)) {
    configuration.columns = filterAndOrderFieldNodes(configuration.columns, spec);
  }
  if (Array.isArray(configuration.layout?.above)) {
    configuration.layout.above = filterAndOrderFieldNodes(configuration.layout.above, spec);
  }
};

const polishBasicViewConfiguration = (configuration, viewtemplate, table, options = {}) => {
  const text = uiTextForLocale(options.ui_language || options.locale || "en");
  const labels = tableFieldLabels(table, options.labels || {});
  const fieldviews = tableFieldviews(
    table,
    scopedFieldviews(options.fieldviews || {}, viewtemplate, options.apply_fieldviews_to_all_views),
    {
      includeStoredFieldviews:
        viewtemplate === "Edit" || options.apply_stored_fieldviews_to_all_views === true,
    }
  );
  const polished = configuration || {};
  const polishOptions = {
    text,
    delete_confirmation:
      options.delete_confirmation || text.deleteConfirmation,
    create_label: options.create_label || text.create,
    create_view_display: options.create_view_display || "Popup",
    create_view_location: options.create_view_location || "Top right",
    create_link_style: options.create_link_style || "btn btn-primary",
    create_link_size: options.create_link_size || "",
    view_link_style: options.view_link_style || "btn btn-outline-secondary",
    view_link_size: options.view_link_size || "btn-sm",
    include_create_in_list: options.include_create_in_list === true,
  };

  if (viewtemplate === "List") {
    if (polishOptions.include_create_in_list) {
      polished.create_view_label = polishOptions.create_label;
      polished.create_view_display = polishOptions.create_view_display;
      polished.create_view_location = polishOptions.create_view_location;
      polished.create_link_style = polishOptions.create_link_style;
      polished.create_link_size = polishOptions.create_link_size;
      polished.create_view_position = "top-right";
      polished.create_view_align = "right";
      polished.create_view_side = "top";
    } else {
      polished.view_to_create = null;
      delete polished.create_view_label;
      delete polished.create_view_display;
      delete polished.create_view_location;
      delete polished.create_link_style;
      delete polished.create_link_size;
      delete polished.create_view_position;
      delete polished.create_view_align;
      delete polished.create_view_side;
    }
  }

  applyFieldDisplaySpec(polished, viewtemplate, options);

  walkConfiguration(polished, (node) => {
    if (node.field_name && labels[node.field_name]) {
      node.header_label = labels[node.field_name];
      node.label = labels[node.field_name];
      if (fieldviews[node.field_name]) node.fieldview = fieldviews[node.field_name];
      if (node.configuration && typeof node.configuration === "object") {
        node.configuration.label = labels[node.field_name];
        if (fieldviews[node.field_name]) node.configuration.fieldview = fieldviews[node.field_name];
      }
    }
    if (node.join_field) {
      const relationField = String(node.join_field).split(".")[0];
      if (labels[relationField]) node.header_label = labels[relationField];
    }
    if (node.type === "blank" && typeof node.contents === "string") {
      const label = (node.labelFor && labels[node.labelFor]) || labels[node.contents];
      if (label) node.contents = label;
    }
    translateActionColumn(node, polishOptions);
  });

  return polished;
};

const basicViewPolishOptions = (body) => ({
  enabled: body?.polish !== false && body?.polish_basic !== false,
  ui_language: defaultUiLocale(body),
  labels: body?.labels || {},
  fieldviews: body?.fieldviews || body?.fieldview_map || {},
  apply_fieldviews_to_all_views: body?.apply_fieldviews_to_all_views === true,
  apply_stored_fieldviews_to_all_views: body?.apply_stored_fieldviews_to_all_views === true,
  fields: body?.fields,
  list_fields: body?.list_fields,
  edit_fields: body?.edit_fields,
  show_fields: body?.show_fields,
  field_order: body?.field_order,
  list_field_order: body?.list_field_order,
  edit_field_order: body?.edit_field_order,
  show_field_order: body?.show_field_order,
  exclude_fields: body?.exclude_fields,
  hidden_fields: body?.hidden_fields,
  delete_confirmation: body?.delete_confirmation,
  edit_popup_title: body?.edit_popup_title || body?.popup_title,
  edit_popup_width: body?.edit_popup_width || body?.popup_width,
  edit_popup_width_units: body?.edit_popup_width_units || body?.popup_width_units,
  create_label: body?.create_label,
  create_view_display: body?.create_view_display,
  create_view_location: body?.create_view_location,
  create_link_style: body?.create_link_style,
  create_link_size: body?.create_link_size,
  view_link_style: body?.view_link_style,
  view_link_size: body?.view_link_size,
  include_create_in_list: body?.include_create_in_list,
});

const formColumnGroups = (section = {}) => {
  if (Array.isArray(section.columns) && section.columns.length) {
    if (section.columns.every((column) => Array.isArray(column))) {
      return section.columns.map((column) => column.map(String));
    }
    return [section.columns.map(String)];
  }
  const fields = normalizeFieldList(section.fields || section.field_names) || [];
  if (!fields.length) return [];
  const count = Math.max(1, Number(section.column_count || section.columns_count || 1) || 1);
  const groups = Array.from({ length: count }, () => []);
  fields.forEach((field, index) => groups[index % count].push(field));
  return groups.filter((group) => group.length);
};

const fieldNodeForForm = (fieldName, labels, fieldviews) => ({
  type: "field",
  block: false,
  label: labels[fieldName] || humanizeLabel(fieldName),
  fieldview: fieldviews[fieldName] || "edit",
  textStyle: "",
  field_name: fieldName,
  header_label: labels[fieldName] || humanizeLabel(fieldName),
});

const fieldRowForForm = (fieldName, labels, fieldviews) => ({
  style: { marginBottom: "1rem" },
  aligns: ["end", "start"],
  widths: [3, 9],
  besides: [
    {
      above: [
        {
          type: "blank",
          block: false,
          contents: labels[fieldName] || humanizeLabel(fieldName),
          labelFor: fieldName,
          textStyle: "",
        },
      ],
    },
    { above: [fieldNodeForForm(fieldName, labels, fieldviews)] },
  ],
  breakpoints: ["md", "md"],
  mobileAligns: ["start"],
});

const actionRowForForm = (label) => ({
  style: { marginTop: "1rem", marginBottom: "0.25rem" },
  aligns: ["start"],
  widths: [12],
  besides: [
    {
      type: "action",
      block: false,
      minRole: 100,
      action_name: "Save",
      action_label: label,
      action_style: "btn-primary",
    },
  ],
});

const sectionNodesForForm = (section, labels, fieldviews) => {
  const groups = formColumnGroups(section);
  if (!groups.length) throw new Error(`form section has no fields: ${section.title || "untitled"}`);
  const width = Math.floor(12 / groups.length);
  const widths = groups.map(() => width);
  widths[widths.length - 1] += 12 - widths.reduce((sum, item) => sum + item, 0);
  const nodes = [];
  if (section.description) {
    nodes.push({
      type: "blank",
      block: false,
      isHTML: true,
      contents: `<p class="text-muted mb-3">${escapeHtml(section.description)}</p>`,
    });
  }
  nodes.push({
    widths,
    besides: groups.map((group) => ({
      above: group.map((fieldName) => fieldRowForForm(fieldName, labels, fieldviews)),
    })),
    breakpoints: groups.map(() => section.breakpoint || "md"),
    mobileAligns: groups.map(() => "start"),
  });
  return nodes;
};

const sectionLayoutForForm = (section, labels, fieldviews) => {
  const contents = { above: sectionNodesForForm(section, labels, fieldviews) };
  if (String(section.style || "card").toLowerCase() === "plain") {
    return {
      above: [
        ...(section.title
          ? [
              {
                type: "blank",
                block: false,
                isHTML: true,
                contents: `<h3 class="mb-3">${escapeHtml(section.title)}</h3>`,
              },
            ]
          : []),
        ...contents.above,
      ],
    };
  }
  return {
    type: "card",
    title: section.title || uiTextByLocale.en.data,
    contents,
  };
};

const normalizeFormTabs = (body) => {
  if (Array.isArray(body.tabs) && body.tabs.length) {
    return body.tabs.map((tab) => ({
      title: tab.title || tab.name || uiTextForLocale(defaultUiLocale(body)).data,
      sections: Array.isArray(tab.sections) && tab.sections.length
        ? tab.sections
        : [
            {
              title: tab.section_title,
              description: tab.description,
              columns: tab.columns,
              fields: tab.fields,
              column_count: tab.column_count,
              style: tab.section_style || tab.style,
            },
          ],
    }));
  }
  return [
    {
      title: body.tab_title || uiTextForLocale(defaultUiLocale(body)).data,
      sections: Array.isArray(body.sections) && body.sections.length
        ? body.sections
        : [
            {
              title: body.section_title || body.title,
              description: body.description,
              columns: body.columns,
              fields: body.fields,
              column_count: body.column_count,
              style: body.section_style || body.style,
            },
          ],
    },
  ];
};

const collectFormFields = (tabs) => {
  const names = new Set();
  for (const tab of tabs) {
    for (const section of tab.sections || []) {
      for (const group of formColumnGroups(section)) {
        for (const fieldName of group) names.add(fieldName);
      }
    }
  }
  return names;
};

const buildFormLayout = (body, table, labels, fieldviews) => {
  const tabs = normalizeFormTabs(body);
  const fieldNames = collectFormFields(tabs);
  if (!fieldNames.size) throw new Error("form layout needs at least one field");
  for (const fieldName of fieldNames) getTableField(table, fieldName, "form field");

  const content =
    tabs.length > 1
      ? [
          {
            type: "tabs",
            tabsStyle: body.tabs_style || "Tabs",
            titles: tabs.map((tab) => tab.title),
            contents: tabs.map((tab) => ({
              above: (tab.sections || []).map((section) =>
                sectionLayoutForForm(section, labels, fieldviews)
              ),
            })),
          },
        ]
      : (tabs[0].sections || []).map((section) => sectionLayoutForForm(section, labels, fieldviews));
  return {
    above: [
      ...(body.header_html
        ? [{ type: "blank", block: false, isHTML: true, contents: String(body.header_html) }]
        : []),
      ...content,
      actionRowForForm(body.save_label || body.submit_label || uiTextForLocale(defaultUiLocale(body)).save),
    ],
  };
};

const createFormLayoutView = async (body) => {
  const { Table, View, db, getState } = getModels();
  const dryRun = shouldDryRun(body);
  const replaceExisting = bool(body?.replace_existing || body?.replace || body?.update_existing);
  const tableName = normalizeName(body?.table || body?.table_name, "table");
  const table = await findTableFresh(Table, getState, tableName);
  if (!table) throw new Error(`Table not found: ${tableName}`);
  const viewtemplate = "Edit";
  const name = normalizeViewName(body.name || defaultViewName(tableName, viewtemplate));
  const state = getState();
  const vtObj = state.viewtemplates[viewtemplate];
  if (!vtObj || typeof vtObj.createBasicView !== "function") {
    throw new Error("Edit viewtemplate is not available");
  }
  const plan = [{ action: replaceExisting ? "upsert_form_layout_view" : "create_form_layout_view", table: tableName, name }];
  if (dryRun) return { ok: true, dry_run: true, plan };

  let configuration = await vtObj.createBasicView(
    createBasicViewArgs(table, name, body.all_views_created || { Edit: name })
  );
  const polishOptions = basicViewPolishOptions({ ...body, apply_stored_fieldviews_to_all_views: true });
  if (polishOptions.enabled) {
    configuration = polishBasicViewConfiguration(configuration, viewtemplate, table, polishOptions);
  }
  const labels = tableFieldLabels(table, body.labels || {});
  const fieldviews = tableFieldviews(
    table,
    scopedFieldviews(body.fieldviews || body.fieldview_map || {}, viewtemplate, true),
    { includeStoredFieldviews: true }
  );
  configuration = {
    ...configuration,
    destination_type: body.destination_type || configuration.destination_type || "Back to referer",
    layout: buildFormLayout(body, table, labels, fieldviews),
  };

  const replaced = [];
  let view;
  await inTransaction(db, async () => {
    await deleteExistingViewIfRequested(View, name, replaceExisting, replaced);
    view = await View.create({
      name,
      configuration,
      viewtemplate,
      table_id: table.id,
      min_role: body.min_role || table.min_role_write,
      attributes: {
        ...(body.attributes || {}),
        ...(body.popup_title || body.edit_popup_title ? { popup_title: body.popup_title || body.edit_popup_title } : {}),
        ...(body.popup_width || body.edit_popup_width ? { popup_width: body.popup_width || body.edit_popup_width } : {}),
        ...(body.popup_width_units || body.edit_popup_width_units
          ? { popup_width_units: body.popup_width_units || body.edit_popup_width_units }
          : {}),
      },
    });
  });
  await refreshStateCaches(getState, { tables: true, views: true });
  return {
    ok: true,
    dry_run: false,
    replaced,
    view: { id: view.id, name: view.name, viewtemplate },
  };
};

const createBasicViews = async (body) => {
  const { Table, View, db, getState } = getModels();
  const dryRun = shouldDryRun(body);
  const replaceExisting = bool(body?.replace_existing || body?.replace);
  const polishOptions = basicViewPolishOptions(body);
  const tableName = normalizeName(body?.table || body?.table_name, "table");
  const table = await findTableFresh(Table, getState, tableName);
  if (!table) throw new Error(`Table not found: ${tableName}`);

  const requested = body.viewtemplates || body.views || ["List", "Edit", "Show"];
  const state = getState();
  const plan = [];
  const names = {};

  for (const viewtemplate of requested) {
    const vtName = String(viewtemplate);
    const vtObj = state.viewtemplates[vtName];
    if (!vtObj) throw new Error(`Viewtemplate not found: ${vtName}`);
    if (typeof vtObj.createBasicView !== "function") {
      throw new Error(`Viewtemplate does not support createBasicView: ${vtName}`);
    }
    const name = normalizeViewName(
      body.names?.[vtName] || defaultViewName(tableName, vtName),
      `view name for ${vtName}`
    );
    names[vtName] = name;
    plan.push({ action: "create_basic_view", table: tableName, viewtemplate: vtName, name });
  }

  if (dryRun) return { ok: true, dry_run: true, plan };

  const created = [];
  const replaced = [];
  await inTransaction(db, async () => {
    const allViewsCreated = { ...names };
    for (const [viewtemplate, name] of Object.entries(names)) {
      const existing = await findViewByName(View, name);
      if (existing) {
        if (!replaceExisting) throw new Error(`View already exists: ${name}`);
        if (typeof existing.delete !== "function") {
          throw new Error(`View model cannot delete existing view: ${name}`);
        }
        await existing.delete();
        replaced.push({ id: existing.id, name: existing.name, viewtemplate: existing.viewtemplate });
      }
      const vtObj = state.viewtemplates[viewtemplate];
      let configuration = await vtObj.createBasicView(
        createBasicViewArgs(table, name, allViewsCreated)
      );
      if (polishOptions.enabled) {
        configuration = polishBasicViewConfiguration(
          configuration,
          viewtemplate,
          table,
          polishOptions
        );
      }
      const view = await View.create({
        name,
        configuration,
        viewtemplate,
        table_id: table.id,
        min_role: viewtemplate === "Edit" ? table.min_role_write : table.min_role_read,
        attributes:
          viewtemplate === "Edit" && polishOptions.enabled
            ? {
                ...(polishOptions.edit_popup_title
                  ? { popup_title: polishOptions.edit_popup_title }
                  : {}),
                ...(polishOptions.edit_popup_width
                  ? { popup_width: polishOptions.edit_popup_width }
                  : {}),
                ...(polishOptions.edit_popup_width_units
                  ? { popup_width_units: polishOptions.edit_popup_width_units }
                  : {}),
              }
            : {},
      });
      created.push({ id: view.id, name: view.name, viewtemplate });
    }
  });
  await refreshStateCaches(getState, { tables: true, views: true });
  return { ok: true, dry_run: false, replaced, created };
};

const createView = async (body) => {
  const { Table, View, db, getState } = getModels();
  const dryRun = shouldDryRun(body);
  const replaceExisting = bool(body?.replace_existing || body?.replace || body?.update_existing);
  const tableName = body.table || body.table_name;
  const table = tableName
    ? await findTableFresh(Table, getState, normalizeName(tableName, "table"))
    : null;
  const viewtemplate = normalizeViewName(body.viewtemplate, "viewtemplate");
  const name = normalizeViewName(body.name || defaultViewName(tableName || "view", viewtemplate));
  const state = getState();
  const vtObj = state.viewtemplates[viewtemplate];
  if (!vtObj) throw new Error(`Viewtemplate not found: ${viewtemplate}`);
  if (!table && !vtObj.tableless && !vtObj.table_optional) {
    throw new Error(`Viewtemplate ${viewtemplate} requires a table`);
  }
  const existing = await findViewByName(View, name);
  const plan = [
    {
      action: existing && replaceExisting ? "update_view" : "create_view",
      name,
      table: table?.name,
      viewtemplate,
    },
  ];
  if (dryRun) return { ok: true, dry_run: true, plan };
  if (existing && !replaceExisting) throw new Error(`View already exists: ${name}`);
  if (existing && String(existing.viewtemplate) !== String(viewtemplate)) {
    throw new Error(
      `Existing view ${name} uses viewtemplate ${existing.viewtemplate}, not ${viewtemplate}`
    );
  }
  if (existing && table?.id && Number(existing.table_id) !== Number(table.id)) {
    throw new Error(`Existing view ${name} does not belong to table ${table.name}`);
  }

  let configuration = body.configuration;
  if (!configuration && bool(body.use_basic_config, true) && table && vtObj.createBasicView) {
    configuration = await vtObj.createBasicView(
      createBasicViewArgs(table, name, body.all_views_created || { [viewtemplate]: name })
    );
    const polishOptions = basicViewPolishOptions(body);
    if (polishOptions.enabled) {
      configuration = polishBasicViewConfiguration(configuration, viewtemplate, table, polishOptions);
    }
  } else if (!configuration && vtObj.initial_config) {
    configuration = await vtObj.initial_config({
      name,
      table_name: table?.name,
      table_id: table?.id,
      viewtemplate,
    });
  } else if (!configuration) configuration = {};

  let view;
  await inTransaction(db, async () => {
    const row = {
      name,
      configuration,
      viewtemplate,
      table_id: table?.id,
      min_role: body.min_role || (viewtemplate === "Edit" ? table?.min_role_write : table?.min_role_read) || 1,
      attributes: body.attributes || {},
    };
    if (existing) {
      if (typeof View.update !== "function") throw new Error("View.update is not available");
      await View.update(row, existing.id);
      view = { ...existing, ...row };
    } else {
      view = await View.create(row);
    }
  });
  await refreshStateCaches(getState, { tables: true, views: true });
  return {
    ok: true,
    dry_run: false,
    updated: !!existing,
    view: { id: view.id, name: view.name, viewtemplate },
  };
};

const deleteExistingViewIfRequested = async (View, name, replaceExisting, replaced) => {
  const existing = await findViewByName(View, name);
  if (!existing) return;
  if (!replaceExisting) throw new Error(`View already exists: ${name}`);
  if (typeof existing.delete !== "function") {
    throw new Error(`View model cannot delete existing view: ${name}`);
  }
  await existing.delete();
  replaced.push({ id: existing.id, name: existing.name, viewtemplate: existing.viewtemplate });
};

const findViewByName = async (View, name) => {
  const direct = View.findOne({ name });
  if (direct) return direct;
  if (typeof View.find !== "function") return null;
  const rows = await View.find({ name });
  return rows?.[0] || null;
};

const mergeDefined = (...objects) => {
  const merged = {};
  for (const object of objects) {
    for (const [key, value] of Object.entries(object || {})) {
      if (typeof value !== "undefined") merged[key] = value;
    }
  }
  return merged;
};

const getTableField = (table, fieldName, label = "field") => {
  const field = table.getField ? table.getField(fieldName) : (table.fields || []).find((f) => f.name === fieldName);
  if (!field) throw new Error(`${label} not found: ${fieldName}`);
  return field;
};

const fieldTypeName = (field) => field?.type?.name || field?.type || field?.fieldtype;

const isFileFieldType = (field) => {
  const typeName = String(fieldTypeName(field) || "");
  return typeName === "File" || typeName === "File[]";
};

const normalizeOptionalViewName = (value, label = "view name") => {
  if (typeof value === "undefined" || value === null || value === false || value === "") return "";
  return normalizeViewName(value, label);
};

const findViewForTable = async (View, table, viewName, label = "view") => {
  if (!viewName) return null;
  const view = await findViewByName(View, viewName);
  if (!view) throw new Error(`${label} not found: ${viewName}`);
  if (view.table_id && Number(view.table_id) !== Number(table.id)) {
    throw new Error(`${label} ${viewName} does not belong to table ${table.name}`);
  }
  return view;
};

const normalizeStringList = (value, defaultValue = []) => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return defaultValue;
};

const normalizeKanbanDisplay = (value) => {
  const display = String(value || "Popup").trim().toLowerCase();
  if (display === "popup" || display === "modal") return "Popup";
  if (display === "link" || display === "page" || display === "pagina") return "Link";
  return value || "Popup";
};

const normalizeCalendarDisplay = (value) => {
  const display = String(value || "pop-up").trim().toLowerCase();
  if (display === "popup" || display === "pop-up" || display === "modal") return "pop-up";
  if (display === "link" || display === "page" || display === "pagina") return "link";
  return value || "pop-up";
};

const firstFieldByType = (table, typeName) =>
  (table.fields || []).find((field) => String(fieldTypeName(field)) === typeName);

const firstKeyToTable = (table, targetTableName) =>
  (table.fields || []).find((field) => {
    if (String(fieldTypeName(field)) !== "Key" && !field.is_fkey) return false;
    const reftableName =
      field.reftable_name || field.reftable?.name || field.attributes?.reftable_name;
    return reftableName ? reftableName === targetTableName : true;
  });

const firstFieldByNamesOrType = (table, names, typeName) => {
  for (const name of names) {
    const field = (table.fields || []).find((candidate) => candidate.name === name);
    if (field && (!typeName || String(fieldTypeName(field)) === typeName)) return field;
  }
  return firstFieldByType(table, typeName);
};

const chartNumericTypes = new Set(["Float", "Integer", "Money"]);
const chartCategoricalTypes = new Set(["String", "Bool", "Integer"]);

const isRowCount = (value) => String(value || "").trim().toLowerCase() === "row count";

const firstNumericField = (table) =>
  (table.fields || []).find((field) => chartNumericTypes.has(String(fieldTypeName(field))));

const firstCategoricalField = (table) =>
  (table.fields || []).find(
    (field) => chartCategoricalTypes.has(String(fieldTypeName(field))) || field.is_fkey
  );

const normalizeChartType = (value) => {
  const type = String(value || "bar").trim().toLowerCase();
  const aliases = {
    bars: "bar",
    column: "bar",
    columns: "bar",
    dona: "donut",
    doughnut: "donut",
    torta: "pie",
    pastel: "pie",
    linea: "line",
    lineas: "line",
    area: "area",
    scatterplot: "scatter",
    dispersion: "scatter",
    histograma: "histogram",
    embudo: "funnel",
    medidor: "gauge",
    indicador: "gauge",
    mapa_calor: "heatmap",
  };
  const normalized = aliases[type] || type;
  const allowed = new Set([
    "line",
    "area",
    "scatter",
    "bar",
    "pie",
    "donut",
    "histogram",
    "funnel",
    "gauge",
    "heatmap",
  ]);
  if (!allowed.has(normalized)) throw new Error(`Unsupported chart plot_type: ${value}`);
  return normalized;
};

const normalizeChartStatistic = (value) => {
  const stat = String(value || "Count").trim().toLowerCase();
  const aliases = {
    count: "Count",
    cuenta: "Count",
    avg: "Avg",
    average: "Avg",
    promedio: "Avg",
    sum: "Sum",
    suma: "Sum",
    total: "Sum",
    max: "Max",
    maximum: "Max",
    minimo: "Min",
    min: "Min",
    minimum: "Min",
  };
  return aliases[stat] || value || "Count";
};

const normalizeChartOutcome = (table, value, label = "outcome_field") => {
  const raw = firstDefined(value, "Row count");
  const outcome = String(raw || "Row count").trim();
  if (isRowCount(outcome)) return "Row count";
  const field = getTableField(table, normalizeName(outcome, label), label);
  if (!chartNumericTypes.has(String(fieldTypeName(field)))) {
    throw new Error(`${label} must be numeric or "Row count": ${outcome}`);
  }
  return field.name;
};

const normalizeChartField = (table, value, label, fallbackField) => {
  const raw = value || fallbackField?.name;
  const fieldName = normalizeName(raw, label);
  getTableField(table, fieldName, label);
  return fieldName;
};

const createAdvancedView = async ({
  body,
  feature,
  viewtemplate,
  defaultPrefix,
  buildConfiguration,
  minRole,
}) => {
  await ensureFeatureAvailable(feature);
  const { Table, View, db, getState } = getModels();
  const dryRun = shouldDryRun(body);
  const replaceExisting = bool(body?.replace_existing || body?.replace);
  const tableName = normalizeName(body?.table || body?.table_name, "table");
  const table = await findTableFresh(Table, getState, tableName);
  if (!table) throw new Error(`Table not found: ${tableName}`);
  const name = normalizeViewName(
    body?.name || `${defaultPrefix} ${tableName}`,
    `${viewtemplate} view name`
  );
  const state = getState();
  const vtObj = state.viewtemplates[viewtemplate];
  if (!vtObj) throw new Error(`Viewtemplate not found: ${viewtemplate}`);
  const configuration = await buildConfiguration({ body, table, state, vtObj, name, View });
  const plan = [
    {
      action: replaceExisting ? "upsert_advanced_view" : "create_advanced_view",
      table: tableName,
      name,
      viewtemplate,
      configuration,
    },
  ];
  if (dryRun) return { ok: true, dry_run: true, plan };

  const replaced = [];
  let view;
  await inTransaction(db, async () => {
    await deleteExistingViewIfRequested(View, name, replaceExisting, replaced);
    view = await View.create({
      name,
      configuration,
      viewtemplate,
      table_id: table.id,
      min_role: minRole || table.min_role_read,
      attributes: body.attributes || {},
    });
  });
  await refreshStateCaches(getState, { tables: true, views: true });
  return {
    ok: true,
    dry_run: false,
    replaced,
    view: { id: view.id, name: view.name, viewtemplate },
  };
};

const createTabulatorView = async (body) =>
  createAdvancedView({
    body,
    feature: "tabulator",
    viewtemplate: "Tabulator",
    defaultPrefix: "Grid",
    buildConfiguration: async ({ body, table, vtObj, name }) => {
      let configuration = body.configuration;
      if (!configuration) {
        const allViewsCreated = {
          ...(body.show_view ? { Show: body.show_view } : {}),
          ...(body.edit_view ? { Edit: body.edit_view } : {}),
          ...(body.all_views_created || {}),
        };
        if (Object.keys(allViewsCreated).length === 0) {
          allViewsCreated.Show = defaultViewName(table.name, "Show");
          allViewsCreated.Edit = defaultViewName(table.name, "Edit");
        }
        if (typeof vtObj.createBasicView === "function") {
          configuration = await vtObj.createBasicView(
            createBasicViewArgs(table, name, allViewsCreated)
          );
        } else if (typeof vtObj.initial_config === "function") {
          configuration = await vtObj.initial_config({
            table_id: table.id,
            table_name: table.name,
            exttable_name: table.name,
            viewname: name,
          });
        } else {
          configuration = { columns: [] };
        }
      }

      const options = mergeDefined(
        {
          fit: normalizeTabulatorFit(firstDefined(body.fit, body.column_fit)),
          responsiveLayout:
            firstDefined(body.responsive_layout, body.responsiveLayout) || "collapse",
          header_filters: boolOption(body, [
            "header_filters",
            "headerFilters",
            "column_filters",
            "filters",
          ]),
          movable_cols: boolOption(body, ["movable_cols", "movableCols", "movable_columns"], true),
          download_csv: boolOption(body, [
            "download_csv",
            "downloadCsv",
            "download_button",
            "downloadButton",
            "csv_download",
          ], true),
          pagination_enabled: boolOption(body, [
            "pagination_enabled",
            "paginationEnabled",
            "pagination",
          ], true),
          pagination_size: firstDefined(body.pagination_size, body.paginationSize, body.page_size) || 20,
          addRowBtn: boolOption(body, ["add_row_button", "addRowBtn", "add_button"]),
          hideColsBtn: boolOption(body, [
            "hide_columns_button",
            "hideColsBtn",
            "show_hide_fields_button",
            "fields_button",
          ]),
          history: boolOption(body, ["history", "history_buttons"]),
          persistent: boolOption(body, ["persistent", "persist_layout", "save_layout"]),
          override_stylesheet:
            firstDefined(body.override_stylesheet, body.stylesheet, body.theme) || "bootstrap5",
        },
        body.options || {}
      );
      const polished = polishBasicViewConfiguration(
        { ...configuration, ...options },
        "Tabulator",
        table,
        basicViewPolishOptions(body)
      );
      return polished;
    },
  });

const createChartView = async (body) =>
  createAdvancedView({
    body,
    feature: "chart",
    viewtemplate: "Chart",
    defaultPrefix: "Chart",
    buildConfiguration: async ({ body, table }) => {
      let configuration = body.configuration;
      if (!configuration) {
        const requestedType = normalizeChartType(
          firstDefined(body.plot_type, body.chart_type, body.type)
        );
        const plotType = requestedType === "donut" ? "pie" : requestedType;
        const defaultFactor = firstCategoricalField(table);
        const defaultNumeric = firstNumericField(table);
        const common = mergeDefined({
          plot_type: plotType,
          title: firstDefined(body.title, body.chart_title, body.label),
          include_fml: firstDefined(body.include_fml, body.where_formula, body.filter_formula),
          show_missing: boolOption(body, ["show_missing", "include_missing"]),
          null_label: firstDefined(body.null_label, body.missing_label) || "Sin valor",
          show_legend: boolOption(body, ["show_legend", "legend"], true),
          mleft: firstDefined(body.mleft, body.margin_left),
          mright: firstDefined(body.mright, body.margin_right),
          mtop: firstDefined(body.mtop, body.margin_top),
          mbottom: firstDefined(body.mbottom, body.margin_bottom),
        });

        if (plotType === "bar") {
          const factorField = normalizeChartField(
            table,
            firstDefined(body.factor_field, body.category_field, body.group_field, body.x_field),
            "factor_field",
            defaultFactor
          );
          const outcomes = Array.isArray(body.outcomes)
            ? body.outcomes.map((outcome) => ({
                outcome_field: normalizeChartOutcome(
                  table,
                  outcome.outcome_field || outcome.field || outcome.name
                ),
              }))
            : [
                {
                  outcome_field: normalizeChartOutcome(
                    table,
                    firstDefined(
                      body.outcome_field,
                      body.value_field,
                      body.metric_field,
                      body.y_field
                    )
                  ),
                },
              ];
          configuration = {
            ...common,
            factor_field: factorField,
            outcomes,
            statistic: normalizeChartStatistic(body.statistic || body.aggregate),
            bar_stack: boolOption(body, ["bar_stack", "stack", "stacked"]),
            bar_orientation:
              firstDefined(body.bar_orientation, body.orientation) || "vertical",
            bar_axis_title: firstDefined(body.bar_axis_title, body.value_axis_title),
            lower_limit: body.lower_limit,
            upper_limit: body.upper_limit,
          };
        } else if (plotType === "pie" || plotType === "funnel") {
          const factorField = normalizeChartField(
            table,
            firstDefined(body.factor_field, body.category_field, body.group_field),
            "factor_field",
            defaultFactor
          );
          configuration = {
            ...common,
            factor_field: factorField,
            outcome_field: normalizeChartOutcome(
              table,
              firstDefined(body.outcome_field, body.value_field, body.metric_field)
            ),
            statistic: normalizeChartStatistic(body.statistic || body.aggregate),
            ...(plotType === "pie"
              ? {
                  pie_donut:
                    requestedType === "donut" ||
                    boolOption(body, ["pie_donut", "donut", "doughnut"]),
                  donut_ring_width: firstDefined(body.donut_ring_width, body.ring_width) || 50,
                  pie_label_position:
                    firstDefined(body.pie_label_position, body.label_position) || "outside",
                }
              : {}),
          };
        } else if (plotType === "line" || plotType === "area" || plotType === "scatter") {
          const xField = normalizeChartField(
            table,
            firstDefined(body.x_field, body.date_field, body.category_field),
            "x_field",
            firstDefined(firstFieldByType(table, "Date"), defaultNumeric)
          );
          const plotSeries =
            firstDefined(body.plot_series, body.series_mode) ||
            (body.series || body.y_fields ? "multiple" : "single");
          const rawYFields = body.y_fields || body.series;
          const series =
            Array.isArray(rawYFields) && rawYFields.length
              ? rawYFields.map((item) => ({
                  y_field: normalizeChartField(
                    table,
                    typeof item === "string" ? item : item.y_field || item.field,
                    "series.y_field",
                    defaultNumeric
                  ),
                }))
              : undefined;
          configuration = {
            ...common,
            plot_series: plotSeries,
            x_field: xField,
            y_field:
              plotSeries === "single" || plotSeries === "group_by_field"
                ? normalizeChartField(
                    table,
                    firstDefined(body.y_field, body.value_field, body.metric_field),
                    "y_field",
                    defaultNumeric
                  )
                : undefined,
            series,
            group_field:
              plotSeries === "group_by_field"
                ? normalizeChartField(
                    table,
                    firstDefined(body.group_field, body.series_field),
                    "group_field",
                    defaultFactor
                  )
                : undefined,
            smooth: boolOption(body, ["smooth"], plotType === "line"),
          };
        } else if (plotType === "histogram") {
          configuration = {
            ...common,
            histogram_field: normalizeChartField(
              table,
              firstDefined(body.histogram_field, body.value_field, body.field),
              "histogram_field",
              defaultNumeric
            ),
          };
        } else if (plotType === "gauge") {
          const gaugeType = firstDefined(body.gauge_type, body.mode) || "single";
          configuration = {
            ...common,
            outcome_field: normalizeChartOutcome(
              table,
              firstDefined(body.outcome_field, body.value_field, body.metric_field)
            ),
            statistic: normalizeChartStatistic(body.statistic || body.aggregate),
            gauge_min: body.gauge_min,
            gauge_max: body.gauge_max,
            gauge_style: firstDefined(body.gauge_style, body.style) || "arcs",
            gauge_type: gaugeType,
            gauge_group_field:
              gaugeType === "group_by_field"
                ? normalizeChartField(
                    table,
                    firstDefined(body.gauge_group_field, body.group_field),
                    "gauge_group_field",
                    defaultFactor
                  )
                : undefined,
            gauge_name: firstDefined(body.gauge_name, body.name_label) || body.title,
            gauge_series: Array.isArray(body.gauge_series)
              ? body.gauge_series.map((series) => ({
                  outcome_field: normalizeChartOutcome(
                    table,
                    series.outcome_field || series.field || series.name
                  ),
                  gauge_name: series.gauge_name || series.label,
                }))
              : undefined,
          };
        } else if (plotType === "heatmap") {
          configuration = {
            ...common,
            heatmap_x_field: normalizeChartField(
              table,
              firstDefined(body.heatmap_x_field, body.x_field),
              "heatmap_x_field",
              defaultFactor
            ),
            heatmap_y_field: normalizeChartField(
              table,
              firstDefined(body.heatmap_y_field, body.y_field),
              "heatmap_y_field",
              defaultFactor
            ),
            heatmap_value_field: normalizeChartField(
              table,
              firstDefined(body.heatmap_value_field, body.value_field),
              "heatmap_value_field",
              defaultNumeric
            ),
            heatmap_min: body.heatmap_min,
            heatmap_max: body.heatmap_max,
            heatmap_color_scale: body.heatmap_color_scale || "gradient",
          };
        }
      }

      return mergeDefined(configuration, body.options || {});
    },
  });

const createAttachmentView = async (body) =>
  createAdvancedView({
    body,
    feature: "attachments",
    viewtemplate: "Multi File Upload",
    defaultPrefix: "Adjuntos",
    buildConfiguration: async ({ body, table }) => {
      const { Table, getState } = getModels();
      const childTableName = normalizeName(
        body.child_table || body.attachment_table || body.files_table,
        "child_table"
      );
      const childTable = await findTableFresh(Table, getState, childTableName);
      if (!childTable) throw new Error(`child_table not found: ${childTableName}`);
      const relationFieldName = normalizeName(
        body.relation_field ||
          body.parent_key ||
          body.foreign_key ||
          firstKeyToTable(childTable, table.name)?.name,
        "relation_field"
      );
      const relationField = getTableField(childTable, relationFieldName, "relation_field");
      if (String(fieldTypeName(relationField)) !== "Key" && !relationField.is_fkey) {
        throw new Error(`relation_field must be a Key field: ${childTableName}.${relationFieldName}`);
      }
      const fileFieldName = normalizeName(
        body.file_field ||
          firstDefined(
            firstFieldByType(childTable, "File")?.name,
            firstFieldByType(childTable, "File[]")?.name
          ),
        "file_field"
      );
      const fileField = getTableField(childTable, fileFieldName, "file_field");
      if (!isFileFieldType(fileField)) {
        throw new Error(`file_field must be File or File[]: ${childTableName}.${fileFieldName}`);
      }
      const uiMode = String(body.ui_mode || body.mode || "dropzone").trim().toLowerCase();
      const uiAliases = {
        drag: "dropzone",
        drop: "dropzone",
        dragdrop: "dropzone",
        input: "input",
        filepond: "filepond",
      };
      const normalizedMode = uiAliases[uiMode] || uiMode;
      if (!["input", "dropzone", "filepond"].includes(normalizedMode)) {
        throw new Error(`Unsupported upload ui_mode: ${body.ui_mode}`);
      }
      return mergeDefined(
        {
          child_relation: `${childTableName}.${relationFieldName}`,
          file_field: `${childTableName}.${fileFieldName}`,
          target_folder: firstDefined(body.target_folder, body.folder, "/"),
          file_min_role: firstDefined(body.file_min_role, body.min_role_read, 1),
          ui_mode: normalizedMode,
          show_existing: boolOption(body, ["show_existing", "show_files"], true),
          allow_delete: boolOption(body, ["allow_delete", "delete_enabled"], true),
          delete_from_store: boolOption(body, ["delete_from_store", "delete_file_from_store"]),
        },
        body.configuration || {},
        body.options || {}
      );
    },
  });

const createCalendarView = async (body) =>
  createAdvancedView({
    body,
    feature: "calendar",
    viewtemplate: "Calendar",
    defaultPrefix: "Calendar",
    buildConfiguration: async ({ body, table, View }) => {
      const titleFieldName = normalizeName(
        body.title_field ||
          body.title ||
          body.event_title_field ||
          firstFieldByNamesOrType(table, ["titulo", "title", "nombre", "name"], "String")?.name,
        "title_field"
      );
      const startFieldName = normalizeName(
        body.start_field ||
          body.start ||
          body.start_date_field ||
          body.date_field ||
          body.fecha_inicio ||
          firstFieldByNamesOrType(
            table,
            ["inicio", "start", "start_date", "fecha_inicio", "fecha", "date"],
            "Date"
          )?.name,
        "start_field"
      );
      const titleField = getTableField(table, titleFieldName, "title_field");
      const startField = getTableField(table, startFieldName, "start_field");
      if (String(fieldTypeName(titleField)) !== "String") {
        throw new Error(`title_field must be a String field: ${titleFieldName}`);
      }
      if (String(fieldTypeName(startField)) !== "Date") {
        throw new Error(`start_field must be a Date field: ${startFieldName}`);
      }

      const rawEndField = firstDefined(
        body.end_field,
        body.end,
        body.end_date_field,
        body.fecha_fin,
        firstFieldByNamesOrType(table, ["fin", "end", "end_date", "fecha_fin"], "Date")?.name
      );
      const endFieldName = rawEndField ? normalizeName(String(rawEndField), "end_field") : "";
      if (endFieldName) {
        const endField = getTableField(table, endFieldName, "end_field");
        if (String(fieldTypeName(endField)) !== "Date") {
          throw new Error(`end_field must be a Date field: ${endFieldName}`);
        }
      }

      const rawDurationField = firstDefined(body.duration_field, body.duration);
      const durationFieldName = rawDurationField
        ? normalizeName(String(rawDurationField), "duration_field")
        : "";
      if (durationFieldName) {
        const durationField = getTableField(table, durationFieldName, "duration_field");
        const durationType = String(fieldTypeName(durationField));
        if (durationType !== "Integer" && durationType !== "Float") {
          throw new Error(`duration_field must be an Integer or Float field: ${durationFieldName}`);
        }
      }

      const rawAllDayField = firstDefined(body.allday_field, body.all_day_field, body.all_day);
      const allDayFieldName =
        rawAllDayField === "Always"
          ? "Always"
          : rawAllDayField
          ? normalizeName(String(rawAllDayField), "allday_field")
          : "";
      if (allDayFieldName && allDayFieldName !== "Always") {
        const allDayField = getTableField(table, allDayFieldName, "allday_field");
        if (String(fieldTypeName(allDayField)) !== "Bool") {
          throw new Error(`allday_field must be a Bool field or "Always": ${allDayFieldName}`);
        }
      }

      const rawColorField = firstDefined(body.event_color, body.color_field, body.color);
      const colorFieldName = rawColorField ? normalizeName(String(rawColorField), "event_color") : "";
      if (colorFieldName) getTableField(table, colorFieldName, "event_color");

      const showView = normalizeOptionalViewName(
        body.expand_view || body.show_view || body.detail_view || defaultViewName(table.name, "Show"),
        "expand_view"
      );
      await findViewForTable(View, table, showView, "expand_view");

      const createEnabled = boolOption(body, ["create_enabled", "allow_create", "can_create"], true);
      const rawCreateView = firstDefined(body.view_to_create, body.create_view, body.edit_view);
      const createView =
        !createEnabled || rawCreateView === null || rawCreateView === false || rawCreateView === ""
          ? ""
          : normalizeViewName(rawCreateView || defaultViewName(table.name, "Edit"), "view_to_create");
      await findViewForTable(View, table, createView, "view_to_create");

      const eventView = normalizeOptionalViewName(
        body.event_view || body.card_view || body.compact_view,
        "event_view"
      );
      await findViewForTable(View, table, eventView, "event_view");

      const rawRruleField = firstDefined(body.rrule_field, body.recurrence_field);
      const rruleField = rawRruleField ? normalizeName(String(rawRruleField), "rrule_field") : "";
      if (rruleField) getTableField(table, rruleField, "rrule_field");
      const rawEventUidField = firstDefined(body.event_uid_field, body.uid_field);
      const eventUidField = rawEventUidField
        ? normalizeName(String(rawEventUidField), "event_uid_field")
        : "";
      if (eventUidField) getTableField(table, eventUidField, "event_uid_field");

      return mergeDefined(
        {
          title_field: titleFieldName,
          start_field: startFieldName,
          end_field: endFieldName,
          duration_field: durationFieldName,
          duration_units: body.duration_units || "Hours",
          switch_to_duration: boolOption(body, ["switch_to_duration", "use_duration"]),
          allday_field: allDayFieldName,
          event_color: colorFieldName,
          rrule_field: rruleField,
          event_uid_field: eventUidField,
          include_fml: body.include_fml || body.where_formula,
          expand_view: showView,
          expand_display_mode: normalizeCalendarDisplay(
            body.expand_display_mode || body.expand_display || body.show_display
          ),
          reload_on_edit_in_pop_up: boolOption(body, [
            "reload_on_edit_in_pop_up",
            "reload_on_edit",
          ]),
          view_to_create: createView,
          create_display_mode: normalizeCalendarDisplay(
            body.create_display_mode || body.create_display || body.create_mode
          ),
          event_view: eventView,
          reload_on_drag_resize: boolOption(body, [
            "reload_on_drag_resize",
            "reload_on_drag",
          ]),
          progressive_load: boolOption(body, ["progressive_load", "lazy_load"]),
          initialView:
            firstDefined(body.initialView, body.initial_view, body.default_view) || "dayGridMonth",
          calendar_view_options:
            firstDefined(body.calendar_view_options, body.view_options, body.views) ||
            "dayGridMonth,timeGridWeek,listMonth",
          custom_calendar_views: body.custom_calendar_views,
          nowIndicator: boolOption(body, ["nowIndicator", "now_indicator"], true),
          weekNumbers: boolOption(body, ["weekNumbers", "week_numbers"]),
          default_event_color:
            firstDefined(body.default_event_color, body.default_color) || "#4e73df",
          limit_to_working_days: boolOption(body, [
            "limit_to_working_days",
            "working_days_only",
          ]),
          min_week_view_time: body.min_week_view_time || body.min_time,
          max_week_view_time: body.max_week_view_time || body.max_time,
          caldav_url: body.caldav_url,
          resource_field: body.resource_field,
          limit_resources: boolOption(body, ["limit_resources"]),
        },
        body.configuration || {},
        body.options || {}
      );
    },
  });

const columnOrderFromField = (field) => {
  const options = field?.attributes?.options;
  if (!options || typeof options !== "string") return [];
  return options
    .split(",")
    .map((option) => option.trim())
    .filter(Boolean);
};

const createKanbanView = async (body) =>
  createAdvancedView({
    body,
    feature: "kanban",
    viewtemplate: "Kanban",
    defaultPrefix: "Kanban",
    buildConfiguration: async ({ body, table, name, View }) => {
      const text = uiTextForLocale(defaultUiLocale(body));
      const columnFieldName = normalizeName(
        body.column_field || body.status_field || body.group_field || body.columns_by,
        "column_field"
      );
      const columnField = getTableField(table, columnFieldName, "column_field");
      const showView = normalizeViewName(
        body.show_view || body.card_view || defaultViewName(table.name, "Show"),
        "show_view"
      );
      await findViewForTable(View, table, showView, "show_view");
      const createEnabled = boolOption(body, ["create_enabled", "allow_create", "can_create"], true);
      const rawCreateView = firstDefined(body.view_to_create, body.create_view, body.edit_view);
      const editView = !createEnabled || rawCreateView === null || rawCreateView === false || rawCreateView === ""
        ? ""
        : normalizeViewName(
            rawCreateView || defaultViewName(table.name, "Edit"),
            "view_to_create"
          );
      await findViewForTable(View, table, editView, "view_to_create");
      const expandView = normalizeOptionalViewName(
        body.expand_view || body.detail_view || body.modal_view,
        "expand_view"
      );
      await findViewForTable(View, table, expandView, "expand_view");
      const rawPositionField = body.position_field || body.order_field;
      const positionField = rawPositionField ? String(rawPositionField).trim() : "";
      if (positionField) {
        const field = getTableField(table, positionField, "position_field");
        if (String(fieldTypeName(field)) !== "Float") {
          throw new Error(`position_field must be a Float field: ${positionField}`);
        }
      }
      const swimlaneField = body.swimlane_field || body.lane_field;
      if (swimlaneField && !String(swimlaneField).includes(".")) {
        getTableField(table, swimlaneField, "swimlane_field");
      }
      const requestedColumnOrder = firstDefined(body.column_order, body.columns, body.statuses);
      const columnOrder = normalizeStringList(requestedColumnOrder, columnOrderFromField(columnField));
      const updateEvents = normalizeStringList(body.update_events || body.realtime_events, []);

      return mergeDefined(
        {
          viewname: name,
          show_view: showView,
          expand_view: expandView,
          no_card_wrap: boolOption(body, ["no_card_wrap", "noCardWrap", "unstyled_cards"]),
          column_field: columnFieldName,
          column_order: columnOrder,
          column_padding:
            typeof body.column_padding === "undefined" ? 1 : body.column_padding,
          col_bg_color:
            body.col_bg_color || body.column_bg_color || body.column_background_color || "#f0f0f0",
          col_text_color:
            body.col_text_color || body.column_text_color || body.text_color || "#000000",
          col_width: firstDefined(body.col_width, body.column_width, body.width),
          col_width_units:
            firstDefined(body.col_width_units, body.column_width_units, body.width_units) || "px",
          position_field: positionField,
          disable_card_movement: boolOption(body, [
            "disable_card_movement",
            "lock_cards",
            "read_only",
          ]),
          disable_column_reordering: boolOption(body, [
            "disable_column_reordering",
            "lock_columns",
          ]),
          reload_on_drag: boolOption(body, ["reload_on_drag", "reloadOnDrag"]),
          view_to_create: editView,
          create_at_top: boolOption(body, ["create_at_top", "new_card_at_top", "top_create"]),
          create_label: body.create_label || body.new_card_label || text.createCard,
          create_view_display: normalizeKanbanDisplay(
            body.create_view_display || body.create_display || body.create_mode
          ),
          swimlane_field: swimlaneField,
          swimlane_height: body.swimlane_height,
          swimlane_where: body.swimlane_where,
          real_time_updates: boolOption(body, ["real_time_updates", "realtime", "live_updates"], true),
          update_events: updateEvents,
        },
        body.configuration || {},
        body.options || {}
      );
    },
  });

const inspectViews = async (body) => {
  const { View, getState } = getModels();
  if (getState?.()) await getState().refresh_views(true);
  const names = body?.names || body?.views || (body?.name ? [body.name] : []);
  const views = [];
  for (const rawName of names) {
    const name = normalizeViewName(rawName, "view name");
    const view = await findViewByName(View, name);
    views.push(
      view
        ? {
            id: view.id,
            name: view.name,
            viewtemplate: view.viewtemplate,
            table_id: view.table_id,
            min_role: view.min_role,
            configuration: view.configuration,
            attributes: view.attributes,
          }
        : { name, missing: true }
    );
  }
  return { ok: true, views };
};

const inspectPages = async (body) => {
  const { Page, getState } = getModels();
  if (getState?.()) await getState().refresh_pages(true);
  const names = body?.names || body?.pages || (body?.name ? [body.name] : []);
  const pages = [];
  for (const rawName of names) {
    const name = normalizeName(rawName, "page name");
    const page = Page.findOne({ name });
    pages.push(
      page
        ? {
            id: page.id,
            name: page.name,
            title: page.title,
            min_role: page.min_role,
            layout: page.layout,
            fixed_states: page.fixed_states,
            attributes: page.attributes,
          }
        : { name, missing: true }
    );
  }
  return { ok: true, pages };
};

const menuTypeFromItem = (item) => {
  if (item.type) return item.type;
  if (item.pagename || item.page || item.name) return "Page";
  if (item.viewname || item.view) return "View";
  if (item.url || item.href) return "Link";
  if (item.subitems || item.items || item.children) return "Header";
  throw new Error("menu item type is required");
};

const normalizeMenuRole = (value, defaultValue) =>
  typeof value === "undefined" || value === null || value === "" ? defaultValue : value;

const normalizeMenuItem = (item) => {
  const type = menuTypeFromItem(item);
  const label = item.label || item.text || item.title;
  if (!label || typeof label !== "string") throw new Error("menu item label is required");

  const common = {
    label: label.trim(),
    type,
    location: item.location || "Standard",
    min_role: normalizeMenuRole(item.min_role, 1),
    ...(typeof item.max_role !== "undefined" ? { max_role: item.max_role } : {}),
    ...(item.icon ? { icon: item.icon } : {}),
    ...(item.style ? { style: item.style } : {}),
    ...(item.tooltip ? { tooltip: item.tooltip } : {}),
    ...(item.shortcut ? { shortcut: item.shortcut } : {}),
    ...(typeof item.in_modal !== "undefined" ? { in_modal: bool(item.in_modal) } : {}),
    ...(typeof item.target_blank !== "undefined"
      ? { target_blank: bool(item.target_blank) }
      : {}),
    ...(typeof item.disable_on_mobile !== "undefined"
      ? { disable_on_mobile: bool(item.disable_on_mobile) }
      : {}),
  };

  if (type === "Header") {
    const subitems = item.subitems || item.items || item.children || [];
    return {
      ...common,
      subitems: subitems.map(normalizeMenuItem),
    };
  }
  if (type === "Page") {
    return {
      ...common,
      pagename: normalizeName(item.pagename || item.page || item.name, "menu page"),
    };
  }
  if (type === "View") {
    return {
      ...common,
      viewname: normalizeViewName(item.viewname || item.view || item.name, "menu view"),
    };
  }
  if (type === "Link") {
    const url = item.url || item.href;
    if (!url || typeof url !== "string") throw new Error("menu link url is required");
    return {
      ...common,
      url,
      ...(item.target ? { target: item.target } : {}),
    };
  }
  if (type === "Admin Page") {
    const adminPage = item.admin_page || item.adminPage || item.page;
    if (!adminPage || typeof adminPage !== "string") {
      throw new Error("Admin Page menu item requires admin_page");
    }
    return {
      ...common,
      admin_page: adminPage,
    };
  }
  if (type === "User Page") {
    const userPage = item.user_page || item.userPage || item.page;
    if (!userPage || typeof userPage !== "string") {
      throw new Error("User Page menu item requires user_page");
    }
    return {
      ...common,
      user_page: userPage,
    };
  }
  if (type === "Dynamic") return { ...item, ...common };
  throw new Error(`Unsupported menu item type: ${type}`);
};

const validateMenuReferences = async (items, Page, View) => {
  for (const item of items) {
    if (item.type === "Page" && !Page.findOne({ name: item.pagename })) {
      throw new Error(`Menu page not found: ${item.pagename}`);
    }
    if (item.type === "View" && !(await findViewByName(View, item.viewname))) {
      throw new Error(`Menu view not found: ${item.viewname}`);
    }
    if (item.subitems) await validateMenuReferences(item.subitems, Page, View);
  }
};

const removeMenuItem = (items, predicate) => {
  const kept = [];
  for (const item of items || []) {
    if (predicate(item)) continue;
    const next = { ...item };
    if (Array.isArray(next.subitems)) next.subitems = removeMenuItem(next.subitems, predicate);
    kept.push(next);
  }
  return kept;
};

const findHeader = (items, label) =>
  (items || []).find((item) => item.type === "Header" && item.label === label);

const saveMenuItems = async (config, menuItems) => {
  if (!config?.save_menu_items) throw new Error("Saltcorn menu save API is not available");
  await config.save_menu_items(menuItems);
};

const inspectMenu = async () => {
  const { getState } = getModels();
  const state = getState();
  return {
    ok: true,
    menu_items: state.getConfigCopy("menu_items", []),
    unrolled_menu_items: state.getConfigCopy("unrolled_menu_items", []),
  };
};

const upsertMenu = async (body) => {
  const { Page, View, config } = getModels();
  const dryRun = shouldDryRun(body);
  const rawItems = body?.items || body?.menu_items || body?.menu;
  if (!Array.isArray(rawItems)) throw new Error("items must be an array");
  const menu_items = rawItems.map(normalizeMenuItem);
  if (
    !dryRun &&
    menu_items.length === 0 &&
    body.allow_empty !== true &&
    body.confirm !== "BORRAR_MENU"
  ) {
    throw new Error('Refusing to save an empty menu without allow_empty: true and confirm: "BORRAR_MENU"');
  }
  if (body.validate !== false) await validateMenuReferences(menu_items, Page, View);
  const plan = [{ action: "replace_menu", items: menu_items }];
  if (dryRun) return { ok: true, dry_run: true, plan, menu_items };
  await saveMenuItems(config, menu_items);
  return { ok: true, dry_run: false, menu_items };
};

const addPageToMenu = async (body) => {
  const { Page, View, getState, config } = getModels();
  const dryRun = shouldDryRun(body);
  const pageName = normalizeName(body?.page || body?.pagename || body?.name, "page");
  const label = body?.label || body?.menu_label || humanizeLabel(pageName);
  const groupLabel = body?.group || body?.group_label || body?.section;
  const roleInfo = await resolvePageMinRole(body, 1);
  const pageItem = normalizeMenuItem({
    ...body,
    type: "Page",
    label,
    pagename: pageName,
    min_role: roleInfo.min_role,
  });
  if (body.validate !== false) await validateMenuReferences([pageItem], Page, View);

  const currentMenu = getState().getConfigCopy("menu_items", []);
  const withoutPage = removeMenuItem(
    currentMenu,
    (item) => item.type === "Page" && item.pagename === pageName
  );
  const menu_items = [...withoutPage];

  if (groupLabel) {
    let group = findHeader(menu_items, groupLabel);
    if (!group) {
      group = normalizeMenuItem({
        type: "Header",
        label: groupLabel,
        icon: body.group_icon,
        min_role: (await resolveRoleId(firstDefined(body.group_min_role, roleInfo.min_role), 1, "group min_role")).min_role,
        subitems: [],
      });
      menu_items.push(group);
    }
    group.subitems = Array.isArray(group.subitems) ? group.subitems : [];
    group.subitems.push(pageItem);
  } else {
    menu_items.push(pageItem);
  }

  const plan = [
    {
      action: "add_page_to_menu",
      page: pageName,
      label: pageItem.label,
      group: groupLabel || null,
      item: pageItem,
      warnings: roleInfo.warnings,
    },
  ];
  if (dryRun) return { ok: true, dry_run: true, plan, menu_items };
  await saveMenuItems(config, menu_items);
  return { ok: true, dry_run: false, menu_items };
};

const viewLayout = (views) => {
  const contents = views.map((view) => ({
    type: "view",
    view: normalizeViewName(typeof view === "string" ? view : view.name || view.view),
    state: view.state || "shared",
    configuration: view.configuration || {},
  }));
  return contents.length === 1 ? contents[0] : { type: "container", contents };
};

const pageCreateButtonHtml = ({ label, editViewName, listViewName, className = "btn btn-primary" }) => {
  const target = `/view/${encodeURIComponent(editViewName)}`;
  const reload = listViewName
    ? `, {'reload_view': '${escapeJsSingleQuoted(listViewName)}'}`
    : "";
  return `<a href="javascript:void(0)" class="${escapeHtml(className)}" onclick="ajax_modal('${escapeJsSingleQuoted(
    target
  )}'${reload});return false;">${escapeHtml(label)}</a>`;
};

const crudPageLayout = ({
  title,
  listViewName,
  editViewName,
  createLabel,
  createButtonClass,
}) => ({
  above: [
    {
      type: "blank",
      block: false,
      isHTML: true,
      contents: `<div class="d-flex justify-content-between align-items-center mb-3"><h2 class="mb-0">${escapeHtml(
        title
      )}</h2>${pageCreateButtonHtml({
        label: createLabel,
        editViewName,
        listViewName,
        className: createButtonClass,
      })}</div>`,
    },
    {
      type: "view",
      view: listViewName,
      state: "shared",
      configuration: {},
    },
  ],
});

const createCrudPage = async (body) => {
  const { Page, View, db, getState, config } = getModels();
  const text = uiTextForLocale(defaultUiLocale(body));
  const dryRun = shouldDryRun(body);
  const replaceExisting = bool(body?.replace_existing || body?.replace);
  const tableName = normalizeName(body?.table || body?.table_name, "table");
  const pageName = normalizeName(body?.name || `${tableName}_page`, "page name");
  const title = body?.title || humanizeLabel(body?.label || tableName);
  const listViewName = normalizeViewName(
    body?.list_view || body?.views?.List || defaultViewName(tableName, "List"),
    "list view"
  );
  const editViewName = normalizeViewName(
    body?.edit_view || body?.views?.Edit || defaultViewName(tableName, "Edit"),
    "edit view"
  );
  const createLabel =
    body?.create_label || `${text.create} ${humanizeLabel(tableName).toLowerCase()}`;
  const createButtonClass = body?.create_button_class || "btn btn-primary";
  const roleInfo = await resolvePageMinRole(body, 1);
  const minRole = roleInfo.min_role;
  const layout =
    body.layout ||
    crudPageLayout({
      title,
      listViewName,
      editViewName,
      createLabel,
      createButtonClass,
    });
  const plan = [
    {
      action: replaceExisting ? "upsert_crud_page" : "create_crud_page",
      name: pageName,
      title,
      list_view: listViewName,
      edit_view: editViewName,
      layout,
      min_role: minRole,
      public: wantsPublicAccess(body),
      warnings: roleInfo.warnings,
    },
  ];
  if (bool(body.menu)) {
    plan.push({
      action: "add_to_menu",
      type: "Page",
      label: body.menu_label || title,
      page: pageName,
    });
  }

  if (dryRun) return { ok: true, dry_run: true, plan };
  if (!(await findViewByName(View, listViewName))) throw new Error(`View not found: ${listViewName}`);
  if (!(await findViewByName(View, editViewName))) throw new Error(`View not found: ${editViewName}`);
  const existing = Page.findOne({ name: pageName });
  if (existing && !replaceExisting) throw new Error(`Page already exists: ${pageName}`);

  let page;
  await inTransaction(db, async () => {
    const pageRow = {
      name: pageName,
      title,
      min_role: minRole,
      description: body.description || "",
      layout,
      fixed_states: body.fixed_states || {},
      attributes: {
        request_fluid_layout: body.request_fluid_layout !== false,
        ...(body.attributes || {}),
      },
    };
    if (existing) {
      await Page.update(existing.id, pageRow);
      page = Page.findOne({ id: existing.id });
    } else {
      page = await Page.create(pageRow);
    }
    if (bool(body.menu) && config?.save_menu_items) {
      const currentMenu = getState().getConfigCopy("menu_items", []);
      const withoutExisting = currentMenu.filter(
        (item) => !(item.type === "Page" && item.pagename === pageName)
      );
      withoutExisting.push({
        label: body.menu_label || title,
        type: "Page",
        pagename: pageName,
        min_role: minRole,
      });
      await config.save_menu_items(withoutExisting);
    }
  });
  await refreshStateCaches(getState, { pages: true });
  return {
    ok: true,
    dry_run: false,
    page: { id: page?.id || existing?.id, name: pageName, title },
  };
};

const recordStateConfiguration = (state, recordId, configuration = {}) => {
  if (state !== "fixed" || typeof recordId === "undefined" || recordId === null || recordId === "") {
    return configuration || {};
  }
  return { id: recordId, ...(configuration || {}) };
};

const recordPageHeaderHtml = (title, description) => {
  const descriptionHtml = description
    ? `<p class="text-muted mb-0">${escapeHtml(description)}</p>`
    : "";
  return `<div class="mb-3"><h2 class="mb-1">${escapeHtml(title)}</h2>${descriptionHtml}</div>`;
};

const recordPageSectionHeaderHtml = (title, description) => {
  const descriptionHtml = description
    ? `<div class="text-muted small">${escapeHtml(description)}</div>`
    : "";
  return `<div class="mt-4 mb-2"><h4 class="mb-1">${escapeHtml(title)}</h4>${descriptionHtml}</div>`;
};

const normalizeRecordLayoutStyle = (value) => {
  const style = String(value || "plain").trim().toLowerCase();
  const aliases = {
    tab: "tabs",
    tabs: "tabs",
    pestanas: "tabs",
    two_columns: "columns",
    two_column: "columns",
    columnas: "columns",
    columns: "columns",
    sidebar: "columns",
    card: "cards",
    cards: "cards",
    tarjetas: "cards",
    default: "plain",
    simple: "plain",
    plain: "plain",
  };
  const normalized = aliases[style] || style;
  if (!["plain", "tabs", "columns", "cards"].includes(normalized)) {
    throw new Error(`Unsupported record page layout_style: ${value}`);
  }
  return normalized;
};

const normalizeSectionStyle = (value, layoutStyle) => {
  const style = String(value || (layoutStyle === "plain" ? "none" : "card")).trim().toLowerCase();
  const aliases = {
    card: "card",
    cards: "card",
    tarjeta: "card",
    none: "none",
    plain: "none",
    simple: "none",
  };
  const normalized = aliases[style] || style;
  if (!["card", "none"].includes(normalized)) {
    throw new Error(`Unsupported section_style: ${value}`);
  }
  return normalized;
};

const blankBlock = (contents) => ({
  type: "blank",
  block: false,
  isHTML: false,
  contents,
});

const viewSegment = (view, state, configuration) => ({
  type: "view",
  view,
  state,
  configuration,
});

const titledContents = (description, segment) => ({
  above: [description ? blankBlock(description) : null, segment].filter(Boolean),
});

const maybeCard = ({ title, description, segment, sectionDisplay, className }) =>
  sectionDisplay === "card"
    ? {
        type: "card",
        title: title || "",
        class: className || "",
        contents: titledContents(description, segment),
      }
    : title || description
    ? {
        above: [title ? blankBlock(title) : null, description ? blankBlock(description) : null, segment].filter(
          Boolean
        ),
      }
    : segment;

const normalizeRecordSection = (section, recordId) => {
  const viewName = normalizeViewName(section?.view || section?.name, "section.view");
  const state = section?.state || (typeof recordId !== "undefined" ? "fixed" : "shared");
  return {
    title: section?.title || section?.label || "",
    description: section?.description || "",
    tab: section?.tab || section?.title || section?.label || viewName,
    className: section?.class || section?.className || section?.css_class || "",
    view: viewName,
    state,
    configuration: recordStateConfiguration(state, recordId, section?.configuration || {}),
  };
};

const recordWithRelationsLayout = ({
  title,
  description,
  recordViewName,
  recordState,
  recordConfiguration,
  sections,
  showTitle,
  pageName,
  layoutStyle,
  sectionStyle,
  compact,
  recordTitle,
  recordDescription,
  uiLanguage,
}) => {
  const above = [];
  const text = uiTextForLocale(uiLanguage);
  const style = normalizeRecordLayoutStyle(layoutStyle);
  const sectionDisplay = normalizeSectionStyle(sectionStyle, style);
  if (showTitle) {
    above.push({
      type: "card",
      title,
      class: compact ? "mb-2" : "mb-3",
      contents: description ? blankBlock(description) : "",
    });
  }
  const recordSegment = recordViewName
    ? viewSegment(recordViewName, recordState, recordConfiguration)
    : null;
  const recordBlock = recordSegment
    ? maybeCard({
        title: recordTitle || (style === "tabs" ? "" : text.data),
        description: recordDescription || "",
        segment: recordSegment,
        sectionDisplay,
      })
    : null;
  const sectionBlocks = sections.map((section) =>
    maybeCard({
      title: section.title || section.view,
      description: section.description,
      segment: viewSegment(section.view, section.state, section.configuration),
      sectionDisplay,
      className: section.className,
    })
  );

  if (style === "tabs") {
    const contents = [recordBlock, ...sectionBlocks].filter(Boolean);
    above.push({
      type: "tabs",
      tabsStyle: "Tabs",
      titles: [
        ...(recordBlock ? [recordTitle || text.data] : []),
        ...sections.map((section) => section.tab || section.title || section.view),
      ],
      contents,
    });
    return { above };
  }

  if (style === "columns") {
    above.push({
      widths: recordBlock ? [5, 7] : [12],
      besides: recordBlock
        ? [recordBlock, { above: sectionBlocks }]
        : [{ above: sectionBlocks }],
    });
    return { above };
  }

  if (recordBlock) above.push(recordBlock);
  above.push(...sectionBlocks);
  return { above };
};

const createRecordWithRelationsPage = async (body) => {
  const { Page, View, db, getState, config } = getModels();
  const dryRun = shouldDryRun(body);
  const replaceExisting = bool(body?.replace_existing || body?.replace);
  const name = normalizeName(body?.name || body?.page, "page name");
  const title = body?.title || humanizeLabel(name);
  const recordId = firstDefined(body?.record_id, body?.id);
  const recordViewName = normalizeOptionalViewName(
    body?.record_view || body?.main_view || body?.view,
    "record_view"
  );
  const sections = (body?.sections || body?.relations || []).map((section) =>
    normalizeRecordSection(section, recordId)
  );
  if (!recordViewName && sections.length === 0) {
    throw new Error("record_view or at least one section is required");
  }
  const recordState =
    body?.record_state || body?.state || (typeof recordId !== "undefined" ? "fixed" : "shared");
  const recordConfiguration = recordStateConfiguration(
    recordState,
    recordId,
    body?.record_configuration || body?.record_config || {}
  );
  const layout =
    body?.layout ||
    recordWithRelationsLayout({
      title,
      description: body?.description || "",
      recordViewName,
    recordState,
    recordConfiguration,
    sections,
      pageName: name,
      layoutStyle: body?.layout_style || body?.style,
      sectionStyle: body?.section_style,
      compact: bool(body?.compact),
      recordTitle: body?.record_title,
      recordDescription: body?.record_description,
      uiLanguage: defaultUiLocale(body),
      showTitle: body?.show_title !== false,
    });
  const roleInfo = await resolvePageMinRole(body, 1);
  const minRole = roleInfo.min_role;
  const plan = [
    {
      action: replaceExisting ? "upsert_record_with_relations_page" : "create_record_with_relations_page",
      name,
      title,
      record_view: recordViewName || null,
      record_id: typeof recordId === "undefined" ? null : recordId,
      layout_style: normalizeRecordLayoutStyle(body?.layout_style || body?.style),
      sections,
      layout,
      min_role: minRole,
      public: wantsPublicAccess(body),
      warnings: roleInfo.warnings,
    },
  ];
  if (bool(body.menu)) {
    plan.push({
      action: "add_to_menu",
      type: "Page",
      label: body.menu_label || title,
      page: name,
      group: body.group || body.group_label || body.section || null,
    });
  }
  if (dryRun) return { ok: true, dry_run: true, plan };

  const viewNames = [recordViewName, ...sections.map((section) => section.view)].filter(Boolean);
  for (const viewName of viewNames) {
    if (!(await findViewByName(View, viewName))) throw new Error(`View not found: ${viewName}`);
  }
  const existing = Page.findOne({ name });
  if (existing && !replaceExisting) throw new Error(`Page already exists: ${name}`);

  let page;
  await inTransaction(db, async () => {
    const pageRow = {
      name,
      title,
      min_role: minRole,
      description: body.description || "",
      layout,
      fixed_states: body.fixed_states || {},
      attributes: {
        request_fluid_layout: body.request_fluid_layout !== false,
        ...(body.attributes || {}),
      },
    };
    if (existing) {
      await Page.update(existing.id, pageRow);
      page = Page.findOne({ id: existing.id });
    } else {
      page = await Page.create(pageRow);
    }
    if (bool(body.menu) && config?.save_menu_items) {
      const label = body.menu_label || title;
      const groupLabel = body.group || body.group_label || body.section;
      const pageItem = normalizeMenuItem({
        ...body,
        type: "Page",
        label,
        pagename: name,
        min_role: minRole,
      });
      const currentMenu = getState().getConfigCopy("menu_items", []);
      const menu_items = removeMenuItem(
        currentMenu,
        (item) => item.type === "Page" && item.pagename === name
      );
      if (groupLabel) {
        let group = findHeader(menu_items, groupLabel);
        if (!group) {
          group = normalizeMenuItem({
            type: "Header",
            label: groupLabel,
            icon: body.group_icon,
            min_role: body.group_min_role || minRole,
            subitems: [],
          });
          menu_items.push(group);
        }
        group.subitems = Array.isArray(group.subitems) ? group.subitems : [];
        group.subitems.push(pageItem);
      } else {
        menu_items.push(pageItem);
      }
      await config.save_menu_items(menu_items);
    }
  });
  await refreshStateCaches(getState, { pages: true });
  return {
    ok: true,
    dry_run: false,
    page: { id: page?.id || existing?.id, name, title },
    views: viewNames,
  };
};

const createPage = async (body) => {
  const { Page, View, db, getState, config } = getModels();
  const dryRun = shouldDryRun(body);
  const name = normalizeName(body?.name, "page name");
  const title = body.title || name;
  const views = body.views || [];
  const layout = body.layout || viewLayout(views);
  const roleInfo = await resolvePageMinRole(body, 1);
  const minRole = roleInfo.min_role;
  const plan = [
    {
      action: wantsPublicAccess(body) ? "create_public_page" : "create_page",
      name,
      title,
      min_role: minRole,
      public: wantsPublicAccess(body),
      views,
      layout,
      warnings: roleInfo.warnings,
    },
  ];
  if (bool(body.menu)) plan.push({ action: "add_to_menu", type: "Page", label: body.menu_label || title, page: name });

  if (dryRun) return { ok: true, dry_run: true, plan };
  if (Page.findOne({ name })) throw new Error(`Page already exists: ${name}`);
  for (const view of views) {
    const viewName = typeof view === "string" ? view : view.name || view.view;
    if (!(await findViewByName(View, viewName))) throw new Error(`View not found: ${viewName}`);
  }

  let page;
  await inTransaction(db, async () => {
    page = await Page.create({
      name,
      title,
      min_role: minRole,
      description: body.description || "",
      layout,
      fixed_states: body.fixed_states || {},
      attributes: body.attributes || {},
    });
    if (bool(body.menu) && config?.save_menu_items) {
      const currentMenu = getState().getConfigCopy("menu_items", []);
      currentMenu.push({
        label: body.menu_label || title,
        type: "Page",
        pagename: name,
        min_role: minRole,
      });
      await config.save_menu_items(currentMenu);
    }
  });
  await refreshStateCaches(getState, { pages: true });
  return { ok: true, dry_run: false, page: { id: page.id, name: page.name, title: page.title } };
};

const createPublicPage = async (body) =>
  createPage({
    ...body,
    public: true,
  });

const triggerModel = () => {
  const Trigger = optionalRequire("@saltcorn/data/models/trigger");
  if (!Trigger) throw new Error("Saltcorn Trigger model is not available");
  return Trigger;
};

const triggerEventNames = (Trigger) =>
  (Trigger.when_options || [])
    .map((option) =>
      typeof option === "string" ? option : option?.name || option?.value || option?.label
    )
    .filter(Boolean);

const stateActions = () => {
  const { getState } = getModels();
  const state = getState?.();
  return state?.actions || {};
};

const listActionsAndTriggers = async () => {
  const Trigger = triggerModel();
  const actions = stateActions();
  const triggers = typeof Trigger.find === "function" ? await Trigger.find({}) : [];
  return {
    ok: true,
    actions: Object.keys(actions)
      .sort()
      .map((name) => ({
        name,
        description: actions[name]?.description,
        has_config_fields:
          typeof actions[name]?.configFields === "function" ||
          typeof actions[name]?.configuration_workflow === "function",
      })),
    events: triggerEventNames(Trigger).sort(),
    triggers: triggers.map((trigger) => ({
      id: trigger.id,
      name: trigger.name,
      table_id: trigger.table_id,
      when_trigger: trigger.when_trigger,
      action: trigger.action,
      channel: trigger.channel,
      min_role: trigger.min_role,
      description: trigger.description,
      configuration: trigger.configuration,
    })),
  };
};

const normalizeTriggerEvent = (value, Trigger, allowUnknown) => {
  if (typeof value !== "string" || !value.trim()) throw new Error("trigger event is required");
  const raw = value.trim();
  const match = triggerEventNames(Trigger).find(
    (eventName) => eventName.toLowerCase() === raw.toLowerCase()
  );
  if (match) return match;
  if (allowUnknown) return raw;
  throw new Error(`Trigger event is not available: ${raw}`);
};

const tableIdForTrigger = async (body, event) => {
  const tableName = body.table || body.table_name;
  const tableEvents = new Set(["insert", "update", "delete", "validate"]);
  if (!tableName) {
    if (tableEvents.has(String(event).toLowerCase())) {
      throw new Error(`table is required for ${event} triggers`);
    }
    return undefined;
  }
  const { Table } = getModels();
  const table = Table.findOne({ name: normalizeName(tableName, "table") });
  if (!table) throw new Error(`Table not found: ${tableName}`);
  return table.id;
};

const createTriggerRow = async (Trigger, row) => {
  if (typeof Trigger.create === "function") return Trigger.create(row);
  const trigger = new Trigger(row);
  if (typeof trigger.create === "function") return trigger.create();
  throw new Error("Saltcorn Trigger create API is not available");
};

const createTrigger = async (body = {}) => {
  const Trigger = triggerModel();
  const dryRun = shouldDryRun(body);
  const name = normalizeName(body.name || body.trigger || body.trigger_name, "trigger name");
  const event = normalizeTriggerEvent(
    body.when_trigger || body.event || body.when,
    Trigger,
    bool(body.allow_unknown_event)
  );
  const action = normalizeViewName(body.action || body.action_name, "action");
  const actions = stateActions();
  if (!bool(body.allow_unknown_action) && Object.keys(actions).length && !actions[action]) {
    throw new Error(`Action is not available: ${action}`);
  }
  const table_id = await tableIdForTrigger(body, event);
  const roleInfo = await resolveRoleId(firstDefined(body.min_role, body.role), undefined, "trigger min_role");
  const row = {
    name,
    when_trigger: event,
    action,
    ...(typeof table_id !== "undefined" ? { table_id } : {}),
    ...(body.channel ? { channel: body.channel } : {}),
    ...(body.description ? { description: body.description } : {}),
    ...(typeof roleInfo.min_role !== "undefined" ? { min_role: roleInfo.min_role } : {}),
    configuration: body.configuration || body.config || {},
  };
  const plan = [{ action: "create_trigger", trigger: row, warnings: roleInfo.warnings }];
  if (dryRun) return { ok: true, dry_run: true, plan, trigger: row };
  const trigger = await createTriggerRow(Trigger, row);
  return {
    ok: true,
    dry_run: false,
    trigger: {
      id: trigger?.id,
      name,
      when_trigger: event,
      action,
      table_id,
    },
  };
};

const createWebhookTrigger = async (body = {}) => {
  const actions = stateActions();
  const actionNames = Object.keys(actions);
  const inferredAction =
    body.action ||
    actionNames.find((name) => name.toLowerCase() === "webhook") ||
    actionNames.find((name) => name.toLowerCase().includes("webhook"));
  if (!inferredAction) {
    throw new Error("No webhook action is available. Call GET /savne-saltcorn-agent-api/actions first.");
  }
  const url = body.url || body.webhook_url;
  const configuration =
    body.configuration ||
    body.config ||
    {
      ...(url ? { url } : {}),
      method: body.method || "POST",
      headers: body.headers || {},
      body: firstDefined(body.body, body.payload, body.body_template, body.payload_template, {}),
    };
  return createTrigger({
    ...body,
    action: inferredAction,
    configuration,
  });
};

module.exports = {
  addField,
  addPageToMenu,
  deleteObjects,
  createAttachmentView,
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
  getCapabilities,
  getLocaleSettings,
  listActionsAndTriggers,
  inspectMenu,
  inspectPages,
  inspectViews,
  listFieldCapabilities,
  listViewTemplates,
  refreshCaches,
  requireCapabilities,
  setLocaleSettings,
  upsertMenu,
};
