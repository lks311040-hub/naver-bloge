import { useEffect, useState } from "react";

export interface ProgressLogEntry {
  runId: string;
  message: string;
  level: "info" | "warn" | "error" | "done";
  timestamp: string;
}

/** Subscribes to /api/events/:runId while runId is set; resets the log on change. */
export function useEventSource(runId: string | null): ProgressLogEntry[] {
  const [logs, setLogs] = useState<ProgressLogEntry[]>([]);

  useEffect(() => {
    setLogs([]);
    if (!runId) return;

    const es = new EventSource(`/api/events/${runId}`);
    es.onmessage = (e) => {
      const entry = JSON.parse(e.data) as ProgressLogEntry;
      setLogs((prev) => [...prev, entry]);
    };
    return () => es.close();
  }, [runId]);

  return logs;
}
