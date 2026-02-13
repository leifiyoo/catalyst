package dev.catalyst.analytics.data;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import dev.catalyst.analytics.CatalystAnalyticsPlugin;

import java.io.*;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.logging.Level;

/**
 * Manages all analytics data with JSON file persistence.
 * All collections are thread-safe for async access.
 */
public class DataManager {

    private final CatalystAnalyticsPlugin plugin;
    private final File dataFolder;
    private final Gson gson;

    // --- Player tracking ---
    /** UUID -> PlayerData */
    private final ConcurrentHashMap<String, PlayerData> players = new ConcurrentHashMap<>();
    /** Set of all unique player UUIDs ever seen */
    private final Set<String> uniquePlayers = ConcurrentHashMap.newKeySet();
    /** Peak online player count */
    private volatile int peakOnline = 0;

    // --- TPS history: list of {timestamp, value} ---
    private final CopyOnWriteArrayList<TimestampedValue> tpsHistory = new CopyOnWriteArrayList<>();

    // --- Memory history ---
    private final CopyOnWriteArrayList<TimestampedValue> memoryHistory = new CopyOnWriteArrayList<>();

    // --- Player count timeline ---
    private final CopyOnWriteArrayList<TimestampedValue> playerCountTimeline = new CopyOnWriteArrayList<>();

    // --- Geolocation cache: IP -> GeoData ---
    private final ConcurrentHashMap<String, GeoData> geoCache = new ConcurrentHashMap<>();

    // --- Hourly join counts: hour (0-23) -> count ---
    private final ConcurrentHashMap<Integer, Long> hourlyJoins = new ConcurrentHashMap<>();

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
        pd.name = name; // update name in case it changed
        pd.lastJoin = Instant.now().toString();
        pd.joinCount++;
        pd.online = true;
        uniquePlayers.add(uuid);
        totalJoins++;

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
        }
    }

    public void recordChat(String uuid) {
        PlayerData pd = players.get(uuid);
        if (pd != null) pd.chatMessages++;
        totalChatMessages++;
    }

    public void recordDeath(String uuid) {
        PlayerData pd = players.get(uuid);
        if (pd != null) pd.deaths++;
        totalDeaths++;
    }

    public void recordKill(String uuid) {
        PlayerData pd = players.get(uuid);
        if (pd != null) pd.kills++;
        totalKills++;
    }

    public void recordBlockPlaced(String uuid) {
        PlayerData pd = players.get(uuid);
        if (pd != null) pd.blocksPlaced++;
        totalBlocksPlaced++;
    }

    public void recordBlockBroken(String uuid) {
        PlayerData pd = players.get(uuid);
        if (pd != null) pd.blocksBroken++;
        totalBlocksBroken++;
    }

    public void recordCommand(String uuid) {
        PlayerData pd = players.get(uuid);
        if (pd != null) pd.commandsExecuted++;
        totalCommandsExecuted++;
    }

    public void setPlayerClientVersion(String uuid, int protocolVersion) {
        PlayerData pd = players.get(uuid);
        if (pd != null) {
            pd.protocolVersion = protocolVersion;
            pd.clientVersion = ProtocolVersionMapper.map(protocolVersion);
        }
    }

    public void setPlayerClientBrand(String uuid, String brand) {
        PlayerData pd = players.get(uuid);
        if (pd != null) {
            pd.clientBrand = brand;
        }
    }

    public void setPlayerGeo(String uuid, GeoData geo) {
        PlayerData pd = players.get(uuid);
        if (pd != null) {
            pd.country = geo.country;
            pd.region = geo.regionName;
            pd.city = geo.city;
        }
    }

    // ========== TPS ==========

    public void addTpsSample(double tps) {
        tpsHistory.add(new TimestampedValue(Instant.now().toString(), tps));
    }

    public List<TimestampedValue> getTpsHistory() {
        return Collections.unmodifiableList(tpsHistory);
    }

    // ========== Memory ==========

    public void addMemorySample(double usedMB, double maxMB) {
        memoryHistory.add(new TimestampedValue(Instant.now().toString(), usedMB, maxMB));
    }

    public List<TimestampedValue> getMemoryHistory() {
        return Collections.unmodifiableList(memoryHistory);
    }

    // ========== Player Count Timeline ==========

    public void addPlayerCountSnapshot(int count) {
        playerCountTimeline.add(new TimestampedValue(Instant.now().toString(), count));
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

    // ========== Persistence ==========

    public synchronized void saveAll() {
        try {
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
        } catch (Exception e) {
            plugin.getLogger().log(Level.WARNING, "Failed to save analytics data", e);
        }
    }

    @SuppressWarnings("unchecked")
    public synchronized void loadAll() {
        try {
            // Load players
            Type playerMapType = new TypeToken<ConcurrentHashMap<String, PlayerData>>() {}.getType();
            ConcurrentHashMap<String, PlayerData> loadedPlayers = loadJson("players.json", playerMapType);
            if (loadedPlayers != null) {
                // Mark all as offline on load
                loadedPlayers.values().forEach(p -> {
                    p.online = false;
                    p.isNew = false; // They've been seen before
                });
                players.putAll(loadedPlayers);
            }

            // Load TPS history
            Type tpsListType = new TypeToken<CopyOnWriteArrayList<TimestampedValue>>() {}.getType();
            CopyOnWriteArrayList<TimestampedValue> loadedTps = loadJson("tps_history.json", tpsListType);
            if (loadedTps != null) tpsHistory.addAll(loadedTps);

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
        public double value2; // optional secondary value (e.g., max memory)

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
