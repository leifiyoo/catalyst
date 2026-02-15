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
 * All tutorial steps for TCPShield setup
 */
export const TUTORIAL_STEPS: TCPShieldTutorialStep[] = [
  {
    id: 0,
    title: "Create an Account",
    description:
      "Create an account on tcpshield.com and log in to the panel (panel.tcpshield.com).",
    instructions: [
      "Go to tcpshield.com and create a free account.",
      "Confirm your email address.",
      "Log in to the panel at panel.tcpshield.com.",
    ],
    hasExternalLink: true,
    externalLinkUrl: "https://tcpshield.com",
    externalLinkLabel: "Open TCPShield",
  },
  {
    id: 1,
    title: "Create a Network",
    description:
      "Click 'Add Network' in the panel. Give your network a name (e.g. your server name).",
    instructions: [
      "Click 'Add Network' in the TCPShield panel.",
      "Give your network a name (e.g. the name of your Minecraft server).",
      "Select the free plan or a suitable plan.",
    ],
    hasExternalLink: true,
    externalLinkUrl: "https://panel.tcpshield.com",
    externalLinkLabel: "Open TCPShield Panel",
  },
  {
    id: 2,
    title: "Copy Protected CNAME",
    description:
      "Under 'Domain Management' you will see your Protected CNAME (e.g. xxxxxxxx.tcpshield.com). Copy it and paste it below:",
    instructions: [
      "Open your network in the TCPShield panel.",
      "Go to 'Domain Management'.",
      "Copy the displayed Protected CNAME (e.g. xxxxxxxx.tcpshield.com).",
      "Paste it into the input field below.",
    ],
    hasInput: true,
    inputLabel: "Protected CNAME",
    inputPlaceholder: "xxxxxxxx.tcpshield.com",
    inputField: "protectedCname",
    hasExternalLink: true,
    externalLinkUrl: "https://panel.tcpshield.com",
    externalLinkLabel: "Open TCPShield Panel",
  },
  {
    id: 3,
    title: "Get a Domain (Required)",
    description:
      "TCPShield requires a domain for DNS-based routing. You need to point a domain to your Protected CNAME via a DNS record.",
    instructions: [
      "You NEED a domain to use TCPShield — it routes traffic via DNS (CNAME records).",
      "If you already have a domain, skip to the next step.",
      "",
      "Don't have a domain? Here's how to get one cheaply:",
      "  → Cheap domains (~$1–2/year): Get a .xyz or .online domain from Namecheap or Cloudflare Registrar.",
      "  → Free subdomains: Use afraid.org (FreeDNS) to get a free subdomain like yourserver.mooo.com.",
      "",
      "Tip: This is a one-time setup and only takes a few minutes. A $1 domain works perfectly!",
    ],
    hasExternalLink: true,
    externalLinkUrl: "https://www.namecheap.com/domains/domain-name-search/",
    externalLinkLabel: "Search Cheap Domains (Namecheap)",
  },
  {
    id: 4,
    title: "Set Up DNS",
    description:
      "Add your domain in the TCPShield panel under 'Domains', then create a CNAME DNS record pointing to your Protected CNAME.",
    instructions: [
      "Go to 'Domains' in the TCPShield panel and add your domain.",
      "At your DNS provider, create a CNAME record:",
      "  → Name: your domain (e.g. mc.example.com)",
      "  → Target: your Protected CNAME",
      "",
      "Note: DNS changes can take up to a few hours to propagate, but usually it's much faster.",
    ],
    hasExternalLink: true,
    externalLinkUrl: "https://panel.tcpshield.com",
    externalLinkLabel: "Open TCPShield Panel",
  },
  {
    id: 5,
    title: "Configure Backend",
    description:
      "Enter your real server IP and port as the backend in the TCPShield panel. This is the IP you want to protect.",
    instructions: [
      "Go to 'Backends' in the TCPShield panel.",
      "Click 'Add Backend'.",
      "Enter your real server IP and port.",
      "Save the settings.",
      "Also enter the same details below so Catalyst knows them.",
    ],
    hasInput: true,
    inputLabel: "Backend Server IP:Port",
    inputPlaceholder: "123.456.789.0",
    inputField: "backendAddress",
    hasExternalLink: true,
    externalLinkUrl: "https://panel.tcpshield.com",
    externalLinkLabel: "Open TCPShield Panel",
  },
  {
    id: 6,
    title: "Done!",
    description:
      "Your server is now protected by TCPShield! Your real IP stays hidden.",
    instructions: [
      "Setup is complete!",
      "Players now connect via your domain or Protected CNAME.",
      "Your real server IP is protected by TCPShield.",
      "",
      "Tip: Test the connection by joining your server using the new address.",
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
