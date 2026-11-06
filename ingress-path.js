function normalizeIngressPath(requestUrl, ingressPathHeader) {
  if (
    typeof ingressPathHeader !== "string" ||
    !ingressPathHeader.startsWith("/api/hassio_ingress/")
  ) {
    return requestUrl;
  }

  let ingressPath;
  let requestedUrl;
  try {
    ingressPath = new URL(ingressPathHeader, "http://home-assistant.local");
    requestedUrl = new URL(requestUrl, "http://home-assistant.local");
  } catch {
    return requestUrl;
  }

  if (
    ingressPath.origin !== "http://home-assistant.local" ||
    ingressPath.search ||
    ingressPath.hash
  ) {
    return requestUrl;
  }

  const prefix = ingressPath.pathname.replace(/\/+$/, "");
  if (requestedUrl.pathname === prefix) {
    requestedUrl.pathname = "/";
  } else if (requestedUrl.pathname.startsWith(`${prefix}/`)) {
    requestedUrl.pathname = requestedUrl.pathname.slice(prefix.length);
  } else {
    return requestUrl;
  }

  return `${requestedUrl.pathname}${requestedUrl.search}`;
}

module.exports = { normalizeIngressPath };
