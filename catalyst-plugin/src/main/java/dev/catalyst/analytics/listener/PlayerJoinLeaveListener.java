package dev.catalyst.analytics.listener;

import dev.catalyst.analytics.CatalystAnalyticsPlugin;
import dev.catalyst.analytics.data.DataManager;
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

        // Capture protocol version (available on most Spigot versions)
        try {
            // Use reflection to get protocol version for broad compatibility
            Object handle = player.getClass().getMethod("getHandle").invoke(player);
            Object connection = handle.getClass().getField("playerConnection").get(handle);
            Object networkManager = connection.getClass().getField("networkManager").get(connection);
            // This approach may not work on all versions; fall back gracefully
        } catch (Exception ignored) {
            // Protocol version detection not available on this server version
        }

        // Try to get client brand (available on Paper/newer Spigot)
        try {
            java.lang.reflect.Method brandMethod = player.getClass().getMethod("getClientBrandName");
            String brand = (String) brandMethod.invoke(player);
            if (brand != null) {
                dm.setPlayerClientBrand(uuid, brand);
            }
        } catch (Exception ignored) {
            // getClientBrandName() not available on older versions
        }

        // Geolocation lookup (async)
        if (plugin.getConfig().getBoolean("stats.geolocation", true)) {
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
}
