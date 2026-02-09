# ![catalyst](/.github/assets/banner.png)

Catalyst is an upcoming modern server interface.

## Overview

This project is built using Electron, Vite, and React with Shadcn UI.

## Development

### Prerequisites

- Node.js (version 18 or higher recommended)
- npm (comes with Node.js)

### Installation

```bash
npm install --legacy-peer-deps
```

### Development Server

To start the app in development mode:

```bash
npm run dev
```

## Building

To build the application for production:

### Windows

```bash
npm run build:win
```

### macOS

```bash
npm run build:mac
```

### Linux

```bash
npm run build:linux
```

The build artifacts will be stored in the `dist` or `release` directory (depending on your configuration).

### Tech Stack

| Category                  | Technology                                                                                  |
|---------------------------|---------------------------------------------------------------------------------------------|
| **Software Framework**    | [Electron](https://www.electronjs.org/)                                                     |
| **Frontend Library**      | [React](https://react.dev/)                                                                 |
| **Build Tool**            | [Vite](https://vite.dev/), [Electron-Vite](https://electron-vite.org/)                                                                   |
| **UI and Styling**        | [shadcn](https://ui.shadcn.com/), [Tailwind](https://tailwindcss.com/)                      |
| **Testing**               | [Vitest](https://vitest.dev), [Testing Library](https://testing-library.com/)                 |

