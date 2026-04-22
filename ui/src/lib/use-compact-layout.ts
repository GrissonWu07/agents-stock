import { useEffect, useState } from "react";

const COMPACT_QUERY = "(max-width: 1200px)";

const getMatches = () => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(COMPACT_QUERY).matches;
};

export function useCompactLayout() {
  const [isCompact, setIsCompact] = useState<boolean>(getMatches);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }
    const media = window.matchMedia(COMPACT_QUERY);
    const handler = (event: MediaQueryListEvent) => {
      setIsCompact(event.matches);
    };
    setIsCompact(media.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  return isCompact;
}

