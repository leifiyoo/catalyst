package dev.catalyst.analytics.listener;

import dev.catalyst.analytics.CatalystAnalyticsPlugin;
import dev.catalyst.analytics.data.DataManager;
import dev.catalyst.analytics.data.ProtocolVersionMapper;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;

import java.net.InetSocketAddress;

/**
 * Tracks player join/leave events, captures client info and triggers geo lookup.
 */
public class PlayerJoinLeaveListener implements Listener {

    private final CatalystAnalyticsPlugin plugin;

    public PlayerJoinLeaveListener(CatalystAnalyticsPlugin plugin) {
        this.plugin = plugin;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        String uuid = player.getUniqueId().toString();
        String name = player.getName();

        DataManager dm = plugin.getDataManager();
        dm.recordJoin(uuid, name);

        // Capture version for version detection (async-safe, runs on next tick)
        if (plugin.isTrackingEnabled("track-player-versions", "stats.client-version")) {
            Bukkit.getScheduler().runTaskLaterAsynchronously(plugin, () -> {
                detectClientVersion(player, uuid, dm);
            }, 20L); // Delay 1 second to let connection settle
        }

        // Try to get client brand (available on Paper/newer Spigot)
        if (plugin.isTrackingEnabled("track-player-clients", "stats.client-os")) {
            Bukkit.getScheduler().runTaskLater(plugin, () -> {
                try {
                    java.lang.reflect.Method brandMethod = player.getClass().getMethod("getClientBrandName");
                    String brand = (String) brandMethod.invoke(player);
                    if (brand != null) {
                        dm.setPlayerClientBrand(uuid, brand);
                    }
                } catch (Exception ignored) {
                    // getClientBrandName() not available on older versions
                }
            }, 40L); // Delay 2 seconds for brand to be available
        }

        // Geolocation lookup (async)
        if (plugin.isTrackingEnabled("track-geolocation", "stats.geolocation")) {
            InetSocketAddress addr = player.getAddress();
            if (addr != null && addr.getAddress() != null) {
                String ip = addr.getAddress().getHostAddress();
                plugin.getGeoLocationService().lookupAsync(uuid, ip);
            }
        }
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onQuit(PlayerQuitEvent event) {
        String uuid = event.getPlayer().getUniqueId().toString();
        plugin.getDataManager().recordLeave(uuid);
    }

    /**
     * Detect the player's Minecraft version using the most reliable method available.
     *
     * Priority order:
     * 1. ViaVersion API — if ViaVersion plugin is present, it knows the real client protocol version
     * 2. Paper API Bukkit.getMinecraftVersion() — returns the server's exact version string (e.g. "1.21.4").
     *    If ViaVersion is NOT installed, all players must be on the server's version, so this is accurate.
     * 3. Protocol number fallback — use ProtocolVersionMapper as a last resort (least accurate).
     */
    private void detectClientVersion(Player player, String uuid, DataManager dm) {
        try {
            // Approach 1: Try ViaVersion API if available
            // ViaVersion knows the actual protocol version of each individual player,
            // even when they connect with a different version than the server.
            String viaVersion = tryViaVersion(player);
            if (viaVersion != null) {
                dm.setPlayerClientVersionString(uuid, viaVersion);
                return;
            }

            // Approach 2: Use Bukkit.getMinecraftVersion() (Paper API)
            // If ViaVersion is NOT installed, all players MUST be on the server's version.
            // This returns the exact version string like "1.21.4" — no ambiguity.
            String serverVersion = tryGetMinecraftVersion();
            if (serverVersion != null) {
                dm.setPlayerClientVersionString(uuid, serverVersion);
                return;
            }

            // Approach 3: Try player.getProtocolVersion() (Paper API) and map it
            // This is less accurate because protocol numbers can map to multiple versions.
            try {
                java.lang.reflect.Method protocolMethod = player.getClass().getMethod("getProtocolVersion");
                int protocol = (int) protocolMethod.invoke(player);
                if (protocol > 0) {
                    dm.setPlayerClientVersion(uuid, protocol);
                    return;
                }
            } catch (Exception ignored) {}

            // Approach 4: Parse version from Bukkit.getVersion() string
            // Format is typically like "git-Paper-123 (MC: 1.21.4)"
            String parsedVersion = tryParseBukkitVersion();
            if (parsedVersion != null) {
                dm.setPlayerClientVersionString(uuid, parsedVersion);
                return;
            }

        } catch (Exception e) {
            plugin.getLogger().fine("Could not detect client version for " + player.getName());
        }
    }

    /**
     * Try to get the player's version via ViaVersion API.
     * Returns the version string if ViaVersion is available, null otherwise.
     */
    private String tryViaVersion(Player player) {
        try {
            // Check if ViaVersion plugin is loaded
            if (Bukkit.getPluginManager().getPlugin("ViaVersion") == null) {
                return null;
            }

            Class<?> viaClass = Class.forName("com.viaversion.viaversion.api.Via");
            Object api = viaClass.getMethod("getAPI").invoke(null);
            Object playerVersion = api.getClass()
                    .getMethod("getPlayerVersion", java.util.UUID.class)
                    .invoke(api, player.getUniqueId());

            if (playerVersion instanceof Integer) {
                int protocol = (Integer) playerVersion;
                if (protocol > 0) {
                    // Map the ViaVersion protocol number to a version string
                    return ProtocolVersionMapper.map(protocol);
                }
            }
        } catch (Exception ignored) {
            // ViaVersion not available or API changed
        }
        return null;
    }

    /**
     * Try to get the server's Minecraft version using Paper API's Bukkit.getMinecraftVersion().
     * Returns the exact version string (e.g. "1.21.4") or null if not available.
     */
    private String tryGetMinecraftVersion() {
        try {
            java.lang.reflect.Method method = Bukkit.class.getMethod("getMinecraftVersion");
            Object result = method.invoke(null);
            if (result instanceof String) {
                String version = (String) result;
                if (!version.isEmpty()) {
                    return version;
                }
            }
        } catch (Exception ignored) {
            // Not running on Paper, or method not available
        }
        return null;
    }

    /**
     * Try to parse the Minecraft version from Bukkit.getVersion().
     * The format is typically "git-Paper-123 (MC: 1.21.4)" or "git-Spigot-abc-def (MC: 1.21.4)".
     */
    private String tryParseBukkitVersion() {
        try {
            String fullVersion = Bukkit.getVersion();
            if (fullVersion != null && fullVersion.contains("MC: ")) {
                int start = fullVersion.indexOf("MC: ") + 4;
                int end = fullVersion.indexOf(")", start);
                if (end > start) {
                    String version = fullVersion.substring(start, end).trim();
                    if (!version.isEmpty()) {
                        return version;
                    }
                }
            }
        } catch (Exception ignored) {}
        return null;
    }
}
