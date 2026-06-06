import { ConsoleTheme, ConsoleFontSize } from '../hooks/usePreferences'

export interface ConsoleThemeConfig {
  name: string
  background: string
  foreground: string
  colors: {
    black: string
    red: string
    green: string
    yellow: string
    blue: string
    magenta: string
    cyan: string
    white: string
    brightBlack: string
    brightRed: string
    brightGreen: string
    brightYellow: string
    brightBlue: string
    brightMagenta: string
    brightCyan: string
    brightWhite: string
  }
}

export const CONSOLE_THEMES: Record<ConsoleTheme, ConsoleThemeConfig> = {
  monokai: {
    name: 'Monokai',
    background: '#272822',
    foreground: '#f8f8f2',
    colors: {
      black: '#272822',
      red: '#f92672',
      green: '#a6e22e',
      yellow: '#e6db74',
      blue: '#66d9ef',
      magenta: '#ae81ff',
      cyan: '#a1efe4',
      white: '#f8f8f2',
      brightBlack: '#75715e',
      brightRed: '#f92672',
      brightGreen: '#a6e22e',
      brightYellow: '#e6db74',
      brightBlue: '#66d9ef',
      brightMagenta: '#ae81ff',
      brightCyan: '#a1efe4',
      brightWhite: '#f9f8f5'
    }
  },
  'solarized-dark': {
    name: 'Solarized Dark',
    background: '#002b36',
    foreground: '#839496',
    colors: {
      black: '#073642',
      red: '#dc322f',
      green: '#859900',
      yellow: '#b58900',
      blue: '#268bd2',
      magenta: '#d33682',
      cyan: '#2aa198',
      white: '#eee8d5',
      brightBlack: '#586e75',
      brightRed: '#cb4b16',
      brightGreen: '#93a1a1',
      brightYellow: '#839496',
      brightBlue: '#657b83',
      brightMagenta: '#6c71c4',
      brightCyan: '#b58900',
      brightWhite: '#fdf6e3'
    }
  },
  'solarized-light': {
    name: 'Solarized Light',
    background: '#fdf6e3',
    foreground: '#657b83',
    colors: {
      black: '#073642',
      red: '#dc322f',
      green: '#859900',
      yellow: '#b58900',
      blue: '#268bd2',
      magenta: '#d33682',
      cyan: '#2aa198',
      white: '#eee8d5',
      brightBlack: '#002b36',
      brightRed: '#cb4b16',
      brightGreen: '#586e75',
      brightYellow: '#657b83',
      brightBlue: '#839496',
      brightMagenta: '#6c71c4',
      brightCyan: '#93a1a1',
      brightWhite: '#fdf6e3'
    }
  },
  dracula: {
    name: 'Dracula',
    background: '#282a36',
    foreground: '#f8f8f2',
    colors: {
      black: '#282a36',
      red: '#ff5555',
      green: '#50fa7b',
      yellow: '#f1fa8c',
      blue: '#bd93f9',
      magenta: '#ff79c6',
      cyan: '#8be9fd',
      white: '#f8f8f2',
      brightBlack: '#44475a',
      brightRed: '#ff6e6e',
      brightGreen: '#69ff94',
      brightYellow: '#ffffa5',
      brightBlue: '#d6acff',
      brightMagenta: '#ff92df',
      brightCyan: '#a4ffff',
      brightWhite: '#ffffff'
    }
  },
  nord: {
    name: 'Nord',
    background: '#2e3440',
    foreground: '#d8dee9',
    colors: {
      black: '#2e3440',
      red: '#bf616a',
      green: '#a3be8c',
      yellow: '#ebcb8b',
      blue: '#81a1c1',
      magenta: '#b48ead',
      cyan: '#88c0d0',
      white: '#e5e9f0',
      brightBlack: '#3b4252',
      brightRed: '#d08770',
      brightGreen: '#a3be8c',
      brightYellow: '#ebcb8b',
      brightBlue: '#81a1c1',
      brightMagenta: '#b48ead',
      brightCyan: '#8fbcbb',
      brightWhite: '#eceff4'
    }
  }
}

export const FONT_SIZES: Record<ConsoleFontSize, number> = {
  small: 12,
  medium: 14,
  large: 16
}

export function getConsoleThemeCSS(theme: ConsoleTheme): string {
  const config = CONSOLE_THEMES[theme]
  return `
    .console-container {
      background-color: ${config.background};
      color: ${config.foreground};
      font-family: 'Fira Code', 'Courier New', monospace;
    }
    
    .console-line {
      color: ${config.foreground};
    }
    
    .console-error {
      color: ${config.colors.red};
    }
    
    .console-warn {
      color: ${config.colors.yellow};
    }
    
    .console-info {
      color: ${config.colors.cyan};
    }
    
    .console-success {
      color: ${config.colors.green};
    }
    
    .console-timestamp {
      color: ${config.colors.cyan};
      opacity: 0.7;
    }
    
    .console-selection {
      background-color: ${config.colors.brightBlack};
    }
  `
}

export function applyConsoleTheme(theme: ConsoleTheme, fontSize: ConsoleFontSize): void {
  // Remove existing theme style
  const existingStyle = document.getElementById('console-theme-style')
  if (existingStyle) {
    existingStyle.remove()
  }

  // Create and apply new theme style
  const style = document.createElement('style')
  style.id = 'console-theme-style'
  style.innerHTML = getConsoleThemeCSS(theme)
  document.head.appendChild(style)

  // Apply font size
  const root = document.documentElement
  root.style.setProperty('--console-font-size', `${FONT_SIZES[fontSize]}px`)
}
