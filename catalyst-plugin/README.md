# CatalystAnalytics Plugin

A lightweight Minecraft server analytics plugin built for the [Catalyst](../README.md) server manager. It collects server statistics and exposes them via a REST API that the Catalyst desktop app consumes.

## Features

- **Player tracking** — joins, leaves, play time, new vs. returning players
- **Performance monitoring** — TPS history, memory usage over time
- **Player count timeline** — snapshots of online player count
- **Geolocation** — approximate country/region of connecting players (via ip-api.com)
- **Activity stats** — chat messages, commands executed, blocks placed/broken, deaths, kills
- **Client info** — client version and brand detection
- **Peak hours** — hourly join distribution (UTC)
- **Built-in REST API** — serves all data to the Catalyst Electron app on port `7845`

## Auto-Installation

When you create a new server in Catalyst and enable the **"Enable CatalystAnalytics"** toggle (available for Paper and Purpur servers), the plugin JAR is automatically copied into the server's `plugins/` directory. No manual setup required.

## Manual Installation

1. Copy `CatalystAnalytics.jar` into your server's `plugins/` folder.
2. Start (or restart) the server.
3. Edit `plugins/CatalystAnalytics/config.yml` to change the API key and other settings.
4. In the Catalyst app, open the server's **Analytics** tab, enter the API port and key, and click **Connect**.

## Configuration

The plugin creates a `config.yml` in `plugins/CatalystAnalytics/` on first run:

| Setting | Default | Description |
|---------|---------|-------------|
| `api.port` | `7845` | HTTP API port |
| `api.key` | `change-me-to-a-secure-key` | API authentication key |
| `api.cors-origin` | `*` | Allowed CORS origins |
| `data.retention-days` | `30` | Days to keep detailed history |
| `data.save-interval-minutes` | `5` | Auto-save interval |
| `collection.tps-interval` | `60` | TPS sampling interval (seconds) |
| `collection.memory-interval` | `60` | Memory sampling interval (seconds) |
| `collection.player-count-interval` | `300` | Player count snapshot interval (seconds) |

Individual stat collectors can be toggled on/off under the `stats` section.

## API Endpoints

All endpoints require a `Bearer` token in the `Authorization` header (or `?key=` query parameter).

| Endpoint | Description |
|----------|-------------|
| `GET /api/analytics/overview` | Server-wide summary stats |
| `GET /api/analytics/players` | All tracked players with details |
| `GET /api/analytics/tps` | TPS history time series |
| `GET /api/analytics/memory` | Memory usage time series |
| `GET /api/analytics/geo` | Player geolocation breakdown |
| `GET /api/analytics/timeline` | Player count over time |

## Building from Source

Requires Java 17+.

```bash
cd catalyst-plugin
chmod +x gradlew
./gradlew jar
```

The built JAR will be at `build/libs/CatalystAnalytics-1.0.0.jar`.

## Compatibility

- **Minecraft**: 1.13+ (API version 1.13)
- **Server software**: Paper, Purpur, Spigot (Paper/Purpur recommended for full feature support)
- **Java**: 17+
