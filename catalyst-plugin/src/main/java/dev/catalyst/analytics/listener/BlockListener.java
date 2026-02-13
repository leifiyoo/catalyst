package dev.catalyst.analytics.listener;

import dev.catalyst.analytics.CatalystAnalyticsPlugin;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockPlaceEvent;

/**
 * Tracks blocks placed and broken per player.
 */
public class BlockListener implements Listener {

    private final CatalystAnalyticsPlugin plugin;

    public BlockListener(CatalystAnalyticsPlugin plugin) {
        this.plugin = plugin;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onPlace(BlockPlaceEvent event) {
        String uuid = event.getPlayer().getUniqueId().toString();
        plugin.getDataManager().recordBlockPlaced(uuid);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onBreak(BlockBreakEvent event) {
        String uuid = event.getPlayer().getUniqueId().toString();
        plugin.getDataManager().recordBlockBroken(uuid);
    }
}
