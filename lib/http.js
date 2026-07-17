"use strict";

const getBearerToken = (req) => {
  const header = req?.headers?.authorization || req?.headers?.Authorization;
  if (!header || typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
};

const isAdminRequest = (req) => {
  const roleId = req?.user?.role_id ?? req?.user?.roleId;
  return req?.user?.is_admin === true || roleId === 1 || roleId === "1";
};

const getUserModel = () => {
  try {
    return require("@saltcorn/data/models/user");
  } catch (error) {
    const err = new Error("Saltcorn User model is not available for API token authentication");
    err.status = 500;
    throw err;
  }
};

const requireExtensionAccess = async (req, options = {}) => {
  if (options.public === true) return null;

  if (options.allowSession && isAdminRequest(req)) {
    return req.user;
  }

  const token = getBearerToken(req);
  if (!token) {
    const err = new Error("Extension API requires a Saltcorn user API token");
    err.status = 401;
    throw err;
  }

  const User = getUserModel();
  if (typeof User.findByApiToken !== "function") {
    const err = new Error("Saltcorn User.findByApiToken is not available");
    err.status = 500;
    throw err;
  }

  const user = await User.findByApiToken(token);
  if (!user) {
    const err = new Error("Invalid Saltcorn user API token");
    err.status = 401;
    throw err;
  }

  if (user.disabled) {
    const err = new Error("Saltcorn user is disabled");
    err.status = 403;
    throw err;
  }

  const sessionUser = user.session_object || user;
  if (!isAdminRequest({ user: sessionUser })) {
    const err = new Error("Extension API requires an admin Saltcorn user API token");
    err.status = 403;
    throw err;
  }

  req.user = sessionUser;
  req.extension_api_user = user;
  return user;
};

const jsonHandler = (callback) => async (req, res) => {
  try {
    const payload = await callback(req, res);
    if (payload?.__raw_response) {
      if (payload.contentType && res?.type) res.type(payload.contentType);
      if (res?.send) return res.send(payload.body);
      return payload.body;
    }
    if (res?.json) return res.json(payload);
    if (res?.send) return res.send(payload);
    return payload;
  } catch (error) {
    const status = error.status || 500;
    const payload = {
      ok: false,
      error: error.message || "Unexpected error",
    };
    if (res?.status && res?.json) return res.status(status).json(payload);
    if (res?.status && res?.send) return res.status(status).send(payload);
    throw error;
  }
};

module.exports = {
  getBearerToken,
  isAdminRequest,
  jsonHandler,
  requireExtensionAccess,
};
