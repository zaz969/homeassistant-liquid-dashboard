const ingressProxyAddresses = new Set(["172.30.32.2", "::ffff:172.30.32.2"]);

async function start() {
  const [{ createServer }, nextModule, ingressPathModule] = await Promise.all([
    import("node:http"),
    import("next"),
    import("./ingress-path.js"),
  ]);
  const next = nextModule.default;
  const { normalizeIngressPath } = ingressPathModule;
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOSTNAME ?? "0.0.0.0";
  const app = next({ dev: false, hostname: host, port });
  const handle = app.getRequestHandler();

  await app.prepare();
  const server = createServer((request, response) => {
    if (!ingressProxyAddresses.has(request.socket.remoteAddress ?? "")) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Home Assistant Ingress access required.");
      return;
    }

    request.url = normalizeIngressPath(
      request.url ?? "/",
      request.headers["x-ingress-path"],
    );

    void handle(request, response).catch(() => {
      console.error("Could not handle a dashboard request.");
      if (response.headersSent) {
        response.destroy();
      } else {
        response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("The dashboard could not process this request.");
      }
    });
  });

  server.listen(port, host, () => {
    console.log(`Glass Dashboard listening on ${host}:${port}`);
  });
}

start().catch((error) => {
  console.error("Could not start the Home Assistant dashboard app.", error);
  process.exitCode = 1;
});
