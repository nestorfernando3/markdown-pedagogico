import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PedagogicalWarning } from '../../utils/markdownParser';

function addToSet(previous: Set<string>, value: string): Set<string> {
  const next = new Set(previous);
  next.add(value);
  return next;
}

export interface UseWarningSessionResult {
  ignoredWarningIds: Set<string>;
  visibleWarnings: PedagogicalWarning[];
  peakWarningCount: number;
  newWarningIds: Set<string>;
  ignoreWarning: (warningId: string) => void;
}

export function useWarningSession(warnings: PedagogicalWarning[]): UseWarningSessionResult {
  const [ignoredWarningIds, setIgnoredWarningIds] = useState<Set<string>>(new Set());
  const [peakWarningCount, setPeakWarningCount] = useState(0);
  const [newWarningIds, setNewWarningIds] = useState<Set<string>>(new Set());
  const previousWarningIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const warningIds = new Set(warnings.map((warning) => warning.id));

    setIgnoredWarningIds((previous) => {
      let changed = false;
      const next = new Set<string>();

      for (const id of previous) {
        if (warningIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }

      return changed ? next : previous;
    });
  }, [warnings]);

  const visibleWarnings = useMemo(
    () => warnings.filter((warning) => !ignoredWarningIds.has(warning.id)),
    [ignoredWarningIds, warnings]
  );

  useEffect(() => {
    const currentIds = new Set(visibleWarnings.map((warning) => warning.id));
    const additions = new Set<string>();

    for (const id of currentIds) {
      if (!previousWarningIdsRef.current.has(id)) {
        additions.add(id);
      }
    }

    setNewWarningIds(additions);
    previousWarningIdsRef.current = currentIds;
    setPeakWarningCount((previous) => Math.max(previous, currentIds.size));
  }, [visibleWarnings]);

  const ignoreWarning = useCallback((warningId: string) => {
    setIgnoredWarningIds((previous) => addToSet(previous, warningId));
  }, []);

  return {
    ignoredWarningIds,
    visibleWarnings,
    peakWarningCount,
    newWarningIds,
    ignoreWarning,
  };
}
