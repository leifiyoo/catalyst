package dev.catalyst.analytics.collector;

import dev.catalyst.analytics.CatalystAnalyticsPlugin;
import org.bukkit.Bukkit;

/**
 * Takes periodic snapshots of the online player count.
 */
public class PlayerCountCollector {

    private final CatalystAnalyticsPlugin plugin;

    public PlayerCountCollector(CatalystAnalyticsPlugin plugin) {
        this.plugin = plugin;
    }

    public void start() {
        int intervalSeconds = plugin.getConfig().getInt("collection.player-count-interval", 300);
        long intervalTicks = intervalSeconds * 20L;

        // Must read player count on main thread, then store async-safe
        Bukkit.getScheduler().runTaskTimer(plugin, () -> {
            int count = Bukkit.getOnlinePlayers().size();
            plugin.getDataManager().addPlayerCountSnapshot(count);
        }, intervalTicks, intervalTicks);
    }
}
