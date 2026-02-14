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
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

/**
 * Lightweight built-in HTTP server providing REST API endpoints
 * for the Catalyst Electron app to consume analytics data.
 */
public class HttpApiServer {

    private final CatalystAnalyticsPlugin plugin;
    private final HttpServer server;
    private final String apiKey;
    private final String corsOrigin;
    private final Gson gson;

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
        server.createContext("/api/analytics/geo", this::handleGeo);
        server.createContext("/api/analytics/timeline", this::handleTimeline);
    }

    public void start() {
        server.start();
    }

    public void stop() {
        server.stop(0);
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

        // Check API key
        String authHeader = exchange.getRequestHeaders().getFirst("Authorization");
        String queryKey = getQueryParam(exchange, "key");

        boolean valid = false;
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            valid = timingSafeEquals(authHeader.substring(7), apiKey);
        } else if (queryKey != null) {
            valid = timingSafeEquals(queryKey, apiKey);
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
                    m.put("country", p.country);
                    m.put("region", p.region);
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

        // Optionally limit results
        int limit = getIntQueryParam(exchange, "limit", 1440); // default: 24h of minute samples
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

        int limit = getIntQueryParam(exchange, "limit", 1440);
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

    private void handleGeo(HttpExchange exchange) throws IOException {
        if (!authenticate(exchange)) return;

        DataManager dm = plugin.getDataManager();
        Map<String, DataManager.PlayerData> allPlayers = dm.getAllPlayers();

        // Aggregate by country
        Map<String, Integer> countryCount = new LinkedHashMap<>();
        for (DataManager.PlayerData p : allPlayers.values()) {
            if (p.country != null && !p.country.isEmpty()) {
                countryCount.merge(p.country, 1, Integer::sum);
            }
        }

        // Sort by count descending
        List<Map<String, Object>> geoList = countryCount.entrySet().stream()
                .sorted((a, b) -> b.getValue() - a.getValue())
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("country", e.getKey());
                    m.put("count", e.getValue());
                    return m;
                })
                .collect(Collectors.toList());

        sendJson(exchange, 200, Map.of("geo", geoList));
    }

    private void handleTimeline(HttpExchange exchange) throws IOException {
        if (!authenticate(exchange)) return;

        DataManager dm = plugin.getDataManager();
        List<DataManager.TimestampedValue> timeline = dm.getPlayerCountTimeline();

        int limit = getIntQueryParam(exchange, "limit", 288); // default: 24h of 5-min samples
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

    private String getQueryParam(HttpExchange exchange, String key) {
        String query = exchange.getRequestURI().getRawQuery();
        if (query == null) return null;
        for (String param : query.split("&")) {
            String[] kv = param.split("=", 2);
            if (kv.length == 2 && kv[0].equals(key)) {
                try {
                    return URLDecoder.decode(kv[1], StandardCharsets.UTF_8.name());
                } catch (Exception e) {
                    return kv[1];
                }
            }
        }
        return null;
    }

    private int getIntQueryParam(HttpExchange exchange, String key, int defaultValue) {
        String val = getQueryParam(exchange, key);
        if (val == null) return defaultValue;
        try {
            int parsed = Integer.parseInt(val);
            // Bound to reasonable range to prevent memory exhaustion
            return Math.max(1, Math.min(parsed, 10000));
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    /**
     * Constant-time string comparison to prevent timing attacks on API key validation.
     */
    private boolean timingSafeEquals(String a, String b) {
        if (a == null || b == null) return false;
        byte[] aBytes = a.getBytes(StandardCharsets.UTF_8);
        byte[] bBytes = b.getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(aBytes, bBytes);
    }
}
