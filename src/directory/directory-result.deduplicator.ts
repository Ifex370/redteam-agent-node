import { DirectoryScanEntry } from "./directory-result.schema.js";
import { directoryDedupeKey } from "./directory-result.normalizer.js";

function uniq(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function observationsForConflict(field: string, current: unknown, incoming: unknown) {
  if (current === undefined || incoming === undefined || current === incoming) return [];
  return [{ field, values: uniq([String(current), String(incoming)]) }];
}

export function deduplicateDirectoryEntries(entries: DirectoryScanEntry[]) {
  const byKey = new Map<string, DirectoryScanEntry>();

  for (const entry of entries) {
    const key = directoryDedupeKey(entry);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...entry, sources: uniq(entry.sources) });
      continue;
    }

    const observations = [
      ...((existing.metadata.observations as unknown[]) ?? []),
      ...observationsForConflict("statusCode", existing.statusCode, entry.statusCode),
      ...observationsForConflict("contentLength", existing.contentLength, entry.contentLength),
      ...observationsForConflict("contentType", existing.contentType, entry.contentType),
      ...observationsForConflict("redirectLocation", existing.redirectLocation, entry.redirectLocation)
    ];

    existing.sources = uniq([...existing.sources, ...entry.sources]);
    existing.statusCode = existing.statusCode ?? entry.statusCode;
    existing.contentLength = entry.contentLength ?? existing.contentLength;
    existing.contentType = existing.contentType ?? entry.contentType;
    existing.redirectLocation = existing.redirectLocation ?? entry.redirectLocation;
    existing.depth = Math.min(existing.depth ?? entry.depth ?? 0, entry.depth ?? existing.depth ?? 0);
    existing.requiresAuthentication = existing.requiresAuthentication || entry.requiresAuthentication;
    existing.confidence = existing.sources.length > 1 ? "high" : existing.confidence;
    existing.metadata = {
      ...existing.metadata,
      observations,
      mergedRaw: [
        ...((existing.metadata.mergedRaw as unknown[]) ?? []),
        entry.metadata.raw ?? entry.metadata
      ]
    };
  }

  return [...byKey.values()].sort((a, b) => a.url.localeCompare(b.url));
}
