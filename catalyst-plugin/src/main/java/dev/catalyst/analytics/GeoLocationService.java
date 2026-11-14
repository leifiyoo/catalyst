package dev.catalyst.analytics;

import com.google.gson.Gson;
import dev.catalyst.analytics.data.DataManager;
import org.bukkit.Bukkit;

import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.InetAddress;
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
        if (!isPublicAddress(ipAddress)) {
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
                        "https://ipapi.co/{ip}/json/");
                String url = apiUrl.replace("{ip}", ipAddress);

                HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);
                conn.setRequestProperty("User-Agent", "CatalystAnalytics/1.0");

                if (conn.getResponseCode() == 200) {
                    try (InputStreamReader reader = new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8)) {
                        DataManager.GeoData geo = gson.fromJson(reader, DataManager.GeoData.class);
                        if (geo != null && geo.isSuccessful()) {
                            geo.normalizeProviderFields();
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

    private boolean isPublicAddress(String ipAddress) {
        if (ipAddress == null || ipAddress.isEmpty()) {
            return false;
        }

        try {
            InetAddress address = InetAddress.getByName(ipAddress);
            if (
                    address.isAnyLocalAddress() ||
                    address.isLoopbackAddress() ||
                    address.isLinkLocalAddress() ||
                    address.isSiteLocalAddress() ||
                    address.isMulticastAddress()
            ) {
                return false;
            }

            String normalized = address.getHostAddress().toLowerCase();
            return !(normalized.startsWith("fc") || normalized.startsWith("fd"));
        } catch (Exception ignored) {
            return false;
        }
    }
}
