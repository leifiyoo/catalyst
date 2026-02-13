# CatalystAnalytics Plugin

A lightweight Minecraft server analytics plugin built for the [Catalyst](https://github.com/leifiyoo/catalyst) server manager.

## What it does

CatalystAnalytics collects real-time server statistics and exposes them via a built-in REST API that the Catalyst desktop app reads to display analytics dashboards. Tracked data includes:

- **Player activity** — joins, leaves, play time, new vs. returning players
- **Performance** — TPS history, memory usage over time
- **Player stats** — deaths, kills, blocks placed/broken, chat messages, commands
- **Geolocation** — approximate country/region of connecting players (via free IP API)
- **Client info** — Minecraft client version and brand
- **Peak hours** — hourly join distribution

All data is persisted as JSON files inside the plugin's `data/` folder and automatically cleaned up based on a configurable retention period.

## Auto-installation

When you create a new server in Catalyst with the **"Enable CatalystAnalytics"** toggle turned on (available for Paper and Purpur servers), the plugin JAR is automatically copied into the server's `plugins/` directory. The plugin is also re-verified on every server start to ensure it stays installed.

You do **not** need Java or Gradle on your machine — a pre-built JAR ships with the Catalyst app at `resources/plugins/CatalystAnalytics.jar`.

## Configuration

On first run the plugin creates `plugins/CatalystAnalytics/config.yml` with sensible defaults:

| Setting | Default | Description |
|---------|---------|-------------|
| `api.port` | `7845` | HTTP API port |
| `api.key` | `change-me-to-a-secure-key` | Bearer token for API auth |
| `data.retention-days` | `30` | Days to keep historical data |
| `data.save-interval-minutes` | `5` | Auto-save frequency |

See [`src/main/resources/config.yml`](src/main/resources/config.yml) for the full list of options.

## Connecting from Catalyst

1. Start your server with the plugin installed.
2. Open the server's **Analytics** tab in Catalyst.
3. Enter the API port and key (defaults are pre-filled).
4. Click **Connect** — the dashboard will auto-refresh every 30 seconds.

## Building from source

If you want to rebuild the JAR yourself:

```bash
cd catalyst-plugin
./gradlew jar
```

The output JAR will be at `build/libs/CatalystAnalytics-1.0.0.jar`.

Requires **Java 17+**.

## Supported server software

- Paper 1.13+
- Purpur 1.13+

Vanilla and Fabric servers do not support Bukkit plugins and are not compatible.
