import { nanoid } from "nanoid";
import { DirectoryResourceType, DirectoryScanEntry } from "./directory-result.schema.js";

type NormalizedDirectoryUrl = {
  url: string;
  path: string;
  scheme: string;
  hostname: string;
  port: string;
  query: string;
  dedupePath: string;
  originalUrl: string;
};

const fileExtensionPattern = /\.[a-zA-Z0-9]{1,12}$/;
const apiPathPattern = /(^|\/)(api|graphql|rest|rpc|v[0-9]+)(\/|$)/i;

function collapseSlashes(pathname: string) {
  return pathname.replace(/\/{2,}/g, "/") || "/";
}

function sortedQuery(searchParams: URLSearchParams) {
  const entries = [...searchParams.entries()].sort(([aKey, aValue], [bKey, bValue]) => {
    const keyCompare = aKey.localeCompare(bKey);
    return keyCompare === 0 ? aValue.localeCompare(bValue) : keyCompare;
  });
  const params = new URLSearchParams();
  for (const [key, value] of entries) params.append(key, value);
  return params.toString();
}

function normalizePort(parsed: URL) {
  if ((parsed.protocol === "http:" && parsed.port === "80") || (parsed.protocol === "https:" && parsed.port === "443")) {
    return "";
  }
  return parsed.port;
}

function normalizeDedupePath(path: string) {
  if (path === "/") return path;
  if (fileExtensionPattern.test(path)) return path;
  return path.endsWith("/") ? path : `${path}/`;
}

export function normalizeDirectoryUrl(inputUrl: string, target: string): NormalizedDirectoryUrl {
  const originalUrl = inputUrl;
  const parsed = new URL(inputUrl, target);
  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.pathname = collapseSlashes(parsed.pathname);

  const query = sortedQuery(parsed.searchParams);
  parsed.search = query ? `?${query}` : "";
  parsed.port = normalizePort(parsed);

  const path = parsed.pathname || "/";
  return {
    url: parsed.toString(),
    path,
    scheme: parsed.protocol.replace(":", ""),
    hostname: parsed.hostname,
    port: parsed.port,
    query,
    dedupePath: normalizeDedupePath(path),
    originalUrl
  };
}

export function directoryDedupeKey(entry: DirectoryScanEntry) {
  const parsed = normalizeDirectoryUrl(entry.url, entry.url);
  return [
    entry.method.toUpperCase(),
    parsed.scheme,
    parsed.hostname,
    parsed.port,
    parsed.dedupePath,
    parsed.query
  ].join("|");
}

export function classifyDirectoryResource(params: {
  path: string;
  statusCode?: number;
  redirectLocation?: string;
  contentType?: string;
}): DirectoryResourceType {
  if (params.statusCode && params.statusCode >= 300 && params.statusCode < 400 && params.redirectLocation) {
    return "redirect";
  }
  if (params.path.endsWith("/")) return "directory";
  if (fileExtensionPattern.test(params.path)) return "file";
  if (apiPathPattern.test(params.path) || params.contentType?.toLowerCase().includes("application/json")) {
    return "endpoint";
  }
  return "unknown";
}

export function createDirectoryEntry(params: {
  toolName: string;
  target: string;
  url: string;
  method?: string;
  statusCode?: number;
  contentLength?: number;
  contentType?: string;
  redirectLocation?: string;
  depth?: number;
  metadata?: Record<string, unknown>;
}): DirectoryScanEntry {
  const normalized = normalizeDirectoryUrl(params.url, params.target);
  const statusCode = Number.isFinite(params.statusCode) ? params.statusCode : undefined;
  const contentLength = Number.isFinite(params.contentLength) ? params.contentLength : undefined;
  const redirectLocation = params.redirectLocation ? normalizeDirectoryUrl(params.redirectLocation, normalized.url).url : undefined;
  const contentType = params.contentType?.trim() || undefined;
  const resourceType = classifyDirectoryResource({
    path: normalized.path,
    statusCode,
    redirectLocation,
    contentType
  });

  return {
    id: `dir_${nanoid(12)}`,
    url: normalized.url,
    path: normalized.path,
    resourceType,
    method: (params.method ?? "GET").toUpperCase(),
    statusCode,
    contentLength,
    contentType,
    redirectLocation,
    depth: params.depth,
    sources: [params.toolName],
    firstDiscoveredBy: params.toolName,
    confidence: statusCode ? "medium" : "low",
    requiresAuthentication: statusCode === 401 || statusCode === 403,
    metadata: {
      originalUrl: normalized.originalUrl,
      ...(params.metadata ?? {})
    }
  };
}
