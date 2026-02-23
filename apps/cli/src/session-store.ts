import { randomUUID } from "node:crypto";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CliConfig, SessionGenerationRecord, SessionRecord, SessionSettings } from "./types";
import { ensureEikonDirs, getSessionsDir } from "./paths";

function sessionPath(sessionId: string): string {
  return path.join(getSessionsDir(), `${sessionId}.json`);
}

export function createSessionSettingsFromConfig(config: CliConfig): SessionSettings {
  return {
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    imageSize: config.defaultImageSize,
    aspectRatio: config.defaultAspectRatio,
    mode: config.defaultMode,
    referenceImages: [],
  };
}

export function createSession(title: string, settings: SessionSettings): SessionRecord {
  const now = Date.now();
  return {
    id: randomUUID().slice(0, 8),
    title,
    createdAt: now,
    updatedAt: now,
    settings,
    generations: [],
  };
}

export async function saveSession(session: SessionRecord): Promise<void> {
  await ensureEikonDirs();
  session.updatedAt = Date.now();
  await writeFile(sessionPath(session.id), `${JSON.stringify(session, null, 2)}\n`, "utf8");
}

export async function loadSession(sessionId: string): Promise<SessionRecord> {
  const filePath = sessionPath(sessionId);
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as SessionRecord;
}

export async function listSessions(): Promise<SessionRecord[]> {
  await ensureEikonDirs();
  const files = await readdir(getSessionsDir());
  const sessions: SessionRecord[] = [];

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await readFile(path.join(getSessionsDir(), file), "utf8");
      sessions.push(JSON.parse(raw) as SessionRecord);
    } catch {
      // Ignore corrupted session files.
    }
  }

  return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteSession(sessionId: string): Promise<void> {
  await rm(sessionPath(sessionId), { force: true });
}

export async function appendGenerationToSession(
  session: SessionRecord,
  generation: Omit<SessionGenerationRecord, "id" | "createdAt">
): Promise<SessionRecord> {
  const record: SessionGenerationRecord = {
    id: randomUUID().slice(0, 8),
    createdAt: Date.now(),
    ...generation,
  };

  session.generations.push(record);
  await saveSession(session);
  return session;
}
