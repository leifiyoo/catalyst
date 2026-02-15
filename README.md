![catalyst](/.github/assets/banner.png)

# Catalyst

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows-lightgrey.svg)](#installation)
[![Electron](https://img.shields.io/badge/Electron-33-47848F.svg?logo=electron&logoColor=white)](https://www.electronjs.org/)

**A modern, feature-rich Minecraft server launcher and manager.**

Catalyst makes it easy to create, configure, and manage multiple Minecraft servers from a single desktop application. With automatic Java management, plugin support via Modrinth, built-in analytics, and a sleek dark UI — running a Minecraft server has never been simpler.

---

## ✨ Features

- 🖥️ **Multi-Server Management** — Create and run multiple Minecraft servers (Vanilla, Paper, Fabric, Forge, and more)
- ☕ **Automatic Java Runtime** — Downloads and manages the correct Java version (8, 11, 17, 21) based on your Minecraft version
- 📟 **Real-Time Console** — Integrated server console with live output
- 🔌 **Plugin Management** — Search, install, and update plugins directly from Modrinth
- 📊 **Server Analytics** — Bundled CatalystAnalytics plugin for TPS, memory usage, player stats, and geo-location tracking
- 💾 **Automated Backups** — Configurable backup schedules to keep your worlds safe
- 🌐 **Ngrok Integration** — Share your server instantly with built-in tunnel support
- ⚙️ **Server Properties Editor** — Edit server.properties, whitelist, and banlist from the UI
- 🎨 **Modern Dark UI** — Custom frameless window with a polished, modern interface and 3D splash screen
- 🔄 **Auto-Updates** — Built-in update checker to stay on the latest version
- 💻 **Cross-Platform** — Supports Windows (Linux coming soon)

---

## 📥 Installation

Download the latest release from [**GitHub Releases**](../../releases).

| Platform | Format |
|----------|--------|
| Windows  | `.exe` installer |
| Linux    | 🚧 Coming Soon |

---

## 🛠️ Development

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [npm](https://www.npmjs.com/) (included with Node.js)

### Setup

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev
```

### Build

```bash
# Windows
npm run build:win

# Linux
# 🚧 Coming Soon

```

### Testing

```bash
# Run unit tests
npm run test:unit

# Run tests with coverage
npm run coverage
```

---

## 🧰 Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | [Electron 33](https://www.electronjs.org/) with [electron-vite](https://electron-vite.org/) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **Frontend** | [React 19](https://react.dev/) |
| **Styling** | [Tailwind CSS 3](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) |
| **3D Graphics** | [Three.js](https://threejs.org/) |
| **Testing** | [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/) |

---

## 📄 License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
