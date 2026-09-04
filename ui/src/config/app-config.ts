import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "Alpaca Agent",
  version: packageJson.version,
  copyright: `© ${currentYear}, Alpaca Agent.`,
  meta: {
    title: "Alpaca Agent — Autonomous Paper Trading",
    description:
      "An autonomous agent for Alpaca paper trading. TradingAgents finds direction, a second LLM structures the spread against the live chain, and deterministic gates veto unsafe trades. Paper only.",
  },
};
