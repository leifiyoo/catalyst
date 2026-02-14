package dev.catalyst.analytics.listener;

import dev.catalyst.analytics.CatalystAnalyticsPlugin;
import dev.catalyst.analytics.data.DataManager;
import org.bukkit.entity.Player;
import org.bukkit.plugin.messaging.PluginMessageListener;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerRegisterChannelEvent;

import java.nio.charset.StandardCharsets;

/**
 * Detects client brand via the minecraft:brand / MC|Brand plugin messaging channel.
 * This identifies clients like Fabric, Forge, Lunar Client, Badlion, Vanilla, etc.
 */
public class ClientBrandListener implements Listener, PluginMessageListener {

    private final CatalystAnalyticsPlugin plugin;

    public ClientBrandListener(CatalystAnalyticsPlugin plugin) {
        this.plugin = plugin;
    }

    @Override
    public void onPluginMessageReceived(String channel, Player player, byte[] message) {
        if (!channel.equals("minecraft:brand") && !channel.equals("MC|Brand")) {
            return;
        }

        try {
            // The brand message is a UTF-8 string, sometimes prefixed with a varint length
            String brand = decodeBrand(message);
            if (brand != null && !brand.isEmpty()) {
                String uuid = player.getUniqueId().toString();
                String normalized = normalizeBrand(brand);
                plugin.getDataManager().setPlayerClientBrand(uuid, normalized);

                // Try to detect OS from brand string if possible
                String os = detectOsFromBrand(brand);
                if (os != null) {
                    plugin.getDataManager().setPlayerOs(uuid, os);
                }
            }
        } catch (Exception e) {
            plugin.getLogger().fine("Failed to decode brand for " + player.getName() + ": " + e.getMessage());
        }
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onChannelRegister(PlayerRegisterChannelEvent event) {
        // When a player registers the brand channel, try to read their brand
        // via Paper API if available
        Player player = event.getPlayer();
        try {
            java.lang.reflect.Method brandMethod = player.getClass().getMethod("getClientBrandName");
            String brand = (String) brandMethod.invoke(player);
            if (brand != null && !brand.isEmpty()) {
                String uuid = player.getUniqueId().toString();
                plugin.getDataManager().setPlayerClientBrand(uuid, normalizeBrand(brand));
            }
        } catch (Exception ignored) {
            // Not available on this server version
        }
    }

    /**
     * Decode the brand from the raw plugin message bytes.
     * The format is typically a varint-prefixed UTF-8 string.
     */
    private String decodeBrand(byte[] data) {
        if (data == null || data.length == 0) return null;

        // Try reading as varint-prefixed string first
        try {
            int index = 0;
            int length = 0;
            int shift = 0;
            byte b;
            do {
                if (index >= data.length) break;
                b = data[index++];
                length |= (b & 0x7F) << shift;
                shift += 7;
            } while ((b & 0x80) != 0 && shift < 35);

            if (length > 0 && index + length <= data.length) {
                return new String(data, index, length, StandardCharsets.UTF_8).trim();
            }
        } catch (Exception ignored) {}

        // Fall back to reading the entire byte array as a string
        return new String(data, StandardCharsets.UTF_8).trim();
    }

    /**
     * Normalize brand strings to friendly, consistent names.
     */
    private String normalizeBrand(String brand) {
        if (brand == null) return "Unknown";
        String lower = brand.toLowerCase().trim();

        if (lower.contains("lunarclient") || lower.contains("lunar")) return "Lunar Client";
        if (lower.contains("badlion") || lower.contains("blc")) return "Badlion Client";
        if (lower.contains("labymod")) return "LabyMod";
        if (lower.contains("feather")) return "Feather Client";
        if (lower.contains("fabric")) return "Fabric";
        if (lower.contains("forge") || lower.contains("fml")) return "Forge";
        if (lower.contains("quilt")) return "Quilt";
        if (lower.contains("optifine")) return "OptiFine";
        if (lower.contains("iris")) return "Iris";
        if (lower.contains("sodium")) return "Sodium";
        if (lower.equals("vanilla") || lower.equals("minecraft") || lower.equals("brand")) return "Vanilla";

        // Return original if no match
        return brand;
    }

    /**
     * Try to detect OS from brand string (some modded clients include OS info).
     */
    private String detectOsFromBrand(String brand) {
        if (brand == null) return null;
        String lower = brand.toLowerCase();
        if (lower.contains("windows") || lower.contains("win32") || lower.contains("win64")) return "Windows";
        if (lower.contains("macos") || lower.contains("mac os") || lower.contains("darwin")) return "macOS";
        if (lower.contains("linux") || lower.contains("ubuntu") || lower.contains("debian")) return "Linux";
        return null;
    }
}
