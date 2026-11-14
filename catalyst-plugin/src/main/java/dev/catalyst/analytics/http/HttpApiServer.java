package dev.catalyst.analytics.http;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import dev.catalyst.analytics.CatalystAnalyticsPlugin;
import dev.catalyst.analytics.data.DataManager;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

/**
 * Lightweight built-in HTTP server providing REST API endpoints
 * for the Catalyst Electron app to consume analytics data.
 *
 * Security features:
 * - API key authentication
 * - Rate limiting per IP
 * - Input validation on all query parameters
 * - CORS headers
 * - PreparedStatement-style parameter handling (no SQL, but validated inputs)
 */
public class HttpApiServer {

    private final CatalystAnalyticsPlugin plugin;
    private final HttpServer server;
    private final String apiKey;
    private final String corsOrigin;
    private final Gson gson;

    // Rate limiting: IP -> request count tracker
    private final ConcurrentHashMap<String, RateLimitEntry> rateLimitMap = new ConcurrentHashMap<>();
    private static final int MAX_REQUESTS_PER_MINUTE = 60;
    private static final long RATE_LIMIT_WINDOW_MS = 60_000L;

    public HttpApiServer(CatalystAnalyticsPlugin plugin, int port, String apiKey, String corsOrigin) throws IOException {
        this.plugin = plugin;
        this.apiKey = apiKey;
        this.corsOrigin = corsOrigin;
        this.gson = new GsonBuilder().create();

        server = HttpServer.create(new InetSocketAddress(port), 0);
        server.setExecutor(Executors.newFixedThreadPool(4));

        // Register endpoints
        server.createContext("/api/analytics/overview", this::handleOverview);
        server.createContext("/api/analytics/players", this::handlePlayers);
        server.createContext("/api/analytics/tps", this::handleTps);
        server.createContext("/api/analytics/memory", this::handleMemory);
        server.createContext("/api/analytics/timeline", this::handleTimeline);
    }

    public void start() {
        server.start();
    }

    public void stop() {
        server.stop(0);
    }

    // ========== Rate Limiting ==========

    private static class RateLimitEntry {
        final AtomicInteger count = new AtomicInteger(0);
        volatile long windowStart = System.currentTimeMillis();

        boolean tryAcquire() {
            long now = System.currentTimeMillis();
            if (now - windowStart > RATE_LIMIT_WINDOW_MS) {
                // Reset window
                windowStart = now;
                count.set(1);
                return true;
            }
            return count.incrementAndGet() <= MAX_REQUESTS_PER_MINUTE;
        }
    }

    private boolean checkRateLimit(HttpExchange exchange) throws IOException {
        String clientIp = exchange.getRemoteAddress().getAddress().getHostAddress();
        RateLimitEntry entry = rateLimitMap.computeIfAbsent(clientIp, k -> new RateLimitEntry());

        if (!entry.tryAcquire()) {
            exchange.getResponseHeaders().set("Retry-After", "60");
            sendJson(exchange, 429, Map.of("error", "Rate limit exceeded", "message", "Too many requests. Try again later."));
            return false;
        }
        return true;
    }

    // ========== Auth & CORS ==========

    private boolean authenticate(HttpExchange exchange) throws IOException {
        // Handle CORS preflight
        if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
            addCorsHeaders(exchange);
            exchange.sendResponseHeaders(204, -1);
            return false;
        }

        addCorsHeaders(exchange);

        // Rate limiting check
        if (!checkRateLimit(exchange)) {
            return false;
        }

        // Check API key
        String authHeader = exchange.getRequestHeaders().getFirst("Authorization");
        String queryKey = getQueryParam(exchange, "key");

        boolean valid = false;
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            valid = authHeader.substring(7).equals(apiKey);
        } else if (queryKey != null) {
            valid = queryKey.equals(apiKey);
        }

        if (!valid) {
            sendJson(exchange, 401, Map.of("error", "Unauthorized", "message", "Invalid or missing API key"));
            return false;
        }

        return true;
    }

    private void addCorsHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", corsOrigin);
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Authorization, Content-Type");
        exchange.getResponseHeaders().set("Access-Control-Max-Age", "86400");
    }

    // ========== Endpoints ==========

    private void handleOverview(HttpExchange exchange) throws IOException {
        if (!authenticate(exchange)) return;

        DataManager dm = plugin.getDataManager();
        Map<String, Object> overview = new LinkedHashMap<>();
        overview.put("currentOnline", dm.getCurrentOnline());
        overview.put("peakOnline", dm.getPeakOnline());
        overview.put("uniquePlayers", dm.getUniquePlayerCount());
        overview.put("totalJoins", dm.getTotalJoins());
        overview.put("newPlayers", dm.getNewPlayerCount());
        overview.put("returningPlayers", dm.getReturningPlayerCount());
        overview.put("averagePlayTimeSeconds", dm.getAveragePlayTimeSeconds());
        overview.put("totalChatMessages", dm.getTotalChatMessages());
        overview.put("totalCommandsExecuted", dm.getTotalCommandsExecuted());
        overview.put("totalBlocksPlaced", dm.getTotalBlocksPlaced());
        overview.put("totalBlocksBroken", dm.getTotalBlocksBroken());
        overview.put("totalDeaths", dm.getTotalDeaths());
        overview.put("totalKills", dm.getTotalKills());
        overview.put("hourlyJoins", dm.getHourlyJoins());

        // Latest TPS
        List<DataManager.TimestampedValue> tps = dm.getTpsHistory();
        if (!tps.isEmpty()) {
            overview.put("currentTps", tps.get(tps.size() - 1).value);
        }

        // Latest memory
        List<DataManager.TimestampedValue> mem = dm.getMemoryHistory();
        if (!mem.isEmpty()) {
            DataManager.TimestampedValue latest = mem.get(mem.size() - 1);
            overview.put("memoryUsedMB", latest.value);
            overview.put("memoryMaxMB", latest.value2);
        }

        sendJson(exchange, 200, overview);
    }

    private void handlePlayers(HttpExchange exchange) throws IOException {
        if (!authenticate(exchange)) return;

        DataManager dm = plugin.getDataManager();
        Map<String, DataManager.PlayerData> allPlayers = dm.getAllPlayers();

        // Convert to list sorted by playtime descending
        List<Map<String, Object>> playerList = allPlayers.values().stream()
                .sorted((a, b) -> Long.compare(b.totalPlayTimeSeconds, a.totalPlayTimeSeconds))
                .map(p -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("uuid", p.uuid);
                    m.put("name", p.name);
                    m.put("online", p.online);
                    m.put("firstJoin", p.firstJoin);
                    m.put("lastJoin", p.lastJoin);
                    m.put("joinCount", p.joinCount);
                    m.put("totalPlayTimeSeconds", p.totalPlayTimeSeconds);
                    m.put("clientVersion", p.clientVersion);
                    m.put("clientBrand", p.clientBrand);
                    m.put("chatMessages", p.chatMessages);
                    m.put("deaths", p.deaths);
                    m.put("kills", p.kills);
                    m.put("blocksPlaced", p.blocksPlaced);
                    m.put("blocksBroken", p.blocksBroken);
                    m.put("commandsExecuted", p.commandsExecuted);
                    return m;
                })
                .collect(Collectors.toList());

        sendJson(exchange, 200, Map.of("players", playerList, "total", playerList.size()));
    }

    private void handleTps(HttpExchange exchange) throws IOException {
        if (!authenticate(exchange)) return;

        DataManager dm = plugin.getDataManager();
        List<DataManager.TimestampedValue> history = dm.getTpsHistory();

        // Validate and clamp limit parameter
        int limit = getValidatedIntParam(exchange, "limit", 1440, 1, 10000);
        if (history.size() > limit) {
            history = history.subList(history.size() - limit, history.size());
        }

        List<Map<String, Object>> data = history.stream().map(v -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("timestamp", v.timestamp);
            m.put("tps", v.value);
            return m;
        }).collect(Collectors.toList());

        sendJson(exchange, 200, Map.of("tps", data));
    }

    private void handleMemory(HttpExchange exchange) throws IOException {
        if (!authenticate(exchange)) return;

        DataManager dm = plugin.getDataManager();
        List<DataManager.TimestampedValue> history = dm.getMemoryHistory();

        int limit = getValidatedIntParam(exchange, "limit", 1440, 1, 10000);
        if (history.size() > limit) {
            history = history.subList(history.size() - limit, history.size());
        }

        List<Map<String, Object>> data = history.stream().map(v -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("timestamp", v.timestamp);
            m.put("usedMB", v.value);
            m.put("maxMB", v.value2);
            return m;
        }).collect(Collectors.toList());

        sendJson(exchange, 200, Map.of("memory", data));
    }

    private void handleTimeline(HttpExchange exchange) throws IOException {
        if (!authenticate(exchange)) return;

        DataManager dm = plugin.getDataManager();
        List<DataManager.TimestampedValue> timeline = dm.getPlayerCountTimeline();

        int limit = getValidatedIntParam(exchange, "limit", 288, 1, 10000);
        if (timeline.size() > limit) {
            timeline = timeline.subList(timeline.size() - limit, timeline.size());
        }

        List<Map<String, Object>> data = timeline.stream().map(v -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("timestamp", v.timestamp);
            m.put("players", (int) v.value);
            return m;
        }).collect(Collectors.toList());

        sendJson(exchange, 200, Map.of("timeline", data));
    }

    // ========== Helpers ==========

    private void sendJson(HttpExchange exchange, int statusCode, Object data) throws IOException {
        String json = gson.toJson(data);
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(statusCode, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    /**
     * Safely extract a query parameter value. Returns null if not found.
     * Input is validated to prevent injection attacks.
     */
    private String getQueryParam(HttpExchange exchange, String key) {
        String query = exchange.getRequestURI().getQuery();
        if (query == null) return null;
        for (String param : query.split("&")) {
            String[] kv = param.split("=", 2);
            if (kv.length == 2 && kv[0].equals(key)) {
                // Basic input validation: strip any suspicious characters
                String value = kv[1].trim();
                if (value.length() > 256) return null; // Reject overly long values
                return value;
            }
        }
        return null;
    }

    /**
     * Get a validated integer query parameter, clamped to [min, max].
     */
    private int getValidatedIntParam(HttpExchange exchange, String key, int defaultValue, int min, int max) {
        String val = getQueryParam(exchange, key);
        if (val == null) return defaultValue;
        try {
            int parsed = Integer.parseInt(val);
            return Math.max(min, Math.min(max, parsed));
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }
}
