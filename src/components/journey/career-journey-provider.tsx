"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { TrajectoryResult } from "@/lib/rule-engine/types";

const STORAGE_PREFIX = "itmo-career-trajectory";

interface JourneyState {
  configVersionId: string | null;
  answers: Record<string, string[]>;
  currentQuestionId: string;
  entrepreneurshipRevealed: boolean;
  result: TrajectoryResult | null;
}

interface JourneyContextValue extends JourneyState {
  hydrated: boolean;
  initializeVersion: (configVersionId: string) => void;
  setQuestionAnswers: (questionId: string, answerIds: string[]) => void;
  setCurrentQuestionId: (questionId: string) => void;
  setEntrepreneurshipRevealed: (revealed: boolean) => void;
  setTrajectoryResult: (result: TrajectoryResult | null) => void;
  resetJourney: () => void;
}

const initialState: JourneyState = { configVersionId: null, answers: {}, currentQuestionId: "Q1", entrepreneurshipRevealed: false, result: null };
const storageKey = (configVersionId: string) => `${STORAGE_PREFIX}:${configVersionId}`;
const JourneyContext = createContext<JourneyContextValue | null>(null);

export function CareerJourneyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<JourneyState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (hydrated && state.configVersionId) window.sessionStorage.setItem(storageKey(state.configVersionId), JSON.stringify(state));
  }, [hydrated, state]);

  const initializeVersion = useCallback((configVersionId: string) => {
    setState((current) => {
      if (current.configVersionId === configVersionId) return current;
      try {
        const saved = window.sessionStorage.getItem(storageKey(configVersionId));
        if (saved) return { ...initialState, ...(JSON.parse(saved) as Partial<JourneyState>), configVersionId };
      } catch {
        window.sessionStorage.removeItem(storageKey(configVersionId));
      }
      return { ...initialState, configVersionId };
    });
  }, []);
  const setQuestionAnswers = useCallback((questionId: string, answerIds: string[]) => setState((current) => ({ ...current, result: null, answers: { ...current.answers, [questionId]: answerIds } })), []);
  const setCurrentQuestionId = useCallback((currentQuestionId: string) => setState((current) => ({ ...current, currentQuestionId })), []);
  const setEntrepreneurshipRevealed = useCallback((entrepreneurshipRevealed: boolean) => setState((current) => ({ ...current, entrepreneurshipRevealed })), []);
  const setTrajectoryResult = useCallback((result: TrajectoryResult | null) => setState((current) => ({ ...current, result })), []);
  const resetJourney = useCallback(() => setState((current) => {
    if (current.configVersionId) window.sessionStorage.removeItem(storageKey(current.configVersionId));
    return initialState;
  }), []);

  const value = useMemo(() => ({ ...state, hydrated, initializeVersion, setQuestionAnswers, setCurrentQuestionId, setEntrepreneurshipRevealed, setTrajectoryResult, resetJourney }), [state, hydrated, initializeVersion, setQuestionAnswers, setCurrentQuestionId, setEntrepreneurshipRevealed, setTrajectoryResult, resetJourney]);
  return <JourneyContext.Provider value={value}>{children}</JourneyContext.Provider>;
}

export function useCareerJourney() {
  const context = useContext(JourneyContext);
  if (!context) throw new Error("useCareerJourney must be used within CareerJourneyProvider");
  return context;
}
