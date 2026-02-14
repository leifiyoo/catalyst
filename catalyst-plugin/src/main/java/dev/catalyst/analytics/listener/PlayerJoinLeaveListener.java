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

        // Delay client info detection slightly to allow brand packet to arrive
        Bukkit.getScheduler().runTaskLaterAsynchronously(plugin, () -> {
            detectClientInfo(player, uuid);
        }, 40L); // 2 seconds delay

        // Geolocation lookup (async)
        if (plugin.isTrackingEnabled("track-geolocation")) {
            InetSocketAddress addr = player.getAddress();
            if (addr != null && addr.getAddress() != null) {
                String ip = addr.getAddress().getHostAddress();
                plugin.getGeoLocationService().lookupAsync(uuid, ip);
            }
        }
    }

    /**
     * Detect client brand, version, and OS from the player.
     * Runs async after a short delay to allow brand packet to arrive.
     */
    private void detectClientInfo(Player player, String uuid) {
        DataManager dm = plugin.getDataManager();

        // Detect client brand via getClientBrandName() (Paper/newer Spigot)
        if (plugin.isTrackingEnabled("track-player-clients")) {
            try {
                java.lang.reflect.Method brandMethod = player.getClass().getMethod("getClientBrandName");
                String brand = (String) brandMethod.invoke(player);
                if (brand != null && !brand.isEmpty()) {
                    dm.setPlayerClientBrand(uuid, brand);
                }
            } catch (Exception ignored) {
                // getClientBrandName() not available on older versions
            }
        }

        // Detect protocol version for Minecraft version mapping
        if (plugin.isTrackingEnabled("track-player-versions")) {
            try {
                // Try Paper's getProtocolVersion() first
                java.lang.reflect.Method protocolMethod = player.getClass().getMethod("getProtocolVersion");
                int protocolVersion = (int) protocolMethod.invoke(player);
                dm.setPlayerClientVersion(uuid, protocolVersion);
            } catch (Exception ignored) {
                // Try NMS approach for Spigot
                try {
                    Object handle = player.getClass().getMethod("getHandle").invoke(player);
                    // Try different field names across versions
                    Object connection = null;
                    for (String fieldName : new String[]{"connection", "playerConnection", "b"}) {
                        try {
                            java.lang.reflect.Field f = handle.getClass().getField(fieldName);
                            connection = f.get(handle);
                            break;
                        } catch (NoSuchFieldException ignored2) {}
                    }
                    // Protocol version detection may not work on all versions
                } catch (Exception ignored2) {}
            }
        }

        // Detect OS - we can infer from client brand in some cases
        if (plugin.isTrackingEnabled("track-os")) {
            try {
                // Try to get client brand for OS detection hints
                java.lang.reflect.Method brandMethod = player.getClass().getMethod("getClientBrandName");
                String brand = (String) brandMethod.invoke(player);
                if (brand != null) {
                    String os = inferOsFromBrand(brand);
                    if (os != null) {
                        dm.setPlayerOs(uuid, os);
                    }
                }
            } catch (Exception ignored) {}
        }
    }

    /**
     * Try to infer OS from client brand string.
     * Some clients include OS info in their brand.
     * Falls back to null if unable to determine.
     */
    private String inferOsFromBrand(String brand) {
        if (brand == null) return null;
        String lower = brand.toLowerCase();
        // Some modded clients include OS info
        if (lower.contains("win") && !lower.contains("window")) return "Windows";
        if (lower.contains("windows")) return "Windows";
        if (lower.contains("mac") || lower.contains("osx")) return "macOS";
        if (lower.contains("linux")) return "Linux";
        // Cannot determine from brand alone
        return null;
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onQuit(PlayerQuitEvent event) {
        String uuid = event.getPlayer().getUniqueId().toString();
        plugin.getDataManager().recordLeave(uuid);
    }
}
