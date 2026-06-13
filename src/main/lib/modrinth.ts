import path from "path";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import crypto from "crypto";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";

import { isPathWithin, sanitizeDownloadFileName } from "./safety";

const MODRINTH_API_BASE = "https://api.modrinth.com/v2";
const META_DIR_NAME = ".catalyst";
const MANIFEST_NAME = "modrinth.json";
const MODRINTH_CACHE_TTL_MS = 5 * 60 * 1000;

export type ModrinthProjectType = "plugin" | "mod";

export type ModrinthSearchParams = {
  query: string;
  projectType: ModrinthProjectType;
  loader?: string;
  gameVersion?: string;
  limit?: number;
  offset?: number;
  sort?: "relevance" | "downloads" | "updated" | "newest";
};

export type ModrinthSearchHit = {
  projectId: string;
  slug: string;
  title: string;
  description: string;
  iconUrl?: string;
  categories?: string[];
  clientSide?: string;
  serverSide?: string;
  downloads: number;
  follows: number;
  author: string;
  dateModified: string;
};

export type ModrinthSearchResult = {
  hits: ModrinthSearchHit[];
  totalHits: number;
};

export type ModrinthInstallRequest = {
  projectId: string;
  projectType: ModrinthProjectType;
  loader?: string;
  gameVersion?: string;
  versionId?: string;
  title?: string;
  slug?: string;
  iconUrl?: string;
};

export type ModrinthVersionOption = {
  id: string;
  name: string;
  versionNumber: string;
  versionType: "release" | "beta" | "alpha";
  datePublished: string;
  loaders: string[];
  gameVersions: string[];
  fileName: string;
  fileSize?: number;
};

export type ModrinthInstallEntry = {
  projectId: string;
  versionId: string;
  fileName: string;
  title: string;
  slug?: string;
  iconUrl?: string;
  projectType: ModrinthProjectType;
  loader?: string;
  gameVersion?: string;
  installedAt: string;
};

export type ModrinthInstallResult = {
  success: boolean;
  entry?: ModrinthInstallEntry;
  error?: string;
};

export type ModrinthUpdateResult = {
  success: boolean;
  updated: boolean;
  entry?: ModrinthInstallEntry;
  error?: string;
};

export type ModrinthGalleryImage = {
  url: string;
  title?: string;
  description?: string;
  featured?: boolean;
};

export type ModrinthProjectDetails = {
  projectId: string;
  slug: string;
  title: string;
  description: string;
  body: string;
  iconUrl?: string;
  downloads: number;
  followers: number;
  clientSide?: string;
  serverSide?: string;
  categories?: string[];
  projectUrl?: string;
  sourceUrl?: string;
  issuesUrl?: string;
  wikiUrl?: string;
  gallery: ModrinthGalleryImage[];
};

type ModrinthVersionFile = {
  url: string;
  filename: string;
  primary?: boolean;
  size?: number;
  hashes?: {
    sha1?: string;
    sha512?: string;
  };
};

type ModrinthVersionDependency = {
  version_id?: string;
  project_id?: string;
  dependency_type: "required" | "optional" | "incompatible" | "embedded";
};

type ModrinthVersion = {
  id: string;
  name: string;
  version_number: string;
  version_type: "release" | "beta" | "alpha";
  date_published: string;
  loaders: string[];
  game_versions: string[];
  files: ModrinthVersionFile[];
  dependencies?: ModrinthVersionDependency[];
};

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const versionCache = new Map<string, CacheEntry<ModrinthVersion[]>>();
const versionRequests = new Map<string, Promise<ModrinthVersion[]>>();
const projectCache = new Map<string, CacheEntry<ModrinthProjectDetails>>();
const projectRequests = new Map<string, Promise<ModrinthProjectDetails>>();

function getCacheEntry<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCacheEntry<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T): void {
  cache.set(key, {
    expiresAt: Date.now() + MODRINTH_CACHE_TTL_MS,
    value,
  });
}

function buildVersionsUrl(projectId: string, loader?: string, gameVersion?: string): URL {
  const url = new URL(`${MODRINTH_API_BASE}/project/${projectId}/version`);
  if (loader) {
    url.searchParams.set("loaders", JSON.stringify([loader]));
  }
  if (gameVersion) {
    url.searchParams.set("game_versions", JSON.stringify([gameVersion]));
  }
  return url;
}

async function fetchModrinthVersions(
  projectId: string,
  loader?: string,
  gameVersion?: string
): Promise<ModrinthVersion[]> {
  const cacheKey = `${projectId}:${loader ?? "any"}:${gameVersion ?? "any"}`;
  const cached = getCacheEntry(versionCache, cacheKey);
  if (cached) return cached;

  const inFlight = versionRequests.get(cacheKey);
  if (inFlight) return inFlight;

  const request = fetch(buildVersionsUrl(projectId, loader, gameVersion).toString(), {
    headers: {
      "User-Agent": "Catalyst/1.0 (Modrinth API)",
    },
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Modrinth versions failed: ${res.status}`);
      }

      const versions = (await res.json()) as ModrinthVersion[];
      versions.sort((a, b) =>
        new Date(b.date_published).getTime() - new Date(a.date_published).getTime()
      );
      setCacheEntry(versionCache, cacheKey, versions);
      return versions;
    })
    .finally(() => {
      versionRequests.delete(cacheKey);
    });

  versionRequests.set(cacheKey, request);
  return request;
}

async function fetchModrinthProject(projectId: string): Promise<ModrinthProjectDetails> {
  const cached = getCacheEntry(projectCache, projectId);
  if (cached) return cached;

  const inFlight = projectRequests.get(projectId);
  if (inFlight) return inFlight;

  const request = fetch(`${MODRINTH_API_BASE}/project/${projectId}`, {
    headers: {
      "User-Agent": "Catalyst/1.0 (Modrinth API)",
    },
  })
    .then(async (projectRes) => {
      if (!projectRes.ok) {
        throw new Error(`Modrinth project failed: ${projectRes.status}`);
      }

      const project = (await projectRes.json()) as {
        slug: string;
        title: string;
        description: string;
        body: string;
        icon_url?: string;
        downloads: number;
        followers: number;
        client_side?: string;
        server_side?: string;
        categories?: string[];
        project_url?: string;
        source_url?: string;
        issues_url?: string;
        wiki_url?: string;
        gallery?: Array<{
          url: string;
          title?: string;
          description?: string;
          featured?: boolean;
        }>;
      };

      const gallery: ModrinthGalleryImage[] = (project.gallery || []).map((item) => ({
        url: item.url,
        title: item.title,
        description: item.description,
        featured: item.featured,
      }));

      const detail: ModrinthProjectDetails = {
        projectId,
        slug: project.slug,
        title: project.title,
        description: project.description,
        body: project.body,
        iconUrl: project.icon_url,
        downloads: project.downloads,
        followers: project.followers,
        clientSide: project.client_side,
        serverSide: project.server_side,
        categories: project.categories,
        projectUrl: project.project_url,
        sourceUrl: project.source_url,
        issuesUrl: project.issues_url,
        wikiUrl: project.wiki_url,
        gallery,
      };

      setCacheEntry(projectCache, projectId, detail);
      return detail;
    })
    .finally(() => {
      projectRequests.delete(projectId);
    });

  projectRequests.set(projectId, request);
  return request;
}

export async function listModrinthVersions(
  projectId: string,
  loader?: string,
  gameVersion?: string
): Promise<ModrinthVersionOption[]> {
  let versions = await fetchModrinthVersions(projectId, loader, gameVersion);
  if (versions.length === 0 && gameVersion) {
    versions = await fetchModrinthVersions(projectId, loader);
  }
  if (versions.length === 0 && loader) {
    versions = await fetchModrinthVersions(projectId, undefined, gameVersion);
  }
  if (versions.length === 0) {
    versions = await fetchModrinthVersions(projectId);
  }
  return versions.map((version) => {
    const file = version.files.find((f) => f.primary) ?? version.files[0];
    return {
      id: version.id,
      name: version.name,
      versionNumber: version.version_number,
      versionType: version.version_type,
      datePublished: version.date_published,
      loaders: version.loaders ?? [],
      gameVersions: version.game_versions ?? [],
      fileName: file?.filename ?? "No primary file",
      fileSize: file?.size,
    };
  });
}

function getManifestPath(serverPath: string): string {
  return path.join(serverPath, META_DIR_NAME, MANIFEST_NAME);
}

async function readManifest(serverPath: string): Promise<ModrinthInstallEntry[]> {
  const manifestPath = getManifestPath(serverPath);
  try {
    const content = await fs.readFile(manifestPath, "utf-8");
    return JSON.parse(content) as ModrinthInstallEntry[];
  } catch {
    return [];
  }
}

async function writeManifest(
  serverPath: string,
  entries: ModrinthInstallEntry[]
): Promise<void> {
  const manifestPath = getManifestPath(serverPath);
  const metaDir = path.dirname(manifestPath);
  await fs.mkdir(metaDir, { recursive: true });
  await fs.writeFile(manifestPath, JSON.stringify(entries, null, 2), "utf-8");
}

function getInstallFolder(projectType: ModrinthProjectType): string {
  return projectType === "plugin" ? "plugins" : "mods";
}

function getSafeInstallPath(installDir: string, fileName: string): { fileName: string; filePath: string } {
  const safeFileName = sanitizeDownloadFileName(fileName);
  const resolvedInstallDir = path.resolve(installDir);
  const filePath = path.join(resolvedInstallDir, safeFileName);
  if (!isPathWithin(filePath, resolvedInstallDir) || filePath === resolvedInstallDir) {
    throw new Error("Invalid install filename");
  }
  return { fileName: safeFileName, filePath };
}

function buildFacets(
  params: ModrinthSearchParams,
  options?: { includeLoader?: boolean; includeVersion?: boolean }
): string {
  const facets: string[][] = [];
  facets.push([`project_type:${params.projectType}`]);
  if (params.gameVersion && options?.includeVersion !== false) {
    facets.push([`versions:${params.gameVersion}`]);
  }
  if (params.loader && options?.includeLoader !== false) {
    facets.push([`categories:${params.loader}`]);
  }
  return JSON.stringify(facets);
}

export async function searchModrinthProjects(
  params: ModrinthSearchParams
): Promise<ModrinthSearchResult> {
  const trySearch = async (facets: string) => {
    const rawLimit = Number(params.limit ?? 20);
    const rawOffset = Number(params.offset ?? 0);
    const limit = Number.isFinite(rawLimit)
      ? Math.max(1, Math.min(100, Math.floor(rawLimit)))
      : 20;
    const offset = Number.isFinite(rawOffset)
      ? Math.max(0, Math.floor(rawOffset))
      : 0;
    const url = new URL(`${MODRINTH_API_BASE}/search`);
    url.searchParams.set("query", params.query || "");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("index", params.sort ?? "relevance");
    url.searchParams.set("facets", facets);

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "Catalyst/1.0 (Modrinth API)",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Modrinth search failed: ${res.status} ${body}`);
    }

    return (await res.json()) as {
    hits: Array<{
      project_id: string;
      slug: string;
      title: string;
      description: string;
      icon_url?: string;
      categories?: string[];
      client_side?: string;
      server_side?: string;
      downloads: number;
      follows: number;
      author: string;
      date_modified: string;
    }>;
      total_hits: number;
    };
  };

  let data: Awaited<ReturnType<typeof trySearch>>;

  try {
    data = await trySearch(buildFacets(params));
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("400")) {
      try {
        data = await trySearch(buildFacets(params, { includeLoader: false }));
      } catch (innerErr) {
        const innerMessage = innerErr instanceof Error ? innerErr.message : "";
        if (innerMessage.includes("400")) {
          data = await trySearch(
            buildFacets(params, { includeLoader: false, includeVersion: false })
          );
        } else {
          throw innerErr;
        }
      }
    } else {
      throw err;
    }
  }

  return {
    hits: data.hits.map((hit) => ({
      projectId: hit.project_id,
      slug: hit.slug,
      title: hit.title,
      description: hit.description,
      iconUrl: hit.icon_url,
      categories: hit.categories,
      clientSide: hit.client_side,
      serverSide: hit.server_side,
      downloads: hit.downloads,
      follows: hit.follows,
      author: hit.author,
      dateModified: hit.date_modified,
    })),
    totalHits: data.total_hits,
  };
}

export async function getModrinthProjectDetails(
  projectId: string
): Promise<ModrinthProjectDetails> {
  return fetchModrinthProject(projectId);
}

async function getLatestVersion(
  projectId: string,
  loader?: string,
  gameVersion?: string
): Promise<ModrinthVersion> {
  const versions = await fetchModrinthVersions(projectId, loader, gameVersion);
  if (versions.length === 0) {
    throw new Error("No compatible versions found");
  }

  return versions[0];
}

async function getVersionById(
  projectId: string,
  versionId: string,
  _loader?: string,
  _gameVersion?: string
): Promise<ModrinthVersion> {
  const versions = await fetchModrinthVersions(projectId);
  const version = versions.find((candidate) => candidate.id === versionId);
  if (!version) {
    throw new Error("Selected version was not found on Modrinth");
  }
  return version;
}

function verifyHash(actual: string, expected?: string): boolean {
  if (!expected) return true;
  const normalizedExpected = expected.trim().toLowerCase();
  if (!normalizedExpected) return true;
  return actual.toLowerCase() === normalizedExpected;
}

async function downloadFile(
  url: string,
  filePath: string,
  hashes?: ModrinthVersionFile["hashes"]
): Promise<void> {
  if (new URL(url).protocol !== "https:") {
    throw new Error("Downloads must use HTTPS");
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status}`);
  }
  if (!res.body) {
    throw new Error("Download response did not include a body");
  }

  const sha1 = hashes?.sha1 ? crypto.createHash("sha1") : null;
  const sha512 = hashes?.sha512 ? crypto.createHash("sha512") : null;
  const hashStream = new Transform({
    transform(chunk, _encoding, callback) {
      sha1?.update(chunk);
      sha512?.update(chunk);
      callback(null, chunk);
    },
  });

  try {
    await pipeline(
      Readable.fromWeb(res.body as any),
      hashStream,
      createWriteStream(filePath)
    );

    const sha1Ok = verifyHash(sha1?.digest("hex") ?? "", hashes?.sha1);
    const sha512Ok = verifyHash(sha512?.digest("hex") ?? "", hashes?.sha512);
    if (!sha1Ok || !sha512Ok) {
      await fs.rm(filePath, { force: true });
      throw new Error("Download integrity check failed");
    }
  } catch (err) {
    await fs.rm(filePath, { force: true }).catch(() => {});
    throw err;
  }
}

export async function listModrinthInstalls(
  serverPath: string,
  projectType: ModrinthProjectType
): Promise<ModrinthInstallEntry[]> {
  const entries = await readManifest(serverPath);
  const filtered: ModrinthInstallEntry[] = [];

  for (const entry of entries) {
    if (entry.projectType !== projectType) continue;
    try {
      const filePath = path.join(
        serverPath,
        getInstallFolder(entry.projectType),
        sanitizeDownloadFileName(entry.fileName)
      );
      await fs.stat(filePath);
      filtered.push(entry);
    } catch {
      // Skip missing file
    }
  }

  return filtered;
}

async function installVersionWithDependencies(
  serverPath: string,
  request: ModrinthInstallRequest,
  version: ModrinthVersion,
  entries: ModrinthInstallEntry[],
  visited: Set<string>
): Promise<ModrinthInstallEntry> {
  if (visited.has(request.projectId)) {
    const existing = entries.find((entry) => entry.projectId === request.projectId);
    if (existing) return existing;
    throw new Error(`Circular Modrinth dependency detected for ${request.projectId}`);
  }
  visited.add(request.projectId);

  const requiredDependencies = (version.dependencies ?? []).filter(
    (dependency) => dependency.dependency_type === "required" && dependency.project_id
  );

  for (const dependency of requiredDependencies) {
    const dependencyProjectId = dependency.project_id!;
    const alreadyInstalled = entries.some((entry) => entry.projectId === dependencyProjectId);
    if (alreadyInstalled) continue;

    const dependencyVersion = dependency.version_id
      ? await getVersionById(dependencyProjectId, dependency.version_id)
      : await getLatestVersion(dependencyProjectId, request.loader, request.gameVersion);
    const dependencyProject = await fetchModrinthProject(dependencyProjectId).catch(() => null);

    await installVersionWithDependencies(
      serverPath,
      {
        projectId: dependencyProjectId,
        projectType: request.projectType,
        loader: request.loader,
        gameVersion: request.gameVersion,
        versionId: dependency.version_id,
        title: dependencyProject?.title ?? dependencyProjectId,
        slug: dependencyProject?.slug,
        iconUrl: dependencyProject?.iconUrl,
      },
      dependencyVersion,
      entries,
      visited
    );
  }

  const file = version.files.find((f) => f.primary) ?? version.files[0];
  if (!file) {
    throw new Error("No downloadable file available");
  }

  const installDir = path.join(serverPath, getInstallFolder(request.projectType));
  await fs.mkdir(installDir, { recursive: true });

  const existing = entries.find((e) => e.projectId === request.projectId);
  if (existing) {
    const existingPath = getSafeInstallPath(installDir, existing.fileName).filePath;
    await fs.rm(existingPath, { force: true });
  }

  const target = getSafeInstallPath(installDir, file.filename);
  await downloadFile(file.url, target.filePath, file.hashes);

  const entry: ModrinthInstallEntry = {
    projectId: request.projectId,
    versionId: version.id,
    fileName: target.fileName,
    title: request.title ?? request.projectId,
    slug: request.slug,
    iconUrl: request.iconUrl,
    projectType: request.projectType,
    loader: request.loader,
    gameVersion: request.gameVersion,
    installedAt: new Date().toISOString(),
  };

  const existingIndex = entries.findIndex((e) => e.projectId === request.projectId);
  if (existingIndex >= 0) {
    entries[existingIndex] = entry;
  } else {
    entries.push(entry);
  }

  return entry;
}

export async function installModrinthProject(
  serverPath: string,
  request: ModrinthInstallRequest
): Promise<ModrinthInstallResult> {
  try {
    const version = request.versionId
      ? await getVersionById(request.projectId, request.versionId, request.loader, request.gameVersion)
      : await getLatestVersion(request.projectId, request.loader, request.gameVersion);
    const entries = await readManifest(serverPath);
    const entry = await installVersionWithDependencies(serverPath, request, version, entries, new Set());
    await writeManifest(serverPath, entries);

    return { success: true, entry };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}

export async function updateModrinthInstall(
  serverPath: string,
  request: ModrinthInstallRequest
): Promise<ModrinthUpdateResult> {
  try {
    const entries = await readManifest(serverPath);
    const existing = entries.find((e) => e.projectId === request.projectId);
    if (!existing) {
      return { success: false, updated: false, error: "Not installed" };
    }

    const version = await getLatestVersion(
      request.projectId,
      request.loader ?? existing.loader,
      request.gameVersion ?? existing.gameVersion
    );

    if (version.id === existing.versionId) {
      return { success: true, updated: false, entry: existing };
    }

    const entry = await installVersionWithDependencies(
      serverPath,
      { ...request, projectType: existing.projectType, title: existing.title, slug: existing.slug, iconUrl: existing.iconUrl },
      version,
      entries,
      new Set()
    );
    await writeManifest(serverPath, entries);

    return { success: true, updated: true, entry };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, updated: false, error: msg };
  }
}

export async function removeModrinthInstall(
  serverPath: string,
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const entries = await readManifest(serverPath);
    const entry = entries.find((e) => e.projectId === projectId);
    if (!entry) return { success: true };

    const installDir = path.join(serverPath, getInstallFolder(entry.projectType));
    const filePath = getSafeInstallPath(installDir, entry.fileName).filePath;
    await fs.rm(filePath, { force: true });

    const updated = entries.filter((e) => e.projectId !== projectId);
    await writeManifest(serverPath, updated);

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}
