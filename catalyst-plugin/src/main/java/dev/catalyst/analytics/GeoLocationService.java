package dev.catalyst.analytics;

import com.google.gson.Gson;
import dev.catalyst.analytics.data.DataManager;
import org.bukkit.Bukkit;

import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.logging.Level;

/**
 * Async IP geolocation service using ip-api.com free tier.
 * Includes rate limiting and caching.
 */
public class GeoLocationService {

    private final CatalystAnalyticsPlugin plugin;
    private final Gson gson = new Gson();
    private final AtomicInteger requestsThisMinute = new AtomicInteger(0);
    private volatile long minuteStart = System.currentTimeMillis();

    public GeoLocationService(CatalystAnalyticsPlugin plugin) {
        this.plugin = plugin;
    }

    /**
     * Look up geolocation for an IP address asynchronously.
     * Results are cached and applied to the player's data.
     */
    public void lookupAsync(String playerUuid, String ipAddress) {
        if (ipAddress == null || ipAddress.isEmpty()) {
            return;
        }
        // Skip local/private IPs and validate format to prevent SSRF
        if (ipAddress.equals("127.0.0.1") || ipAddress.startsWith("192.168.")
                || ipAddress.startsWith("10.") || ipAddress.startsWith("172.16.")
                || ipAddress.startsWith("172.17.") || ipAddress.startsWith("172.18.")
                || ipAddress.startsWith("172.19.") || ipAddress.startsWith("172.2")
                || ipAddress.startsWith("172.30.") || ipAddress.startsWith("172.31.")
                || ipAddress.equals("0.0.0.0") || ipAddress.startsWith("169.254.")
                || ipAddress.equals("::1") || ipAddress.startsWith("fc") || ipAddress.startsWith("fd")) {
            return; // Skip local/private IPs
        }
        // Validate IP format (basic check to prevent injection into URL)
        if (!ipAddress.matches("^[0-9a-fA-F.:]+$")) {
            return;
        }

        // Check cache first
        DataManager dm = plugin.getDataManager();
        DataManager.GeoData cached = dm.getCachedGeo(ipAddress);
        int cacheDuration = plugin.getConfig().getInt("geolocation.cache-minutes", 1440);
        if (cached != null && (Instant.now().getEpochSecond() - cached.cachedAt) < cacheDuration * 60L) {
            dm.setPlayerGeo(playerUuid, cached);
            return;
        }

        // Run HTTP request async
        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            try {
                // Rate limiting
                long now = System.currentTimeMillis();
                if (now - minuteStart > 60000) {
                    minuteStart = now;
                    requestsThisMinute.set(0);
                }
                int rateLimit = plugin.getConfig().getInt("geolocation.rate-limit", 40);
                if (requestsThisMinute.incrementAndGet() > rateLimit) {
                    return; // Skip this request to stay within rate limit
                }

                String apiUrl = plugin.getConfig().getString("geolocation.api-url",
                        "http://ip-api.com/json/{ip}?fields=status,country,regionName,city,isp");
                String url = apiUrl.replace("{ip}", ipAddress);

                HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);
                conn.setRequestProperty("User-Agent", "CatalystAnalytics/1.0");

                if (conn.getResponseCode() == 200) {
                    try (InputStreamReader reader = new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8)) {
                        DataManager.GeoData geo = gson.fromJson(reader, DataManager.GeoData.class);
                        if (geo != null && "success".equals(geo.status)) {
                            geo.cachedAt = Instant.now().getEpochSecond();
                            dm.cacheGeo(ipAddress, geo);
                            dm.setPlayerGeo(playerUuid, geo);
                        }
                    }
                }
                conn.disconnect();
            } catch (Exception e) {
                plugin.getLogger().log(Level.FINE, "Geo lookup failed for " + ipAddress, e);
            }
        });
    }
}
