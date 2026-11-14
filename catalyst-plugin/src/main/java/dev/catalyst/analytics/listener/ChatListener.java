package dev.catalyst.analytics.listener;

import dev.catalyst.analytics.CatalystAnalyticsPlugin;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.AsyncPlayerChatEvent;

/**
 * Tracks chat message counts per player.
 */
public class ChatListener implements Listener {

    private final CatalystAnalyticsPlugin plugin;

    public ChatListener(CatalystAnalyticsPlugin plugin) {
        this.plugin = plugin;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onChat(AsyncPlayerChatEvent event) {
        String uuid = event.getPlayer().getUniqueId().toString();
        plugin.getDataManager().recordChat(uuid);
    }
}
