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

        // Capture protocol version for version detection (runs on main thread since Player API is not thread-safe)
        if (plugin.isTrackingEnabled("track-player-versions", "stats.client-version")) {
            Bukkit.getScheduler().runTaskLater(plugin, () -> {
                if (player.isOnline()) {
                    detectProtocolVersion(player, uuid, dm);
                }
            }, 20L); // Delay 1 second to let connection settle
        }

        // Try to get client brand (available on Paper/newer Spigot)
        if (plugin.isTrackingEnabled("track-player-clients", "stats.client-os")) {
            Bukkit.getScheduler().runTaskLater(plugin, () -> {
                if (!player.isOnline()) return;
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
     * Detect the player's protocol version using multiple approaches for broad compatibility.
     */
    private void detectProtocolVersion(Player player, String uuid, DataManager dm) {
        try {
            // Approach 1: Try Paper API (getProtocolVersion) — Paper 1.13+
            try {
                java.lang.reflect.Method protocolMethod = player.getClass().getMethod("getProtocolVersion");
                int protocol = (int) protocolMethod.invoke(player);
                if (protocol > 0) {
                    dm.setPlayerClientVersion(uuid, protocol);
                    return;
                }
            } catch (Exception ignored) {}

            // Approach 2: Try ViaVersion API if available
            try {
                Class<?> viaClass = Class.forName("com.viaversion.viaversion.api.Via");
                Object api = viaClass.getMethod("getAPI").invoke(null);
                Object playerVersion = api.getClass().getMethod("getPlayerVersion", Object.class).invoke(api, player);
                if (playerVersion instanceof Integer) {
                    int protocol = (Integer) playerVersion;
                    if (protocol > 0) {
                        dm.setPlayerClientVersion(uuid, protocol);
                        return;
                    }
                }
            } catch (Exception ignored) {}

            // Approach 3: Try ProtocolSupport API if available
            try {
                Class<?> psClass = Class.forName("protocolsupport.api.ProtocolSupportAPI");
                Object protocolVersion = psClass.getMethod("getProtocolVersion", Player.class).invoke(null, player);
                if (protocolVersion != null) {
                    java.lang.reflect.Method getIdMethod = protocolVersion.getClass().getMethod("getId");
                    int protocol = (int) getIdMethod.invoke(protocolVersion);
                    if (protocol > 0) {
                        dm.setPlayerClientVersion(uuid, protocol);
                        return;
                    }
                }
            } catch (Exception ignored) {}

            // Approach 4: NMS reflection for Spigot (works on many versions)
            try {
                Object handle = player.getClass().getMethod("getHandle").invoke(player);

                // Try different field names across versions
                Object connection = null;
                for (String fieldName : new String[]{"connection", "playerConnection", "b"}) {
                    try {
                        connection = handle.getClass().getField(fieldName).get(handle);
                        if (connection != null) break;
                    } catch (Exception ignored) {}
                }

                if (connection != null) {
                    Object networkManager = null;
                    for (String fieldName : new String[]{"networkManager", "a", "connection"}) {
                        try {
                            networkManager = connection.getClass().getField(fieldName).get(connection);
                            if (networkManager != null) break;
                        } catch (Exception ignored) {}
                    }

                    if (networkManager != null) {
                        // Try to get protocol version from channel
                        for (String methodName : new String[]{"getProtocolVersion", "getVersion"}) {
                            try {
                                java.lang.reflect.Method m = networkManager.getClass().getMethod(methodName);
                                int protocol = (int) m.invoke(networkManager);
                                if (protocol > 0) {
                                    dm.setPlayerClientVersion(uuid, protocol);
                                    return;
                                }
                            } catch (Exception ignored) {}
                        }
                    }
                }
            } catch (Exception ignored) {}

            // Approach 5: Fall back to server's own protocol version
            // This at least tells us the server version
            try {
                Object server = Bukkit.getServer().getClass().getMethod("getServer").invoke(Bukkit.getServer());
                for (String methodName : new String[]{"getProtocolVersion", "getServerVersion"}) {
                    try {
                        java.lang.reflect.Method m = server.getClass().getMethod(methodName);
                        Object result = m.invoke(server);
                        if (result instanceof Integer && (Integer) result > 0) {
                            dm.setPlayerClientVersion(uuid, (Integer) result);
                            return;
                        }
                    } catch (Exception ignored) {}
                }
            } catch (Exception ignored) {}

        } catch (Exception e) {
            plugin.getLogger().fine("Could not detect protocol version for " + player.getName());
        }
    }
}
