"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { VideoCreatorSession, defaultVideoInput, unknownSubmission, validVideoInput, type VideoInput } from "../creator-session";

export function useVideoGeneration(ownerId: string) {
  const [session, setSession] = useState<VideoCreatorSession | null>(null);
  const [input, setInput] = useState<VideoInput>(defaultVideoInput);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [storageFailed, setStorageFailed] = useState(false);
  useEffect(() => {
    try {
      const restored = new VideoCreatorSession(ownerId, window.localStorage, () => crypto.randomUUID());
      setSession(restored);
      setInput(restored.snapshot?.input ?? defaultVideoInput);
    } catch {
      setError("Request storage is unavailable or damaged. Generation is disabled to avoid duplicate submissions. Existing jobs remain visible below.");
    }
  }, [ownerId]);
  const current = session?.ownerId === ownerId ? session : null;
  const requestKey = current?.snapshot?.key;
  const state = useQuery(api.videoGenerations.getVideoCreatorState, { ownerId, requestKey });
  const ownedState = state?.ownerId === ownerId ? state : null;
  const start = useMutation(api.videoGenerations.startCreatorVideo);
  const valid = !!ownedState && validVideoInput(input, ownedState.frames.map(frame => frame.id));
  const attempted = !!current?.snapshot?.attempted && JSON.stringify(current.snapshot.input) === JSON.stringify(input);
  const submit = () => {
    if (!current || !ownedState || storageFailed) return;
    const promise = current.submit(input, ownedState.frames.map(frame => frame.id), ownedState.credential?.health === "active", start);
    const submittedKey = current.snapshot?.key;
    setVersion(v => v + 1);
    void promise.then(message => {
      if (current.snapshot?.key === submittedKey) setError(message);
      setVersion(v => v + 1);
    }).catch(() => {
      setStorageFailed(true);
      setError("Unable to persist the request identity. Generation is disabled until request storage is available.");
    });
  };
  const updateInput = (next: VideoInput) => {
    if (!current || storageFailed) return;
    try {
      // Editing prepares a distinct identity, including an edit back to an older prompt.
      current.editInput(next);
      setInput(next);
      setError(null);
    } catch {
      setStorageFailed(true);
      setError("Unable to persist changed inputs. Generation is disabled to avoid duplicate submissions.");
    }
  };
  const hasSavedRequest = ownedState?.jobs.some(job => job.requestKey === requestKey);
  const visibleError = error === unknownSubmission && hasSavedRequest ? null : error;
  return { input, setInput: updateInput, canPrepareNew: !!current && valid && !storageFailed, state: ownedState, ready: !!current && !!ownedState && !storageFailed, error: visibleError, version,
    canGenerate: !!current && !storageFailed && valid && ownedState?.credential?.health === "active" && !attempted,
    submit, requestKey, waiting: !!current?.snapshot?.attempted && !hasSavedRequest && error !== unknownSubmission ? "Waiting for this request's saved status. No automatic resubmission." : null,
    newGeneration: () => {
      if (!current || !valid || storageFailed) return;
      try { current.newGeneration(input); setError(null); setVersion(v => v + 1); }
      catch { setError("Unable to persist a new request identity. No submission was made."); }
    },
  };
}
