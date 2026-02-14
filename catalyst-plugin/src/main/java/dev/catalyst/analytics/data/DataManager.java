package dev.catalyst.analytics.data;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import dev.catalyst.analytics.CatalystAnalyticsPlugin;

import java.io.*;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.logging.Level;

/**
 * Manages all analytics data with JSON file persistence.
 * All collections are thread-safe for async access.
 * Uses batched writes — data is only written to disk periodically, not on every event.
 */
public class DataManager {

    private final CatalystAnalyticsPlugin plugin;
    private final File dataFolder;
    private final Gson gson;

    // --- Player tracking ---
    private final ConcurrentHashMap<String, PlayerData> players = new ConcurrentHashMap<>();
    private final Set<String> uniquePlayers = ConcurrentHashMap.newKeySet();
    private volatile int peakOnline = 0;

    // --- TPS history ---
    private final CopyOnWriteArrayList<TimestampedValue> tpsHistory = new CopyOnWriteArrayList<>();

    // --- MSPT history ---
    private final CopyOnWriteArrayList<TimestampedValue> msptHistory = new CopyOnWriteArrayList<>();

    // --- Memory history ---
    private final CopyOnWriteArrayList<TimestampedValue> memoryHistory = new CopyOnWriteArrayList<>();

    // --- Player count timeline ---
    private final CopyOnWriteArrayList<TimestampedValue> playerCountTimeline = new CopyOnWriteArrayList<>();

    // --- Geolocation cache: IP -> GeoData ---
    private final ConcurrentHashMap<String, GeoData> geoCache = new ConcurrentHashMap<>();

    // --- Hourly join counts: hour (0-23) -> count ---
    private final ConcurrentHashMap<Integer, Long> hourlyJoins = new ConcurrentHashMap<>();

    // --- Server start time ---
    private final String serverStartTime = Instant.now().toString();

    // --- Server-wide stats ---
    private volatile long totalJoins = 0;
    private volatile long totalChatMessages = 0;
    private volatile long totalCommandsExecuted = 0;
    private volatile long totalBlocksPlaced = 0;
    private volatile long totalBlocksBroken = 0;
    private volatile long totalDeaths = 0;
    private volatile long totalKills = 0;

    // --- Dirty flag for batched writes ---
    private volatile boolean dirty = false;

    public DataManager(CatalystAnalyticsPlugin plugin) {
        this.plugin = plugin;
        this.dataFolder = new File(plugin.getDataFolder(), "data");
        if (!dataFolder.exists()) {
            dataFolder.mkdirs();
        }
        this.gson = new GsonBuilder().setPrettyPrinting().create();
    }

    // ========== Player Data ==========

    public PlayerData getOrCreatePlayer(String uuid, String name) {
        return players.computeIfAbsent(uuid, k -> {
            PlayerData pd = new PlayerData();
            pd.uuid = uuid;
            pd.name = name;
            pd.firstJoin = Instant.now().toString();
            pd.isNew = true;
            return pd;
        });
    }

    public PlayerData getPlayer(String uuid) {
        return players.get(uuid);
    }

    public Map<String, PlayerData> getAllPlayers() {
        return Collections.unmodifiableMap(players);
    }

    public void recordJoin(String uuid, String name) {
        PlayerData pd = getOrCreatePlayer(uuid, name);
        pd.name = name;
        pd.lastJoin = Instant.now().toString();
        pd.joinCount++;
        pd.online = true;
        uniquePlayers.add(uuid);
        totalJoins++;
        dirty = true;

        // Track hourly joins
        int hour = java.time.ZonedDateTime.now(java.time.ZoneOffset.UTC).getHour();
        hourlyJoins.merge(hour, 1L, Long::sum);

        // Update peak
        int currentOnline = (int) players.values().stream().filter(p -> p.online).count();
        if (currentOnline > peakOnline) {
            peakOnline = currentOnline;
        }
    }

    public void recordLeave(String uuid) {
        PlayerData pd = players.get(uuid);
        if (pd != null) {
            pd.online = false;
            if (pd.lastJoin != null) {
                try {
                    Instant joinTime = Instant.parse(pd.lastJoin);
                    long sessionSeconds = Instant.now().getEpochSecond() - joinTime.getEpochSecond();
                    if (sessionSeconds > 0) {
                        pd.totalPlayTimeSeconds += sessionSeconds;
                    }
                } catch (Exception ignored) {}
            }
            pd.lastLeave = Instant.now().toString();
            dirty = true;
        }
    }

    public void recordChat(String uuid) {
        PlayerData pd = players.get(uuid);
        if (pd != null) pd.chatMessages++;
        totalChatMessages++;
        dirty = true;
    }

    public void recordDeath(String uuid) {
        PlayerData pd = players.get(uuid);
        if (pd != null) pd.deaths++;
        totalDeaths++;
        dirty = true;
    }

    public void recordKill(String uuid) {
        PlayerData pd = players.get(uuid);
        if (pd != null) pd.kills++;
        totalKills++;
        dirty = true;
    }

    public void recordBlockPlaced(String uuid) {
        PlayerData pd = players.get(uuid);
        if (pd != null) pd.blocksPlaced++;
        totalBlocksPlaced++;
        dirty = true;
    }

    public void recordBlockBroken(String uuid) {
        PlayerData pd = players.get(uuid);
        if (pd != null) pd.blocksBroken++;
        totalBlocksBroken++;
        dirty = true;
    }

    public void recordCommand(String uuid) {
        PlayerData pd = players.get(uuid);
        if (pd != null) pd.commandsExecuted++;
        totalCommandsExecuted++;
        dirty = true;
    }

    public void setPlayerClientVersion(String uuid, int protocolVersion) {
        PlayerData pd = players.get(uuid);
        if (pd != null) {
            pd.protocolVersion = protocolVersion;
            pd.clientVersion = ProtocolVersionMapper.map(protocolVersion);
            dirty = true;
        }
    }

    public void setPlayerClientBrand(String uuid, String brand) {
        PlayerData pd = players.get(uuid);
        if (pd != null) {
            pd.clientBrand = brand;
            dirty = true;
        }
    }

    public void setPlayerOs(String uuid, String os) {
        PlayerData pd = players.get(uuid);
        if (pd != null) {
            pd.os = os;
            dirty = true;
        }
    }

    public void setPlayerGeo(String uuid, GeoData geo) {
        PlayerData pd = players.get(uuid);
        if (pd != null) {
            pd.country = geo.country;
            pd.region = geo.regionName;
            pd.city = geo.city;
            dirty = true;
        }
    }

    // ========== TPS ==========

    public void addTpsSample(double tps) {
        tpsHistory.add(new TimestampedValue(Instant.now().toString(), tps));
        dirty = true;
    }

    public List<TimestampedValue> getTpsHistory() {
        return Collections.unmodifiableList(tpsHistory);
    }

    // ========== MSPT ==========

    public void addMsptSample(double mspt) {
        msptHistory.add(new TimestampedValue(Instant.now().toString(), mspt));
        dirty = true;
    }

    public List<TimestampedValue> getMsptHistory() {
        return Collections.unmodifiableList(msptHistory);
    }

    // ========== Memory ==========

    public void addMemorySample(double usedMB, double maxMB) {
        memoryHistory.add(new TimestampedValue(Instant.now().toString(), usedMB, maxMB));
        dirty = true;
    }

    public List<TimestampedValue> getMemoryHistory() {
        return Collections.unmodifiableList(memoryHistory);
    }

    // ========== Player Count Timeline ==========

    public void addPlayerCountSnapshot(int count) {
        playerCountTimeline.add(new TimestampedValue(Instant.now().toString(), count));
        dirty = true;
    }

    public List<TimestampedValue> getPlayerCountTimeline() {
        return Collections.unmodifiableList(playerCountTimeline);
    }

    // ========== Geo Cache ==========

    public void cacheGeo(String ip, GeoData data) {
        geoCache.put(ip, data);
    }

    public GeoData getCachedGeo(String ip) {
        return geoCache.get(ip);
    }

    // ========== Getters ==========

    public int getPeakOnline() { return peakOnline; }
    public int getUniquePlayerCount() { return uniquePlayers.size(); }
    public long getTotalJoins() { return totalJoins; }
    public long getTotalChatMessages() { return totalChatMessages; }
    public long getTotalCommandsExecuted() { return totalCommandsExecuted; }
    public long getTotalBlocksPlaced() { return totalBlocksPlaced; }
    public long getTotalBlocksBroken() { return totalBlocksBroken; }
    public long getTotalDeaths() { return totalDeaths; }
    public long getTotalKills() { return totalKills; }
    public Map<Integer, Long> getHourlyJoins() { return Collections.unmodifiableMap(hourlyJoins); }

    public int getCurrentOnline() {
        return (int) players.values().stream().filter(p -> p.online).count();
    }

    public double getAveragePlayTimeSeconds() {
        if (players.isEmpty()) return 0;
        return players.values().stream()
                .mapToLong(p -> p.totalPlayTimeSeconds)
                .average()
                .orElse(0);
    }

    public long getNewPlayerCount() {
        return players.values().stream().filter(p -> p.isNew).count();
    }

    public long getReturningPlayerCount() {
        return players.values().stream().filter(p -> !p.isNew && p.joinCount > 1).count();
    }

    // ========== Persistence (Batched) ==========

    public synchronized void saveAll() {
        try {
            saveJson("players.json", players);
            saveJson("tps_history.json", tpsHistory);
            saveJson("mspt_history.json", msptHistory);
            saveJson("memory_history.json", memoryHistory);
            saveJson("player_count_timeline.json", playerCountTimeline);
            saveJson("geo_cache.json", geoCache);
            saveJson("hourly_joins.json", hourlyJoins);

            // Save server-wide stats
            Map<String, Object> serverStats = new HashMap<>();
            serverStats.put("peakOnline", peakOnline);
            serverStats.put("totalJoins", totalJoins);
            serverStats.put("totalChatMessages", totalChatMessages);
            serverStats.put("totalCommandsExecuted", totalCommandsExecuted);
            serverStats.put("totalBlocksPlaced", totalBlocksPlaced);
            serverStats.put("totalBlocksBroken", totalBlocksBroken);
            serverStats.put("totalDeaths", totalDeaths);
            serverStats.put("totalKills", totalKills);
            serverStats.put("uniquePlayers", new ArrayList<>(uniquePlayers));
            saveJson("server_stats.json", serverStats);

            // Write combined analytics.json for Electron app to read
            writeCombinedAnalyticsJson();
            dirty = false;
        } catch (Exception e) {
            plugin.getLogger().log(Level.WARNING, "Failed to save analytics data", e);
        }
    }

    /**
     * Writes a single combined analytics.json file that the Catalyst Electron app
     * reads directly from the filesystem. No API needed.
     */
    private void writeCombinedAnalyticsJson() {
        try {
            Map<String, Object> combined = new LinkedHashMap<>();

            // Overview
            Map<String, Object> overview = new LinkedHashMap<>();
            overview.put("currentOnline", getCurrentOnline());
            overview.put("peakOnline", peakOnline);
            overview.put("uniquePlayers", uniquePlayers.size());
            overview.put("totalJoins", totalJoins);
            overview.put("newPlayers", getNewPlayerCount());
            overview.put("returningPlayers", getReturningPlayerCount());
            overview.put("averagePlayTimeSeconds", getAveragePlayTimeSeconds());
            overview.put("totalChatMessages", totalChatMessages);
            overview.put("totalCommandsExecuted", totalCommandsExecuted);
            overview.put("totalBlocksPlaced", totalBlocksPlaced);
            overview.put("totalBlocksBroken", totalBlocksBroken);
            overview.put("totalDeaths", totalDeaths);
            overview.put("totalKills", totalKills);

            // Current TPS and memory
            Runtime rt = Runtime.getRuntime();
            double usedMB = (rt.totalMemory() - rt.freeMemory()) / (1024.0 * 1024.0);
            double maxMB = rt.maxMemory() / (1024.0 * 1024.0);
            overview.put("memoryUsedMB", Math.round(usedMB * 10.0) / 10.0);
            overview.put("memoryMaxMB", Math.round(maxMB * 10.0) / 10.0);

            // Get latest TPS from history
            if (!tpsHistory.isEmpty()) {
                overview.put("currentTps", tpsHistory.get(tpsHistory.size() - 1).value);
            }

            // Get latest MSPT from history
            if (!msptHistory.isEmpty()) {
                overview.put("currentMspt", msptHistory.get(msptHistory.size() - 1).value);
            }

            // Hourly joins
            Map<String, Long> hourlyJoinsStr = new LinkedHashMap<>();
            for (Map.Entry<Integer, Long> entry : hourlyJoins.entrySet()) {
                hourlyJoinsStr.put(String.valueOf(entry.getKey()), entry.getValue());
            }
            overview.put("hourlyJoins", hourlyJoinsStr);
            overview.put("serverStartTime", serverStartTime);

            combined.put("overview", overview);

            // Players list
            List<Map<String, Object>> playersList = new ArrayList<>();
            for (PlayerData pd : players.values()) {
                Map<String, Object> pm = new LinkedHashMap<>();
                pm.put("uuid", pd.uuid);
                pm.put("name", pd.name);
                pm.put("online", pd.online);
                pm.put("firstJoin", pd.firstJoin);
                pm.put("lastJoin", pd.lastJoin);
                pm.put("joinCount", pd.joinCount);
                pm.put("totalPlayTimeSeconds", pd.totalPlayTimeSeconds);
                pm.put("country", pd.country);
                pm.put("region", pd.region);
                pm.put("os", pd.os);
                pm.put("clientVersion", pd.clientVersion);
                pm.put("clientBrand", pd.clientBrand);
                pm.put("chatMessages", pd.chatMessages);
                pm.put("deaths", pd.deaths);
                pm.put("kills", pd.kills);
                pm.put("blocksPlaced", pd.blocksPlaced);
                pm.put("blocksBroken", pd.blocksBroken);
                pm.put("commandsExecuted", pd.commandsExecuted);
                playersList.add(pm);
            }
            combined.put("players", playersList);

            // TPS history (last 100 entries)
            combined.put("tps", buildTimeseriesList(tpsHistory, "tps", 100));

            // MSPT history (last 100 entries)
            combined.put("mspt", buildTimeseriesList(msptHistory, "mspt", 100));

            // Memory history (last 100 entries)
            List<Map<String, Object>> memList = new ArrayList<>();
            int memStart = Math.max(0, memoryHistory.size() - 100);
            for (int i = memStart; i < memoryHistory.size(); i++) {
                TimestampedValue tv = memoryHistory.get(i);
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("timestamp", tv.timestamp);
                m.put("usedMB", tv.value);
                m.put("maxMB", tv.value2);
                memList.add(m);
            }
            combined.put("memory", memList);

            // Player count timeline (last 100 entries)
            List<Map<String, Object>> timelineList = new ArrayList<>();
            int tlStart = Math.max(0, playerCountTimeline.size() - 100);
            for (int i = tlStart; i < playerCountTimeline.size(); i++) {
                TimestampedValue tv = playerCountTimeline.get(i);
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("timestamp", tv.timestamp);
                m.put("players", (int) tv.value);
                timelineList.add(m);
            }
            combined.put("timeline", timelineList);

            // Geo distribution
            combined.put("geo", buildAggregation(players.values(), pd -> pd.country, "country"));

            // Version distribution
            combined.put("versions", buildAggregation(players.values(), pd -> pd.clientVersion, "version"));

            // Client brand distribution
            combined.put("clients", buildAggregation(players.values(), pd -> pd.clientBrand, "client"));

            // OS distribution
            combined.put("operatingSystems", buildAggregation(players.values(), pd -> pd.os, "os"));

            // Tracking config (expose to UI)
            Map<String, Boolean> trackingConfig = new LinkedHashMap<>();
            trackingConfig.put("track-player-joins", plugin.isTrackingEnabled("track-player-joins", "stats.player-join-leave"));
            trackingConfig.put("track-player-versions", plugin.isTrackingEnabled("track-player-versions", "stats.client-version"));
            trackingConfig.put("track-player-clients", plugin.isTrackingEnabled("track-player-clients", "stats.client-os"));
            trackingConfig.put("track-geolocation", plugin.isTrackingEnabled("track-geolocation", "stats.geolocation"));
            trackingConfig.put("track-os", plugin.isTrackingEnabled("track-os", "stats.client-os"));
            trackingConfig.put("track-tps", plugin.isTrackingEnabled("track-tps", "stats.tps-history"));
            trackingConfig.put("track-ram", plugin.isTrackingEnabled("track-ram", "stats.memory-history"));
            trackingConfig.put("track-playtime", plugin.isTrackingEnabled("track-playtime", "stats.play-time"));
            trackingConfig.put("track-fps", plugin.getConfig().getBoolean("tracking.track-fps", true));
            combined.put("trackingConfig", trackingConfig);

            // Timestamp of this snapshot
            combined.put("lastUpdated", Instant.now().toString());

            // Write to analytics.json in the plugin's data folder (atomic write)
            File analyticsFile = new File(dataFolder, "analytics.json");
            File tmpFile = new File(dataFolder, "analytics.json.tmp");
            try (Writer writer = new OutputStreamWriter(new FileOutputStream(tmpFile), StandardCharsets.UTF_8)) {
                gson.toJson(combined, writer);
            }
            if (analyticsFile.exists()) {
                analyticsFile.delete();
            }
            tmpFile.renameTo(analyticsFile);
        } catch (Exception e) {
            plugin.getLogger().log(Level.WARNING, "Failed to write combined analytics.json", e);
        }
    }

    /**
     * Build a timeseries list from history data.
     */
    private List<Map<String, Object>> buildTimeseriesList(List<TimestampedValue> history, String valueKey, int limit) {
        List<Map<String, Object>> list = new ArrayList<>();
        int start = Math.max(0, history.size() - limit);
        for (int i = start; i < history.size(); i++) {
            TimestampedValue tv = history.get(i);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("timestamp", tv.timestamp);
            m.put(valueKey, tv.value);
            list.add(m);
        }
        return list;
    }

    /**
     * Build an aggregation (count by field) from player data.
     */
    private interface FieldExtractor {
        String extract(PlayerData pd);
    }

    private List<Map<String, Object>> buildAggregation(Collection<PlayerData> playerData, FieldExtractor extractor, String keyName) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (PlayerData pd : playerData) {
            String value = extractor.extract(pd);
            if (value != null && !value.isEmpty()) {
                counts.merge(value, 1, Integer::sum);
            }
        }
        List<Map<String, Object>> result = new ArrayList<>();
        counts.entrySet().stream()
                .sorted((a, b) -> b.getValue() - a.getValue())
                .forEach(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put(keyName, e.getKey());
                    m.put("count", e.getValue());
                    result.add(m);
                });
        return result;
    }

    @SuppressWarnings("unchecked")
    public synchronized void loadAll() {
        try {
            // Load players
            Type playerMapType = new TypeToken<ConcurrentHashMap<String, PlayerData>>() {}.getType();
            ConcurrentHashMap<String, PlayerData> loadedPlayers = loadJson("players.json", playerMapType);
            if (loadedPlayers != null) {
                loadedPlayers.values().forEach(p -> {
                    p.online = false;
                    p.isNew = false;
                });
                players.putAll(loadedPlayers);
            }

            // Load TPS history
            Type tpsListType = new TypeToken<CopyOnWriteArrayList<TimestampedValue>>() {}.getType();
            CopyOnWriteArrayList<TimestampedValue> loadedTps = loadJson("tps_history.json", tpsListType);
            if (loadedTps != null) tpsHistory.addAll(loadedTps);

            // Load MSPT history
            CopyOnWriteArrayList<TimestampedValue> loadedMspt = loadJson("mspt_history.json", tpsListType);
            if (loadedMspt != null) msptHistory.addAll(loadedMspt);

            // Load memory history
            CopyOnWriteArrayList<TimestampedValue> loadedMem = loadJson("memory_history.json", tpsListType);
            if (loadedMem != null) memoryHistory.addAll(loadedMem);

            // Load player count timeline
            CopyOnWriteArrayList<TimestampedValue> loadedPc = loadJson("player_count_timeline.json", tpsListType);
            if (loadedPc != null) playerCountTimeline.addAll(loadedPc);

            // Load geo cache
            Type geoCacheType = new TypeToken<ConcurrentHashMap<String, GeoData>>() {}.getType();
            ConcurrentHashMap<String, GeoData> loadedGeo = loadJson("geo_cache.json", geoCacheType);
            if (loadedGeo != null) geoCache.putAll(loadedGeo);

            // Load hourly joins
            Type hourlyType = new TypeToken<ConcurrentHashMap<Integer, Long>>() {}.getType();
            ConcurrentHashMap<Integer, Long> loadedHourly = loadJson("hourly_joins.json", hourlyType);
            if (loadedHourly != null) hourlyJoins.putAll(loadedHourly);

            // Load server stats
            Type mapType = new TypeToken<Map<String, Object>>() {}.getType();
            Map<String, Object> serverStats = loadJson("server_stats.json", mapType);
            if (serverStats != null) {
                peakOnline = ((Number) serverStats.getOrDefault("peakOnline", 0)).intValue();
                totalJoins = ((Number) serverStats.getOrDefault("totalJoins", 0L)).longValue();
                totalChatMessages = ((Number) serverStats.getOrDefault("totalChatMessages", 0L)).longValue();
                totalCommandsExecuted = ((Number) serverStats.getOrDefault("totalCommandsExecuted", 0L)).longValue();
                totalBlocksPlaced = ((Number) serverStats.getOrDefault("totalBlocksPlaced", 0L)).longValue();
                totalBlocksBroken = ((Number) serverStats.getOrDefault("totalBlocksBroken", 0L)).longValue();
                totalDeaths = ((Number) serverStats.getOrDefault("totalDeaths", 0L)).longValue();
                totalKills = ((Number) serverStats.getOrDefault("totalKills", 0L)).longValue();
                Object up = serverStats.get("uniquePlayers");
                if (up instanceof List) {
                    ((List<String>) up).forEach(uniquePlayers::add);
                }
            }

            plugin.getLogger().info("Loaded analytics data: " + players.size() + " players, " +
                    tpsHistory.size() + " TPS samples, " + memoryHistory.size() + " memory samples");
        } catch (Exception e) {
            plugin.getLogger().log(Level.WARNING, "Failed to load analytics data", e);
        }
    }

    public void cleanupOldData() {
        int retentionDays = plugin.getConfig().getInt("data.retention-days", 30);
        Instant cutoff = Instant.now().minus(retentionDays, ChronoUnit.DAYS);
        String cutoffStr = cutoff.toString();

        tpsHistory.removeIf(v -> v.timestamp.compareTo(cutoffStr) < 0);
        msptHistory.removeIf(v -> v.timestamp.compareTo(cutoffStr) < 0);
        memoryHistory.removeIf(v -> v.timestamp.compareTo(cutoffStr) < 0);
        playerCountTimeline.removeIf(v -> v.timestamp.compareTo(cutoffStr) < 0);

        plugin.getLogger().info("Cleaned up data older than " + retentionDays + " days");
    }

    private <T> void saveJson(String filename, T data) {
        File file = new File(dataFolder, filename);
        try (Writer writer = new OutputStreamWriter(new FileOutputStream(file), StandardCharsets.UTF_8)) {
            gson.toJson(data, writer);
        } catch (IOException e) {
            plugin.getLogger().log(Level.WARNING, "Failed to save " + filename, e);
        }
    }

    private <T> T loadJson(String filename, Type type) {
        File file = new File(dataFolder, filename);
        if (!file.exists()) return null;
        try (Reader reader = new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8)) {
            return gson.fromJson(reader, type);
        } catch (Exception e) {
            plugin.getLogger().log(Level.WARNING, "Failed to load " + filename, e);
            return null;
        }
    }

    // ========== Inner Data Classes ==========

    public static class PlayerData {
        public String uuid;
        public String name;
        public String firstJoin;
        public String lastJoin;
        public String lastLeave;
        public long joinCount = 0;
        public long totalPlayTimeSeconds = 0;
        public boolean online = false;
        public transient boolean isNew = false;
        public String country;
        public String region;
        public String city;
        public String os;
        public int protocolVersion;
        public String clientVersion;
        public String clientBrand;
        public long chatMessages = 0;
        public long deaths = 0;
        public long kills = 0;
        public long blocksPlaced = 0;
        public long blocksBroken = 0;
        public long commandsExecuted = 0;
    }

    public static class TimestampedValue {
        public String timestamp;
        public double value;
        public double value2;

        public TimestampedValue() {}

        public TimestampedValue(String timestamp, double value) {
            this.timestamp = timestamp;
            this.value = value;
        }

        public TimestampedValue(String timestamp, double value, double value2) {
            this.timestamp = timestamp;
            this.value = value;
            this.value2 = value2;
        }
    }

    public static class GeoData {
        public String status;
        public String country;
        public String regionName;
        public String city;
        public String isp;
        public long cachedAt;
    }
}
