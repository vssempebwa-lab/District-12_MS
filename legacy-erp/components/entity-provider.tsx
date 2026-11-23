"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Company } from "@/lib/data";import { useSystem } from "@/components/system-provider";

const STORAGE_KEY = "d12-entity";
const GROUP = "group";

interface EntityContextValue {
  entityId: string;
  entity: Company | null;
  setEntityId: (id: string) => void;
}

const EntityContext = createContext<EntityContextValue | null>(null);

export function EntityProvider({ children }: { children: ReactNode }) {
  const { companies } = useSystem();
  const [entityId, setEntityIdState] = useState(GROUP);

  useEffect(() => {
    let requested: string | null = null;
    try {
      requested = new URLSearchParams(window.location.search).get("entity");
    } catch {
      // no URL access — fall back to the stored selection
    }

    if (requested) {
      if (requested === GROUP || companies.some((c) => c.id === requested)) {
        setEntityId(requested);
      }
      return;
    }

    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && (saved === GROUP || companies.some((c) => c.id === saved))) {
        setEntityIdState(saved);
      }
    } catch {
      // storage unavailable — stay on the group view
    }
  }, [companies]);

  function setEntityId(id: string) {
    setEntityIdState(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore write failures
    }
  }

  const value = useMemo<EntityContextValue>(
    () => ({
      entityId,
      entity: companies.find((company) => company.id === entityId) ?? null,
      setEntityId,
    }),
    [entityId, companies]
  );

  return <EntityContext.Provider value={value}>{children}</EntityContext.Provider>;
}

export function useEntity() {
  const context = useContext(EntityContext);
  if (!context) {
    throw new Error("useEntity must be used inside EntityProvider");
  }
  return context;
}
