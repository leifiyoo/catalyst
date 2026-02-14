package dev.catalyst.analytics.collector;

import dev.catalyst.analytics.CatalystAnalyticsPlugin;
import org.bukkit.Bukkit;

/**
 * Samples TPS (ticks per second) and MSPT (milliseconds per tick) at configurable intervals.
 * Uses a tick-counting approach compatible with all Spigot/Paper versions.
 */
public class TpsCollector {

    private final CatalystAnalyticsPlugin plugin;
    private long lastPollTime;

    public TpsCollector(CatalystAnalyticsPlugin plugin) {
        this.plugin = plugin;
    }

    public void start() {
        int intervalSeconds = plugin.getConfig().getInt("collection.tps-interval", 60);
        long intervalTicks = intervalSeconds * 20L;

        // Initialize baseline
        lastPollTime = System.nanoTime();

        // Use a repeating sync task to count ticks accurately
        Bukkit.getScheduler().runTaskTimer(plugin, new Runnable() {
            private long tickCount = 0;

            @Override
            public void run() {
                tickCount++;
                if (tickCount % intervalTicks == 0) {
                    long now = System.nanoTime();
                    long elapsed = now - lastPollTime;
                    double seconds = elapsed / 1_000_000_000.0;
                    double tps = intervalTicks / seconds;
                    // Cap at 20 TPS
                    tps = Math.min(tps, 20.0);
                    tps = Math.round(tps * 100.0) / 100.0;

                    // Calculate MSPT (milliseconds per tick)
                    double mspt = (elapsed / 1_000_000.0) / intervalTicks;
                    mspt = Math.round(mspt * 100.0) / 100.0;

                    plugin.getDataManager().addTpsSampleWithMspt(tps, mspt);
                    lastPollTime = now;
                }
            }
        }, 1L, 1L);
    }
}
