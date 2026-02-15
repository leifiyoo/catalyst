import { app } from "electron";
import path from "path";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import {
  TCPShieldTutorialConfig,
  TCPShieldTutorialStep,
  TCPShieldTutorialStatus,
} from "@shared/types";

const CONFIG_DIR = path.join(app.getPath("userData"), "tcpshield");
const TUTORIAL_FILE = path.join(CONFIG_DIR, "tutorial.json");

const DEFAULT_TUTORIAL_CONFIG: TCPShieldTutorialConfig = {
  tutorialStatus: "not-started",
  currentStep: 0,
  protectedCname: "",
  domain: "",
  backendAddress: "",
  backendPort: 25565,
  debug: false,
};

/**
 * All tutorial steps for TCPShield setup (German)
 */
export const TUTORIAL_STEPS: TCPShieldTutorialStep[] = [
  {
    id: 0,
    title: "Account erstellen",
    description:
      "Erstelle einen Account auf tcpshield.com und logge dich ins Panel ein (panel.tcpshield.com).",
    instructions: [
      "Gehe auf tcpshield.com und erstelle einen kostenlosen Account.",
      "Bestätige deine E-Mail-Adresse.",
      "Logge dich ins Panel ein unter panel.tcpshield.com.",
    ],
    hasExternalLink: true,
    externalLinkUrl: "https://tcpshield.com",
    externalLinkLabel: "TCPShield öffnen",
  },
  {
    id: 1,
    title: "Netzwerk erstellen",
    description:
      "Klicke auf 'Add Network' im Panel. Gib deinem Netzwerk einen Namen (z.B. dein Servername).",
    instructions: [
      "Klicke im TCPShield Panel auf 'Add Network'.",
      "Gib deinem Netzwerk einen Namen (z.B. den Namen deines Minecraft-Servers).",
      "Wähle den kostenlosen Plan oder einen passenden Plan aus.",
    ],
    hasExternalLink: true,
    externalLinkUrl: "https://panel.tcpshield.com",
    externalLinkLabel: "TCPShield Panel öffnen",
  },
  {
    id: 2,
    title: "Protected CNAME kopieren",
    description:
      "Unter 'Domain Management' siehst du deine Protected CNAME (z.B. xxxxxxxx.tcpshield.com). Kopiere diese und füge sie hier ein:",
    instructions: [
      "Öffne dein Netzwerk im TCPShield Panel.",
      "Gehe zu 'Domain Management'.",
      "Kopiere die angezeigte Protected CNAME (z.B. xxxxxxxx.tcpshield.com).",
      "Füge sie unten in das Eingabefeld ein.",
    ],
    hasInput: true,
    inputLabel: "Protected CNAME",
    inputPlaceholder: "xxxxxxxx.tcpshield.com",
    inputField: "protectedCname",
    hasExternalLink: true,
    externalLinkUrl: "https://panel.tcpshield.com",
    externalLinkLabel: "TCPShield Panel öffnen",
  },
  {
    id: 3,
    title: "Domain hinzufügen",
    description:
      "Füge deine Domain im TCPShield Panel unter 'Domains' hinzu. Erstelle dann einen CNAME DNS-Record der auf deine Protected CNAME zeigt.",
    instructions: [
      "Gehe im TCPShield Panel zu 'Domains' und füge deine Domain hinzu.",
      "Erstelle bei deinem DNS-Anbieter einen CNAME-Record:",
      "  → Name: deine Domain (z.B. mc.example.com)",
      "  → Ziel: deine Protected CNAME",
      "",
      "Kein eigener Domain? Spieler können sich direkt über deine Protected CNAME verbinden!",
    ],
    hasExternalLink: true,
    externalLinkUrl: "https://panel.tcpshield.com",
    externalLinkLabel: "TCPShield Panel öffnen",
  },
  {
    id: 4,
    title: "Backend konfigurieren",
    description:
      "Gib im TCPShield Panel deine echte Server-IP und Port als Backend ein. Das ist die IP die du schützen willst.",
    instructions: [
      "Gehe im TCPShield Panel zu 'Backends'.",
      "Klicke auf 'Add Backend'.",
      "Gib deine echte Server-IP und den Port ein.",
      "Speichere die Einstellungen.",
      "Trage die gleichen Daten auch unten ein, damit Catalyst sie kennt.",
    ],
    hasInput: true,
    inputLabel: "Backend Server-IP:Port",
    inputPlaceholder: "123.456.789.0",
    inputField: "backendAddress",
    hasExternalLink: true,
    externalLinkUrl: "https://panel.tcpshield.com",
    externalLinkLabel: "TCPShield Panel öffnen",
  },
  {
    id: 5,
    title: "Fertig!",
    description:
      "Dein Server ist jetzt über TCPShield geschützt! Deine echte IP bleibt versteckt.",
    instructions: [
      "Die Einrichtung ist abgeschlossen!",
      "Spieler verbinden sich jetzt über deine Domain oder Protected CNAME.",
      "Deine echte Server-IP ist durch TCPShield geschützt.",
      "",
      "Tipp: Teste die Verbindung, indem du dich über die neue Adresse mit deinem Server verbindest.",
    ],
  },
];

// ---- Config persistence ----

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function debugLog(config: TCPShieldTutorialConfig, ...args: unknown[]): void {
  if (config.debug) {
    console.log("[tcpshield-tutorial]", ...args);
  }
}

/**
 * Load tutorial config from disk
 */
export async function loadTutorialConfig(): Promise<TCPShieldTutorialConfig> {
  try {
    ensureConfigDir();
    if (!existsSync(TUTORIAL_FILE)) {
      return { ...DEFAULT_TUTORIAL_CONFIG };
    }
    const raw = await fs.readFile(TUTORIAL_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    const config: TCPShieldTutorialConfig = {
      tutorialStatus: parsed.tutorialStatus ?? DEFAULT_TUTORIAL_CONFIG.tutorialStatus,
      currentStep: parsed.currentStep ?? DEFAULT_TUTORIAL_CONFIG.currentStep,
      protectedCname: parsed.protectedCname ?? DEFAULT_TUTORIAL_CONFIG.protectedCname,
      domain: parsed.domain ?? DEFAULT_TUTORIAL_CONFIG.domain,
      backendAddress: parsed.backendAddress ?? DEFAULT_TUTORIAL_CONFIG.backendAddress,
      backendPort: parsed.backendPort ?? DEFAULT_TUTORIAL_CONFIG.backendPort,
      debug: parsed.debug ?? DEFAULT_TUTORIAL_CONFIG.debug,
    };
    debugLog(config, "Config loaded");
    return config;
  } catch (error) {
    console.error("[tcpshield-tutorial] Failed to load config:", error);
    return { ...DEFAULT_TUTORIAL_CONFIG };
  }
}

/**
 * Save tutorial config to disk
 */
export async function saveTutorialConfig(config: TCPShieldTutorialConfig): Promise<void> {
  try {
    ensureConfigDir();
    await fs.writeFile(TUTORIAL_FILE, JSON.stringify(config, null, 2), "utf-8");
    debugLog(config, "Config saved");
  } catch (error) {
    console.error("[tcpshield-tutorial] Failed to save config:", error);
    throw error;
  }
}

/**
 * Update partial tutorial config fields and persist
 */
export async function updateTutorialConfig(
  partial: Partial<TCPShieldTutorialConfig>
): Promise<TCPShieldTutorialConfig> {
  const current = await loadTutorialConfig();
  const updated: TCPShieldTutorialConfig = {
    ...current,
    ...partial,
  };

  // Auto-update tutorial status based on step
  if (partial.currentStep !== undefined) {
    if (partial.currentStep >= TUTORIAL_STEPS.length - 1) {
      updated.tutorialStatus = "completed";
    } else if (partial.currentStep > 0) {
      updated.tutorialStatus = "in-progress";
    }
  }

  debugLog(updated, "Config updated:", partial);
  await saveTutorialConfig(updated);
  return updated;
}

/**
 * Reset tutorial to initial state
 */
export async function resetTutorial(): Promise<void> {
  const config = { ...DEFAULT_TUTORIAL_CONFIG };
  await saveTutorialConfig(config);
  console.log("[tcpshield-tutorial] Tutorial reset");
}

/**
 * Get all tutorial steps
 */
export function getTutorialSteps(): TCPShieldTutorialStep[] {
  return TUTORIAL_STEPS;
}
