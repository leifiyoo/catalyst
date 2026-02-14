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
        if (getConfig().getBoolean("stats.player-join-leave", true)) {
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

        // Start collectors (async tasks)
        if (getConfig().getBoolean("stats.tps-history", true)) {
            tpsCollector = new TpsCollector(this);
            tpsCollector.start();
        }
        if (getConfig().getBoolean("stats.memory-history", true)) {
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

        // Schedule data cleanup
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

        getLogger().info("CatalystAnalytics disabled.");
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
