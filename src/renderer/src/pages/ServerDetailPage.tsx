import { useState, useEffect, useMemo, useCallback, useRef, type MutableRefObject, type ReactNode } from "react"
import { AnalyticsTab } from "@/components/AnalyticsTab"
import { ConsoleTab } from "@/components/ConsoleTab"
import { useParams, useNavigate, useSearchParams } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle, AlertAction } from "@/components/ui/alert"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Spinner } from "@/components/ui/spinner"
import { RadialGauge } from "@/components/ui/radial-gauge"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    ArrowLeft,
    Play,
    Square,
    FolderOpen,
    Archive,
    Trash2,
    RefreshCw,
    Clock,
    Send,
    Save,
    Plus,
    X,
    Info,
    CheckCircle2,
    Check,
    Users,
    Gauge,
    MemoryStick,
    File,
    Folder,
    ChevronRight,
    ChevronLeft,
    FileText,
    Download,
    Search,
    Globe,
    Heart,
    Box,
    ScrollText,
    Anvil,
    Layers,
    Leaf,
    Droplet,
    Wind,
    Zap,
    Link,
} from "lucide-react"
import type {
    ServerRecord,
    ServerProperty,
    ServerStats,
    FileEntry,
    ModrinthSearchHit,
    ModrinthInstallEntry,
    ModrinthProjectType,
    ModrinthProjectDetails,
    ModrinthVersionOption,
    ModrinthGalleryImage,
    BackupEntry,
    NgrokStatus,
} from "@shared/types"
import { useServerStore } from "@/stores/serverStore"

type ModrinthInstallTarget = {
    projectId: string
    slug?: string
    title: string
    description?: string
    iconUrl?: string
    downloads?: number
    follows?: number
    author?: string
    dateModified?: string
}

const SERVER_STATUS_STYLES: Record<ServerRecord["status"], string> = {
    Starting: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
    Online: "border-primary/30 bg-primary/10 text-primary",
    Stopping: "border-orange-500/30 bg-orange-500/10 text-orange-300",
    Offline: "text-muted-foreground",
    Idle: "text-muted-foreground",
}

const SERVER_STATUS_DOT: Record<ServerRecord["status"], string> = {
    Starting: "status-dot-starting",
    Online: "status-dot-online",
    Stopping: "status-dot-stopping",
    Offline: "status-dot-offline",
    Idle: "status-dot-idle",
}

const MODRINTH_LOADER_CATEGORIES = new Set([
    "fabric",
    "forge",
    "neoforge",
    "quilt",
    "paper",
    "spigot",
    "folia",
    "bukkit",
    "bungeecord",
    "velocity",
    "waterfall",
    "sponge",
    "purpur",
])

function isMarkdownBoundary(line: string) {
    const trimmed = line.trim()
    return (
        trimmed === "" ||
        trimmed.startsWith("#") ||
        trimmed.startsWith("```") ||
        trimmed.startsWith(">") ||
        /^[-*]\s+/.test(trimmed) ||
        /^\d+[.)]\s+/.test(trimmed) ||
        trimmed.startsWith("![") ||
        /^-{3,}$/.test(trimmed)
    )
}

function isSafeExternalUrl(url: string) {
    try {
        const protocol = new URL(url).protocol
        return protocol === "http:" || protocol === "https:"
    } catch {
        return false
    }
}

function isProbablyImageUrl(url: string) {
    try {
        const parsed = new URL(url)
        return (
            /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(parsed.pathname) ||
            parsed.hostname === "img.shields.io" ||
            parsed.hostname === "raw.githubusercontent.com" ||
            (parsed.hostname === "cdn.modrinth.com" && parsed.pathname.includes("/cached_images/"))
        )
    } catch {
        return false
    }
}

function parseMarkdownDestination(raw: string) {
    const cleaned = raw.trim().replace(/^<|>$/g, "")
    const nestedMarkdownLink = cleaned.match(/\[https?:\/\/[^\]]+]\((https?:\/\/[^\s)]+)\)?/)
    if (nestedMarkdownLink) return nestedMarkdownLink[1]
    const match = cleaned.match(/^(https?:\/\/\S+?)(?:\s+["'][^"']*["'])?$/)
    return match?.[1] ?? cleaned
}

function humanizeMarkdownLabel(label: string) {
    return label
        .replace(/\.(png|jpe?g|gif|webp|svg)$/i, "")
        .replace(/[-_]+/g, " ")
        .replace(/\bbadge\b/gi, "")
        .replace(/\s+/g, " ")
        .trim() || "Open link"
}

function MarkdownImage({
    src,
    alt,
    inline = false,
    width,
}: {
    src: string
    alt: string
    inline?: boolean
    width?: number
}) {
    const [failed, setFailed] = useState(!isProbablyImageUrl(src))
    const safeWidth = width && width >= 80 ? Math.min(width, inline ? 360 : 720) : undefined

    if (failed) {
        return (
            <a
                href={src}
                className="mx-1 inline-flex max-w-full items-center rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 align-middle text-[12px] font-medium leading-5 text-primary no-underline hover:bg-primary/15"
                onClick={(event) => {
                    event.preventDefault()
                    window.context?.openExternal?.(src)
                }}
            >
                {humanizeMarkdownLabel(alt)}
            </a>
        )
    }

    return (
        <img
            src={src}
            alt={alt}
            className={
                inline
                    ? "mx-1 my-1 inline-block max-h-28 max-w-full rounded border border-border/70 align-middle object-contain"
                    : "my-3 max-h-[520px] max-w-full rounded-lg border border-border object-contain"
            }
            style={safeWidth ? { width: safeWidth } : undefined}
            loading="lazy"
            onError={() => setFailed(true)}
        />
    )
}

function stripHtmlTags(value: string) {
    return value.replace(/<[^>]+>/g, "").trim()
}

function normalizeMarkdownBody(value: string) {
    return value
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
        .replace(/<\/?(p|div|section|center)[^>]*>/gi, "\n")
        .replace(/<a\b[^>]*href=(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi, (_match, a, b, c, label) => {
            const href = parseMarkdownDestination(a || b || c || "")
            const text = stripHtmlTags(label).replace(/\s+/g, " ") || "Open link"
            return isSafeExternalUrl(href) ? `[${text}](${href})` : text
        })
        .replace(/\[https?:\/\/[^\]]+]\((https?:\/\/[^\s)]+)\)?/g, "$1")
        .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, "**$2**")
        .replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, "*$2*")
        .replace(/<\/?(span|small)[^>]*>/gi, "")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, "\"")
        .replace(/&#39;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
}

type MarkdownInlineToken = {
    index: number
    end: number
    priority: number
    render: (key: string) => ReactNode
}

function findDelimitedToken(
    text: string,
    delimiter: string,
    start: number,
    priority: number,
    render: (content: string, index: number, key: string) => ReactNode
): MarkdownInlineToken | null {
    const index = text.indexOf(delimiter, start)
    if (index === -1) return null

    const contentStart = index + delimiter.length
    const end = text.indexOf(delimiter, contentStart)
    if (end === -1 || end === contentStart) return null

    return {
        index,
        end: end + delimiter.length,
        priority,
        render: (key) => render(text.slice(contentStart, end), index, key),
    }
}

function findMarkdownDestinationEnd(text: string, start: number) {
    let depth = 0
    for (let index = start; index < text.length; index += 1) {
        const char = text[index]
        if (char === "(") {
            depth += 1
        } else if (char === ")") {
            if (depth === 0) return index
            depth -= 1
        }
    }
    return -1
}

function findLinkToken(text: string, start: number): MarkdownInlineToken | null {
    const imageIndex = text.indexOf("![", start)
    const linkIndex = text.indexOf("[", start)
    const candidates = [imageIndex, linkIndex].filter((index) => index >= 0)
    if (candidates.length === 0) return null

    const index = Math.min(...candidates)
    const isImage = text.startsWith("![", index)
    const labelStart = index + (isImage ? 2 : 1)
    const labelEnd = text.indexOf("](", labelStart)
    if (labelEnd === -1) return null

    const urlStart = labelEnd + 2
    const urlEnd = findMarkdownDestinationEnd(text, urlStart)
    if (urlEnd === -1) return null

    const href = parseMarkdownDestination(text.slice(urlStart, urlEnd))
    if (!isSafeExternalUrl(href)) return null

    const label = text.slice(labelStart, labelEnd)
    return {
        index,
        end: urlEnd + 1,
        priority: 1,
        render: (key) =>
            isImage ? (
                <MarkdownImage
                    key={key}
                    src={href}
                    alt={label}
                    inline
                />
            ) : (
                <a
                    key={key}
                    href={href}
                    className="text-primary underline underline-offset-4 hover:text-primary/80"
                    onClick={(event) => {
                        event.preventDefault()
                        window.context?.openExternal?.(href)
                    }}
                >
                    {renderMarkdownInline(label, `${key}-label`)}
                </a>
            ),
    }
}

function findLinkedImageToken(text: string, start: number): MarkdownInlineToken | null {
    const index = text.indexOf("[![", start)
    if (index === -1) return null

    const altStart = index + 3
    const altEnd = text.indexOf("](", altStart)
    if (altEnd === -1) return null

    const srcStart = altEnd + 2
    const srcEnd = findMarkdownDestinationEnd(text, srcStart)
    if (srcEnd === -1 || text.slice(srcEnd + 1, srcEnd + 3) !== "](") return null

    const hrefStart = srcEnd + 3
    const hrefEnd = findMarkdownDestinationEnd(text, hrefStart)
    if (hrefEnd === -1) return null

    const alt = text.slice(altStart, altEnd)
    const src = parseMarkdownDestination(text.slice(srcStart, srcEnd))
    const href = parseMarkdownDestination(text.slice(hrefStart, hrefEnd))
    const safeHref = isSafeExternalUrl(href) ? href : undefined
    if (!isSafeExternalUrl(src)) return null

    return {
        index,
        end: hrefEnd + 1,
        priority: 1,
        render: (key) =>
            safeHref ? (
                <a
                    key={key}
                    href={safeHref}
                    className="inline-block align-middle"
                    onClick={(event) => {
                        event.preventDefault()
                        window.context?.openExternal?.(safeHref)
                    }}
                >
                    <MarkdownImage src={src} alt={alt} inline />
                </a>
            ) : (
                <MarkdownImage key={key} src={src} alt={alt} inline />
            ),
    }
}

function findHtmlImageToken(text: string, start: number): MarkdownInlineToken | null {
    const pattern = /<img\b[^>]*>/gi
    pattern.lastIndex = start
    const match = pattern.exec(text)
    if (!match) return null

    const tag = match[0]
    const src = tag.match(/\bsrc=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)?.slice(1).find(Boolean)
    if (!src || !isSafeExternalUrl(src)) return null

    const alt =
        tag.match(/\balt=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)?.slice(1).find((value) => value != null) ?? "Image"
    const widthValue = tag.match(/\bwidth=(?:"(\d+)"|'(\d+)'|(\d+))/i)?.slice(1).find(Boolean)
    const width = widthValue ? Number(widthValue) : undefined

    return {
        index: match.index,
        end: match.index + tag.length,
        priority: 1,
        render: (key) => <MarkdownImage key={key} src={src} alt={alt} inline width={width} />,
    }
}

function findBareUrlToken(text: string, start: number): MarkdownInlineToken | null {
    const urlPattern = /https?:\/\/[^\s<]+/g
    urlPattern.lastIndex = start
    const match = urlPattern.exec(text)
    if (!match) return null

    const href = match[0].replace(/[),.;:!?]+$/, "")
    if (!isSafeExternalUrl(href)) return null

    return {
        index: match.index,
        end: match.index + href.length,
        priority: 8,
        render: (key) => (
            <a
                key={key}
                href={href}
                className="text-primary underline underline-offset-4 hover:text-primary/80"
                onClick={(event) => {
                    event.preventDefault()
                    window.context?.openExternal?.(href)
                }}
            >
                {href}
            </a>
        ),
    }
}

function findNextInlineToken(text: string, start: number): MarkdownInlineToken | null {
    const candidates = [
        findLinkedImageToken(text, start),
        findLinkToken(text, start),
        findHtmlImageToken(text, start),
        findDelimitedToken(text, "`", start, 2, (content, _index, key) => (
            <code key={key} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] text-foreground">
                {content}
            </code>
        )),
        findDelimitedToken(text, "**", start, 3, (content, _index, key) => (
            <strong key={key} className="font-semibold text-foreground">
                {renderMarkdownInline(content, `${key}-strong`)}
            </strong>
        )),
        findDelimitedToken(text, "__", start, 4, (content, _index, key) => (
            <strong key={key} className="font-semibold text-foreground">
                {renderMarkdownInline(content, `${key}-strong`)}
            </strong>
        )),
        findDelimitedToken(text, "~~", start, 5, (content, _index, key) => (
            <del key={key} className="text-muted-foreground/70">
                {renderMarkdownInline(content, `${key}-del`)}
            </del>
        )),
        findDelimitedToken(text, "*", start, 6, (content, index, key) => {
            if (text[index - 1] === "*" || text[index + 1] === "*") return text.slice(index, index + content.length + 2)
            return (
                <em key={key} className="italic text-foreground/90">
                    {renderMarkdownInline(content, `${key}-em`)}
                </em>
            )
        }),
        findDelimitedToken(text, "_", start, 7, (content, index, key) => {
            if (text[index - 1] === "_" || text[index + 1] === "_") return text.slice(index, index + content.length + 2)
            return (
                <em key={key} className="italic text-foreground/90">
                    {renderMarkdownInline(content, `${key}-em`)}
                </em>
            )
        }),
        findBareUrlToken(text, start),
    ].filter((candidate): candidate is MarkdownInlineToken => Boolean(candidate))

    if (candidates.length === 0) return null
    let best = candidates[0]
    for (let index = 1; index < candidates.length; index += 1) {
        const candidate = candidates[index]
        if (
            candidate.index < best.index ||
            (candidate.index === best.index && candidate.priority < best.priority)
        ) {
            best = candidate
        }
    }
    return best
}

function renderMarkdownInline(text: string, keyPrefix = "inline"): ReactNode[] {
    const nodes: ReactNode[] = []
    let index = 0

    while (index < text.length) {
        const token = findNextInlineToken(text, index)
        if (!token) break
        if (token.index > index) nodes.push(text.slice(index, token.index))
        nodes.push(token.render(`${keyPrefix}-${token.index}`))
        index = token.end
    }

    if (index < text.length) nodes.push(text.slice(index))

    return nodes
}

function parseMarkdownTableRow(line: string) {
    return line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim())
}

function isMarkdownTableSeparator(line: string) {
    return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)
}

function ModrinthInlineMarkdown({ text }: { text: string }) {
    return <>{renderMarkdownInline(text)}</>
}

function ModrinthReadme({ body }: { body: string }) {
    const blocks = useMemo(() => {
    const lines = normalizeMarkdownBody(body).split(/\r?\n/)
    const blocks: ReactNode[] = []
    let index = 0

    while (index < lines.length) {
        const line = lines[index]
        const trimmed = line.trim()

        if (!trimmed) {
            index += 1
            continue
        }

        if (trimmed.startsWith("```")) {
            const code: string[] = []
            index += 1
            while (index < lines.length && !lines[index].trim().startsWith("```")) {
                code.push(lines[index])
                index += 1
            }
            index += 1
            blocks.push(
                <pre key={`code-${index}`} className="overflow-auto rounded-xl border border-border bg-background p-4 font-mono text-[12px] leading-relaxed text-muted-foreground">
                    <code>{code.join("\n")}</code>
                </pre>
            )
            continue
        }

        if (trimmed.startsWith("![")) {
            const image = trimmed.match(/^!\[([^\]]*)]\(([^)]+)\)$/)
            const src = image ? parseMarkdownDestination(image[2]) : ""
            blocks.push(
                <div key={`image-${index}`} className="overflow-hidden rounded-lg border border-border bg-muted/30 p-2">
                    {image && isSafeExternalUrl(src)
                        ? <MarkdownImage src={src} alt={image[1]} />
                        : renderMarkdownInline(trimmed, `image-${index}`)}
                </div>
            )
            index += 1
            continue
        }

        if (/^-{3,}$/.test(trimmed)) {
            blocks.push(<hr key={`rule-${index}`} className="border-border" />)
            index += 1
            continue
        }

        if (index + 1 < lines.length && trimmed.includes("|") && isMarkdownTableSeparator(lines[index + 1])) {
            const headers = parseMarkdownTableRow(trimmed)
            const rows: string[][] = []
            index += 2
            while (index < lines.length && lines[index].trim().includes("|") && lines[index].trim() !== "") {
                rows.push(parseMarkdownTableRow(lines[index]))
                index += 1
            }
            blocks.push(
                <div key={`table-${index}`} className="overflow-x-auto rounded-lg border border-border">
                    <table className="min-w-full text-left text-[13px] text-muted-foreground">
                        <thead className="bg-muted/50 text-foreground">
                            <tr>
                                {headers.map((header, headerIndex) => (
                                    <th key={`${header}-${headerIndex}`} className="border-b border-border px-3 py-2 font-medium">
                                        {renderMarkdownInline(header, `table-${index}-header-${headerIndex}`)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, rowIndex) => (
                                <tr key={`row-${rowIndex}`} className="border-b border-border last:border-0">
                                    {row.map((cell, cellIndex) => (
                                        <td key={`${rowIndex}-${cellIndex}`} className="px-3 py-2 align-top">
                                            {renderMarkdownInline(cell, `table-${index}-row-${rowIndex}-${cellIndex}`)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )
            continue
        }

        const heading = trimmed.match(/^(#{1,4})\s+(.+)$/)
        if (heading) {
            const level = heading[1].length
            const text = heading[2].replace(/\s+#$/, "")
            const HeadingTag = level <= 2 ? "h2" : "h3"
            blocks.push(
                <HeadingTag key={`heading-${index}`} className={level <= 2 ? "pt-2 text-xl font-semibold tracking-tight text-foreground" : "pt-1 text-base font-semibold text-foreground"}>
                    {renderMarkdownInline(text)}
                </HeadingTag>
            )
            index += 1
            continue
        }

        if (/^[-*]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed)) {
            const items: string[] = []
            const ordered = /^\d+[.)]\s+/.test(trimmed)
            const marker = ordered ? /^\d+[.)]\s+/ : /^[-*]\s+/
            while (index < lines.length && marker.test(lines[index].trim())) {
                items.push(lines[index].trim().replace(marker, "").replace(/^\[[ xX]]\s+/, ""))
                index += 1
            }
            const ListTag = ordered ? "ol" : "ul"
            blocks.push(
                <ListTag key={`list-${index}`} className="space-y-2 pl-5 text-[13.5px] leading-relaxed text-muted-foreground">
                    {items.map((item, itemIndex) => (
                        <li key={`${item}-${itemIndex}`} className={ordered ? "list-decimal marker:text-primary/70" : "list-disc marker:text-primary/70"}>
                            {renderMarkdownInline(item)}
                        </li>
                    ))}
                </ListTag>
            )
            continue
        }

        if (trimmed.startsWith(">")) {
            const quote: string[] = []
            while (index < lines.length && lines[index].trim().startsWith(">")) {
                quote.push(lines[index].trim().replace(/^>\s?/, ""))
                index += 1
            }
            blocks.push(
                <blockquote key={`quote-${index}`} className="rounded-xl border border-primary/20 border-l-primary bg-primary/5 px-4 py-3 text-[13.5px] leading-relaxed text-muted-foreground">
                    <ModrinthReadme body={quote.join("\n")} />
                </blockquote>
            )
            continue
        }

        const paragraph: string[] = [trimmed]
        index += 1
        while (index < lines.length && !isMarkdownBoundary(lines[index])) {
            paragraph.push(lines[index].trim())
            index += 1
        }
        blocks.push(
            <p key={`paragraph-${index}`} className="text-[13.5px] leading-7 text-muted-foreground">
                {renderMarkdownInline(paragraph.join(" "))}
            </p>
        )
    }
    return blocks
    }, [body])

    if (blocks.length === 0) {
        return <p className="text-sm text-muted-foreground">No description provided.</p>
    }

    return <div className="space-y-4">{blocks}</div>
}

type ModrinthProjectPreviewSource = {
    projectId: string
    slug?: string
    title?: string
    description?: string
    iconUrl?: string
    downloads?: number
    follows?: number
    categories?: string[]
    clientSide?: string
    serverSide?: string
}

function createModrinthDetailPreview(project: ModrinthProjectPreviewSource): ModrinthProjectDetails {
    return {
        projectId: project.projectId,
        slug: project.slug ?? project.projectId,
        title: project.title ?? "Modrinth Project",
        description: project.description ?? "",
        body: "",
        iconUrl: project.iconUrl,
        downloads: project.downloads ?? 0,
        followers: project.follows ?? 0,
        clientSide: project.clientSide,
        serverSide: project.serverSide,
        categories: project.categories,
        gallery: [],
    }
}

function getVersionChannelMeta(type: ModrinthVersionOption["versionType"]) {
    if (type === "release") {
        return {
            label: "Stable",
            className: "border-primary/30 bg-primary/10 text-primary",
        }
    }
    if (type === "beta") {
        return {
            label: "Beta",
            className: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
        }
    }
    return {
        label: "Alpha",
        className: "border-orange-500/30 bg-orange-500/10 text-orange-300",
    }
}

function formatVersionDate(value: string) {
    return new Date(value).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    })
}

function formatGameVersions(versions: string[]) {
    if (versions.length === 0) return "No Minecraft version listed"
    if (versions.length <= 4) return versions.join(", ")
    return `${versions.slice(0, 4).join(", ")} +${versions.length - 4}`
}

function useLazyRef<T>(factory: () => T): MutableRefObject<T> {
    const ref = useRef<T | null>(null)
    if (ref.current === null) {
        ref.current = factory()
    }
    return ref as MutableRefObject<T>
}

function supportsMinecraftVersion(version: ModrinthVersionOption, gameVersion: string) {
    return version.gameVersions.includes(gameVersion)
}

function pickRecommendedModrinthVersion(
    versions: ModrinthVersionOption[],
    gameVersion: string
) {
    return versions.find(
        (version) =>
            version.versionType === "release" &&
            supportsMinecraftVersion(version, gameVersion)
    )
}

function pickDefaultModrinthVersion(
    versions: ModrinthVersionOption[],
    gameVersion: string
) {
    return (
        pickRecommendedModrinthVersion(versions, gameVersion) ??
        versions.find((version) => supportsMinecraftVersion(version, gameVersion)) ??
        versions.find((version) => version.versionType === "release") ??
        versions[0]
    )
}

function ServerDetailSkeleton() {
    return (
        <section className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-8 py-8">
            <div className="h-5 w-28 rounded-md bg-muted/70" />
            <div className="flex items-center gap-5">
                <div className="h-16 w-16 rounded-xl border border-border bg-card" />
                <div className="space-y-3">
                    <div className="h-8 w-56 rounded-lg bg-muted/70" />
                    <div className="h-4 w-36 rounded-md bg-muted/60" />
                </div>
            </div>
            <div className="h-12 rounded-lg border border-border bg-card" />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="h-[460px] rounded-lg border border-border bg-card" />
                <div className="h-[300px] rounded-lg border border-border bg-card" />
            </div>
        </section>
    )
}

export function ServerDetailPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const shouldAutoStart = searchParams.get("start") === "true"
    const storeStats = useServerStore((state) => (id ? state.stats[id] : undefined))
    const storeServer = useServerStore((state) => state.servers.find((entry) => entry.id === id))
    const refreshServers = useServerStore((state) => state.refresh)
    const removeServerFromStore = useServerStore((state) => state.removeServer)

    const [server, setServer] = useState<ServerRecord | null>(() => storeServer ?? null)
    const [loading, setLoading] = useState(() => !storeServer)
    
    // File Context Menu & Actions
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: FileEntry } | null>(null)
    const [fileRenameDialogOpen, setFileRenameDialogOpen] = useState(false)
    const [fileDuplicateDialogOpen, setFileDuplicateDialogOpen] = useState(false)
    const [fileDeleteDialogOpen, setFileDeleteDialogOpen] = useState(false)
    const [fileActionInput, setFileActionInput] = useState("")
    const [targetEntry, setTargetEntry] = useState<FileEntry | null>(null)

    // Close context menu on click elsewhere
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener("click", handleClick);
        return () => window.removeEventListener("click", handleClick);
    }, []);

    // Properties state
    const [properties, setProperties] = useState<ServerProperty[]>([])
    const [, setPropsLoaded] = useState(false)
    const [propsSaving, setPropsSaving] = useState(false)
    const [propsSuccess, setPropsSuccess] = useState(false)
    const [propsFilter, setPropsFilter] = useState("")

    // Whitelist state
    const [whitelist, setWhitelist] = useState<string[]>([])
    const [whitelistInput, setWhitelistInput] = useState("")
    const [, setWhitelistLoaded] = useState(false)
    const [whitelistSaving, setWhitelistSaving] = useState(false)

    // Banlist state
    const [banlist, setBanlist] = useState<string[]>([])
    const [banlistInput, setBanlistInput] = useState("")
    const [, setBanlistLoaded] = useState(false)
    const [banlistSaving, setBanlistSaving] = useState(false)

    // Settings state
    const [ramOption, setRamOption] = useState("")
    const [customRamMB, setCustomRamMB] = useState("")
    const [javaPath, setJavaPath] = useState("")
    const [settingsSaving, setSettingsSaving] = useState(false)
    const [settingsSuccess, setSettingsSuccess] = useState(false)
    const [maxRamMB, setMaxRamMB] = useState(16384)

    // Stats state
    const [stats, setStats] = useState<ServerStats | null>(null)

    // EULA dialog state
    const [eulaDialogOpen, setEulaDialogOpen] = useState(false)

    // Ngrok dialog state
    const [ngrokDialogOpen, setNgrokDialogOpen] = useState(false)
    const [ngrokInstalling, setNgrokInstalling] = useState(false)
    const [ngrokInstallProgress, setNgrokInstallProgress] = useState(0)
    const [ngrokStatus, setNgrokStatus] = useState<NgrokStatus | null>(null)
    const [ngrokAuthtoken, setNgrokAuthtoken] = useState("")
    const [ngrokAuthtokenError, setNgrokAuthtokenError] = useState<string | null>(null)
    const [localIp, setLocalIp] = useState("localhost")
    const [ipCopied, setIpCopied] = useState(false)
    const [ngrokUrlCopied, setNgrokUrlCopied] = useState(false)

    // Delete dialog
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

    // Helper for tag colors and icons
    const getTagConfig = (tag: string) => {
        const lower = tag.toLowerCase()
        if (lower.includes("fabric")) return { color: "bg-stone-400/10 text-stone-500 dark:text-stone-400 border-stone-400/20 hover:bg-stone-400/15", icon: ScrollText }
        if (lower.includes("forge")) return { color: "bg-indigo-700/10 text-indigo-700 dark:text-indigo-400 border-indigo-700/20 hover:bg-indigo-700/15", icon: Anvil }
        if (lower.includes("neoforge")) return { color: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 hover:bg-orange-500/15", icon: Zap }
        if (lower.includes("quilt")) return { color: "bg-primary/10 text-primary border-primary/20 hover:bg-primary/15", icon: Layers }
        if (lower.includes("paper")) return { color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 hover:bg-blue-500/15", icon: Send }
        if (lower.includes("spigot")) return { color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/15", icon: Droplet }
        if (lower.includes("velocity")) return { color: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20 hover:bg-teal-500/15", icon: Wind }
        if (lower.includes("folia")) return { color: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 hover:bg-green-500/15", icon: Leaf }
        if (lower.includes("bukkit")) return { color: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 hover:bg-orange-500/15", icon: Box }
        if (lower.includes("bungeecord")) return { color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/15", icon: Layers }
        if (lower.includes("waterfall")) return { color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 hover:bg-blue-500/15", icon: Droplet }
        if (lower.includes("sponge")) return { color: "bg-lime-500/10 text-lime-600 dark:text-lime-400 border-lime-500/20 hover:bg-lime-500/15", icon: Square }
        if (lower.includes("purpur")) return { color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 hover:bg-purple-500/15", icon: Box }
        return { color: "bg-muted text-muted-foreground border-border hover:bg-muted/80", icon: Box }
    }

    // Files state
    const [files, setFiles] = useState<FileEntry[]>([])
    const [currentPath, setCurrentPath] = useState("")
    const [filesLoading, setFilesLoading] = useState(false)
    const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
    const [selectedFileMeta, setSelectedFileMeta] = useState<FileEntry | null>(null)
    const [fileContent, setFileContent] = useState("")
    const [fileLoading, setFileLoading] = useState(false)
    const [fileSaving, setFileSaving] = useState(false)
    const [fileError, setFileError] = useState<string | null>(null)
    const [fileDirty, setFileDirty] = useState(false)

    // Backup state
    const [backups, setBackups] = useState<BackupEntry[]>([])
    const [backupsLoading, setBackupsLoading] = useState(false)
    const [autoBackupEnabled, setAutoBackupEnabled] = useState(false)
    const [backupInterval, setBackupInterval] = useState("24")
    const [createBackupDialogOpen, setCreateBackupDialogOpen] = useState(false)
    const [newBackupName, setNewBackupName] = useState("")
    const [creatingBackup, setCreatingBackup] = useState(false)
    const [backupPercent, setBackupPercent] = useState(0)
    const [backupStage, setBackupStage] = useState<'idle' | 'calculating' | 'archiving' | 'complete'>('idle')
    const [backupFileCount, setBackupFileCount] = useState({ processed: 0, total: 0 })

    // Modrinth library state
    const [modrinthQuery, setModrinthQuery] = useState("")
    const [modrinthResults, setModrinthResults] = useState<ModrinthSearchHit[]>([])
    const [modrinthTotalHits, setModrinthTotalHits] = useState(0)
    const [modrinthSort, setModrinthSort] = useState<
        "relevance" | "downloads" | "updated" | "newest"
    >("relevance")
    const [modrinthPage, setModrinthPage] = useState(0)
    const [modrinthLoading, setModrinthLoading] = useState(false)
    const [modrinthError, setModrinthError] = useState<string | null>(null)
    const [modrinthInstalls, setModrinthInstalls] = useState<ModrinthInstallEntry[]>([])
    const [modrinthInstallsLoading, setModrinthInstallsLoading] = useState(false)
    const [modrinthInstalling, setModrinthInstalling] = useState<Record<string, boolean>>({})
    const [modrinthUpdating, setModrinthUpdating] = useState<Record<string, boolean>>({})
    const [modrinthRemoving, setModrinthRemoving] = useState<Record<string, boolean>>({})
    const [modrinthDetailOpen, setModrinthDetailOpen] = useState(false)
    const [modrinthDetailLoading, setModrinthDetailLoading] = useState(false)
    const [modrinthDetailError, setModrinthDetailError] = useState<string | null>(null)
    const [modrinthDetail, setModrinthDetail] = useState<ModrinthProjectDetails | null>(null)
    const [modrinthGalleryPreview, setModrinthGalleryPreview] = useState<ModrinthGalleryImage | null>(null)
    const [modrinthInstallOpen, setModrinthInstallOpen] = useState(false)
    const [modrinthInstallTarget, setModrinthInstallTarget] = useState<ModrinthInstallTarget | null>(null)
    const [modrinthVersions, setModrinthVersions] = useState<ModrinthVersionOption[]>([])
    const [modrinthVersionsLoading, setModrinthVersionsLoading] = useState(false)
    const [modrinthVersionsError, setModrinthVersionsError] = useState<string | null>(null)
    const [selectedModrinthVersionId, setSelectedModrinthVersionId] = useState<string>("")
    const [showModrinthAlternates, setShowModrinthAlternates] = useState(false)
    const modrinthDetailCacheRef = useLazyRef(() => new Map<string, ModrinthProjectDetails>())
    const modrinthDetailRequestsRef = useLazyRef(() => new Map<string, Promise<ModrinthProjectDetails>>())
    const modrinthVersionsCacheRef = useLazyRef(() => new Map<string, ModrinthVersionOption[]>())
    const modrinthVersionRequestsRef = useLazyRef(() => new Map<string, Promise<ModrinthVersionOption[]>>())
    const autoStartConsumedRef = useRef<string | null>(null)

    const [starting, setStarting] = useState(false)
    const [stopping, setStopping] = useState(false)
    const [restarting, setRestarting] = useState(false)
    const [exporting, setExporting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState("overview")
    
    // Disk usage state
    const [diskUsage, setDiskUsage] = useState<number | null>(null)
    const [diskUsageLoading, setDiskUsageLoading] = useState(false)

    // Track all auto-clearing timeouts so they can be cleaned up on unmount
    const timersRef = useLazyRef(() => new Set<ReturnType<typeof setTimeout>>())
    useEffect(() => {
        return () => {
            timersRef.current.forEach((t) => clearTimeout(t))
            timersRef.current.clear()
        }
    }, [])
    const safeTimeout = useCallback((fn: () => void, ms: number) => {
        const t = setTimeout(() => {
            timersRef.current.delete(t)
            fn()
        }, ms)
        timersRef.current.add(t)
        return t
    }, [])

    const currentStatus = storeServer?.status ?? server?.status ?? "Offline"
    const isStarting = currentStatus === "Starting"
    const isOnline = currentStatus === "Online"
    const isStopping = currentStatus === "Stopping"
    const canStart = currentStatus === "Offline" || currentStatus === "Idle"
    const modrinthContext = useMemo(() => {
        if (!server) return null
        if (["Paper", "Purpur"].includes(server.framework)) {
            return { projectType: "plugin" as ModrinthProjectType, loader: "paper", label: "Plugins" }
        }
        if (server.framework === "Fabric") {
            return { projectType: "mod" as ModrinthProjectType, loader: "fabric", label: "Mods" }
        }
        if (server.framework === "Forge") {
            return { projectType: "mod" as ModrinthProjectType, loader: "forge", label: "Mods" }
        }
        return null
    }, [server])

    const installedProjectIds = useMemo(() => {
        return new Set(modrinthInstalls.map((entry) => entry.projectId))
    }, [modrinthInstalls])

    const getModrinthDetail = useCallback((projectId: string) => {
        const cached = modrinthDetailCacheRef.current.get(projectId)
        if (cached) return Promise.resolve(cached)

        const inFlight = modrinthDetailRequestsRef.current.get(projectId)
        if (inFlight) return inFlight

        const request = window.context.getModrinthProject(projectId).then((detail) => {
            modrinthDetailCacheRef.current.set(projectId, detail)
            modrinthDetailRequestsRef.current.delete(projectId)
            return detail
        }).catch((err) => {
            modrinthDetailRequestsRef.current.delete(projectId)
            throw err
        })
        modrinthDetailRequestsRef.current.set(projectId, request)
        return request
    }, [])

    const getModrinthVersionsCacheKey = useCallback((projectId: string) => {
        return `${projectId}:${modrinthContext?.loader ?? "any"}:${server?.version ?? "any"}`
    }, [modrinthContext?.loader, server?.version])

    const getModrinthVersionOptions = useCallback((projectId: string) => {
        if (!modrinthContext || !server) return Promise.resolve([])
        const key = getModrinthVersionsCacheKey(projectId)
        const cached = modrinthVersionsCacheRef.current.get(key)
        if (cached) return Promise.resolve(cached)

        const inFlight = modrinthVersionRequestsRef.current.get(key)
        if (inFlight) return inFlight

        const request = window.context.listModrinthVersions(
            projectId,
            modrinthContext.loader,
            server.version
        ).then((versions) => {
            modrinthVersionsCacheRef.current.set(key, versions)
            modrinthVersionRequestsRef.current.delete(key)
            return versions
        }).catch((err) => {
            modrinthVersionRequestsRef.current.delete(key)
            throw err
        })
        modrinthVersionRequestsRef.current.set(key, request)
        return request
    }, [getModrinthVersionsCacheKey, modrinthContext, server])

    const handlePrefetchModrinthDetails = useCallback((projectId: string) => {
        if (!projectId || modrinthDetailCacheRef.current.has(projectId) || modrinthDetailRequestsRef.current.has(projectId)) return
        void getModrinthDetail(projectId).catch(() => undefined)
    }, [getModrinthDetail])

    const handlePrefetchModrinthVersions = useCallback((projectId: string) => {
        if (!projectId || !modrinthContext || !server) return
        const key = getModrinthVersionsCacheKey(projectId)
        if (modrinthVersionsCacheRef.current.has(key) || modrinthVersionRequestsRef.current.has(key)) return
        void getModrinthVersionOptions(projectId).catch(() => undefined)
    }, [getModrinthVersionOptions, getModrinthVersionsCacheKey, modrinthContext, server])


    // Load server
    useEffect(() => {
        if (storeServer) {
            setServer(storeServer)
            setLoading(false)
        } else if (id) {
            setServer(null)
            setLoading(true)
        }
    }, [id, storeServer])

    useEffect(() => {
        if (!id) return
        refreshServers()
        window.context.getServer(id).then((s) => {
            setServer(s)
            setLoading(false)
            if (s) {
                const ram = s.ramMB
                const presets = [2048, 4096, 6144, 8192, 12288, 16384]
                if (presets.includes(ram)) {
                    setRamOption(String(ram))
                } else {
                    setRamOption("custom")
                    setCustomRamMB(String(ram))
                }
                setJavaPath(s.javaPath || "")

                // Backups
                if (s.backupConfig) {
                    setAutoBackupEnabled(s.backupConfig.enabled)
                    setBackupInterval(s.backupConfig.intervalHours.toString())
                }
                
                // Load server properties to get the port
                window.context.getServerProperties(id).then((props) => {
                    setProperties(props)
                    setPropsLoaded(true)
                })
            }
        }).catch(() => {
            setServer(null)
            setLoading(false)
        })
    }, [id, refreshServers])

    // Load system info for RAM limits
    useEffect(() => {
        window.context.getSystemInfo().then((info) => {
            setMaxRamMB(info.maxRamMB)
        })
    }, [])

    // Load disk usage
    useEffect(() => {
        if (!id) return
        const timer = setTimeout(() => {
            setDiskUsageLoading(true)
            window.context.getServerDiskUsage(id).then((result) => {
                if (result.success && result.bytes !== undefined) {
                    setDiskUsage(result.bytes)
                }
                setDiskUsageLoading(false)
            })
        }, 900)
        return () => clearTimeout(timer)
    }, [id])

    // Server status subscriber
    useEffect(() => {
        if (!id) return
        const unsubscribe = window.context.onServerStatus((update) => {
            if (update.serverId === id) {
                setServer((prev) => {
                    if (!prev) return prev
                    return {
                        ...prev,
                        status: update.status,
                        players: update.players || prev.players,
                    }
                })
            }
        })
        return unsubscribe
    }, [id])

    // Backup progress subscriber - Now receives detailed progress updates
    useEffect(() => {
        if (!id) return
        const unsubscribe = window.context.onBackupProgress(({ serverId, percent, stage, processedFiles, totalFiles }) => {
            if (serverId === id) {
                if (percent < 0) {
                    // Error state
                    setBackupPercent(-1);
                    setCreatingBackup(false);
                    setBackupStage('idle');
                    setError("Backup failed");
                } else {
                    setBackupPercent(percent);
                    setCreatingBackup(true);
                    if (stage) {
                        setBackupStage(stage as 'idle' | 'calculating' | 'archiving' | 'complete');
                    }
                    if (processedFiles !== undefined && totalFiles !== undefined) {
                        setBackupFileCount({ processed: processedFiles, total: totalFiles });
                    }
                }
            }
        })
        return unsubscribe
    }, [id])

    // Backup completion subscriber
    useEffect(() => {
        if (!id) return
        let backupDoneTimer: ReturnType<typeof setTimeout> | null = null
        const unsubscribe = window.context.onBackupCompleted(({ serverId }) => {
            if (serverId === id) {
                // Backup completed - refresh the list after a short delay
                backupDoneTimer = setTimeout(() => {
                    setCreatingBackup(false);
                    setBackupPercent(0);
                    setBackupStage('idle');
                    setBackupFileCount({ processed: 0, total: 0 });
                    loadBackups();
                }, 1000);
            }
        })
        return () => {
            unsubscribe()
            if (backupDoneTimer) clearTimeout(backupDoneTimer)
        }
    }, [id])

    // Stats subscriber
    useEffect(() => {
        if (!id) return
        const unsubscribe = window.context.onServerStats((s) => {
            if (s.serverId === id) {
                setStats(s)
            }
        })
        return unsubscribe
    }, [id])

    // Reset stats when server goes offline
    useEffect(() => {
        if (!isOnline) setStats(null)
    }, [isOnline])

    // Get local IP on mount
    useEffect(() => {
        window.context.getLocalIp().then(setLocalIp).catch(() => setLocalIp("localhost"))
    }, [])

    // Ngrok URL change subscriber
    useEffect(() => {
        if (!id) return
        const unsubscribe = window.context.onNgrokUrlChanged((info) => {
            if (info.serverId === id) {
                setServer((prev) => prev ? { ...prev, ngrokUrl: info.publicUrl } : prev)
                setNgrokStatus((prev) => prev ? { ...prev, tunnelActive: true, publicUrl: info.publicUrl } : prev)
                // Persist ngrok URL to server record
                window.context.updateServerSettings(id, { ngrokUrl: info.publicUrl })
            }
        })
        return unsubscribe
    }, [id])

    // Ngrok install progress subscriber
    useEffect(() => {
        const unsubscribe = window.context.onNgrokInstallProgress((data) => {
            setNgrokInstallProgress(data.percent)
        })
        return unsubscribe
    }, [])

    // Get ngrok status when server changes
    useEffect(() => {
        if (id) {
            window.context.getNgrokStatus(id).then(setNgrokStatus)
        }
    }, [id])

    const handleStart = async () => {
        if (!id || !server) return
        // Check if EULA needs to be accepted (new servers or servers where it hasn't been accepted)
        // Treat eulaAccepted === undefined as true for backward compatibility with existing servers
        if (server.eulaAccepted === false) {
            setEulaDialogOpen(true)
            return
        }
        // Check if ngrok is enabled globally (not just per-server setting)
        const ngrokEnabled = await window.context.isNgrokEnabled()
        const hasToken = await window.context.isNgrokAuthtokenConfigured()
        
        // Auto-start ngrok if enabled globally and has token
        if (ngrokEnabled && hasToken) {
            await doStartServer(true)
        } else {
            await doStartServer(false)
        }
    }

    const doStartServer = async (withNgrok = false) => {
        if (!id) return
        setStarting(true)
        setError(null)
        setServer((prev) => prev ? { ...prev, status: "Starting" } : prev)
        const result = await window.context.startServer(id)
        if (!result.success) {
            setError(result.error || "Failed to start server")
            setServer((prev) => prev ? { ...prev, status: "Offline" } : prev)
        } else if (withNgrok) {
            // Start ngrok tunnel after server starts
            const port = properties.find(p => p.key === "server-port")?.value || "25565"
            const ngrokResult = await window.context.startNgrok(id, parseInt(port, 10))
            if (!ngrokResult.success) {
                setError(ngrokResult.error || "Failed to start ngrok tunnel")
            }
        }
        setStarting(false)
    }

    useEffect(() => {
        if (!shouldAutoStart || !id || !server || loading) return
        if (autoStartConsumedRef.current === id) return
        autoStartConsumedRef.current = id
        navigate(`/servers/${id}`, { replace: true })
        void handleStart()
    }, [shouldAutoStart, id, server, loading])

    const handleAcceptEula = async () => {
        if (!id) return
        setEulaDialogOpen(false)
        const result = await window.context.acceptEula(id)
        if (result.success) {
            setServer((prev) => prev ? { ...prev, eulaAccepted: true } : prev)
            
            // Check if ngrok is enabled globally and if we have a saved token
            const ngrokEnabled = await window.context.isNgrokEnabled()
            const hasToken = await window.context.isNgrokAuthtokenConfigured()
            
            if (ngrokEnabled && hasToken) {
                // We have a saved token, use it directly and start server with ngrok
                await doStartServer(true)
            } else {
                // First-time start: ask about ngrok after accepting the EULA
                setNgrokDialogOpen(true)
            }
        } else {
            setError(result.error || "Failed to accept EULA")
        }
    }

    const handleEnableNgrok = async () => {
        if (!id) return
        
        // Validate authtoken
        if (!ngrokAuthtoken.trim()) {
            setNgrokAuthtokenError("Authtoken is required")
            return
        }
        
        setNgrokAuthtokenError(null)
        setNgrokInstallProgress(-2) // Indicate validating phase
        
        // Validate the authtoken first
        const validationResult = await window.context.validateNgrokAuthtoken(ngrokAuthtoken.trim())
        if (!validationResult.valid) {
            setNgrokAuthtokenError(validationResult.error || "Invalid authtoken")
            setNgrokInstallProgress(0)
            return
        }
        
        setNgrokDialogOpen(false)
        setNgrokInstalling(true)
        setNgrokInstallProgress(0)
        
        // Install ngrok
        const installResult = await window.context.installNgrok()
        if (!installResult.success) {
            setError(installResult.error || "Failed to install ngrok")
            setNgrokInstalling(false)
            // Start server without ngrok
            await doStartServer(false)
            return
        }
        
        // Configure authtoken
        setNgrokInstallProgress(-1) // Indicate configuring phase
        const authResult = await window.context.configureNgrokAuthtoken(ngrokAuthtoken.trim())
        if (!authResult.success) {
            setError(authResult.error || "Failed to configure ngrok authtoken")
            setNgrokInstalling(false)
            // Start server without ngrok
            await doStartServer(false)
            return
        }
        
        setNgrokInstalling(false)
        
        // Update server settings to use ngrok
        await window.context.updateServerSettings(id, {
            ramMB: server?.ramMB,
            javaPath: server?.javaPath,
            backupConfig: server?.backupConfig,
            useNgrok: true
        })
        
        // Update local state
        setServer((prev) => prev ? { ...prev, useNgrok: true } : prev)
        
        // Start server with ngrok
        await doStartServer(true)
    }

    const handleSkipNgrok = async () => {
        setNgrokDialogOpen(false)
        await doStartServer(false)
    }

    const handleCopyIP = async () => {
        const port = properties.find(p => p.key === "server-port")?.value || "25565"
        const address = `${localIp}:${port}`
        await navigator.clipboard.writeText(address)
        setIpCopied(true)
        safeTimeout(() => setIpCopied(false), 2000)
    }

    const handleCopyNgrokUrl = async () => {
        const url = server?.ngrokUrl || ngrokStatus?.publicUrl
        if (url) {
            await navigator.clipboard.writeText(url)
            setNgrokUrlCopied(true)
            safeTimeout(() => setNgrokUrlCopied(false), 2000)
        }
    }

    const handleStop = async () => {
        if (!id) return
        setStopping(true)
        setError(null)
        setStats(null)
        setServer((prev) => prev ? { ...prev, status: "Stopping", players: "0/20" } : prev)
        const result = await window.context.stopServer(id)
        if (!result.success) {
            setError(result.error || "Failed to stop server")
            await refreshServers()
        } else {
            setServer((prev) => prev ? { ...prev, status: "Offline", players: "0/20" } : prev)
            await refreshServers()
        }
        setStopping(false)
    }

    const handleRestart = async () => {
        if (!id) return
        setRestarting(true)
        setError(null)
        
        // Backend handles ngrok checking and starting internally
        const result = await window.context.restartServer(id)
        if (!result.success) {
            setError(result.error || "Failed to restart server")
            await refreshServers()
        }
        setRestarting(false)
    }

    const handleExport = async () => {
        if (!id) return
        setExporting(true)
        setError(null)
        const result = await window.context.exportServer(id)
        if (!result.success && result.error !== "Export cancelled") {
            setError(result.error || "Failed to export server")
        }
        setExporting(false)
    }

    const handleLoadProperties = async () => {
        if (!id) return
        const props = await window.context.getServerProperties(id)
        setProperties(props)
        setPropsLoaded(true)
    }

    const handleSaveProperties = async () => {
        if (!id) return
        setPropsSaving(true)
        const result = await window.context.saveServerProperties(id, properties)
        setPropsSaving(false)
        if (result.success) {
            setPropsSuccess(true)
            safeTimeout(() => setPropsSuccess(false), 3000)
        }
    }

    const handleLoadWhitelist = async () => {
        if (!id) return
        const wl = await window.context.getWhitelist(id)
        setWhitelist(wl)
        setWhitelistLoaded(true)
    }

    const handleLoadBanlist = async () => {
        if (!id) return
        const bl = await window.context.getBanlist(id)
        setBanlist(bl)
        setBanlistLoaded(true)
    }

    const onContextMenu = (e: React.MouseEvent, entry: FileEntry) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, entry });
    };

    const handleRenameClick = () => {
        if (!contextMenu) return;
        setTargetEntry(contextMenu.entry);
        setFileActionInput(contextMenu.entry.name);
        setFileRenameDialogOpen(true);
    };

    const handleDuplicateClick = () => {
         if (!contextMenu) return;
        setTargetEntry(contextMenu.entry);
        const nameParts = contextMenu.entry.name.split(".");
        let newName = contextMenu.entry.name + "_copy";
        if (nameParts.length > 1) {
             const ext = nameParts.pop();
             newName = nameParts.join(".") + "_copy." + ext;
        }
        setFileActionInput(newName);
        setFileDuplicateDialogOpen(true);
    }

    const handleDeleteClick = () => {
         if (!contextMenu) return;
        setTargetEntry(contextMenu.entry);
        setFileDeleteDialogOpen(true);
    }

    const confirmRename = async () => {
        if (!id || !targetEntry) return;
        const relativePath = currentPath ? `${currentPath}/${targetEntry.name}` : targetEntry.name;
        await window.context.renameServerFile(id, relativePath, fileActionInput);
        handleLoadFiles(currentPath);
        setFileRenameDialogOpen(false);
    }

    const confirmDuplicate = async () => {
        if (!id || !targetEntry) return;
        const relativePath = currentPath ? `${currentPath}/${targetEntry.name}` : targetEntry.name;
        await window.context.copyServerFile(id, relativePath, fileActionInput);
        handleLoadFiles(currentPath);
        setFileDuplicateDialogOpen(false);
    }

    const confirmDelete = async () => {
         if (!id || !targetEntry) return;
        const relativePath = currentPath ? `${currentPath}/${targetEntry.name}` : targetEntry.name;
        await window.context.deleteServerFile(id, relativePath);
        handleLoadFiles(currentPath);
        setFileDeleteDialogOpen(false);
    }

    const handleLoadFiles = async (relativePath = "") => {
        if (!id) return
        setFilesLoading(true)
        const entries = await window.context.listServerFiles(id, relativePath)
        setFiles(entries)
        setCurrentPath(relativePath)
        setFilesLoading(false)
    }

    const handleNavigateFile = (entry: FileEntry) => {
        if (entry.isDirectory) {
            const newPath = currentPath ? `${currentPath}/${entry.name}` : entry.name
            handleLoadFiles(newPath)
            return
        }

        const filePath = currentPath ? `${currentPath}/${entry.name}` : entry.name
        handleOpenFile(filePath, entry)
    }

    const handleNavigateUp = () => {
        const parts = currentPath.split("/").filter(Boolean)
        parts.pop()
        handleLoadFiles(parts.join("/"))
    }

    const ALLOWED_EXTENSIONS = [
        ".txt", ".json", ".yml", ".yaml", ".properties", ".log", ".md", ".toml", ".sh", ".bat", ".xml", ".ini", ".cfg", ".conf"
    ];

    const handleOpenFile = async (filePath: string, entry?: FileEntry) => {
        if (!id) return

        const ext = filePath.substring(filePath.lastIndexOf(".")).toLowerCase();
        const isText = ALLOWED_EXTENSIONS.includes(ext) || !filePath.includes("."); // Allowed known extensions or no extension (often config files)
        
        // Explicitly block binaries
        const BLOCKED_EXTENSIONS = [".jar", ".zip", ".exe", ".dat", ".lock", ".gz", ".tar"];
        if (BLOCKED_EXTENSIONS.includes(ext)) {
            setFileError("Cannot open binary files in the editor.");
            return;
        }

        if (!isText && !confirm("This file type might not be text. Open anyway?")) {
            return;
        }

        setFileError(null)
        setFileLoading(true)
        const result = await window.context.readServerFile(id, filePath)
        setFileLoading(false)
        if (!result.success) {
            setFileError(result.error || "Unable to read file")
            return
        }
        setSelectedFilePath(filePath)
        setSelectedFileMeta(entry || null)
        setFileContent(result.content ?? "")
        setFileDirty(false)
    }

    const handleSaveFile = async () => {
        if (!id || !selectedFilePath) return
        setFileSaving(true)
        const result = await window.context.writeServerFile(id, selectedFilePath, fileContent)
        setFileSaving(false)
        if (!result.success) {
            setFileError(result.error || "Unable to save file")
            return
        }
        setFileDirty(false)
        await handleLoadFiles(currentPath)
    }

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return "—"
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    const pathSegments = currentPath.split("/").filter(Boolean)

    const handleSaveWhitelist = async () => {
        if (!id) return
        setWhitelistSaving(true)
        const result = await window.context.saveWhitelist(id, whitelist)
        setWhitelistSaving(false)
        if (!result.success) {
            setError(result.error || "Failed to save whitelist")
            return
        }
        if (isOnline) {
            window.context.sendCommand(id, "whitelist reload")
        }
    }

    const handleSaveBanlist = async () => {
        if (!id) return
        setBanlistSaving(true)
        const result = await window.context.saveBanlist(id, banlist)
        setBanlistSaving(false)
        if (!result.success) {
            setError(result.error || "Failed to save banlist")
            return
        }
        if (isOnline) {
            window.context.sendCommand(id, "banlist reload")
        }
    }

    const loadModrinthInstalls = useCallback(async () => {
        if (!id || !modrinthContext) return
        setModrinthInstallsLoading(true)
        try {
            const installs = await window.context.listModrinthInstalls(
                id,
                modrinthContext.projectType
            )
            setModrinthInstalls(installs)
        } finally {
            setModrinthInstallsLoading(false)
        }
    }, [id, modrinthContext])

    // Load Modrinth installs for this server
    useEffect(() => {
        if (!id || !modrinthContext) return
        loadModrinthInstalls()
    }, [id, modrinthContext, loadModrinthInstalls])

    const handleSearchModrinth = useCallback(async (pageOverride?: number) => {
        if (!modrinthContext || !server) return
        const page = pageOverride ?? modrinthPage
        if (pageOverride != null) {
            setModrinthPage(pageOverride)
        }
        setModrinthLoading(true)
        setModrinthError(null)
        try {
            const result = await window.context.searchModrinth({
                query: modrinthQuery.trim(),
                projectType: modrinthContext.projectType,
                loader: modrinthContext.loader,
                gameVersion: server.version,
                limit: 20,
                offset: page * 20,
                sort: modrinthSort,
            })
            setModrinthResults(result.hits)
            setModrinthTotalHits(result.totalHits)
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Search failed"
            setModrinthError(msg)
        } finally {
            setModrinthLoading(false)
        }
    }, [modrinthContext, modrinthQuery, modrinthPage, modrinthSort, server])

    // Automatically load Modrinth results when tab is opened/context is available
    useEffect(() => {
        if (activeTab === "library" && modrinthContext && modrinthResults.length === 0 && !modrinthLoading && modrinthQuery === "") {
            handleSearchModrinth(0)
        }
    }, [activeTab, modrinthContext, modrinthResults.length, modrinthLoading, modrinthQuery, handleSearchModrinth])

    const performInstallModrinth = async (target: ModrinthInstallTarget, versionId: string) => {
        if (!id || !modrinthContext || !server) return
        setModrinthInstalling((prev) => ({ ...prev, [target.projectId]: true }))
        const result = await window.context.installModrinthProject(id, {
            projectId: target.projectId,
            projectType: modrinthContext.projectType,
            loader: modrinthContext.loader,
            gameVersion: server.version,
            versionId,
            title: target.title,
            slug: target.slug,
            iconUrl: target.iconUrl,
        })
        setModrinthInstalling((prev) => ({ ...prev, [target.projectId]: false }))
        if (!result.success) {
            setError(result.error || "Failed to install")
            return
        }
        setModrinthInstallOpen(false)
        setModrinthInstallTarget(null)
        await loadModrinthInstalls()
    }

    const handleOpenModrinthInstall = async (target: ModrinthInstallTarget) => {
        if (!modrinthContext || !server) return
        if (!target.projectId) {
            setError("Modrinth project is missing an id.")
            return
        }
        setModrinthDetailOpen(false)
        setModrinthInstallTarget(target)
        setModrinthInstallOpen(true)
        setModrinthVersions([])
        setSelectedModrinthVersionId("")
        setShowModrinthAlternates(false)
        setModrinthVersionsError(null)
        const cacheKey = getModrinthVersionsCacheKey(target.projectId)
        const cachedVersions = modrinthVersionsCacheRef.current.get(cacheKey)
        if (cachedVersions) {
            const defaultVersion = pickDefaultModrinthVersion(cachedVersions, server.version)
            setModrinthVersions(cachedVersions)
            setSelectedModrinthVersionId(defaultVersion?.id ?? "")
            setModrinthVersionsLoading(false)
            if (cachedVersions.length === 0) {
                setModrinthVersionsError("No builds were returned by Modrinth for this project.")
            }
            return
        }
        setModrinthVersionsLoading(true)
        try {
            const versions = await getModrinthVersionOptions(target.projectId)
            const defaultVersion = pickDefaultModrinthVersion(versions, server.version)
            setModrinthVersions(versions)
            setSelectedModrinthVersionId(defaultVersion?.id ?? "")
            if (versions.length === 0) {
                setModrinthVersionsError("No builds were returned by Modrinth for this project.")
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to load versions"
            setModrinthVersionsError(msg)
        } finally {
            setModrinthVersionsLoading(false)
        }
    }

    const handleConfirmModrinthInstall = async () => {
        if (!modrinthInstallTarget || !selectedModrinthVersionId) return
        await performInstallModrinth(modrinthInstallTarget, selectedModrinthVersionId)
    }

    const handleUpdateModrinth = async (entry: ModrinthInstallEntry) => {
        if (!id || !modrinthContext || !server) return
        setModrinthUpdating((prev) => ({ ...prev, [entry.projectId]: true }))
        const result = await window.context.updateModrinthInstall(id, {
            projectId: entry.projectId,
            projectType: entry.projectType,
            loader: entry.loader ?? modrinthContext.loader,
            gameVersion: entry.gameVersion ?? server.version,
            title: entry.title,
            slug: entry.slug,
        })
        setModrinthUpdating((prev) => ({ ...prev, [entry.projectId]: false }))
        if (!result.success) {
            setError(result.error || "Failed to update")
            return
        }
        await loadModrinthInstalls()
    }

    const handleRemoveModrinth = async (entry: ModrinthInstallEntry) => {
        if (!id) return
        setModrinthRemoving((prev) => ({ ...prev, [entry.projectId]: true }))
        const result = await window.context.removeModrinthInstall(id, entry.projectId)
        setModrinthRemoving((prev) => ({ ...prev, [entry.projectId]: false }))
        if (!result.success) {
            setError(result.error || "Failed to remove")
            return
        }
        await loadModrinthInstalls()
    }

    const handleOpenModrinthDetails = async (project: ModrinthProjectPreviewSource) => {
        if (!project.projectId) {
            setError("Modrinth project is missing an id.")
            return
        }
        setModrinthDetailOpen(true)
        setModrinthDetailError(null)
        const cached = modrinthDetailCacheRef.current.get(project.projectId)
        if (cached) {
            setModrinthDetail(cached)
            setModrinthDetailLoading(false)
            return
        }
        setModrinthDetail(createModrinthDetailPreview(project))
        setModrinthDetailLoading(true)
        try {
            const detail = await getModrinthDetail(project.projectId)
            setModrinthDetail(detail)
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to load details"
            setModrinthDetailError(msg)
        } finally {
            setModrinthDetailLoading(false)
        }
    }

    const handleSaveSettings = async () => {
        if (!id) return
        const effectiveRam =
            ramOption === "custom"
                ? parseInt(customRamMB, 10) || 0
                : parseInt(ramOption, 10)
        if (effectiveRam < 512) return

        setSettingsSaving(true)
        const result = await window.context.updateServerSettings(id, {
            ramMB: effectiveRam,
            javaPath: javaPath.trim() || undefined,
            backupConfig: {
                enabled: autoBackupEnabled,
                intervalHours: parseInt(backupInterval),
                lastBackupAt: server?.backupConfig?.lastBackupAt
            }
        })
        setSettingsSaving(false)
        if (result.success) {
            setServer((prev) =>
                prev ? { 
                    ...prev, 
                    ramMB: effectiveRam, 
                    javaPath: javaPath.trim() || undefined,
                    backupConfig: {
                        enabled: autoBackupEnabled,
                        intervalHours: parseInt(backupInterval),
                        lastBackupAt: server?.backupConfig?.lastBackupAt
                    }
                } : prev
            )
            setSettingsSuccess(true)
            safeTimeout(() => setSettingsSuccess(false), 3000)
        }
    }

    const loadBackups = async () => {
        if (!id) return
        setBackupsLoading(true)
        const data = await window.context.getBackups(id)
        setBackups(data)
        setBackupsLoading(false)
    }

    const handleCreateBackup = async () => {
        if (!id) return
        window.context.logToMain("handleCreateBackup:start", { id, name: newBackupName })
        setCreatingBackup(true)
        setBackupPercent(0)
        setBackupStage('calculating')
        setBackupFileCount({ processed: 0, total: 0 })
        setCreateBackupDialogOpen(false) // Close dialog to show progress on main button
        
        const backupName = newBackupName.trim() || undefined
        setNewBackupName("")

        try {
            // Fire and forget - backup runs in worker thread
            const result = await window.context.createBackup(id, backupName)
            if (!result.success) {
                window.context.logToMain("handleCreateBackup:error", { id, error: result.error })
                setError(result.error || "Failed to create backup")
                setCreatingBackup(false)
                setBackupStage('idle')
            } else if (result.started) {
                window.context.logToMain("handleCreateBackup:started", { id })
                // UI updates now come from onBackupProgress and onBackupCompleted events
            }
        } catch (err) {
            window.context.logToMain("handleCreateBackup:exception", { id, error: String(err) })
            setError("Failed to initiate backup")
            setCreatingBackup(false)
            setBackupStage('idle')
        }
        // Note: We don't setCreatingBackup(false) here anymore -
        // that happens when we receive the completion event
    }

    const handleCancelBackup = async () => {
        if (!id) return
        try {
            const result = await window.context.cancelBackup(id)
            if (result.success) {
                window.context.logToMain("handleCancelBackup:success", { id })
                setCreatingBackup(false)
                setBackupPercent(0)
                setBackupStage('idle')
                setBackupFileCount({ processed: 0, total: 0 })
            }
        } catch (err) {
            window.context.logToMain("handleCancelBackup:error", { id, error: String(err) })
        }
    }

    const handleDeleteBackup = async (filename: string) => {
        if (!id) return
        const result = await window.context.deleteBackup(id, filename)
        if (result.success) {
            loadBackups()
        } else {
             setError(result.error || "Failed to delete backup")
        }
    }

    const handleRestoreBackup = async (filename: string) => {
        if (!id) return
        const result = await window.context.restoreBackup(id, filename)
        if (result.success) {
            // maybe refresh file list?
             setSettingsSuccess(true)
             safeTimeout(() => setSettingsSuccess(false), 3000)
        } else {
             setError(result.error || "Failed to restore backup")
        }
    }

    const handleDeleteServer = async () => {
        if (!id) return
        const result = await window.context.deleteServer(id)
        if (!result.success) {
            setError(result.error || "Failed to delete server")
            return
        }
        removeServerFromStore(id)
        navigate("/servers")
    }

    const formatRam = (ramMB: number) => {
        if (ramMB >= 1024 && ramMB % 1024 === 0) return `${ramMB / 1024} GB`
        if (ramMB >= 1024) return `${(ramMB / 1024).toFixed(1)} GB`
        return `${ramMB} MB`
    }

    const formatBytes = (bytes: number) => {
        if (bytes >= 1073741824) { // GB
            const gb = bytes / 1073741824
            return gb % 1 === 0 ? `${gb} GB` : `${gb.toFixed(2)} GB`
        }
        if (bytes >= 1048576) { // MB
            const mb = bytes / 1048576
            return mb % 1 === 0 ? `${mb} MB` : `${mb.toFixed(1)} MB`
        }
        if (bytes >= 1024) { // KB
            return `${(bytes / 1024).toFixed(1)} KB`
        }
        return `${bytes} B`
    }

    const filteredProperties = useMemo(() => {
        const needle = propsFilter.trim().toLowerCase()
        const visible: Array<{ prop: ServerProperty; index: number }> = []
        properties.forEach((prop, index) => {
            if (prop.comment) return
            if (needle && !prop.key.toLowerCase().includes(needle)) return
            visible.push({ prop, index })
        })
        return visible
    }, [properties, propsFilter])

    const liveStats = storeStats ?? stats ?? null
    const memoryMax = liveStats?.memoryMaxMB ?? server?.ramMB ?? null
    const memoryUsed = liveStats?.memoryUsedMB ?? null
    const memoryPercent =
        memoryUsed != null && memoryMax
            ? Math.min(100, Math.max(0, Math.round((memoryUsed / memoryMax) * 100)))
            : null
    const recommendedModrinthVersion = useMemo(
        () => (server ? pickRecommendedModrinthVersion(modrinthVersions, server.version) : undefined),
        [modrinthVersions, server]
    )
    const selectedModrinthVersion = useMemo(
        () => modrinthVersions.find((version) => version.id === selectedModrinthVersionId),
        [modrinthVersions, selectedModrinthVersionId]
    )
    const otherModrinthVersions = useMemo(
        () =>
            modrinthVersions.filter(
                (version) => version.id !== recommendedModrinthVersion?.id
            ),
        [modrinthVersions, recommendedModrinthVersion]
    )
    const hasMinecraftVersionBuild = useMemo(
        () =>
            server
                ? modrinthVersions.some((version) =>
                    supportsMinecraftVersion(version, server.version)
                )
                : false,
        [modrinthVersions, server]
    )
    const installVersionWarning = server && modrinthVersions.length > 0
        ? !hasMinecraftVersionBuild
            ? `No build lists Minecraft ${server.version}. You can still install another build, but it may not work on this server.`
            : !recommendedModrinthVersion
                ? `No stable build lists Minecraft ${server.version}. Choose one of the non-stable builds below if you still want to continue.`
                : selectedModrinthVersion && selectedModrinthVersion.id !== recommendedModrinthVersion.id
                    ? `Selected build is ${getVersionChannelMeta(selectedModrinthVersion.versionType).label.toLowerCase()} or not the recommended stable release.`
                    : null
        : null

    if (loading) {
        return <ServerDetailSkeleton />
    }

    if (!server) {
        return (
            <section className="flex flex-1 flex-col items-center justify-center gap-4">
                <p className="text-muted-foreground">Server not found</p>
                <Button variant="ghost" onClick={() => navigate("/servers")}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to servers
                </Button>
            </section>
        )
    }

    return (
        <section className="mx-auto flex w-full max-w-[1200px] flex-col gap-0 pb-10">
            {/* Header */}
            <header className="px-8 pt-6 pb-5">
                {/* Back link */}
                <button
                    onClick={() => navigate("/servers")}
                    className="mb-4 inline-flex items-center gap-1.5 self-start text-[13px] font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    All servers
                </button>

                {/* Server title row */}
                <div className="flex items-start gap-5">
                    {/* Server icon */}
                    <div className="h-16 w-16 rounded-xl bg-muted/60 border border-border flex items-center justify-center shrink-0 overflow-hidden">
                        <Box className="h-8 w-8 text-muted-foreground" />
                    </div>

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-4">
                            <h1 className="text-2xl font-bold tracking-tight">{server.name}</h1>
                            <div className="flex items-center gap-2 shrink-0">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => id && window.context.openServerFolder(id)}
                                >
                                    <FolderOpen className="h-4 w-4 mr-1" />
                                    Open folder
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleExport}
                                    disabled={exporting}
                                >
                                    {exporting ? <Spinner className="h-4 w-4 mr-1" /> : <Download className="h-4 w-4 mr-1" />}
                                    {exporting ? "Exporting..." : "Export"}
                                </Button>
                                {isOnline ? (
                                    <>
                                        <Button variant="outline" size="sm" onClick={handleRestart} disabled={restarting}>
                                            {restarting ? <Spinner className="mr-1.5 h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                                            {restarting ? "Restarting..." : "Restart"}
                                        </Button>
                                        <Button variant="destructive" size="sm" onClick={handleStop} disabled={stopping}>
                                            {stopping ? <Spinner className="mr-1.5 h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5 mr-1.5" />}
                                            {stopping ? "Stopping..." : "Stop"}
                                        </Button>
                                    </>
                                ) : isStarting ? (
                                    <Button variant="outline" size="sm" disabled>
                                        <Spinner className="mr-1.5 h-3.5 w-3.5" />
                                        Starting...
                                    </Button>
                                ) : isStopping ? (
                                    <Button variant="outline" size="sm" disabled>
                                        <Spinner className="mr-1.5 h-3.5 w-3.5" />
                                        Stopping...
                                    </Button>
                                ) : (
                                    <Button className="bg-primary text-primary-foreground hover:bg-primary/90" size="sm" onClick={handleStart} disabled={starting || !canStart}>
                                        {starting ? <Spinner className="mr-1.5 h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
                                        {starting ? "Starting..." : "Start"}
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge variant="outline" className="gap-1.5 font-normal text-muted-foreground">
                                <Box className="h-3 w-3" />
                                Minecraft {server.version}
                            </Badge>
                            <Badge variant="outline" className="gap-1.5 font-normal text-muted-foreground">
                                <Layers className="h-3 w-3" />
                                {server.framework} {server.version}
                            </Badge>
                            <Badge
                                variant="outline"
                                className="gap-1.5 font-normal text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                                onClick={handleCopyIP}
                            >
                                <Globe className="h-3 w-3" />
                                {ipCopied ? "Copied!" : `${localIp}:${properties.find(p => p.key === "server-port")?.value || "25565"}`}
                            </Badge>
                            {isOnline && (server.ngrokUrl || ngrokStatus?.publicUrl) && (
                                <Badge
                                    variant="outline"
                                    className="gap-1.5 font-normal text-primary cursor-pointer hover:text-primary/80 transition-colors border-primary/30"
                                    onClick={handleCopyNgrokUrl}
                                >
                                    <Link className="h-3 w-3" />
                                    {ngrokUrlCopied ? "Copied!" : (server.ngrokUrl || ngrokStatus?.publicUrl)}
                                </Badge>
                            )}
                            <Badge
                                variant="outline"
                                className={`gap-1.5 font-medium ${SERVER_STATUS_STYLES[currentStatus]}`}
                            >
                                <span className={`status-dot !h-1.5 !w-1.5 ${SERVER_STATUS_DOT[currentStatus]}`} />
                                {currentStatus === "Idle" ? "Offline" : currentStatus}
                            </Badge>
                        </div>
                    </div>
                </div>
            </header>

            {error && (
                <div className="px-8">
                    <Alert variant="destructive">
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                </div>
            )}

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
                <div className="px-8 border-b border-border">
                    <TabsList>
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="library">Content</TabsTrigger>
                        <TabsTrigger value="files" onClick={() => handleLoadFiles(currentPath)}>Files</TabsTrigger>
                        <TabsTrigger value="settings" onClick={loadBackups}>Settings</TabsTrigger>
                        <TabsTrigger value="properties" onClick={() => { handleLoadProperties(); handleLoadWhitelist(); handleLoadBanlist(); }}>Properties</TabsTrigger>
                        <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    </TabsList>
                </div>

                {/* Overview Tab */}
                <TabsContent value="overview" className="mt-0 px-8 pt-6">
                    {/* Stats cards */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        {/* Players card */}
                        <Card className="overflow-hidden">
                            <CardContent className="p-6">
                                <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                                    <Users className="h-3.5 w-3.5" />
                                    Players online
                                </p>
                                <div className="mt-2.5 flex items-baseline gap-1.5">
                                    <span className={`font-data text-[32px] font-medium leading-none tracking-tight ${isOnline && liveStats && liveStats.playerCount > 0 ? "text-primary" : "text-foreground"}`}>
                                        {isOnline ? (liveStats ? liveStats.playerCount : 0) : "—"}
                                    </span>
                                    <span className="font-data text-sm text-muted-foreground">
                                        / {isOnline && liveStats ? liveStats.maxPlayers : "20"}
                                    </span>
                                </div>
                                <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-muted">
                                    <div
                                        className="h-full rounded-full bg-primary transition-all duration-500"
                                        style={{ width: isOnline && liveStats ? `${Math.min(100, (liveStats.playerCount / liveStats.maxPlayers) * 100)}%` : "0%" }}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Memory card — segmented gauge */}
                        <Card className="overflow-hidden">
                            <CardContent className="flex items-center justify-between gap-3 p-6">
                                <div className="min-w-0">
                                    <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                                        <MemoryStick className="h-3.5 w-3.5" />
                                        Memory usage
                                    </p>
                                    <div className={`mt-2.5 font-data text-[32px] font-medium leading-none tracking-tight ${isOnline && memoryPercent != null && memoryPercent > 85 ? "text-destructive" : isOnline && memoryPercent != null ? "text-primary" : "text-foreground"}`}>
                                        {isOnline && memoryPercent != null ? `${memoryPercent}%` : "—"}
                                    </div>
                                    <p className="mt-2.5 truncate font-data text-[12px] text-muted-foreground">
                                        {isOnline && memoryUsed != null
                                            ? `${memoryUsed} MB process / ${memoryMax ?? "?"} MB heap`
                                            : `${formatRam(server.ramMB)} heap limit`}
                                    </p>
                                </div>
                                <RadialGauge
                                    value={isOnline && memoryPercent != null ? memoryPercent : 0}
                                    display=""
                                    size={86}
                                    segments={20}
                                    className="shrink-0"
                                />
                            </CardContent>
                        </Card>

                        {/* Storage card */}
                        <Card className="overflow-hidden">
                            <CardContent className="p-6">
                                <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                                    <Archive className="h-3.5 w-3.5" />
                                    Storage usage
                                </p>
                                <div className="mt-2.5 font-data text-[32px] font-medium leading-none tracking-tight text-foreground">
                                    {diskUsage !== null ? formatBytes(diskUsage) : diskUsageLoading ? "..." : "—"}
                                </div>
                                <p className="mt-2.5 font-data text-[12px] text-muted-foreground">on disk</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Console — isolated component with its own state */}
                    <ConsoleTab serverId={id || ""} isOnline={isOnline} />
                </TabsContent>

                {/* Properties Tab */}
                <TabsContent value="properties" className="mt-0 px-8 pt-6">
                    <Card>
                        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <CardTitle>Server Properties</CardTitle>
                                <CardDescription>
                                    Fine-tune server.properties values
                                </CardDescription>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <Input
                                    value={propsFilter}
                                    onChange={(e) => setPropsFilter(e.target.value)}
                                    placeholder="Search properties"
                                    className="h-9 w-full sm:w-[220px]"
                                />
                                <Button
                                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                                    onClick={handleSaveProperties}
                                    disabled={propsSaving}
                                >
                                    {propsSaving ? (
                                        <Spinner className="mr-2" />
                                    ) : (
                                        <Save className="h-4 w-4 mr-1" />
                                    )}
                                    Save
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {propsSuccess && (
                                <Alert className="mb-4 border-primary/30 bg-primary/10">
                                    <CheckCircle2 className="h-4 w-4 text-primary" />
                                    <AlertTitle className="text-primary">
                                        Saved
                                    </AlertTitle>
                                    <AlertDescription className="text-muted-foreground">
                                        Restart the server for changes to take
                                        effect.
                                    </AlertDescription>
                                </Alert>
                            )}
                            {properties.length === 0 ? (
                                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                    <Info className="h-4 w-4" />
                                    <span>
                                        No server.properties file found. Start
                                        the server once to generate it.
                                    </span>
                                </div>
                            ) : (
                                <div>
                                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 text-[12px] text-muted-foreground">
                                        <span>Property</span>
                                        <span>Value</span>
                                    </div>
                                    <div className="mt-3 flex flex-col gap-2 max-h-[400px] overflow-auto">
                                        {filteredProperties.map(({ prop, index }) => (
                                            <div
                                                key={`${prop.key}-${index}`}
                                                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 items-center rounded-xl border border-border bg-muted/50 px-3 py-2"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <FileText className="h-3 w-3 text-primary" />
                                                    <span className="text-xs text-muted-foreground font-mono truncate">
                                                        {prop.key}
                                                    </span>
                                                </div>
                                                <Input
                                                    value={prop.value}
                                                    onChange={(e) => {
                                                        const updated = [...properties]
                                                        updated[index] = {
                                                            ...updated[index],
                                                            value: e.target.value,
                                                        }
                                                        setProperties(updated)
                                                    }}
                                                    className="text-xs font-mono h-8"
                                                />
                                            </div>
                                        ))}
                                        {filteredProperties.length === 0 && (
                                            <p className="text-xs text-muted-foreground">No properties match that search.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Players Tab */}
                <TabsContent value="players" className="mt-0 px-8 pt-6">
                    <div className="grid grid-cols-2 gap-4">
                        {/* Whitelist */}
                        <Card>
                            <CardHeader className="flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-base">
                                        Whitelist
                                    </CardTitle>
                                    <CardDescription>
                                        {whitelist.length} player
                                        {whitelist.length !== 1 ? "s" : ""}
                                    </CardDescription>
                                </div>
                                <Button
                                    size="sm"
                                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                                    onClick={handleSaveWhitelist}
                                    disabled={whitelistSaving}
                                >
                                    {whitelistSaving ? (
                                        <Spinner className="mr-1" />
                                    ) : (
                                        <Save className="h-3 w-3 mr-1" />
                                    )}
                                    Save
                                </Button>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3">
                                <div className="flex gap-2">
                                    <Input
                                        value={whitelistInput}
                                        onChange={(e) =>
                                            setWhitelistInput(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                            if (
                                                e.key === "Enter" &&
                                                whitelistInput.trim()
                                            ) {
                                                setWhitelist((prev) => [
                                                    ...prev,
                                                    whitelistInput.trim(),
                                                ])
                                                setWhitelistInput("")
                                            }
                                        }}
                                        placeholder="Player name"
                                        className="text-xs h-8"
                                    />
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                            if (whitelistInput.trim()) {
                                                setWhitelist((prev) => [
                                                    ...prev,
                                                    whitelistInput.trim(),
                                                ])
                                                setWhitelistInput("")
                                            }
                                        }}
                                    >
                                        <Plus className="h-3 w-3" />
                                    </Button>
                                </div>
                                <div className="flex flex-col gap-1 max-h-[250px] overflow-auto">
                                    {whitelist.map((player, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center justify-between rounded-lg bg-muted/50 border border-border px-3 py-1.5 text-xs"
                                        >
                                            <span>{player}</span>
                                            <button
                                                className="text-muted-foreground/60 hover:text-rose-400 transition"
                                                onClick={() =>
                                                    setWhitelist((prev) =>
                                                        prev.filter(
                                                            (_, j) => j !== i
                                                        )
                                                    )
                                                }
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                    {whitelist.length === 0 && (
                                        <p className="text-xs text-muted-foreground">
                                            No players whitelisted
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Banlist */}
                        <Card>
                            <CardHeader className="flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-base">
                                        Banlist
                                    </CardTitle>
                                    <CardDescription>
                                        {banlist.length} player
                                        {banlist.length !== 1 ? "s" : ""}
                                    </CardDescription>
                                </div>
                                <Button
                                    size="sm"
                                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                                    onClick={handleSaveBanlist}
                                    disabled={banlistSaving}
                                >
                                    {banlistSaving ? (
                                        <Spinner className="mr-1" />
                                    ) : (
                                        <Save className="h-3 w-3 mr-1" />
                                    )}
                                    Save
                                </Button>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3">
                                <div className="flex gap-2">
                                    <Input
                                        value={banlistInput}
                                        onChange={(e) =>
                                            setBanlistInput(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                            if (
                                                e.key === "Enter" &&
                                                banlistInput.trim()
                                            ) {
                                                setBanlist((prev) => [
                                                    ...prev,
                                                    banlistInput.trim(),
                                                ])
                                                setBanlistInput("")
                                            }
                                        }}
                                        placeholder="Player name"
                                        className="text-xs h-8"
                                    />
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                            if (banlistInput.trim()) {
                                                setBanlist((prev) => [
                                                    ...prev,
                                                    banlistInput.trim(),
                                                ])
                                                setBanlistInput("")
                                            }
                                        }}
                                    >
                                        <Plus className="h-3 w-3" />
                                    </Button>
                                </div>
                                <div className="flex flex-col gap-1 max-h-[250px] overflow-auto">
                                    {banlist.map((player, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center justify-between rounded-lg bg-muted/50 border border-border px-3 py-1.5 text-xs"
                                        >
                                            <span>{player}</span>
                                            <button
                                                className="text-muted-foreground/60 hover:text-rose-400 transition"
                                                onClick={() =>
                                                    setBanlist((prev) =>
                                                        prev.filter(
                                                            (_, j) => j !== i
                                                        )
                                                    )
                                                }
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                    {banlist.length === 0 && (
                                        <p className="text-xs text-muted-foreground">
                                            No players banned
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Library Tab */}
                <TabsContent value="library" className="mt-0 px-8 pt-6">
                    {!modrinthContext ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>Modrinth Library</CardTitle>
                                <CardDescription>
                                    This server type does not support Modrinth
                                    plugins or mods.
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    ) : (
                        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
                            <Card className="overflow-hidden">
                                <CardHeader className="border-b border-border bg-card">
                                    <div>
                                        <CardTitle>Browse</CardTitle>
                                        <CardDescription>
                                            {modrinthContext.label} for Minecraft {server?.version}
                                        </CardDescription>
                                    </div>
                                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                                        <Input
                                            value={modrinthQuery}
                                            onChange={(e) => {
                                                setModrinthQuery(e.target.value)
                                                setModrinthPage(0)
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    handleSearchModrinth(0)
                                                }
                                            }}
                                            placeholder="Name or keyword"
                                            className="h-9 w-full sm:flex-1"
                                        />
                                        <Select value={modrinthSort} onValueChange={(value) => {
                                            setModrinthSort(value as typeof modrinthSort)
                                            setModrinthPage(0)
                                        }}>
                                            <SelectTrigger className="h-9 w-[140px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="relevance">Relevance</SelectItem>
                                                <SelectItem value="downloads">Downloads</SelectItem>
                                                <SelectItem value="updated">Updated</SelectItem>
                                                <SelectItem value="newest">Newest</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            size="sm"
                                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                                            onClick={() => handleSearchModrinth()}
                                            disabled={modrinthLoading}
                                        >
                                            {modrinthLoading ? <Spinner className="mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                                            Search
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-3">
                                    {modrinthError && (
                                        <Alert variant="destructive">
                                            <AlertTitle>Error</AlertTitle>
                                            <AlertDescription>{modrinthError}</AlertDescription>
                                        </Alert>
                                    )}
                                    {modrinthLoading && modrinthResults.length === 0 ? (
                                        <div className="grid gap-3 py-2">
                                            {Array.from({ length: 5 }).map((_, index) => (
                                                <div key={index} className="flex gap-3 rounded-lg border border-border bg-card p-3">
                                                    <div className="h-16 w-16 shrink-0 rounded-lg bg-muted" />
                                                    <div className="min-w-0 flex-1 space-y-3">
                                                        <div className="h-4 w-44 rounded bg-muted" />
                                                        <div className="h-3 w-full rounded bg-muted/80" />
                                                        <div className="h-3 w-2/3 rounded bg-muted/70" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : modrinthResults.length === 0 ? (
                                        <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                                            <div className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-muted/40">
                                                <Search className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <p className="text-sm text-foreground">Search Modrinth</p>
                                                <p className="mt-1 text-[12.5px]">Find a plugin or mod by name.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="max-h-[680px] overflow-auto pr-2 custom-scrollbar">
                                            <div className="flex flex-col gap-3">
                                                {modrinthResults.map((hit) => (
                                                <div
                                                    key={hit.projectId}
                                                    className="group relative flex w-full cursor-pointer items-stretch gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/45"
                                                    onClick={() => handleOpenModrinthDetails(hit)}
                                                    onMouseEnter={() => {
                                                        handlePrefetchModrinthDetails(hit.projectId)
                                                    }}
                                                    onFocus={() => {
                                                        handlePrefetchModrinthDetails(hit.projectId)
                                                    }}
                                                    role="button"
                                                    tabIndex={0}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") handleOpenModrinthDetails(hit)
                                                    }}
                                                >
                                                    {/* Left: Icon Frame */}
                                                    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background p-2">
                                                         <div className="absolute inset-0 z-0 flex items-center justify-center text-2xl font-medium text-muted-foreground/20 select-none">
                                                            {hit.title.charAt(0).toUpperCase()}
                                                         </div>
                                                         <img
                                                                src={hit.iconUrl || `https://cdn.modrinth.com/data/${hit.projectId}/icon.png`}
                                                                alt={hit.title}
                                                                className="relative z-10 h-full w-full object-contain rounded-md"
                                                                onError={(e) => {
                                                                    e.currentTarget.style.display = 'none'
                                                                }}
                                                            />
                                                    </div>

                                                    {/* Middle: Content */}
                                                    <div className="flex min-w-0 flex-1 flex-col justify-between">
                                                        <div>
                                                            <div className="flex items-baseline gap-2">
                                                                <h3 className="truncate text-[14px] font-medium text-foreground">{hit.title}</h3>
                                                                <span className="text-xs text-muted-foreground truncate">by {hit.author}</span>
                                                            </div>
                                                            <p className="mt-1 line-clamp-2 text-sm leading-snug text-foreground/80">
                                                                <ModrinthInlineMarkdown text={hit.description} />
                                                            </p>
                                                        </div>
                                                        
                                                        {/* Tags */}
                                                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                                            {/* Client/Server Tag */}
                                                            {(hit.clientSide !== 'unsupported' || hit.serverSide !== 'unsupported') && (
                                                                <Badge variant="outline" className="flex items-center gap-1.5 border-border bg-muted text-muted-foreground hover:bg-muted/80 px-2 py-0.5 font-normal">
                                                                    <Globe className="h-3 w-3" />
                                                                    <span>
                                                                        {hit.clientSide === 'required' && hit.serverSide === 'required' ? 'Client & Server' :
                                                                         hit.clientSide === 'required' ? 'Client' :
                                                                         hit.serverSide === 'required' ? 'Server' : 'Client or Server'}
                                                                    </span>
                                                                </Badge>
                                                            )}
                                                            
                                                            {/* Categories */}
                                                            {(() => {
                                                                const allCats = hit.categories || [];
                                                                const loaderCats: string[] = [];
                                                                const featureCats: string[] = [];
                                                                allCats.forEach((cat) => {
                                                                    if (MODRINTH_LOADER_CATEGORIES.has(cat.toLowerCase())) {
                                                                        loaderCats.push(cat);
                                                                    } else {
                                                                        featureCats.push(cat);
                                                                    }
                                                                });
                                                                featureCats.sort((a, b) => a.localeCompare(b));
                                                                loaderCats.sort((a, b) => a.localeCompare(b));
                                                                const sortedCats = featureCats.concat(loaderCats);

                                                                const visible = sortedCats.slice(0, 6);
                                                                const overflow = sortedCats.slice(6);
                                                                
                                                                return (
                                                                    <>
                                                                        {visible.map(cat => {
                                                                            const config = getTagConfig(cat);
                                                                            const Icon = config.icon;
                                                                            return (
                                                                                <Badge key={cat} variant="outline" className={`flex items-center gap-1.5 px-2 py-0.5 font-normal ${config.color}`}>
                                                                                    <Icon className="h-3 w-3" />
                                                                                    <span className="capitalize">{cat}</span>
                                                                                </Badge>
                                                                            )
                                                                        })}

                                                                        {/* Overflow Badge */}
                                                                        {overflow.length > 0 && (
                                                                            <TooltipProvider>
                                                                                <Tooltip>
                                                                                    <TooltipTrigger asChild>
                                                                                        <Badge variant="outline" className="flex items-center gap-1 border-border bg-muted text-muted-foreground hover:bg-muted/80 px-2 py-0.5 font-normal cursor-help">
                                                                                            <Plus className="h-3 w-3" />
                                                                                            <span>{overflow.length}</span>
                                                                                        </Badge>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent side="bottom" className="bg-card border border-border p-2">
                                                                                        <div className="flex flex-wrap gap-2 max-w-[200px]">
                                                                                            {overflow.map(cat => {
                                                                                                const config = getTagConfig(cat);
                                                                                                const Icon = config.icon;
                                                                                                return (
                                                                                                    <Badge key={cat} variant="outline" className={`flex items-center gap-1.5 px-2 py-0.5 font-normal ${config.color}`}>
                                                                                                        <Icon className="h-3 w-3" />
                                                                                                        <span className="capitalize">{cat}</span>
                                                                                                    </Badge>
                                                                                                )
                                                                                            })}
                                                                                        </div>
                                                                                    </TooltipContent>
                                                                                </Tooltip>
                                                                            </TooltipProvider>
                                                                        )}
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>

                                                    {/* Right: Metadata & Actions */}
                                                    <div className="flex min-w-[118px] shrink-0 flex-col items-end justify-between border-l border-border pl-3">
                                                        {/* Top Right: Stats */}
                                                        <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
                                                             <div className="flex items-center gap-1.5" title={`${hit.downloads} Downloads`}>
                                                                 <Download className="h-3.5 w-3.5" />
                                                                 <span>
                                                                    {Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(hit.downloads)}
                                                                 </span>
                                                             </div>
                                                             <div className="flex items-center gap-1.5" title={`${hit.follows} Follows`}>
                                                                 <Heart className="h-3.5 w-3.5" />
                                                                 <span>
                                                                    {Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(hit.follows)}
                                                                 </span>
                                                             </div>
                                                        </div>

                                                        {/* Action Button */}
                                                        <div onClick={e => e.stopPropagation()} className="my-1">
                                                             {installedProjectIds.has(hit.projectId) ? (
                                                                <Button size="sm" className="h-7 text-xs bg-primary/15 text-primary hover:bg-primary/15 cursor-default" disabled>
                                                                    Installed
                                                                </Button>
                                                            ) : modrinthInstalling[hit.projectId] ? (
                                                                <Button size="sm" variant="outline" className="h-7 text-xs" disabled>
                                                                    <Spinner className="mr-1.5 h-3 w-3" />
                                                                    Downloading
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    size="sm"
                                                                    className="h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                                                                    onMouseEnter={() => handlePrefetchModrinthVersions(hit.projectId)}
                                                                    onFocus={() => handlePrefetchModrinthVersions(hit.projectId)}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleOpenModrinthInstall(hit)
                                                                    }}
                                                                >
                                                                    <Download className="h-3.5 w-3.5 mr-1.5" />
                                                                    Install
                                                                </Button>
                                                            )}
                                                        </div>

                                                        {/* Bottom Right: Timestamp */}
                                                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
                                                            <Clock className="h-3 w-3" />
                                                            <span>
                                                                {(() => {
                                                                    const date = new Date(hit.dateModified);
                                                                    const now = new Date();
                                                                    const diffTime = Math.abs(now.getTime() - date.getTime());
                                                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                                                                    return diffDays > 30 
                                                                        ? date.toLocaleDateString() 
                                                                        : `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
                                                                })()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {modrinthTotalHits > 20 && (
                                        <div className="flex items-center justify-between pt-4 pb-2 text-xs text-muted-foreground">
                                            <span>
                                                Page {modrinthPage + 1} of {Math.ceil(modrinthTotalHits / 20)}
                                            </span>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        const nextPage = Math.max(0, modrinthPage - 1)
                                                        handleSearchModrinth(nextPage)
                                                    }}
                                                    disabled={modrinthPage === 0 || modrinthLoading}
                                                    className="border-border text-foreground hover:bg-secondary h-8"
                                                >
                                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                                    Prev
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        const nextPage = modrinthPage + 1
                                                        handleSearchModrinth(nextPage)
                                                    }}
                                                    disabled={modrinthLoading || (modrinthPage + 1) * 20 >= modrinthTotalHits}
                                                    className="border-border text-foreground hover:bg-secondary h-8"
                                                >
                                                    Next
                                                    <ChevronRight className="h-4 w-4 ml-1" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="h-fit overflow-hidden">
                                <CardHeader className="flex flex-row items-center justify-between border-b border-border bg-card pb-4">
                                    <div>
                                        <CardTitle className="text-[15px]">Installed</CardTitle>
                                        <CardDescription className="text-muted-foreground">
                                            {modrinthInstalls.length} item{modrinthInstalls.length === 1 ? "" : "s"}
                                        </CardDescription>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={loadModrinthInstalls}
                                        disabled={modrinthInstallsLoading}
                                    >
                                        <RefreshCw className="h-4 w-4" />
                                    </Button>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-2">
                                    {modrinthInstallsLoading ? (
                                        <div className="flex items-center justify-center py-10">
                                            <Spinner className="text-primary" />
                                        </div>
                                    ) : modrinthInstalls.length === 0 ? (
                                        <div className="rounded-lg border border-dashed border-border bg-background/40 px-3 py-8 text-center text-xs text-muted-foreground">
                                            No installs yet.
                                        </div>
                                    ) : (
                                        <div className="flex max-h-[520px] flex-col gap-2 overflow-auto pr-1 custom-scrollbar">
                                            {modrinthInstalls.map((entry) => (
                                                <div
                                                    key={entry.projectId}
                                                    className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-background/45 px-3 py-2.5 transition-colors hover:bg-muted/50"
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => handleOpenModrinthDetails(entry)}
                                                    onMouseEnter={() => handlePrefetchModrinthDetails(entry.projectId)}
                                                    onFocus={() => handlePrefetchModrinthDetails(entry.projectId)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") handleOpenModrinthDetails(entry)
                                                    }}
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="relative h-10 w-10 shrink-0">
                                                            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                                                                {entry.title.charAt(0).toUpperCase()}
                                                            </div>
                                                            {entry.iconUrl && (
                                                                <img
                                                                    src={entry.iconUrl}
                                                                    alt={entry.title}
                                                                    className="relative h-10 w-10 rounded-lg object-cover"
                                                                    onError={(e) => {
                                                                        e.currentTarget.style.opacity = "0"
                                                                    }}
                                                                />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="truncate text-[13px] font-medium">{entry.title}</p>
                                                            <p className="text-[10px] text-muted-foreground/60 truncate">
                                                                {entry.fileName}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleUpdateModrinth(entry)
                                                            }}
                                                            disabled={modrinthUpdating[entry.projectId]}
                                                        >
                                                            {modrinthUpdating[entry.projectId] ? (
                                                                <Spinner className="h-4 w-4" />
                                                            ) : (
                                                                <RefreshCw className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleRemoveModrinth(entry)
                                                            }}
                                                            disabled={modrinthRemoving[entry.projectId]}
                                                        >
                                                            {modrinthRemoving[entry.projectId] ? (
                                                                <Spinner className="h-4 w-4" />
                                                            ) : (
                                                                <Trash2 className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </TabsContent>

                {/* Files Tab */}
                <TabsContent value="files" className="mt-0 px-8 pt-6">
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>File Explorer</CardTitle>
                                    <CardDescription>
                                        Browse server files and directories
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleLoadFiles(currentPath)}
                                    >
                                        <RefreshCw className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleLoadFiles("")}
                                    >
                                        root
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {/* Breadcrumb */}
                                <div className="flex items-center gap-1 mb-4 text-xs">
                                    <button
                                        className="text-primary hover:underline"
                                        onClick={() => handleLoadFiles("")}
                                    >
                                        root
                                    </button>
                                    {pathSegments.map((segment, i) => (
                                        <span key={i} className="flex items-center gap-1">
                                            <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
                                            <button
                                                className="text-primary hover:underline"
                                                onClick={() =>
                                                    handleLoadFiles(
                                                        pathSegments.slice(0, i + 1).join("/")
                                                    )
                                                }
                                            >
                                                {segment}
                                            </button>
                                        </span>
                                    ))}
                                </div>

                                {filesLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Spinner className="text-primary" />
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-1 max-h-[520px] overflow-auto">
                                        {/* Go up (..) */}
                                        {currentPath && (
                                            <button
                                                className="flex items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-muted/50"
                                                onClick={handleNavigateUp}
                                            >
                                                <Folder className="h-4 w-4 text-primary" />
                                                <span className="text-sm text-muted-foreground">..</span>
                                            </button>
                                        )}
                                        {files.map((entry) => {
                                            const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name
                                            const isSelected = selectedFilePath === entryPath
                                            return (
                                                <button
                                                    key={entry.name}
                                                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-muted/50 ${
                                                        isSelected ? "bg-primary/10 border border-primary/30" : ""
                                                    }`}
                                                    onClick={() => handleNavigateFile(entry)}
                                                    onContextMenu={(e) => onContextMenu(e, entry)}
                                                    style={{
                                                        cursor: entry.isDirectory ? "pointer" : "default",
                                                    }}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {entry.isDirectory ? (
                                                            <Folder className="h-4 w-4 text-primary" />
                                                        ) : (
                                                            <File className="h-4 w-4 text-muted-foreground/60" />
                                                        )}
                                                        <span className="text-sm">
                                                            {entry.name}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs text-muted-foreground/60">
                                                        <span>{entry.isDirectory ? "" : formatFileSize(entry.size)}</span>
                                                        <span className="w-[100px] text-right">
                                                            {new Date(entry.modifiedAt).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                        {files.length === 0 && !currentPath && (
                                            <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground text-sm">
                                                <Info className="h-4 w-4" />
                                                <span>No files yet. Start the server once to generate files.</span>
                                            </div>
                                        )}
                                        {files.length === 0 && currentPath && (
                                            <p className="text-xs text-muted-foreground text-center py-8">
                                                This folder is empty
                                            </p>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Quick Editor</CardTitle>
                                    <CardDescription>
                                        Edit server files without leaving the app
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => selectedFilePath && handleOpenFile(selectedFilePath, selectedFileMeta || undefined)}
                                        disabled={!selectedFilePath || fileLoading}
                                    >
                                        <RefreshCw className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                                        size="sm"
                                        onClick={handleSaveFile}
                                        disabled={!selectedFilePath || !fileDirty || fileSaving}
                                    >
                                        {fileSaving ? <Spinner className="mr-2" /> : <Save className="h-4 w-4 mr-1" />}
                                        Save
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {fileError && (
                                    <Alert className="mb-4 border-destructive/30 bg-destructive/10">
                                        <AlertTitle className="text-destructive">Editor error</AlertTitle>
                                        <AlertDescription className="text-destructive/80">
                                            {fileError}
                                        </AlertDescription>
                                    </Alert>
                                )}
                                {!selectedFilePath ? (
                                    <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground text-sm">
                                        <FileText className="h-5 w-5" />
                                        <span>Select a file to start editing</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span className="truncate">{selectedFilePath}</span>
                                            {selectedFileMeta && (
                                                <span>
                                                    {formatFileSize(selectedFileMeta.size)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="console-surface rounded-xl border border-border">
                                            {fileLoading ? (
                                                <div className="flex items-center justify-center py-16">
                                                    <Spinner className="text-primary" />
                                                </div>
                                            ) : (
                                                <textarea
                                                    value={fileContent}
                                                    onChange={(e) => {
                                                        setFileContent(e.target.value)
                                                        setFileDirty(true)
                                                    }}
                                                    spellCheck={false}
                                                    className="h-[360px] w-full resize-none bg-transparent p-3 text-xs font-mono text-foreground/90 outline-none select-text"
                                                />
                                            )}
                                        </div>
                                        {fileDirty && (
                                            <div className="text-[11px] text-primary">
                                                Unsaved changes
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* File Context Menu & Modals */}
                    {contextMenu && (
                        <div
                            className="fixed z-50 min-w-[160px] rounded-lg border border-border bg-card p-1 shadow-xl animate-in fade-in zoom-in-95"
                            style={{ top: contextMenu.y, left: contextMenu.x }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button onClick={() => { if(contextMenu.entry.isDirectory) { handleLoadFiles(currentPath ? `${currentPath}/${contextMenu.entry.name}` : contextMenu.entry.name) } else { handleOpenFile(currentPath ? `${currentPath}/${contextMenu.entry.name}` : contextMenu.entry.name, contextMenu.entry) } setContextMenu(null) }} className="w-full text-left px-2 py-1.5 text-xs text-foreground hover:bg-muted/50 rounded-md">Open</button>
                            <button onClick={handleRenameClick} className="w-full text-left px-2 py-1.5 text-xs text-foreground hover:bg-muted/50 rounded-md">Rename</button>
                            <button onClick={handleDuplicateClick} className="w-full text-left px-2 py-1.5 text-xs text-foreground hover:bg-muted/50 rounded-md">Duplicate</button>
                            <div className="h-[1px] bg-muted/50 my-1" />
                            <button onClick={handleDeleteClick} className="w-full text-left px-2 py-1.5 text-xs text-destructive hover:bg-muted/50 rounded-md">Delete</button>
                        </div>
                    )}

                    <Dialog open={fileRenameDialogOpen} onOpenChange={setFileRenameDialogOpen}>
                        <DialogContent className="bg-card border-border">
                            <DialogHeader>
                                <DialogTitle>Rename File</DialogTitle>
                                <DialogDescription>Enter a new name for the file.</DialogDescription>
                            </DialogHeader>
                            <Input 
                                value={fileActionInput} 
                                onChange={(e) => setFileActionInput(e.target.value)} 
                                className="border-border font-mono" 
                            />
                            <div className="flex justify-end gap-2 mt-4">
                                <Button variant="ghost" onClick={() => setFileRenameDialogOpen(false)}>Cancel</Button>
                                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={confirmRename}>Rename</Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={fileDuplicateDialogOpen} onOpenChange={setFileDuplicateDialogOpen}>
                        <DialogContent className="bg-card border-border">
                            <DialogHeader>
                                <DialogTitle>Duplicate File</DialogTitle>
                                <DialogDescription>Enter a name for the copy.</DialogDescription>
                            </DialogHeader>
                            <Input 
                                value={fileActionInput} 
                                onChange={(e) => setFileActionInput(e.target.value)} 
                                className="border-border font-mono" 
                            />
                            <div className="flex justify-end gap-2 mt-4">
                                <Button variant="ghost" onClick={() => setFileDuplicateDialogOpen(false)}>Cancel</Button>
                                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={confirmDuplicate}>Duplicate</Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <AlertDialog open={fileDeleteDialogOpen} onOpenChange={setFileDeleteDialogOpen}>
                        <AlertDialogContent className="bg-card border-border">
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete 
                                    <span className="text-primary font-mono mx-1">{targetEntry?.name}</span>.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="border-border bg-muted/50 text-foreground hover:bg-muted/50 hover:text-foreground">Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </TabsContent>



                {/* Backups Tab - MOVED TO SETTINGS */}
                
                {/* Create Backup Dialog */}
                 <Dialog open={createBackupDialogOpen} onOpenChange={setCreateBackupDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create Backup</DialogTitle>
                            <DialogDescription>
                                Enter a name for this backup.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <label htmlFor="name" className="text-sm font-medium">Backup Name (Optional)</label>
                                <Input 
                                    id="name" 
                                    value={newBackupName} 
                                    onChange={(e) => setNewBackupName(e.target.value)} 
                                    placeholder="e.g. Before Mod Update" 
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => setCreateBackupDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleCreateBackup} disabled={creatingBackup} className="bg-primary hover:bg-primary/90">
                                {creatingBackup && <Spinner className="mr-2" />}
                                Create
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Settings Tab */}
                <TabsContent value="settings" className="mt-0 px-8 pt-6 space-y-8 pb-10 max-h-[75vh] overflow-y-auto pr-2">
                    
                    {/* Fixed Success Alert */}
                    {settingsSuccess && (
                        <div className="fixed bottom-6 right-6 z-50 w-[380px] animate-in slide-in-from-bottom-5 fade-in duration-300">
                             <Alert className="border-primary/40 bg-primary/10 text-primary shadow-xl">
                                <CheckCircle2 className="h-4 w-4" />
                                <AlertTitle>Success</AlertTitle>
                                <AlertDescription>
                                    {isOnline
                                        ? "Settings saved. RAM changes will apply on next server restart."
                                        : "Settings saved. RAM changes will apply on next server start."}
                                </AlertDescription>
                                <AlertAction>
                                    <Button variant="ghost" size="icon" className="-mt-2 -mr-2 h-8 w-8 text-primary/60 hover:text-primary" onClick={() => setSettingsSuccess(false)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </AlertAction>
                             </Alert>
                        </div>
                    )}

                    {/* Section: General */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-border">
                            <Info className="h-5 w-5 text-primary" />
                            <h3 className="text-lg font-semibold tracking-tight">General Information</h3>
                        </div>
                        <div className="grid gap-4 xl:grid-cols-2">
                             <Card>
                                <CardHeader>
                                    <CardTitle>Server Details</CardTitle>
                                    <CardDescription>
                                        Quick reference and tools
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-4">
                                    <div className="grid gap-2 text-sm">
                                        <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                                            <span className="text-muted-foreground">Platform</span>
                                            <span className="font-medium flex items-center gap-2">
                                                {server.framework}
                                                <Badge variant="outline" className="text-[10px] py-0 h-5 bg-muted">{server.version}</Badge>
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                                            <span className="text-muted-foreground">Created</span>
                                            <span className="font-medium">
                                                {new Date(server.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                                            <span className="text-muted-foreground">Path</span>
                                            <span className="font-medium truncate max-w-[200px] text-right text-xs font-mono opacity-80" title={server.serverPath}>
                                                {server.serverPath}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                                            <span className="text-muted-foreground">Disk Usage</span>
                                            <span className="font-medium flex items-center gap-2">
                                                {diskUsageLoading ? (
                                                    <Spinner className="h-3.5 w-3.5" />
                                                ) : diskUsage !== null ? (
                                                    formatBytes(diskUsage)
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 pt-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1 border-border hover:bg-muted/50"
                                            onClick={() => id && window.context.openServerFolder(id)}
                                        >
                                            <FolderOpen className="h-4 w-4 mr-2" />
                                            Folder
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1 border-border hover:bg-muted/50"
                                            onClick={() => handleLoadFiles(currentPath)}
                                        >
                                            <RefreshCw className="h-4 w-4 mr-2" />
                                            Refresh
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {/* Section: Performance */}
                    <div className="space-y-4">
                         <div className="flex items-center gap-2 pb-2 border-b border-border">
                            <Gauge className="h-5 w-5 text-primary" />
                            <h3 className="text-lg font-semibold tracking-tight">Performance</h3>
                        </div>
                        <div className="grid gap-4 xl:grid-cols-2">
                             <Card>
                                <CardHeader>
                                    <CardTitle>Java & Memory</CardTitle>
                                    <CardDescription>
                                        Changes require a server restart to take effect
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-6">
                                    <div className="grid gap-3">
                                        <div className="flex items-center gap-2">
                                            <label className="text-[12.5px] font-medium text-muted-foreground">
                                                Allocated Memory (RAM)
                                            </label>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Info className="h-3.5 w-3.5 text-muted-foreground/40 cursor-help" />
                                                    </TooltipTrigger>
                                                    <TooltipContent side="right" className="max-w-xs">
                                                        <p className="text-xs">
                                                            This sets the Java heap size (-Xmx). The actual process memory will be ~10-20% higher due to JVM overhead (metaspace, code cache, thread stacks).
                                                        </p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                        <div className="flex gap-4 items-start">
                                            <Select
                                                value={ramOption}
                                                onValueChange={setRamOption}
                                            >
                                                <SelectTrigger className="w-[180px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {[2048, 4096, 6144, 8192, 12288, 16384].filter(v => v <= maxRamMB).map(v => (
                                                        <SelectItem key={v} value={String(v)}>{v >= 1024 ? `${v / 1024} GB` : `${v} MB`}</SelectItem>
                                                    ))}
                                                    <SelectItem value="custom">Custom</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {ramOption === "custom" && (
                                                <div className="flex-1 flex items-center gap-2">
                                                    <Input
                                                        type="number"
                                                        min={512}
                                                        max={maxRamMB}
                                                        value={customRamMB}
                                                        onChange={(e) =>
                                                            setCustomRamMB(e.target.value)
                                                        }
                                                        placeholder="MB"
                                                    />
                                                    <span className="text-xs text-muted-foreground">MB (max {maxRamMB})</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="grid gap-3">
                                        <label className="text-[12.5px] font-medium text-muted-foreground">
                                            Java Executable
                                        </label>
                                        <Input
                                            placeholder="System default (java)"
                                            value={javaPath}
                                            onChange={(e) => setJavaPath(e.target.value)}
                                            className="font-mono text-xs"
                                        />
                                    </div>
                                    <Button
                                        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                                        onClick={handleSaveSettings}
                                        disabled={settingsSaving}
                                    >
                                        {settingsSaving ? (
                                            <Spinner className="mr-2" />
                                        ) : (
                                            <Save className="h-4 w-4 mr-1" />
                                        )}
                                        Save Performance Settings
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                
                    {/* Section: Backups */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-border">
                            <Archive className="h-5 w-5 text-primary" />
                            <h3 className="text-lg font-semibold tracking-tight">Backups</h3>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-2">
                             {/* Backup Config */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Configuration</CardTitle>
                                    <CardDescription>Automated backup schedule</CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-4">
                                     <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                                        <div className="space-y-0.5">
                                            <div className="text-sm font-medium">Automatic Backups</div>
                                            <div className="text-xs text-muted-foreground">{autoBackupEnabled ? "Active" : "Paused"}</div>
                                        </div>
                                        <Select 
                                            value={autoBackupEnabled ? "on" : "off"} 
                                            onValueChange={(v) => setAutoBackupEnabled(v === "on")}
                                        >
                                            <SelectTrigger className="w-[100px] h-8 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="off">Off</SelectItem>
                                                <SelectItem value="on">On</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {autoBackupEnabled && (
                                        <div className="grid gap-2">
                                            <label className="text-[12.5px] font-medium text-muted-foreground">
                                                Interval
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    max={168}
                                                    value={backupInterval}
                                                    onChange={(e) => setBackupInterval(e.target.value)}
                                                    className="w-24"
                                                />
                                                <span className="text-sm text-muted-foreground">Hours</span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="pt-2">
                                        <Button
                                            className="w-full bg-muted/50 text-foreground hover:bg-muted"
                                            onClick={handleSaveSettings}
                                            disabled={settingsSaving}
                                            variant="outline"
                                        >
                                            {settingsSaving ? <Spinner className="mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                            Save Backup Config
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Manual Action */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Manual Backup</CardTitle>
                                    <CardDescription>Create a snapshot now</CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col justify-center gap-4">
                                    {/* Work in Progress Warning */}
                                    <div className="mb-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3">
                                        <div className="flex items-start gap-2">
                                            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                                            <div className="text-sm">
                                                <span className="font-semibold text-amber-700 dark:text-amber-300">Work in progress:</span>
                                                <span className="ml-1 text-amber-700/80 dark:text-amber-300/70">Backup functionality is currently under development and may not work correctly.</span>
                                            </div>
                                        </div>
                                    </div>
                                    {creatingBackup ? (
                                        <div className="space-y-3">
                                            {/* Progress Bar */}
                                            <div className="w-full bg-muted rounded-full h-2.5">
                                                <div
                                                    className="bg-primary h-2.5 rounded-full transition-all duration-300"
                                                    style={{ width: `${Math.max(0, backupPercent)}%` }}
                                                ></div>
                                            </div>
                                            
                                            {/* Status Text */}
                                            <div className="flex items-center justify-between text-sm">
                                                <div className="flex items-center gap-2">
                                                    <Spinner className="h-4 w-4" />
                                                    <span className="text-foreground/80">
                                                        {backupStage === 'calculating' && "Calculating..."}
                                                        {backupStage === 'archiving' && `Archiving ${backupFileCount.total > 0 ? `(${backupFileCount.processed}/${backupFileCount.total})` : ''}`}
                                                        {backupStage === 'complete' && "Finalizing..."}
                                                        {!backupStage && "Creating Backup..."}
                                                    </span>
                                                </div>
                                                <span className="text-muted-foreground font-mono">
                                                    {backupPercent}%
                                                </span>
                                            </div>
                                            
                                            {/* Cancel Button */}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full h-8 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                onClick={handleCancelBackup}
                                            >
                                                <X className="h-3 w-3 mr-1" />
                                                Cancel Backup
                                            </Button>
                                        </div>
                                    ) : (
                                        <Button
                                            className="h-12 w-full"
                                            onClick={() => setCreateBackupDialogOpen(true)}
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            New Backup
                                        </Button>
                                    )}
                                    <div className="text-xs text-center text-muted-foreground/60">
                                        Backups are stored in <code>/backups</code> folder
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                        
                        {/* List */}
                        <Card>
                             <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <div>
                                    <CardTitle>History</CardTitle>
                                    <CardDescription>
                                        {backups.length} snapshot{backups.length !== 1 ? 's' : ''} available
                                    </CardDescription>
                                </div>
                                <Button variant="ghost" size="icon" onClick={loadBackups} disabled={backupsLoading}>
                                    <RefreshCw className={`h-4 w-4 ${backupsLoading ? "animate-spin" : ""}`} />
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {backupsLoading && backups.length === 0 ? (
                                    <div className="flex justify-center py-8">
                                        <Spinner />
                                    </div>
                                ) : backups.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2 bg-muted/50 rounded-lg border border-dashed border-border mx-1">
                                        <Archive className="h-6 w-6 opacity-20" />
                                        <p className="text-xs">No backups found</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2 max-h-[300px] overflow-auto pr-2 custom-scrollbar">
                                        {backups.map((backup) => (
                                            <div key={backup.filename} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border group hover:border-border transition-all">
                                                <div className="flex items-center gap-3">
                                                    <div className={`h-8 w-8 rounded-md flex items-center justify-center ${backup.type === 'auto' ? 'bg-[hsl(var(--chart-3))]/10 text-[hsl(var(--chart-3))]' : 'bg-primary/10 text-primary'}`}>
                                                        {backup.type === 'auto' ? <Clock className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium">{backup.name}</div>
                                                        <div className="text-[10px] text-muted-foreground flex gap-3">
                                                            <span>{new Date(backup.createdAt).toLocaleString()}</span>
                                                            <span className="opacity-30">•</span>
                                                            <span>{formatFileSize(backup.size)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRestoreBackup(backup.filename)}>
                                                                    <RefreshCw className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>Restore</TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteBackup(backup.filename)}>
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>Delete</TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Section: Danger Zone */}
                    <div className="space-y-4 pt-4 border-t border-border">
                        <div className="flex items-center gap-2 pb-2">
                             <h3 className="text-lg font-semibold tracking-tight text-destructive">Danger Zone</h3>
                        </div>
                        <Card className="border-destructive/20 bg-destructive/5">
                            <CardContent className="flex items-center justify-between p-6">
                                <div className="space-y-1">
                                    <h4 className="text-sm font-medium text-foreground">Delete Server</h4>
                                    <p className="text-xs text-muted-foreground max-w-[400px]">
                                        This action will permanently delete this server and all associated files, logs, and backups. This action cannot be undone.
                                    </p>
                                </div>
                                <Button
                                    variant="destructive"
                                    onClick={() => setDeleteDialogOpen(true)}
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Server
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Analytics Tab */}
                <TabsContent value="analytics" className="mt-0 px-8 pt-6 max-h-[75vh] overflow-y-auto pr-2">
                    <AnalyticsTab serverId={id || ""} />
                </TabsContent>
            </Tabs>

            <Dialog open={modrinthDetailOpen} onOpenChange={setModrinthDetailOpen}>
                <DialogContent className="max-w-[960px] border-border bg-card max-h-[88vh] overflow-y-auto custom-scrollbar select-text">
                    <DialogHeader>
                        <DialogTitle>Modrinth Project</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            README, gallery, versions, and install status
                        </DialogDescription>
                    </DialogHeader>
                    {modrinthDetailLoading && !modrinthDetail ? (
                        <div className="flex items-center justify-center py-12">
                            <Spinner className="text-primary" />
                        </div>
                    ) : modrinthDetailError ? (
                        <Alert variant="destructive" className="mt-4">
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{modrinthDetailError}</AlertDescription>
                        </Alert>
                    ) : modrinthDetail ? (
                        <div className="mt-4 flex flex-col gap-6">
                            {/* Header Section */}
                            <div className="flex items-start gap-4">
                                <div className="relative h-20 w-20 shrink-0">
                                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-muted text-2xl font-bold text-muted-foreground/20 border border-border">
                                        {modrinthDetail.title.charAt(0).toUpperCase()}
                                    </div>
                                    {modrinthDetail.iconUrl && (
                                        <img
                                            src={modrinthDetail.iconUrl}
                                            alt={modrinthDetail.title}
                                            className="relative h-20 w-20 rounded-2xl object-contain bg-muted border border-border"
                                            onError={(e) => {
                                                e.currentTarget.style.opacity = "0"
                                            }}
                                        />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1 select-text">
                                    <h2 className="text-2xl font-bold text-foreground truncate">
                                        {modrinthDetail.title}
                                    </h2>
                                    <p className="text-base text-muted-foreground mt-1">
                                        <ModrinthInlineMarkdown text={modrinthDetail.description} />
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                        <Badge variant="secondary" className="bg-muted/50 hover:bg-muted/50 text-muted-foreground font-normal">
                                            <Download className="w-3 h-3 mr-1" />
                                            {modrinthDetail.downloads.toLocaleString()} downloads
                                        </Badge>
                                        <Badge variant="secondary" className="bg-muted/50 hover:bg-muted/50 text-muted-foreground font-normal">
                                            <Heart className="w-3 h-3 mr-1" />
                                            {modrinthDetail.followers.toLocaleString()} followers
                                        </Badge>
                                        {modrinthDetail.categories?.slice(0, 4).map((category) => (
                                            <Badge
                                                key={category}
                                                variant="outline"
                                                className="border-border text-muted-foreground font-normal capitalize"
                                            >
                                                {category}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 shrink-0">
                                     {installedProjectIds.has(modrinthDetail.projectId) ? (
                                        <Button
                                            className="bg-primary/15 text-primary hover:bg-primary/15 cursor-default w-full"
                                            disabled
                                        >
                                            <Check className="h-4 w-4 mr-2" />
                                            Installed
                                        </Button>
                                    ) : modrinthInstalling[modrinthDetail.projectId] ? (
                                        <Button variant="outline" disabled className="w-full">
                                            <Spinner className="mr-2 h-4 w-4" />
                                            Downloading
                                        </Button>
                                    ) : (
                                        <Button
                                            className="bg-primary text-primary-foreground hover:bg-primary/90 w-full"
                                            onClick={() =>
                                                handleOpenModrinthInstall({
                                                    projectId: modrinthDetail.projectId,
                                                    slug: modrinthDetail.slug,
                                                    title: modrinthDetail.title,
                                                    description: modrinthDetail.description,
                                                    iconUrl: modrinthDetail.iconUrl,
                                                    downloads: modrinthDetail.downloads,
                                                    follows: modrinthDetail.followers,
                                                    author: "",
                                                    dateModified: "",
                                                })
                                            }
                                        >
                                            <Download className="h-4 w-4 mr-2" />
                                            Install
                                        </Button>
                                    )}
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={() => {
                                            const url = modrinthDetail.projectUrl || `https://modrinth.com/${modrinthContext?.projectType ?? "plugin"}/${modrinthDetail.slug}`
                                            window.context?.openExternal?.(url)
                                        }}
                                    >
                                        <Link className="h-4 w-4 mr-2" />
                                        View on Modrinth
                                    </Button>
                                </div>
                            </div>

                            {modrinthDetail.gallery && modrinthDetail.gallery.length > 0 && (
                                <div className="space-y-2">
                                    <h3 className="text-sm font-medium text-muted-foreground">Gallery</h3>
                                    <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x">
                                        {modrinthDetail.gallery.map((image) => (
                                            <button
                                                key={image.url}
                                                type="button"
                                                className="snap-start overflow-hidden rounded-lg border border-border bg-muted"
                                                onClick={() => setModrinthGalleryPreview(image)}
                                            >
                                                <img
                                                    src={image.url}
                                                    alt={image.title || modrinthDetail.title}
                                                    className="h-48 cursor-zoom-in object-cover transition-transform duration-200 hover:scale-[1.02]"
                                                    loading="lazy"
                                                />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <h3 className="text-sm font-medium text-muted-foreground">README</h3>
                                <div className="rounded-2xl border border-border bg-background/70 p-6 select-text">
                                    {modrinthDetailLoading ? (
                                        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                                            <Spinner className="h-4 w-4 text-primary" />
                                            Loading README...
                                        </div>
                                    ) : (
                                        <ModrinthReadme body={modrinthDetail.body || modrinthDetail.description} />
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>

            <Dialog open={!!modrinthGalleryPreview} onOpenChange={(open) => !open && setModrinthGalleryPreview(null)}>
                <DialogContent className="max-w-[92vw] border-border bg-card p-4">
                    <DialogHeader>
                        <DialogTitle>{modrinthGalleryPreview?.title ?? "Gallery image"}</DialogTitle>
                        {modrinthGalleryPreview?.description && (
                            <DialogDescription className="select-text text-muted-foreground">
                                {modrinthGalleryPreview.description}
                            </DialogDescription>
                        )}
                    </DialogHeader>
                    {modrinthGalleryPreview && (
                        <div className="flex max-h-[78vh] items-center justify-center overflow-auto rounded-xl bg-background/70 p-2">
                            <img
                                src={modrinthGalleryPreview.url}
                                alt={modrinthGalleryPreview.title ?? "Gallery image"}
                                className="max-h-[74vh] max-w-full rounded-lg object-contain"
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={modrinthInstallOpen} onOpenChange={setModrinthInstallOpen}>
                <DialogContent className="max-w-[560px] border-border bg-card">
                    <DialogHeader>
                        <DialogTitle>Install {modrinthInstallTarget?.title ?? modrinthContext?.label}</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Recommended is only shown for the newest stable build that matches Minecraft {server.version}.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mt-4 space-y-4">
                        {modrinthVersionsLoading ? (
                            <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background/60 py-8 text-sm text-muted-foreground">
                                <Spinner className="text-primary" />
                                Loading builds...
                            </div>
                        ) : modrinthVersionsError ? (
                            <Alert variant="destructive">
                                <AlertTitle>Versions unavailable</AlertTitle>
                                <AlertDescription>{modrinthVersionsError}</AlertDescription>
                            </Alert>
                        ) : (
                            <>
                                {installVersionWarning && (
                                    <Alert>
                                        <Info className="h-4 w-4" />
                                        <AlertTitle>Check compatibility</AlertTitle>
                                        <AlertDescription>{installVersionWarning}</AlertDescription>
                                    </Alert>
                                )}

                                {recommendedModrinthVersion && (
                                    <div className="rounded-xl border border-primary/35 bg-primary/10 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <Badge className="bg-primary text-primary-foreground hover:bg-primary">Recommended</Badge>
                                                    <Badge variant="outline" className={getVersionChannelMeta(recommendedModrinthVersion.versionType).className}>
                                                        {getVersionChannelMeta(recommendedModrinthVersion.versionType).label}
                                                    </Badge>
                                                </div>
                                                <p className="mt-3 truncate text-[15px] font-medium text-foreground">
                                                    {recommendedModrinthVersion.versionNumber}
                                                </p>
                                                <p className="mt-1 truncate text-[12.5px] text-muted-foreground">
                                                    {recommendedModrinthVersion.name}
                                                </p>
                                            </div>
                                            {selectedModrinthVersionId === recommendedModrinthVersion.id ? (
                                                <Check className="h-5 w-5 shrink-0 text-primary" />
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setSelectedModrinthVersionId(recommendedModrinthVersion.id)}
                                                >
                                                    Use
                                                </Button>
                                            )}
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-1.5">
                                            <Badge variant="secondary" className={recommendedModrinthVersion.gameVersions.includes(server.version) ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground"}>
                                                {recommendedModrinthVersion.gameVersions.includes(server.version)
                                                    ? `Minecraft ${server.version}`
                                                    : formatGameVersions(recommendedModrinthVersion.gameVersions)}
                                            </Badge>
                                            {recommendedModrinthVersion.loaders.slice(0, 3).map((loader) => (
                                                <Badge key={loader} variant="outline" className="capitalize text-muted-foreground">
                                                    {loader}
                                                </Badge>
                                            ))}
                                            <Badge variant="outline" className="text-muted-foreground">
                                                {formatVersionDate(recommendedModrinthVersion.datePublished)}
                                            </Badge>
                                            {recommendedModrinthVersion.fileSize && (
                                                <Badge variant="outline" className="text-muted-foreground">
                                                    {formatBytes(recommendedModrinthVersion.fileSize)}
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="mt-3 truncate font-mono text-[11px] text-muted-foreground/70">
                                            {recommendedModrinthVersion.fileName}
                                        </p>
                                    </div>
                                )}

                                {!recommendedModrinthVersion && selectedModrinthVersion && (
                                    <div className="rounded-xl border border-border bg-background/60 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className={getVersionChannelMeta(selectedModrinthVersion.versionType).className}>
                                                        {getVersionChannelMeta(selectedModrinthVersion.versionType).label}
                                                    </Badge>
                                                    {supportsMinecraftVersion(selectedModrinthVersion, server.version) && (
                                                        <Badge variant="secondary" className="bg-primary/10 text-primary">
                                                            Minecraft {server.version}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="mt-3 truncate text-[15px] font-medium text-foreground">
                                                    {selectedModrinthVersion.versionNumber}
                                                </p>
                                                <p className="mt-1 truncate text-[12.5px] text-muted-foreground">
                                                    {selectedModrinthVersion.name}
                                                </p>
                                            </div>
                                            <Check className="h-5 w-5 shrink-0 text-muted-foreground" />
                                        </div>
                                        <p className="mt-3 truncate font-mono text-[11px] text-muted-foreground/80">
                                            {selectedModrinthVersion.fileName}
                                        </p>
                                    </div>
                                )}

                                {otherModrinthVersions.length > 0 && (
                                    <div className="rounded-xl border border-border bg-background/50">
                                        <button
                                            type="button"
                                            className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                                            onClick={() => setShowModrinthAlternates((value) => !value)}
                                        >
                                            All builds
                                            <ChevronRight className={`h-4 w-4 transition-transform ${showModrinthAlternates ? "rotate-90" : ""}`} />
                                        </button>
                                        {showModrinthAlternates && (
                                            <div className="grid max-h-52 gap-1 overflow-auto border-t border-border p-2 custom-scrollbar">
                                                {otherModrinthVersions.map((version) => {
                                                    const selected = version.id === selectedModrinthVersionId
                                                    const channel = getVersionChannelMeta(version.versionType)
                                                    return (
                                                        <button
                                                            key={version.id}
                                                            type="button"
                                                            onClick={() => setSelectedModrinthVersionId(version.id)}
                                                            className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                                                                selected ? "bg-primary/10 text-foreground" : "hover:bg-muted/50"
                                                            }`}
                                                        >
                                                            <div className="min-w-0">
                                                                <p className="truncate text-[13px] font-medium">{version.versionNumber}</p>
                                                                <p className="truncate text-[11.5px] text-muted-foreground">
                                                                    {supportsMinecraftVersion(version, server.version) ? `Minecraft ${server.version}` : formatGameVersions(version.gameVersions)} - {formatVersionDate(version.datePublished)}
                                                                </p>
                                                            </div>
                                                            <Badge variant="outline" className={`shrink-0 ${channel.className}`}>
                                                                {channel.label}
                                                            </Badge>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="mt-6 flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setModrinthInstallOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirmModrinthInstall}
                            disabled={
                                !selectedModrinthVersionId ||
                                !modrinthInstallTarget ||
                                !!modrinthVersionsError ||
                                modrinthVersionsLoading ||
                                !!(modrinthInstallTarget && modrinthInstalling[modrinthInstallTarget.projectId])
                            }
                        >
                            {modrinthInstallTarget && modrinthInstalling[modrinthInstallTarget.projectId] ? (
                                <Spinner className="mr-2 h-4 w-4" />
                            ) : (
                                <Download className="mr-2 h-4 w-4" />
                            )}
                            {selectedModrinthVersionId === recommendedModrinthVersion?.id ? "Install recommended" : "Install selected"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* EULA Dialog */}
            <AlertDialog open={eulaDialogOpen} onOpenChange={setEulaDialogOpen}>
                <AlertDialogContent className="border-border bg-card">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Minecraft EULA</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                            By starting this server, you agree to the{" "}
                            <a
                                href="https://aka.ms/MinecraftEULA"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline hover:text-primary"
                            >
                                Minecraft End User License Agreement
                            </a>
                            . You must accept the EULA before the server can start.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-border bg-muted/50 text-muted-foreground hover:bg-muted/50">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                            onClick={handleAcceptEula}
                        >
                            Accept & Start
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Ngrok Dialog */}
            <AlertDialog open={ngrokDialogOpen} onOpenChange={setNgrokDialogOpen}>
                <AlertDialogContent className="border-border bg-card max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Globe className="h-5 w-5 text-primary" />
                            Enable External Access?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                            Would you like to use ngrok to allow players from outside your network to join this server?
                            This will automatically download and install ngrok, then create a public tunnel to your server.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-3 py-4">
                        <label className="text-sm font-medium text-foreground/80">
                            Ngrok Authtoken <span className="text-destructive">*</span>
                        </label>
                        <Input
                            type="password"
                            placeholder="Enter your ngrok authtoken"
                            value={ngrokAuthtoken}
                            onChange={(e) => {
                                setNgrokAuthtoken(e.target.value)
                                setNgrokAuthtokenError(null)
                            }}
                            className="bg-muted/50 border-border placeholder:text-muted-foreground/40"
                        />
                        {ngrokAuthtokenError && (
                            <p className="text-sm text-destructive">{ngrokAuthtokenError}</p>
                        )}
                        <p className="text-xs text-muted-foreground/60">
                            Get your free authtoken at{" "}
                            <a
                                href="https://dashboard.ngrok.com/get-started/your-authtoken"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                                onClick={(e) => {
                                    e.preventDefault()
                                    window.context.openExternal("https://dashboard.ngrok.com/get-started/your-authtoken")
                                }}
                            >
                                dashboard.ngrok.com
                            </a>
                        </p>
                    </div>
                    <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                        <AlertDialogCancel
                            className="border-border bg-muted/50 text-muted-foreground hover:bg-muted/50"
                            onClick={handleSkipNgrok}
                        >
                            No, local only
                        </AlertDialogCancel>
                        <Button
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                            onClick={(e) => {
                                e.preventDefault()
                                handleEnableNgrok()
                            }}
                            disabled={ngrokInstallProgress === -2}
                        >
                            {ngrokInstallProgress === -2 ? (
                                <span className="flex items-center gap-2">
                                    <Spinner className="h-4 w-4" />
                                    Validating...
                                </span>
                            ) : (
                                "Yes, enable ngrok"
                            )}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Ngrok Installing Dialog */}
            <AlertDialog open={ngrokInstalling}>
                <AlertDialogContent className="border-border bg-card">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Spinner className="h-5 w-5" />
                            {ngrokInstallProgress < 0 ? "Configuring ngrok..." : "Installing ngrok..."}
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="mt-4 text-sm text-muted-foreground">
                                {ngrokInstallProgress < 0 ? (
                                    <p className="text-center text-sm">Setting up your authtoken...</p>
                                ) : (
                                    <>
                                        <div className="h-2 w-full rounded-full bg-muted/50 overflow-hidden">
                                            <div
                                                className="h-full bg-primary rounded-full transition-all duration-300"
                                                style={{ width: `${ngrokInstallProgress}%` }}
                                            />
                                        </div>
                                        <p className="text-center mt-2 text-sm">{ngrokInstallProgress}%</p>
                                    </>
                                )}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent className="border-border bg-card">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete server "{server.name}"?</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                            This action cannot be undone. The server folder and all data
                            will be permanently removed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-border bg-muted/50 text-muted-foreground hover:bg-muted/50">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={handleDeleteServer}
                        >
                            Delete server
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </section>
    )
}
