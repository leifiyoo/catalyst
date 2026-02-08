import path from "path";
import fs from "fs/promises";

const MODRINTH_API_BASE = "https://api.modrinth.com/v2";
const META_DIR_NAME = ".catalyst";
const MANIFEST_NAME = "modrinth.json";

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
  title?: string;
  slug?: string;
  iconUrl?: string;
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
};

type ModrinthVersion = {
  id: string;
  name: string;
  version_number: string;
  date_published: string;
  files: ModrinthVersionFile[];
};

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
  const projectRes = await fetch(`${MODRINTH_API_BASE}/project/${projectId}`, {
    headers: {
      "User-Agent": "Catalyst/1.0 (Modrinth API)",
    },
  });
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

  return {
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
}

async function getLatestVersion(
  projectId: string,
  loader?: string,
  gameVersion?: string
): Promise<ModrinthVersion> {
  const url = new URL(`${MODRINTH_API_BASE}/project/${projectId}/version`);
  if (loader) {
    url.searchParams.set("loaders", JSON.stringify([loader]));
  }
  if (gameVersion) {
    url.searchParams.set("game_versions", JSON.stringify([gameVersion]));
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Modrinth versions failed: ${res.status}`);
  }

  const versions = (await res.json()) as ModrinthVersion[];
  if (versions.length === 0) {
    throw new Error("No compatible versions found");
  }

  versions.sort((a, b) =>
    new Date(b.date_published).getTime() - new Date(a.date_published).getTime()
  );
  return versions[0];
}

async function downloadFile(url: string, filePath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(filePath, buffer);
}

export async function listModrinthInstalls(
  serverPath: string,
  projectType: ModrinthProjectType
): Promise<ModrinthInstallEntry[]> {
  const entries = await readManifest(serverPath);
  const filtered: ModrinthInstallEntry[] = [];

  for (const entry of entries) {
    if (entry.projectType !== projectType) continue;
    const filePath = path.join(
      serverPath,
      getInstallFolder(entry.projectType),
      entry.fileName
    );
    try {
      await fs.stat(filePath);
      filtered.push(entry);
    } catch {
      // Skip missing file
    }
  }

  return filtered;
}

export async function installModrinthProject(
  serverPath: string,
  request: ModrinthInstallRequest
): Promise<ModrinthInstallResult> {
  try {
    const version = await getLatestVersion(
      request.projectId,
      request.loader,
      request.gameVersion
    );
    const file = version.files.find((f) => f.primary) ?? version.files[0];
    if (!file) {
      return { success: false, error: "No downloadable file available" };
    }

    const installDir = path.join(serverPath, getInstallFolder(request.projectType));
    await fs.mkdir(installDir, { recursive: true });

    const entries = await readManifest(serverPath);
    const existing = entries.find((e) => e.projectId === request.projectId);
    if (existing) {
      const existingPath = path.join(installDir, existing.fileName);
      await fs.rm(existingPath, { force: true });
    }

    const targetPath = path.join(installDir, file.filename);
    await downloadFile(file.url, targetPath);

    const entry: ModrinthInstallEntry = {
      projectId: request.projectId,
      versionId: version.id,
      fileName: file.filename,
      title: request.title ?? request.projectId,
      slug: request.slug,
      iconUrl: request.iconUrl,
      projectType: request.projectType,
      loader: request.loader,
      gameVersion: request.gameVersion,
      installedAt: new Date().toISOString(),
    };

    const updated = entries.filter((e) => e.projectId !== request.projectId);
    updated.push(entry);
    await writeManifest(serverPath, updated);

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

    const file = version.files.find((f) => f.primary) ?? version.files[0];
    if (!file) {
      return { success: false, updated: false, error: "No downloadable file available" };
    }

    const installDir = path.join(serverPath, getInstallFolder(existing.projectType));
    await fs.mkdir(installDir, { recursive: true });

    const existingPath = path.join(installDir, existing.fileName);
    await fs.rm(existingPath, { force: true });

    const targetPath = path.join(installDir, file.filename);
    await downloadFile(file.url, targetPath);

    const entry: ModrinthInstallEntry = {
      ...existing,
      versionId: version.id,
      fileName: file.filename,
      installedAt: new Date().toISOString(),
    };

    const updatedEntries = entries.map((e) =>
      e.projectId === request.projectId ? entry : e
    );
    await writeManifest(serverPath, updatedEntries);

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
    const filePath = path.join(installDir, entry.fileName);
    await fs.rm(filePath, { force: true });

    const updated = entries.filter((e) => e.projectId !== projectId);
    await writeManifest(serverPath, updated);

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}
