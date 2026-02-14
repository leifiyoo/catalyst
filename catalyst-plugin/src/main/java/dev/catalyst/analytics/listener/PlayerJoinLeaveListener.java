package dev.catalyst.analytics.listener;

import dev.catalyst.analytics.CatalystAnalyticsPlugin;
import dev.catalyst.analytics.data.DataManager;
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
 *
 * Version detection priority:
 *   1. ViaVersion API (if installed) — shows the actual client version
 *   2. Bukkit.getMinecraftVersion() — shows the server version as fallback
 *
 * No hardcoded protocol mappings or wiki.vg lookups.
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

        // Capture client version (async-safe, runs on next tick)
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
     * Detect the player's Minecraft version using a reliable priority chain:
     *
     * Priority 1: ViaVersion API — if ViaVersion is installed, it knows the actual
     *             client version even when the server runs a different version.
     *
     * Priority 2: Bukkit.getMinecraftVersion() — returns the server's Minecraft version
     *             string (e.g. "1.21.4"). This is the fallback when ViaVersion is not
     *             installed, meaning all players connect with the server version.
     */
    private void detectClientVersion(Player player, String uuid, DataManager dm) {
        try {
            // Priority 1: ViaVersion API — gives the actual client version string
            try {
                Class<?> viaClass = Class.forName("com.viaversion.viaversion.api.Via");
                Object api = viaClass.getMethod("getAPI").invoke(null);
                Object playerVersion = api.getClass().getMethod("getPlayerVersion", Object.class).invoke(api, player);
                if (playerVersion instanceof Integer) {
                    int protocolId = (Integer) playerVersion;
                    if (protocolId > 0) {
                        // Use ViaVersion's own version name resolution
                        try {
                            Class<?> protocolVersionClass = Class.forName("com.viaversion.viaversion.api.protocol.version.ProtocolVersion");
                            Object protocolVersion2 = protocolVersionClass.getMethod("getProtocol", int.class).invoke(null, protocolId);
                            if (protocolVersion2 != null) {
                                String versionName = protocolVersion2.toString();
                                // ViaVersion returns format like "1.21.4" or similar
                                if (versionName != null && !versionName.isEmpty() && !versionName.equals("UNKNOWN")) {
                                    dm.setPlayerClientVersionString(uuid, versionName);
                                    return;
                                }
                            }
                        } catch (Exception ignored) {
                            // Fallback: try older ViaVersion API format
                        }

                        // Fallback: try to get version name from ViaVersion's ProtocolVersion enum
                        try {
                            Class<?> pvClass = Class.forName("com.viaversion.viaversion.api.protocol.version.ProtocolVersion");
                            java.lang.reflect.Method getNameMethod = pvClass.getMethod("getName");
                            java.lang.reflect.Method getClosest = pvClass.getMethod("getClosest", int.class);
                            Object closest = getClosest.invoke(null, protocolId);
                            if (closest != null) {
                                String name = (String) getNameMethod.invoke(closest);
                                if (name != null && !name.isEmpty()) {
                                    dm.setPlayerClientVersionString(uuid, name);
                                    return;
                                }
                            }
                        } catch (Exception ignored) {}

                        // Last ViaVersion fallback: just store the protocol ID and let the server version be used
                        // Don't use protocol ID directly — it's unreliable without a mapping
                    }
                }
            } catch (ClassNotFoundException ignored) {
                // ViaVersion not installed — expected, fall through to Bukkit
            } catch (Exception ignored) {
                // ViaVersion API error — fall through to Bukkit
            }

            // Priority 2: Bukkit.getMinecraftVersion() — returns server version string like "1.21.4"
            // This is reliable and always available on modern Bukkit/Spigot/Paper
            try {
                String serverVersion = Bukkit.getMinecraftVersion();
                if (serverVersion != null && !serverVersion.isEmpty()) {
                    dm.setPlayerClientVersionString(uuid, serverVersion);
                    return;
                }
            } catch (Exception ignored) {
                // Method not available on very old versions
            }

            // Final fallback: try to extract version from Bukkit.getVersion() string
            // Format is usually like "git-Paper-123 (MC: 1.21.4)"
            try {
                String bukkitVersion = Bukkit.getVersion();
                if (bukkitVersion != null) {
                    int mcStart = bukkitVersion.indexOf("MC: ");
                    if (mcStart >= 0) {
                        int mcEnd = bukkitVersion.indexOf(")", mcStart);
                        if (mcEnd > mcStart) {
                            String mcVersion = bukkitVersion.substring(mcStart + 4, mcEnd).trim();
                            if (!mcVersion.isEmpty()) {
                                dm.setPlayerClientVersionString(uuid, mcVersion);
                                return;
                            }
                        }
                    }
                }
            } catch (Exception ignored) {}

        } catch (Exception e) {
            plugin.getLogger().fine("Could not detect version for " + player.getName());
        }
    }
}
