package dev.catalyst.analytics;

import dev.catalyst.analytics.collector.*;
import dev.catalyst.analytics.command.AnalyticsCommand;
import dev.catalyst.analytics.data.DataManager;
import dev.catalyst.analytics.listener.*;
import org.bukkit.Bukkit;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.logging.Level;

/**
 * CatalystAnalytics — Lightweight analytics plugin for Catalyst server manager.
 * Collects server statistics asynchronously and writes them to a local JSON file
 * that the Catalyst Electron app reads directly via the filesystem.
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

        // Schedule periodic async data saving (internal data files)
        int saveIntervalMinutes = getConfig().getInt("data.save-interval-minutes", 5);
        long saveIntervalTicks = saveIntervalMinutes * 60L * 20L;
        Bukkit.getScheduler().runTaskTimerAsynchronously(this, () -> dataManager.saveAll(), saveIntervalTicks, saveIntervalTicks);

        // Schedule data cleanup
        Bukkit.getScheduler().runTaskTimerAsynchronously(this, () -> dataManager.cleanupOldData(), 20L * 60, 20L * 60 * 60);

        // Schedule analytics.json export every 5 seconds (async, lag-free)
        // This is the file the Catalyst Electron app reads directly
        int exportIntervalSeconds = getConfig().getInt("export.interval-seconds", 5);
        long exportIntervalTicks = exportIntervalSeconds * 20L;
        Bukkit.getScheduler().runTaskTimerAsynchronously(this, () -> dataManager.exportAnalyticsJson(), 20L * 5, exportIntervalTicks);

        // Register commands
        getCommand("analytics").setExecutor(new AnalyticsCommand(this));

        getLogger().info("CatalystAnalytics v" + getDescription().getVersion() + " enabled!");
        getLogger().info("Analytics data will be written to: " + dataManager.getAnalyticsJsonPath());
    }

    @Override
    public void onDisable() {
        // Save all data synchronously on shutdown
        if (dataManager != null) {
            dataManager.saveAll();
            dataManager.exportAnalyticsJson();
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
