const { spawn } = require("node:child_process");
const { createConnection } = require("node:net");
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { simMiddleware } = require("serve-sim/middleware");
const { withUniwindConfig } = require("uniwind/metro");

const config = getDefaultConfig(__dirname);

const simPreviewPath = "/.sim";
const simPreviewServerPort = 3200;
const disableServeSim = process.env.BR_OPEN_DISABLE_SERVE_SIM === "1";
const serveSimScript = path.join(
  path.dirname(require.resolve("serve-sim/middleware")),
  "serve-sim.js"
);

const isPortOpen = (port, onResult) => {
  const socket = createConnection({ host: "127.0.0.1", port });
  let finished = false;

  const finish = (isOpen) => {
    if (finished) {
      return;
    }

    finished = true;
    socket.destroy();
    onResult(isOpen);
  };

  socket.setTimeout(500);
  socket.on("connect", () => finish(true));
  socket.on("error", () => finish(false));
  socket.on("timeout", () => finish(false));
};

const startServeSim = () => {
  if (disableServeSim || process.platform !== "darwin") {
    return;
  }

  isPortOpen(simPreviewServerPort, (isOpen) => {
    if (isOpen) {
      return;
    }

    const child = spawn(process.execPath, [serveSimScript], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout?.on("data", (chunk) => process.stdout.write(chunk));
    child.stderr?.on("data", (chunk) => process.stderr.write(chunk));
    child.on("error", (error) => {
      process.stderr.write(`serve-sim: ${error.message}\n`);
    });
  });
};

startServeSim();

config.server = config.server ?? {};

const originalEnhanceMiddleware = config.server.enhanceMiddleware;

config.server.enhanceMiddleware = (metroMiddleware, server) => {
  const enhancedMiddleware = originalEnhanceMiddleware
    ? originalEnhanceMiddleware(metroMiddleware, server)
    : metroMiddleware;
  const simulatorMiddleware = simMiddleware({ basePath: simPreviewPath });

  return (request, response, next) => {
    const requestPath = request.url?.split("?", 1)[0] ?? "";

    if (
      requestPath === simPreviewPath ||
      requestPath.startsWith(`${simPreviewPath}/`)
    ) {
      return simulatorMiddleware(request, response, next);
    }

    return enhancedMiddleware(request, response, next);
  };
};

module.exports = withUniwindConfig(config, {
  // relative path to your global.css file (from previous step)
  cssEntryFile: "./src/global.css",
  // (optional) path where we gonna auto-generate typings
  // defaults to project's root
  dtsFile: "./src/uniwind-types.d.ts",
});
