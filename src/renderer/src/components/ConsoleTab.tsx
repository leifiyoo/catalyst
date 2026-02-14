import { useState, useEffect, useRef, useCallback, memo } from "react"
import { FixedSizeList as List } from "react-window"
import { Input } from "@/components/ui/input"
import { Send } from "lucide-react"
import type { ConsoleLine } from "@shared/types"

// ═══════════════════════════════════════════════════════════
// ANSI text parser — extracted so it can be used in memoized rows
// ═══════════════════════════════════════════════════════════
function renderAnsiText(text: string) {
    const segments: React.ReactNode[] = []
    const regex = /\x1b\[([0-9;]*)m/g
    let lastIndex = 0
    let color: string | null = null
    let match: RegExpExecArray | null
    let keyIndex = 0

    while ((match = regex.exec(text)) !== null) {
        const chunk = text.slice(lastIndex, match.index)
        if (chunk) {
            segments.push(
                <span key={`ansi-${keyIndex++}`} style={{ color: color ?? undefined }}>
                    {chunk}
                </span>
            )
        }

        const params = match[1]
            .split(";")
            .map((value) => parseInt(value, 10))
            .filter((value) => !Number.isNaN(value))

        if (params.length === 0 || params.includes(0) || params.includes(39)) {
            color = null
        } else {
            const colorIndex = params.indexOf(38)
            if (colorIndex !== -1 && params[colorIndex + 1] === 2) {
                const r = params[colorIndex + 2]
                const g = params[colorIndex + 3]
                const b = params[colorIndex + 4]
                if ([r, g, b].every((value) => typeof value === "number" && !Number.isNaN(value))) {
                    color = `rgb(${r}, ${g}, ${b})`
                }
            }
        }

        lastIndex = regex.lastIndex
    }

    const tail = text.slice(lastIndex)
    if (tail) {
        segments.push(
            <span key={`ansi-${keyIndex++}`} style={{ color: color ?? undefined }}>
                {tail}
            </span>
        )
    }

    return segments
}

// ═══════════════════════════════════════════════════════════
// Memoized console line row — prevents re-renders of unchanged lines
// ═══════════════════════════════════════════════════════════
const ConsoleLineRow = memo(function ConsoleLineRow({
    line,
}: {
    line: ConsoleLine
}) {
    return (
        <div
            className={
                line.type === "stderr"
                    ? "text-destructive"
                    : line.type === "system"
                      ? "text-primary"
                      : "text-[#e8e4df]"
            }
        >
            {renderAnsiText(line.text)}
        </div>
    )
})

// ═══════════════════════════════════════════════════════════
// Virtualized row renderer for react-window
// ═══════════════════════════════════════════════════════════
function RowRenderer({
    index,
    style,
    data,
}: {
    index: number
    style: React.CSSProperties
    data: ConsoleLine[]
}) {
    return (
        <div style={style}>
            <ConsoleLineRow line={data[index]} />
        </div>
    )
}

// ═══════════════════════════════════════════════════════════
// Console Tab Props
// ═══════════════════════════════════════════════════════════
interface ConsoleTabProps {
    serverId: string
    isOnline: boolean
}

const CONSOLE_LINE_HEIGHT = 20
const MAX_CONSOLE_LINES = 300

/**
 * Isolated Console component with its own state to prevent
 * re-renders of the parent ServerDetailPage on every keystroke
 * and console output update.
 */
export function ConsoleTab({ serverId, isOnline }: ConsoleTabProps) {
    const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([])
    const [commandInput, setCommandInput] = useState("")
    const listRef = useRef<List>(null)

    // Fetch initial logs
    useEffect(() => {
        if (!serverId) return

        window.context.getServerLogs(serverId).then((logs) => {
            setConsoleLines((prev) => {
                const all = [...logs, ...prev]
                const seen = new Set<string>()
                return all
                    .filter((l) => {
                        const key = l.timestamp + l.text
                        if (seen.has(key)) return false
                        seen.add(key)
                        return true
                    })
                    .slice(-MAX_CONSOLE_LINES)
            })
        })

        const unsubscribe = window.context.onConsoleOutput((sid, line) => {
            if (sid === serverId) {
                setConsoleLines((prev) => [...prev.slice(-MAX_CONSOLE_LINES), line])
            }
        })
        return unsubscribe
    }, [serverId])

    // Auto-scroll to bottom when new lines arrive
    useEffect(() => {
        if (listRef.current && consoleLines.length > 0) {
            listRef.current.scrollToItem(consoleLines.length - 1, "end")
        }
    }, [consoleLines.length])

    const handleSendCommand = useCallback(() => {
        if (!serverId || !commandInput.trim()) return
        window.context.sendCommand(serverId, commandInput.trim())
        setConsoleLines((prev) => [
            ...prev,
            {
                timestamp: new Date().toISOString(),
                text: `> ${commandInput.trim()}`,
                type: "system",
            },
        ])
        setCommandInput("")
    }, [serverId, commandInput])

    return (
        <div>
            <div className="flex items-center gap-2 mb-3">
                <h2 className="text-lg font-semibold">Console</h2>
                <span
                    className={`h-2 w-2 rounded-full ${isOnline ? "bg-primary animate-pulse" : "bg-muted-foreground/40"}`}
                />
            </div>
            <div className="rounded-xl border border-border overflow-hidden">
                <div className="h-[420px] bg-[#2c2b28] font-mono text-xs text-[#e8e4df] select-text p-4">
                    {consoleLines.length === 0 ? (
                        <p className="text-muted-foreground">
                            {isOnline
                                ? "Waiting for output..."
                                : "Start the server to see console output"}
                        </p>
                    ) : (
                        <List
                            ref={listRef}
                            height={388}
                            itemCount={consoleLines.length}
                            itemSize={CONSOLE_LINE_HEIGHT}
                            width="100%"
                            itemData={consoleLines}
                            overscanCount={20}
                        >
                            {RowRenderer}
                        </List>
                    )}
                </div>
                <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-card/50">
                    <Send className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <Input
                        value={commandInput}
                        onChange={(e) => setCommandInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleSendCommand()
                        }}
                        placeholder={isOnline ? "Send a command" : "Server is offline"}
                        disabled={!isOnline}
                        className="font-mono text-xs border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 h-8"
                    />
                </div>
            </div>
        </div>
    )
}
