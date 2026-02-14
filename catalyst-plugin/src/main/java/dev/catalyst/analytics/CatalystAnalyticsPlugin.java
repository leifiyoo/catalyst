package dev.catalyst.analytics;

import dev.catalyst.analytics.collector.*;
import dev.catalyst.analytics.command.AnalyticsCommand;
import dev.catalyst.analytics.data.DataManager;
import dev.catalyst.analytics.listener.*;
import org.bukkit.Bukkit;
import org.bukkit.plugin.java.JavaPlugin;

/**
 * CatalystAnalytics — Lightweight analytics plugin for Catalyst server manager.
 * Collects server statistics asynchronously and writes them to a JSON file
 * that the Catalyst Electron app reads directly from the filesystem.
 * No HTTP API, no external connections needed.
 */
public class CatalystAnalyticsPlugin extends JavaPlugin {

    private static CatalystAnalyticsPlugin instance;
    private DataManager dataManager;
    private TpsCollector tpsCollector;
    private MemoryCollector memoryCollector;
    private PlayerCountCollector playerCountCollector;
    private GeoLocationService geoLocationService;

    @Override
    public void onEnable() {
        instance = this;
        saveDefaultConfig();

        // Initialize data manager (handles JSON persistence)
        dataManager = new DataManager(this);
        dataManager.loadAll();

        // Initialize geolocation service
        geoLocationService = new GeoLocationService(this);

        // Register event listeners based on config
        // Support both new "tracking.*" and legacy "stats.*" config keys
        if (isTrackingEnabled("track-player-joins", "stats.player-join-leave")) {
            Bukkit.getPluginManager().registerEvents(new PlayerJoinLeaveListener(this), this);
        }
        if (getConfig().getBoolean("stats.chat-messages", true)) {
            Bukkit.getPluginManager().registerEvents(new ChatListener(this), this);
        }
        if (getConfig().getBoolean("stats.deaths-kills", true)) {
            Bukkit.getPluginManager().registerEvents(new DeathKillListener(this), this);
        }
        if (getConfig().getBoolean("stats.blocks", true)) {
            Bukkit.getPluginManager().registerEvents(new BlockListener(this), this);
        }
        if (getConfig().getBoolean("stats.commands", true)) {
            Bukkit.getPluginManager().registerEvents(new CommandListener(this), this);
        }

        // Register brand channel listener for client detection
        if (isTrackingEnabled("track-player-clients", "stats.client-os")) {
            Bukkit.getPluginManager().registerEvents(new ClientBrandListener(this), this);
            // Register plugin messaging channel for brand detection
            try {
                Bukkit.getMessenger().registerIncomingPluginChannel(this, "minecraft:brand", new ClientBrandListener(this));
            } catch (Exception e) {
                // Try legacy channel name for older versions
                try {
                    Bukkit.getMessenger().registerIncomingPluginChannel(this, "MC|Brand", new ClientBrandListener(this));
                } catch (Exception ignored) {
                    getLogger().fine("Could not register brand channel listener");
                }
            }
        }

        // Start collectors (async tasks)
        if (isTrackingEnabled("track-tps", "stats.tps-history")) {
            tpsCollector = new TpsCollector(this);
            tpsCollector.start();
        }
        if (isTrackingEnabled("track-ram", "stats.memory-history")) {
            memoryCollector = new MemoryCollector(this);
            memoryCollector.start();
        }
        if (getConfig().getBoolean("stats.player-count-timeline", true)) {
            playerCountCollector = new PlayerCountCollector(this);
            playerCountCollector.start();
        }

        // Schedule periodic async data saving (writes analytics.json for Electron app)
        int saveIntervalSeconds = getConfig().getInt("data.save-interval-seconds", 30);
        long saveIntervalTicks = saveIntervalSeconds * 20L;
        Bukkit.getScheduler().runTaskTimerAsynchronously(this, () -> dataManager.saveAll(), saveIntervalTicks, saveIntervalTicks);

        // Schedule data cleanup (every hour)
        Bukkit.getScheduler().runTaskTimerAsynchronously(this, () -> dataManager.cleanupOldData(), 20L * 60, 20L * 60 * 60);

        // Register commands
        getCommand("analytics").setExecutor(new AnalyticsCommand(this));

        getLogger().info("CatalystAnalytics v" + getDescription().getVersion() + " enabled! (file-based mode)");
    }

    @Override
    public void onDisable() {
        // Save all data synchronously on shutdown
        if (dataManager != null) {
            dataManager.saveAll();
        }

        // Unregister plugin channels
        try {
            Bukkit.getMessenger().unregisterIncomingPluginChannel(this);
        } catch (Exception ignored) {}

        getLogger().info("CatalystAnalytics disabled.");
    }

    /**
     * Check if a tracking feature is enabled, supporting both new and legacy config keys.
     */
    public boolean isTrackingEnabled(String newKey, String legacyKey) {
        // New tracking.* keys take priority
        if (getConfig().contains("tracking." + newKey)) {
            return getConfig().getBoolean("tracking." + newKey, true);
        }
        // Fall back to legacy stats.* keys
        return getConfig().getBoolean(legacyKey, true);
    }

    public static CatalystAnalyticsPlugin getInstance() {
        return instance;
    }

    public DataManager getDataManager() {
        return dataManager;
    }

    public GeoLocationService getGeoLocationService() {
        return geoLocationService;
    }
}
