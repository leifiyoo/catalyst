package dev.catalyst.analytics.listener;

import dev.catalyst.analytics.CatalystAnalyticsPlugin;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerCommandPreprocessEvent;

/**
 * Tracks commands executed by players.
 */
public class CommandListener implements Listener {

    private final CatalystAnalyticsPlugin plugin;

    public CommandListener(CatalystAnalyticsPlugin plugin) {
        this.plugin = plugin;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onCommand(PlayerCommandPreprocessEvent event) {
        Player player = event.getPlayer();
        plugin.getDataManager().recordCommand(player.getUniqueId().toString());
    }
}
