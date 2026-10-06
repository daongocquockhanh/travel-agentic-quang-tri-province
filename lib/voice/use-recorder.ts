"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_AUDIO_BYTES, MAX_RECORDING_MS, MIN_RECORDING_MS } from "@/lib/voice/config";

export type RecorderError = "unsupported" | "denied" | "too_short" | "too_large" | "failed";

/** First container the browser can record that Whisper also accepts. */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

/**
 * Push-to-talk recorder. `start()` on press, `stop()` on release. Recording
 * auto-stops at 30 s. Releasing before the mic is live (e.g. while the
 * permission prompt is open) counts as a too-short press rather than a
 * stuck recording.
 */
export function useRecorder(opts: {
  onAudio: (audio: Blob, durationMs: number) => void;
  onError: (code: RecorderError) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const startedAt = useRef(0);
  const releasedEarly = useRef(false);
  const starting = useRef(false);
  const cancelled = useRef(false);
  const timers = useRef<{ tick?: number; cap?: number }>({});
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const clearTimers = () => {
    window.clearInterval(timers.current.tick);
    window.clearTimeout(timers.current.cap);
    timers.current = {};
  };

  const stop = useCallback((cancel = false) => {
    cancelled.current = cancel;
    if (starting.current) {
      releasedEarly.current = true;
      return;
    }
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const start = useCallback(async () => {
    if (recRef.current || starting.current) return;
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      optsRef.current.onError("unsupported");
      return;
    }
    starting.current = true;
    releasedEarly.current = false;
    cancelled.current = false;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
    } catch (err) {
      starting.current = false;
      const name = err instanceof DOMException ? err.name : "";
      optsRef.current.onError(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "failed");
      return;
    }
    starting.current = false;

    if (releasedEarly.current) {
      stream.getTracks().forEach((t) => t.stop());
      if (!cancelled.current) optsRef.current.onError("too_short");
      return;
    }

    const mimeType = pickMimeType();
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : undefined);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      optsRef.current.onError("failed");
      return;
    }
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onstop = () => {
      clearTimers();
      stream.getTracks().forEach((t) => t.stop());
      recRef.current = null;
      setRecording(false);
      const duration = Date.now() - startedAt.current;
      if (cancelled.current) return;
      const blob = new Blob(chunks, { type: rec.mimeType || mimeType || "audio/webm" });
      if (duration < MIN_RECORDING_MS || blob.size === 0) return optsRef.current.onError("too_short");
      if (blob.size > MAX_AUDIO_BYTES) return optsRef.current.onError("too_large");
      optsRef.current.onAudio(blob, duration);
    };

    recRef.current = rec;
    startedAt.current = Date.now();
    setElapsedMs(0);
    setRecording(true);
    rec.start(250);
    timers.current.tick = window.setInterval(() => setElapsedMs(Date.now() - startedAt.current), 200);
    timers.current.cap = window.setTimeout(() => stop(), MAX_RECORDING_MS);
  }, [stop]);

  // Release the mic if the component unmounts mid-recording.
  useEffect(
    () => () => {
      cancelled.current = true;
      clearTimers();
      const rec = recRef.current;
      if (rec && rec.state !== "inactive") rec.stop();
    },
    [],
  );

  return { recording, elapsedMs, start, stop };
}
