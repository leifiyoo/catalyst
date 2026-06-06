import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { useServerStore, Server } from '../stores/serverStore'
import { Copy, Check, ExternalLink } from 'lucide-react'

export function MobileDashboard() {
  const { servers } = useServerStore()
  const [dashboardUrl, setDashboardUrl] = useState<string>('')
  const [copied, setCopied] = useState(false)

  // In a real app, this would get the ngrok URL from your backend
  useEffect(() => {
    // Mock URL - in production, this would come from your server
    const url = `https://your-ngrok-url.ngrok.io/dashboard`
    setDashboardUrl(url)
  }, [])

  const copyToClipboard = () => {
    navigator.clipboard.writeText(dashboardUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const openInNewTab = () => {
    window.open(dashboardUrl, '_blank')
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Mobile Dashboard Link</CardTitle>
          <CardDescription>
            Share this link to access a read-only mobile dashboard via ngrok
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={dashboardUrl}
              readOnly
              className="flex-1 rounded border bg-muted px-3 py-2 text-sm font-mono"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={copyToClipboard}
              className="gap-2"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={openInNewTab}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Open
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Share this link to view server status and console logs on mobile. Read-only access.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Server Status (Mobile View)</CardTitle>
          <CardDescription>
            Real-time server metrics visible on mobile dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {servers.map((server: Server) => (
              <div
                key={server.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex-1">
                  <div className="font-medium">{server.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {server.online ? (
                      <span className="text-green-600">
                        ● Online • {server.players || 0} players
                      </span>
                    ) : (
                      <span className="text-red-600">● Offline</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm">
                    {server.tps?.toFixed(2) || 'N/A'} TPS
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {server.memory || 'N/A'} MB
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Console Logs (Mobile View)</CardTitle>
          <CardDescription>
            Read-only access to latest server console output
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-slate-900 rounded p-3 font-mono text-xs text-white max-h-64 overflow-y-auto">
            <div className="text-green-400">[12:30:45] Server started successfully</div>
            <div className="text-green-400">[12:30:46] Loading world...</div>
            <div className="text-blue-400">[12:30:47] [INFO] 1 player joined</div>
            <div className="text-yellow-400">[12:31:00] [WARN] High memory usage detected</div>
            <div className="text-green-400">[12:31:15] Player built a structure</div>
            <div className="text-gray-400">[Latest logs truncated for display]</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
