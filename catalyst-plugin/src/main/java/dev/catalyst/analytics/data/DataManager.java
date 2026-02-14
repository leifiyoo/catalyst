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
 * Optimized for low memory footprint with bounded collections.
 */
public class DataManager {

    private final CatalystAnalyticsPlugin plugin;
    private final File dataFolder;
    private final Gson gson;

    // Maximum entries for time-series data to prevent unbounded growth
    private static final int MAX_HISTORY_ENTRIES = 2880; // ~48h at 1min intervals

    // --- Player tracking ---
    private final ConcurrentHashMap<String, PlayerData> players = new ConcurrentHashMap<>();
    private final Set<String> uniquePlayers = ConcurrentHashMap.newKeySet();
    private volatile int peakOnline = 0;

    // --- TPS history ---
    private final CopyOnWriteArrayList<TimestampedValue> tpsHistory = new CopyOnWriteArrayList<>();

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

    // --- Dirty flag for batched writes ---
    private volatile boolean dirty = false;

    // --- Server-wide stats ---
    private volatile long totalJoins = 0;
    private volatile long totalChatMessages = 0;
    private volatile long totalCommandsExecuted = 0;
    private volatile long totalBlocksPlaced = 0;
    private volatile long totalBlocksBroken = 0;
    private volatile long totalDeaths = 0;
    private volatile long totalKills = 0;

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
            pd.clientBrand = normalizeClientBrand(brand);
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

    /**
     * Normalize client brand strings to friendly names.
     * e.g. "lunarclient:v1.8.9-2.15.1" -> "Lunar Client"
     */
    private String normalizeClientBrand(String brand) {
        if (brand == null) return "Unknown";
        String lower = brand.toLowerCase().trim();

        if (lower.startsWith("lunarclient") || lower.contains("lunar")) return "Lunar Client";
        if (lower.startsWith("badlion") || lower.contains("badlion")) return "Badlion Client";
        if (lower.equals("fabric") || lower.startsWith("fabric")) return "Fabric";
        if (lower.equals("forge") || lower.startsWith("forge") || lower.contains("fml")) return "Forge";
        if (lower.equals("vanilla") || lower.equals("minecraft") || lower.equals("brand")) return "Vanilla";
        if (lower.contains("optifine")) return "OptiFine";
        if (lower.contains("quilt")) return "Quilt";
        if (lower.contains("labymod")) return "LabyMod";
        if (lower.contains("feather")) return "Feather Client";
        if (lower.contains("pvplounge")) return "PvPLounge";

        // Return the original brand if no match (capitalize first letter)
        if (brand.length() > 0) {
            return brand.substring(0, 1).toUpperCase() + brand.substring(1);
        }
        return brand;
    }

    // ========== TPS ==========

    public void addTpsSample(double tps) {
        addBounded(tpsHistory, new TimestampedValue(Instant.now().toString(), tps));
        dirty = true;
    }

    public void addTpsSampleWithMspt(double tps, double mspt) {
        addBounded(tpsHistory, new TimestampedValue(Instant.now().toString(), tps, mspt));
        dirty = true;
    }

    public List<TimestampedValue> getTpsHistory() {
        return Collections.unmodifiableList(tpsHistory);
    }

    // ========== Memory ==========

    public void addMemorySample(double usedMB, double maxMB) {
        addBounded(memoryHistory, new TimestampedValue(Instant.now().toString(), usedMB, maxMB));
        dirty = true;
    }

    public List<TimestampedValue> getMemoryHistory() {
        return Collections.unmodifiableList(memoryHistory);
    }

    // ========== Player Count Timeline ==========

    public void addPlayerCountSnapshot(int count) {
        addBounded(playerCountTimeline, new TimestampedValue(Instant.now().toString(), count));
        dirty = true;
    }

    public List<TimestampedValue> getPlayerCountTimeline() {
        return Collections.unmodifiableList(playerCountTimeline);
    }

    // ========== Bounded list helper ==========

    private void addBounded(CopyOnWriteArrayList<TimestampedValue> list, TimestampedValue value) {
        list.add(value);
        // Trim if exceeds max (remove oldest entries)
        while (list.size() > MAX_HISTORY_ENTRIES) {
            list.remove(0);
        }
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

    // ========== Persistence ==========

    public synchronized void saveAll() {
        try {
            // Always write the combined analytics.json (Electron reads this)
            writeCombinedAnalyticsJson();

            // Only write individual data files if data changed
            if (dirty) {
                saveJson("players.json", players);
                saveJson("tps_history.json", tpsHistory);
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

                dirty = false;
            }
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
                TimestampedValue latestTps = tpsHistory.get(tpsHistory.size() - 1);
                overview.put("currentTps", latestTps.value);
                if (latestTps.value2 > 0) {
                    overview.put("currentMspt", latestTps.value2);
                }
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
                pm.put("clientVersion", pd.clientVersion);
                pm.put("clientBrand", pd.clientBrand);
                pm.put("os", pd.os);
                pm.put("chatMessages", pd.chatMessages);
                pm.put("deaths", pd.deaths);
                pm.put("kills", pd.kills);
                pm.put("blocksPlaced", pd.blocksPlaced);
                pm.put("blocksBroken", pd.blocksBroken);
                pm.put("commandsExecuted", pd.commandsExecuted);
                playersList.add(pm);
            }
            combined.put("players", playersList);

            // TPS history (last 100 entries for the JSON file)
            List<Map<String, Object>> tpsList = new ArrayList<>();
            int tpsStart = Math.max(0, tpsHistory.size() - 100);
            for (int i = tpsStart; i < tpsHistory.size(); i++) {
                TimestampedValue tv = tpsHistory.get(i);
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("timestamp", tv.timestamp);
                m.put("tps", tv.value);
                if (tv.value2 > 0) {
                    m.put("mspt", tv.value2);
                }
                tpsList.add(m);
            }
            combined.put("tps", tpsList);

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
            Map<String, Integer> geoDistribution = new LinkedHashMap<>();
            for (PlayerData pd : players.values()) {
                if (pd.country != null && !pd.country.isEmpty()) {
                    geoDistribution.merge(pd.country, 1, Integer::sum);
                }
            }
            List<Map<String, Object>> geoList = new ArrayList<>();
            geoDistribution.entrySet().stream()
                    .sorted((a, b) -> b.getValue() - a.getValue())
                    .forEach(e -> {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("country", e.getKey());
                        m.put("count", e.getValue());
                        geoList.add(m);
                    });
            combined.put("geo", geoList);

            // Version distribution
            Map<String, Integer> versionDistribution = new LinkedHashMap<>();
            for (PlayerData pd : players.values()) {
                if (pd.clientVersion != null && !pd.clientVersion.isEmpty()) {
                    versionDistribution.merge(pd.clientVersion, 1, Integer::sum);
                }
            }
            List<Map<String, Object>> versionList = new ArrayList<>();
            versionDistribution.entrySet().stream()
                    .sorted((a, b) -> b.getValue() - a.getValue())
                    .forEach(e -> {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("version", e.getKey());
                        m.put("count", e.getValue());
                        versionList.add(m);
                    });
            combined.put("versions", versionList);

            // Client brand distribution
            Map<String, Integer> clientDistribution = new LinkedHashMap<>();
            for (PlayerData pd : players.values()) {
                if (pd.clientBrand != null && !pd.clientBrand.isEmpty()) {
                    clientDistribution.merge(pd.clientBrand, 1, Integer::sum);
                }
            }
            List<Map<String, Object>> clientList = new ArrayList<>();
            clientDistribution.entrySet().stream()
                    .sorted((a, b) -> b.getValue() - a.getValue())
                    .forEach(e -> {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("client", e.getKey());
                        m.put("count", e.getValue());
                        clientList.add(m);
                    });
            combined.put("clients", clientList);

            // OS distribution
            Map<String, Integer> osDistribution = new LinkedHashMap<>();
            for (PlayerData pd : players.values()) {
                if (pd.os != null && !pd.os.isEmpty()) {
                    osDistribution.merge(pd.os, 1, Integer::sum);
                }
            }
            List<Map<String, Object>> osList = new ArrayList<>();
            osDistribution.entrySet().stream()
                    .sorted((a, b) -> b.getValue() - a.getValue())
                    .forEach(e -> {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("os", e.getKey());
                        m.put("count", e.getValue());
                        osList.add(m);
                    });
            combined.put("operatingSystems", osList);

            // Tracking settings (so the UI can show toggles)
            Map<String, Boolean> trackingSettings = new LinkedHashMap<>();
            trackingSettings.put("trackPlayerJoins", plugin.isTrackingEnabled("track-player-joins"));
            trackingSettings.put("trackPlayerVersions", plugin.isTrackingEnabled("track-player-versions"));
            trackingSettings.put("trackPlayerClients", plugin.isTrackingEnabled("track-player-clients"));
            trackingSettings.put("trackGeolocation", plugin.isTrackingEnabled("track-geolocation"));
            trackingSettings.put("trackOs", plugin.isTrackingEnabled("track-os"));
            trackingSettings.put("trackTps", plugin.isTrackingEnabled("track-tps"));
            trackingSettings.put("trackRam", plugin.isTrackingEnabled("track-ram"));
            trackingSettings.put("trackPlaytime", plugin.isTrackingEnabled("track-playtime"));
            trackingSettings.put("trackChatMessages", plugin.isTrackingEnabled("track-chat-messages"));
            trackingSettings.put("trackDeathsKills", plugin.isTrackingEnabled("track-deaths-kills"));
            trackingSettings.put("trackBlocks", plugin.isTrackingEnabled("track-blocks"));
            trackingSettings.put("trackCommands", plugin.isTrackingEnabled("track-commands"));
            combined.put("trackingSettings", trackingSettings);

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
            if (loadedTps != null) {
                // Only load up to MAX_HISTORY_ENTRIES
                int start = Math.max(0, loadedTps.size() - MAX_HISTORY_ENTRIES);
                for (int i = start; i < loadedTps.size(); i++) {
                    tpsHistory.add(loadedTps.get(i));
                }
            }

            // Load memory history
            CopyOnWriteArrayList<TimestampedValue> loadedMem = loadJson("memory_history.json", tpsListType);
            if (loadedMem != null) {
                int start = Math.max(0, loadedMem.size() - MAX_HISTORY_ENTRIES);
                for (int i = start; i < loadedMem.size(); i++) {
                    memoryHistory.add(loadedMem.get(i));
                }
            }

            // Load player count timeline
            CopyOnWriteArrayList<TimestampedValue> loadedPc = loadJson("player_count_timeline.json", tpsListType);
            if (loadedPc != null) {
                int start = Math.max(0, loadedPc.size() - MAX_HISTORY_ENTRIES);
                for (int i = start; i < loadedPc.size(); i++) {
                    playerCountTimeline.add(loadedPc.get(i));
                }
            }

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
        public int protocolVersion;
        public String clientVersion;
        public String clientBrand;
        public String os;
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
        public double value2; // optional secondary value (e.g., max memory or mspt)

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
