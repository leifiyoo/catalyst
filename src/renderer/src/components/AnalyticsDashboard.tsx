import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { useServerStore } from '../stores/serverStore'
import { Activity, Users, Zap, Clock } from 'lucide-react'

interface HistoryDataPoint {
  time: string;
  tps: number;
  players: number;
  memory: number;
  cpu: number;
}

export function AnalyticsDashboard() {
  const { servers } = useServerStore()

  // Generate mock data for the 24-hour period
  const historyData = useMemo<HistoryDataPoint[]>(() => {
    const data: HistoryDataPoint[] = []
    const now = new Date()
    for (let i = 24; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60 * 1000)
      const formattedTime = time.getHours() + ':00'
      
      data.push({
        time: formattedTime,
        tps: 18 + Math.random() * 2,
        players: Math.floor(Math.random() * 100),
        memory: 1024 + Math.random() * 2048,
        cpu: Math.random() * 80
      })
    }
    return data
  }, [])

  const averageTPS = useMemo(() => {
    const sum = historyData.reduce((acc, curr) => acc + curr.tps, 0)
    return (sum / historyData.length).toFixed(2)
  }, [historyData])

  const peakPlayers = useMemo(() => {
    return Math.max(...historyData.map((d) => d.players))
  }, [historyData])

  const avgMemory = useMemo(() => {
    const sum = historyData.reduce((acc, curr) => acc + curr.memory, 0)
    return (sum / historyData.length / 1024).toFixed(2)
  }, [historyData])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average TPS</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageTPS}</div>
            <p className="text-xs text-muted-foreground">Across all servers (24h)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Peak Players</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{peakPlayers}</div>
            <p className="text-xs text-muted-foreground">Maximum concurrent players</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Memory</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgMemory} GB</div>
            <p className="text-xs text-muted-foreground">Average RAM usage</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Peak Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">20:00</div>
            <p className="text-xs text-muted-foreground">Highest player activity</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="players" className="space-y-4">
        <TabsList>
          <TabsTrigger value="players">Player Count</TabsTrigger>
          <TabsTrigger value="performance">TPS History</TabsTrigger>
          <TabsTrigger value="resources">Memory Usage</TabsTrigger>
        </TabsList>
        <TabsContent value="players" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>24-Hour Player Count Trends</CardTitle>
              <CardDescription>Real-time player statistics across all active servers.</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData}>
                  <defs>
                    <linearGradient id="colorPlayers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="players"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#colorPlayers)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>24-Hour TPS History</CardTitle>
              <CardDescription>Server performance and stability metrics (Ticks Per Second).</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="time" />
                  <YAxis domain={[10, 20]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="tps"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="resources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Memory Usage Graph</CardTitle>
              <CardDescription>Allocated RAM consumption over time (MB).</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData}>
                  <defs>
                    <linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="memory"
                    stroke="#8b5cf6"
                    fillOpacity={1}
                    fill="url(#colorMemory)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
