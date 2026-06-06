import { useState, useEffect, useCallback } from 'react'

export type ConsoleTheme = 'monokai' | 'solarized-dark' | 'solarized-light' | 'dracula' | 'nord'
export type ConsoleFontSize = 'small' | 'medium' | 'large'

export interface ConsolePreferences {
  theme: ConsoleTheme
  fontSize: ConsoleFontSize
}

export interface AppPreferences {
  console: ConsolePreferences
  dashboardPassword?: string
  enableMobileLink: boolean
}

const DEFAULT_PREFERENCES: AppPreferences = {
  console: {
    theme: 'monokai',
    fontSize: 'medium'
  },
  enableMobileLink: false
}

const STORAGE_KEY = 'catalyst:preferences'

export function usePreferences() {
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_PREFERENCES)
  const [loaded, setLoaded] = useState(false)

  // Load preferences from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setPreferences(JSON.parse(stored))
      } catch (e) {
        console.error('Failed to parse preferences:', e)
      }
    }
    setLoaded(true)
  }, [])

  // Save preferences to localStorage
  const savePreferences = useCallback((newPrefs: AppPreferences) => {
    setPreferences(newPrefs)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrefs))
  }, [])

  // Update console theme
  const updateConsoleTheme = useCallback((theme: ConsoleTheme) => {
    setPreferences((prev) => {
      const updated = {
        ...prev,
        console: { ...prev.console, theme }
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  // Update console font size
  const updateConsoleFontSize = useCallback((fontSize: ConsoleFontSize) => {
    setPreferences((prev) => {
      const updated = {
        ...prev,
        console: { ...prev.console, fontSize }
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  // Update dashboard password
  const updateDashboardPassword = useCallback((password?: string) => {
    setPreferences((prev) => {
      const updated = {
        ...prev,
        dashboardPassword: password
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  // Toggle mobile link
  const toggleMobileLink = useCallback((enabled: boolean) => {
    setPreferences((prev) => {
      const updated = {
        ...prev,
        enableMobileLink: enabled
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  return {
    preferences,
    loaded,
    savePreferences,
    updateConsoleTheme,
    updateConsoleFontSize,
    updateDashboardPassword,
    toggleMobileLink
  }
}
