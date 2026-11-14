package dev.catalyst.analytics.listener;

import dev.catalyst.analytics.CatalystAnalyticsPlugin;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.PlayerDeathEvent;

/**
 * Tracks player deaths and PvP kills.
 */
public class DeathKillListener implements Listener {

    private final CatalystAnalyticsPlugin plugin;

    public DeathKillListener(CatalystAnalyticsPlugin plugin) {
        this.plugin = plugin;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onDeath(PlayerDeathEvent event) {
        Player victim = event.getEntity();
        plugin.getDataManager().recordDeath(victim.getUniqueId().toString());

        // Check if killer is a player (PvP kill)
        Player killer = victim.getKiller();
        if (killer != null) {
            plugin.getDataManager().recordKill(killer.getUniqueId().toString());
        }
    }
}
