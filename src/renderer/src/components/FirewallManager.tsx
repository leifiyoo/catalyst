import { useState, useEffect, useCallback, memo } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Plus,
  RefreshCw,
  Lock,
  Undo2,
  Save,
  ScrollText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react"
import type {
  FirewallRule,
  FirewallAuditEntry,
  ServerRecord,
} from "@shared/types"

type TabView = "rules" | "add" | "lockdown" | "audit"

export function FirewallManager() {
  // State
  const [rules, setRules] = useState<FirewallRule[]>([])
  const [auditLog, setAuditLog] = useState<FirewallAuditEntry[]>([])
  const [loading, setLoading] = useState(true) // Start with loading=true
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabView>("rules")
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [isWindows, setIsWindows] = useState(true)

  // Servers for multi-server support
  const [servers, setServers] = useState<ServerRecord[]>([])
  const [selectedServerId, setSelectedServerId] = useState<string>("")

  // Add rule form
  const [addIp, setAddIp] = useState("")
  const [addPort, setAddPort] = useState("25565")
  const [addProtocol, setAddProtocol] = useState<"TCP" | "UDP">("TCP")
  const [addLabel, setAddLabel] = useState("")
  const [addType, setAddType] = useState<"allow" | "block">("allow")

  // Custom whitelist
  const [customIps, setCustomIps] = useState("")

  // Lockdown
  const [lockdownPort, setLockdownPort] = useState("25565")
  const [lockdownProtocol, setLockdownProtocol] = useState<"TCP" | "UDP">("TCP")

  // Confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    description: string
    code: string
    onConfirm: () => Promise<void>
  }>({ open: false, title: "", description: "", code: "", onConfirm: async () => {} })
  const [confirmInput, setConfirmInput] = useState("")
  const [confirmError, setConfirmError] = useState<string | null>(null)

  // Snapshot
  const [hasSnapshot, setHasSnapshot] = useState(false)

  // Load servers and check admin on mount
  useEffect(() => {
    loadServers()
    initFirewall()
  }, [])

  const initFirewall = async () => {
    setLoading(true)
    try {
      const admin = await window.context.firewallCheckAdmin()
      setIsAdmin(admin)
    } catch {
      // Not on Windows or check failed
      setIsAdmin(false)
      setIsWindows(false)
    }
    await loadRulesInternal()
    await checkSnapshot()
    setLoading(false)
  }

  const loadServers = async () => {
    try {
      const serverList = await window.context.getServers()
      setServers(serverList)
      if (serverList.length > 0 && !selectedServerId) {
        setSelectedServerId(serverList[0].id)
      }
    } catch {
      // ignore
    }
  }

  const loadRulesInternal = async () => {
    setError(null)
    try {
      const result = await window.context.firewallListRules()
      if (result.success && result.rules) {
        setRules(result.rules)
        if (result.isAdmin !== undefined) {
          setIsAdmin(result.isAdmin)
        }
      } else {
        setError(result.error || "Failed to load firewall rules")
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load firewall rules")
    }
  }

  const loadRules = useCallback(async () => {
    setLoading(true)
    await loadRulesInternal()
    setLoading(false)
  }, [])

  const checkSnapshot = async () => {
    try {
      const result = await window.context.firewallLoadSnapshot()
      setHasSnapshot(result.success && !!result.snapshot)
    } catch {
      setHasSnapshot(false)
    }
  }

  const showSuccess = (msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 5000)
  }

  const showConfirmation = async (
    title: string,
    description: string,
    onConfirm: () => Promise<void>
  ) => {
    const code = await window.context.firewallGenerateCode()
    setConfirmDialog({ open: true, title, description, code, onConfirm })
    setConfirmInput("")
    setConfirmError(null)
  }

  const handleConfirm = async () => {
    if (confirmInput.toUpperCase() !== confirmDialog.code.toUpperCase()) {
      setConfirmError("Confirmation code does not match. Please try again.")
      return
    }
    setConfirmDialog((prev) => ({ ...prev, open: false }))
    await confirmDialog.onConfirm()
  }

  // ---- Actions ----

  const handleDeleteRule = async (ruleName: string) => {
    showConfirmation(
      "Delete Firewall Rule",
      `You are about to delete the firewall rule "${ruleName}". This action cannot be undone.`,
      async () => {
        setLoading(true)
        try {
          const result = await window.context.firewallDeleteRule(ruleName)
          if (result.success) {
            showSuccess(`Rule "${ruleName}" deleted successfully`)
            await loadRules()
          } else {
            setError(result.error || "Failed to delete rule")
          }
        } catch (err: any) {
          setError(err?.message || "Failed to delete rule")
        } finally {
          setLoading(false)
        }
      }
    )
  }

  const handleDeleteAllRules = async () => {
    showConfirmation(
      "Delete All Catalyst Firewall Rules",
      `You are about to delete ALL ${rules.length} Catalyst-managed firewall rules. This is a destructive action.`,
      async () => {
        setLoading(true)
        try {
          const result = await window.context.firewallDeleteAllRules()
          if (result.success) {
            showSuccess(`Deleted ${result.deletedCount} rules successfully`)
            await loadRules()
          } else {
            setError(result.error || "Failed to delete rules")
          }
        } catch (err: any) {
          setError(err?.message || "Failed to delete rules")
        } finally {
          setLoading(false)
        }
      }
    )
  }

  const handleAddRule = async () => {
    setLoading(true)
    setError(null)
    try {
      const port = parseInt(addPort, 10)
      if (isNaN(port) || port < 1 || port > 65535) {
        setError("Invalid port number (1-65535)")
        setLoading(false)
        return
      }

      if (addType === "allow") {
        if (!addIp.trim()) {
          setError("IP address is required for allow rules")
          setLoading(false)
          return
        }
        const result = await window.context.firewallAddAllowRule(
          addIp.trim(),
          port,
          addProtocol,
          addLabel.trim() || undefined
        )
        if (result.success) {
          showSuccess(`Allow rule created: ${result.ruleName}`)
          setAddIp("")
          setAddLabel("")
          await loadRules()
        } else {
          setError(result.error || "Failed to add rule")
        }
      } else {
        const result = await window.context.firewallAddBlockRule(port, addProtocol)
        if (result.success) {
          showSuccess(`Block rule created: ${result.ruleName}`)
          await loadRules()
        } else {
          setError(result.error || "Failed to add rule")
        }
      }
    } catch (err: any) {
      setError(err?.message || "Failed to add rule")
    } finally {
      setLoading(false)
    }
  }

  const handleAddCustomWhitelist = async () => {
    const ips = customIps
      .split(/[\n,;]+/)
      .map((ip) => ip.trim())
      .filter(Boolean)

    if (ips.length === 0) {
      setError("Please enter at least one IP address")
      return
    }

    const port = parseInt(addPort, 10)
    if (isNaN(port) || port < 1 || port > 65535) {
      setError("Invalid port number (1-65535)")
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await window.context.firewallAddCustomWhitelist(ips, port, addProtocol)
      if (result.success) {
        showSuccess(`Added ${result.addedCount} custom whitelist rules`)
        setCustomIps("")
        await loadRules()
      } else {
        setError(result.error || "Failed to add custom whitelist rules")
      }
    } catch (err: any) {
      setError(err?.message || "Failed to add custom whitelist rules")
    } finally {
      setLoading(false)
    }
  }

  const handleTcpShieldLockdown = async () => {
    const port = parseInt(lockdownPort, 10)
    if (isNaN(port) || port < 1 || port > 65535) {
      setError("Invalid port number (1-65535)")
      return
    }

    showConfirmation(
      "TCPShield Lockdown",
      `This will create firewall rules to ONLY allow traffic from TCPShield IP ranges on port ${port}/${lockdownProtocol}, and BLOCK all other incoming traffic on that port. A snapshot of current rules will be saved for rollback.`,
      async () => {
        setLoading(true)
        setError(null)
        try {
          const result = await window.context.firewallTcpShieldLockdown(port, lockdownProtocol)
          if (result.success) {
            showSuccess(`TCPShield lockdown applied on port ${port}/${lockdownProtocol}`)
            await loadRules()
            await checkSnapshot()
          } else {
            setError(result.error || "Lockdown failed")
          }
        } catch (err: any) {
          setError(err?.message || "Lockdown failed")
        } finally {
          setLoading(false)
        }
      }
    )
  }

  const handleSaveSnapshot = async () => {
    setLoading(true)
    try {
      const result = await window.context.firewallSaveSnapshot()
      if (result.success) {
        showSuccess("Snapshot saved successfully")
        setHasSnapshot(true)
      } else {
        setError(result.error || "Failed to save snapshot")
      }
    } catch (err: any) {
      setError(err?.message || "Failed to save snapshot")
    } finally {
      setLoading(false)
    }
  }

  const handleRollback = async () => {
    showConfirmation(
      "Rollback Firewall Rules",
      "This will delete all current Catalyst firewall rules and restore them from the last saved snapshot.",
      async () => {
        setLoading(true)
        try {
          const result = await window.context.firewallRollback()
          if (result.success) {
            showSuccess("Rollback completed successfully")
            await loadRules()
          } else {
            setError(result.error || "Rollback failed")
          }
        } catch (err: any) {
          setError(err?.message || "Rollback failed")
        } finally {
          setLoading(false)
        }
      }
    )
  }

  const handleLoadAuditLog = async () => {
    try {
      const log = await window.context.firewallGetAuditLog()
      setAuditLog(log)
    } catch {
      setError("Failed to load audit log")
    }
  }

  // Get port from selected server
  useEffect(() => {
    if (selectedServerId) {
      const server = servers.find((s) => s.id === selectedServerId)
      if (server) {
        // Try to get port from server properties
        window.context.getServerProperties(server.id).then((props) => {
          const portProp = props.find((p) => p.key === "server-port")
          if (portProp) {
            setAddPort(portProp.value)
            setLockdownPort(portProp.value)
          }
        }).catch(() => {})
      }
    }
  }, [selectedServerId, servers])

  const tabButtonClass = (tab: TabView) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      activeTab === tab
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:text-foreground hover:bg-muted"
    }`

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Windows Firewall Manager
        </CardTitle>
        <CardDescription>
          Manage Windows Firewall rules to protect your game servers. Only allows traffic from trusted sources like TCPShield.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Server selector */}
        {servers.length > 1 && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Target Server</label>
            <Select value={selectedServerId} onValueChange={setSelectedServerId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a server" />
              </SelectTrigger>
              <SelectContent>
                {servers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.framework} {s.version})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Platform / admin warnings */}
        {!isWindows && (
          <Alert className="border-amber-500/40 bg-amber-500/10">
            <ShieldOff className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-amber-500">Not Available</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              Windows Firewall management is only available on Windows systems.
            </AlertDescription>
          </Alert>
        )}
        {isWindows && isAdmin === false && (
          <Alert className="border-amber-500/40 bg-amber-500/10">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-amber-500">Limited Access</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              Catalyst is not running with administrator privileges. You can view existing rules, but adding or removing rules requires running as Administrator.
            </AlertDescription>
          </Alert>
        )}

        {/* Status alerts */}
        {error && (
          <Alert className="border-destructive/40 bg-destructive/10">
            <XCircle className="h-4 w-4 text-destructive" />
            <AlertTitle className="text-destructive">Error</AlertTitle>
            <AlertDescription className="text-muted-foreground">{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="border-primary/40 bg-primary/10">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <AlertTitle className="text-primary">Success</AlertTitle>
            <AlertDescription className="text-muted-foreground">{success}</AlertDescription>
          </Alert>
        )}

        {/* Tab navigation */}
        <div className="flex gap-2 border-b border-border pb-3">
          <button className={tabButtonClass("rules")} onClick={() => setActiveTab("rules")}>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" /> Rules
            </span>
          </button>
          <button className={tabButtonClass("add")} onClick={() => setActiveTab("add")}>
            <span className="flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Add Rule
            </span>
          </button>
          <button className={tabButtonClass("lockdown")} onClick={() => setActiveTab("lockdown")}>
            <span className="flex items-center gap-1.5">
              <Lock className="h-4 w-4" /> TCPShield Lockdown
            </span>
          </button>
          <button
            className={tabButtonClass("audit")}
            onClick={() => {
              setActiveTab("audit")
              handleLoadAuditLog()
            }}
          >
            <span className="flex items-center gap-1.5">
              <ScrollText className="h-4 w-4" /> Audit Log
            </span>
          </button>
        </div>

        {/* Rules Tab */}
        {activeTab === "rules" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {rules.length} Catalyst-managed rule{rules.length !== 1 ? "s" : ""}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={loadRules} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button variant="outline" size="sm" onClick={handleSaveSnapshot} disabled={loading || isAdmin === false}>
                  <Save className="h-4 w-4 mr-1" />
                  Save Snapshot
                </Button>
                {hasSnapshot && (
                  <Button variant="outline" size="sm" onClick={handleRollback} disabled={loading || isAdmin === false}>
                    <Undo2 className="h-4 w-4 mr-1" />
                    Rollback
                  </Button>
                )}
                {rules.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteAllRules}
                    disabled={loading || isAdmin === false}
                    className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete All
                  </Button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="h-8 w-8 text-primary" />
              </div>
            ) : rules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShieldAlert className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No Catalyst firewall rules found.</p>
                <p className="text-sm mt-1">Add rules or use TCPShield Lockdown to get started.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {rules.map((rule, idx) => (
                  <div
                    key={`${rule.name}-${idx}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{rule.name}</p>
                        <Badge
                          variant={rule.action === "Allow" ? "default" : "destructive"}
                          className="text-xs"
                        >
                          {rule.action}
                        </Badge>
                        {rule.enabled ? (
                          <Badge variant="outline" className="text-xs text-green-500 border-green-500/30">
                            Enabled
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Disabled
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {rule.direction} | {rule.protocol} | Port: {rule.localPort} | Remote: {rule.remoteAddress}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteRule(rule.name)}
                      disabled={isAdmin === false}
                      className="text-destructive hover:bg-destructive/10 ml-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Add Rule Tab */}
        {activeTab === "add" && (
          <div className="space-y-6">
            {/* Single rule */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Add Single Rule</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Rule Type</label>
                  <Select value={addType} onValueChange={(v) => setAddType(v as "allow" | "block")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="allow">Allow</SelectItem>
                      <SelectItem value="block">Block</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Protocol</label>
                  <Select value={addProtocol} onValueChange={(v) => setAddProtocol(v as "TCP" | "UDP")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TCP">TCP</SelectItem>
                      <SelectItem value="UDP">UDP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Port</label>
                  <Input
                    type="number"
                    min={1}
                    max={65535}
                    value={addPort}
                    onChange={(e) => setAddPort(e.target.value)}
                    placeholder="25565"
                  />
                </div>
                {addType === "allow" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">IP / CIDR</label>
                    <Input
                      value={addIp}
                      onChange={(e) => setAddIp(e.target.value)}
                      placeholder="192.168.1.0/24"
                    />
                  </div>
                )}
              </div>
              {addType === "allow" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Label (optional)</label>
                  <Input
                    value={addLabel}
                    onChange={(e) => setAddLabel(e.target.value)}
                    placeholder="My trusted IP"
                  />
                </div>
              )}
              <Button onClick={handleAddRule} disabled={loading || isAdmin === false}>
                {loading ? <Spinner className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Add Rule
              </Button>
            </div>

            {/* Bulk whitelist */}
            <div className="border-t border-border pt-6 space-y-4">
              <h3 className="text-sm font-semibold">Bulk Custom IP Whitelist</h3>
              <p className="text-xs text-muted-foreground">
                Enter multiple IPs or CIDR ranges, one per line or separated by commas.
              </p>
              <textarea
                className="w-full h-32 rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                value={customIps}
                onChange={(e) => setCustomIps(e.target.value)}
                placeholder={"192.168.1.100\n10.0.0.0/24\n172.16.0.1"}
              />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Port</label>
                  <Input
                    type="number"
                    min={1}
                    max={65535}
                    value={addPort}
                    onChange={(e) => setAddPort(e.target.value)}
                    placeholder="25565"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Protocol</label>
                  <Select value={addProtocol} onValueChange={(v) => setAddProtocol(v as "TCP" | "UDP")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TCP">TCP</SelectItem>
                      <SelectItem value="UDP">UDP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleAddCustomWhitelist} disabled={loading || isAdmin === false}>
                {loading ? <Spinner className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Add Whitelist Rules
              </Button>
            </div>
          </div>
        )}

        {/* TCPShield Lockdown Tab */}
        {activeTab === "lockdown" && (
          <div className="space-y-6">
            <Alert className="border-amber-500/40 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertTitle className="text-amber-500">Important</AlertTitle>
              <AlertDescription className="text-muted-foreground">
                TCPShield Lockdown will create allow rules for all TCPShield IP ranges and a block rule for all other traffic on the specified port. This ensures only traffic proxied through TCPShield can reach your server. A snapshot will be saved automatically before applying changes.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Game Port</label>
                <Input
                  type="number"
                  min={1}
                  max={65535}
                  value={lockdownPort}
                  onChange={(e) => setLockdownPort(e.target.value)}
                  placeholder="25565"
                />
                <p className="text-xs text-muted-foreground">
                  Default Minecraft port is 25565
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Protocol</label>
                <Select
                  value={lockdownProtocol}
                  onValueChange={(v) => setLockdownProtocol(v as "TCP" | "UDP")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TCP">TCP</SelectItem>
                    <SelectItem value="UDP">UDP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleTcpShieldLockdown}
                disabled={loading || isAdmin === false}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {loading ? (
                  <Spinner className="h-4 w-4 mr-2" />
                ) : (
                  <Lock className="h-4 w-4 mr-2" />
                )}
                Apply TCPShield Lockdown
              </Button>
              {hasSnapshot && (
                <Button variant="outline" onClick={handleRollback} disabled={loading || isAdmin === false}>
                  <Undo2 className="h-4 w-4 mr-2" />
                  Rollback to Snapshot
                </Button>
              )}
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold mb-2">TCPShield IP Ranges</h3>
              <p className="text-xs text-muted-foreground mb-3">
                These IP ranges will be whitelisted when applying the lockdown.
              </p>
              <TcpShieldIpList />
            </div>
          </div>
        )}

        {/* Audit Log Tab */}
        {activeTab === "audit" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {auditLog.length} log entries
              </p>
              <Button variant="outline" size="sm" onClick={handleLoadAuditLog}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
            {auditLog.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ScrollText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No audit log entries yet.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {[...auditLog].reverse().map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30"
                  >
                    {entry.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{entry.action}</p>
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{entry.details}</p>
                      {entry.error && (
                        <p className="text-xs text-destructive mt-0.5">{entry.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => {
          if (!open) setConfirmDialog((prev) => ({ ...prev, open: false }))
        }}
      >
        <AlertDialogContent className="border-border bg-popover">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {confirmDialog.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {confirmDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm">
              To confirm, type the following code:{" "}
              <code className="bg-muted px-2 py-1 rounded font-mono text-primary font-bold tracking-wider">
                {confirmDialog.code}
              </code>
            </p>
            <Input
              value={confirmInput}
              onChange={(e) => {
                setConfirmInput(e.target.value)
                setConfirmError(null)
              }}
              placeholder="Enter confirmation code"
              className="font-mono tracking-wider"
            />
            {confirmError && (
              <p className="text-sm text-destructive">{confirmError}</p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border bg-transparent text-foreground hover:bg-muted">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirm()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

const TcpShieldIpList = memo(function TcpShieldIpList() {
  const [ips, setIps] = useState<string[]>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    window.context.firewallGetTcpShieldIps().then(setIps).catch(() => {})
  }, [])

  const displayIps = expanded ? ips : ips.slice(0, 8)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {displayIps.map((ip) => (
          <Badge key={ip} variant="outline" className="text-xs font-mono">
            {ip}
          </Badge>
        ))}
      </div>
      {ips.length > 8 && (
        <button
          className="text-xs text-primary hover:underline"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show less" : `Show all ${ips.length} ranges`}
        </button>
      )}
    </div>
  )
})
