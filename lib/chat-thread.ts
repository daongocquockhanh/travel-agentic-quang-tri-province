"use client";

import type { Message } from "@ai-sdk/react";

/**
 * Keeps the last chat thread in localStorage so it survives a reload and is
 * readable offline (SYSTEM_DESIGN §8.1). One thread per context: a site, or
 * the general chat.
 */
const KEY = "qt.chat.last";
const MAX_MESSAGES = 30;

interface Saved {
  context: string;
  savedAt: number;
  messages: Message[];
}

export function loadThread(context: string): Message[] | null {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as Saved | null;
    if (!saved || saved.context !== context || !Array.isArray(saved.messages)) return null;
    return saved.messages.map((m) => ({ ...m, createdAt: m.createdAt ? new Date(m.createdAt) : undefined }));
  } catch {
    return null;
  }
}

export function saveThread(context: string, messages: Message[]): void {
  try {
    const value: Saved = { context, savedAt: Date.now(), messages: messages.slice(-MAX_MESSAGES) };
    window.localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* quota or private mode: the thread just isn't kept */
  }
}

export function clearThread(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
