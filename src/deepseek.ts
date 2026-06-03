import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __srcDir = __filename.substring(0, __filename.lastIndexOf("/"));
const __dir = join(__srcDir, "..");

const BASE_URL = "https://chat.deepseek.com";
const APM_TOKEN = "772f2fcc08224a50b0134f8d3c139a21";
const SESSION_FILE = join(__dir, ".deepseek-session.json");
const SOLVER_SCRIPT = join(__dir, "solve_pow.py");

// ── PoW Solver ───────────────────────────────────────────────────────

class PoWSolver {
  private available: boolean;

  constructor() {
    this.available = existsSync(SOLVER_SCRIPT);
    if (!this.available) {
      console.warn("  [WARN] solve_pow.py not found. Place it next to package.json.");
    }
  }

  solve(challengeHex: string, prefix: string, difficulty: number): number {
    if (!this.available) throw new Error("PoW solver not available");
    const result = execFileSync("python3", [SOLVER_SCRIPT, challengeHex, prefix, String(difficulty)], {
      timeout: 60000,
      encoding: "utf-8",
    });
    return parseInt(result.trim(), 10);
  }
}

// ── DeepSeek Client ──────────────────────────────────────────────────

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  model?: string;
}

export class DeepSeekClient {
  private token: string | null = null;
  private userId: string | null = null;
  private sessionId: string | null = null;
  private powsolver: PoWSolver;
  private email: string;
  private password: string;

  constructor(email: string, password: string) {
    this.email = email;
    this.password = password;
    this.powsolver = new PoWSolver();
    this.loadSession();
  }

  private loadSession(): void {
    try {
      if (existsSync(SESSION_FILE)) {
        const data = JSON.parse(readFileSync(SESSION_FILE, "utf-8"));
        this.token = data.token;
        this.userId = data.userId;
        this.sessionId = data.sessionId;
      }
    } catch {}
  }

  private saveSession(): void {
    writeFileSync(SESSION_FILE, JSON.stringify({
      token: this.token, userId: this.userId, sessionId: this.sessionId,
    }));
  }

  async login(): Promise<boolean> {
    const res = await fetch(`${BASE_URL}/api/v0/users/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-auth-token": APM_TOKEN,
        "User-Agent": "DeepSeek/2.1.1 (Android 14; Build/AP3A.240905.015)",
        "x-client-platform": "android",
        "x-client-version": "2.1.1",
      },
      body: JSON.stringify({
        email: this.email, password: this.password,
        device_id: randomBytes(16).toString("hex"), os: "android",
      }),
    });
    const data: any = await res.json();
    if (data.code !== 0) throw new Error(`Login failed: ${JSON.stringify(data)}`);
    const user = data.data?.biz_data?.user || data.data?.user || data.data;
    if (!user?.token) throw new Error("Invalid login response");
    this.token = user.token;
    this.userId = user.id;
    this.saveSession();
    return true;
  }

  async createSession(): Promise<string> {
    const res = await fetch(`${BASE_URL}/api/v0/chat_session/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
        "x-auth-token": APM_TOKEN,
      },
      body: JSON.stringify({}),
    });
    const data: any = await res.json();
    if (data.code !== 0) throw new Error(`Session creation failed: ${JSON.stringify(data)}`);
    const bizData = data.data?.biz_data || data.data;
    if (!bizData?.id) throw new Error("Invalid session response");
    this.sessionId = bizData.id;
    this.saveSession();
    return this.sessionId!;
  }

  async solvePow(targetPath: string): Promise<string> {
    const res = await fetch(`${BASE_URL}/api/v0/chat/create_pow_challenge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
        "x-auth-token": APM_TOKEN,
      },
      body: JSON.stringify({ target_path: targetPath }),
    });
    const data: any = await res.json();
    if (data.code !== 0) throw new Error(`PoW challenge failed: ${JSON.stringify(data)}`);
    const bizData = data.data?.biz_data || data.data;
    const chal = bizData?.challenge || bizData;
    if (!chal?.challenge || !chal?.salt) throw new Error("PoW challenge missing fields");
    const prefix = `${chal.salt}_${chal.expire_at}_`;
    const answer = this.powsolver.solve(chal.challenge, prefix, chal.difficulty);
    const powData = {
      algorithm: "DeepSeekHashV1", challenge: chal.challenge,
      salt: chal.salt, answer, signature: chal.signature, target_path: chal.target_path,
    };
    return Buffer.from(JSON.stringify(powData)).toString("base64");
  }

  async *chatStream(messages: Message[], options: ChatOptions = {}): AsyncGenerator<string> {
    const { model = "deepseek-v3" } = options;
    if (!this.token) await this.login();
    if (!this.sessionId) await this.createSession();
    const prompt = messages.findLast((m) => m.role === "user")?.content || "";
    const powHeader = await this.solvePow("/api/v0/chat/completion");
    const res = await fetch(`${BASE_URL}/api/v0/chat/completion`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
        "x-auth-token": APM_TOKEN,
        "x-ds-pow-response": powHeader,
      },
      body: JSON.stringify({
        messages, chat_session_id: this.sessionId,
        stream: true, model, prompt, ref_file_ids: [],
      }),
    });
    if (res.status === 401) {
      await this.login();
      yield* this.chatStream(messages, options);
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6);
          if (!raw.startsWith("{")) continue;
          if (raw.includes('"v":"[DONE]"')) return;
          try {
            const d = JSON.parse(raw);
            if (typeof d.v === "string" && d.o === "APPEND") yield d.v;
          } catch {}
        }
      }
    }
  }
}

export function createClient(email?: string, password?: string): DeepSeekClient {
  const e = email || process.env.DEEPSEEK_EMAIL;
  const p = password || process.env.DEEPSEEK_PASSWORD;
  if (!e || !p) throw new Error("DeepSeek credentials required. Set DEEPSEEK_EMAIL and DEEPSEEK_PASSWORD env vars.");
  return new DeepSeekClient(e, p);
}
