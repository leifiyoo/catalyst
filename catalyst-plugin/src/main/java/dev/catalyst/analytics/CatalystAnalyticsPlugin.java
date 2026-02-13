package dev.catalyst.analytics;

import dev.catalyst.analytics.collector.*;
import dev.catalyst.analytics.command.AnalyticsCommand;
import dev.catalyst.analytics.data.DataManager;
import dev.catalyst.analytics.http.HttpApiServer;
import dev.catalyst.analytics.listener.*;
import org.bukkit.Bukkit;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.logging.Level;

/**
 * CatalystAnalytics — Lightweight analytics plugin for Catalyst server manager.
 * Collects server statistics asynchronously and exposes them via a REST API.
 */
public class CatalystAnalyticsPlugin extends JavaPlugin {

    private static CatalystAnalyticsPlugin instance;
    private DataManager dataManager;
    private HttpApiServer httpServer;
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

        // Schedule periodic async data saving
        int saveIntervalMinutes = getConfig().getInt("data.save-interval-minutes", 5);
        long saveIntervalTicks = saveIntervalMinutes * 60L * 20L;
        Bukkit.getScheduler().runTaskTimerAsynchronously(this, () -> dataManager.saveAll(), saveIntervalTicks, saveIntervalTicks);

        // Schedule data cleanup
        Bukkit.getScheduler().runTaskTimerAsynchronously(this, () -> dataManager.cleanupOldData(), 20L * 60, 20L * 60 * 60);

        // Start HTTP API server
        int apiPort = getConfig().getInt("api.port", 7845);
        String apiKey = getConfig().getString("api.key", "change-me-to-a-secure-key");
        String corsOrigin = getConfig().getString("api.cors-origin", "*");
        try {
            httpServer = new HttpApiServer(this, apiPort, apiKey, corsOrigin);
            httpServer.start();
            getLogger().info("REST API started on port " + apiPort);
        } catch (Exception e) {
            getLogger().log(Level.SEVERE, "Failed to start HTTP API server on port " + apiPort, e);
        }

        // Register commands
        getCommand("analytics").setExecutor(new AnalyticsCommand(this));

        getLogger().info("CatalystAnalytics v" + getDescription().getVersion() + " enabled!");
    }

    @Override
    public void onDisable() {
        // Save all data synchronously on shutdown
        if (dataManager != null) {
            dataManager.saveAll();
        }

        // Stop HTTP server
        if (httpServer != null) {
            httpServer.stop();
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
