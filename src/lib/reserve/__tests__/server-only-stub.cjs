/* eslint-disable @typescript-eslint/no-require-imports -- a CommonJS preload for plain Node */
// Test preload: "server-only" throws outside Next's server build; tests run in
// plain Node, which is a server, so let it resolve to its empty module.
const Module = require("module");
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "server-only") return require("path").join(__dirname, "empty.cjs");
  return resolve.call(this, request, ...rest);
};
