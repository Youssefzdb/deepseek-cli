/**
 * DeepSeek Claude Code UI - Entry Point
 * ======================================
 * Initialize client and render the app
 */

import React from "react";
import { render } from "@claude-code-kit/ink-renderer";
import { App } from "./components/App.js";
import { DeepSeekClient } from "./deepseek.js";
import { createInterface } from "node:readline";

// ── Helper: ask user input ─────────────────────────────────────────────

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  // Check env vars first, otherwise prompt
  let email = process.env.DEEPSEEK_EMAIL;
  let password = process.env.DEEPSEEK_PASSWORD;

  if (!email) {
    email = await ask("📧 DeepSeek Email: ");
  }
  if (!password) {
    password = await ask("🔑 DeepSeek Password: ");
  }

  if (!email || !password) {
    console.error("❌ Email and password are required.");
    process.exit(1);
  }

  console.log("⏳ Connecting to DeepSeek...");

  // Create DeepSeek client
  const client = new DeepSeekClient(email, password);

  // Render the app
  const instance = await render(<App client={client} />);

  // Handle cleanup
  process.on("SIGINT", () => {
    instance.unmount();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    instance.unmount();
    process.exit(0);
  });

  await instance.waitUntilExit();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
