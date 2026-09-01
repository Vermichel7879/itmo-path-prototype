"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { TrajectoryResult } from "@/lib/rule-engine/types";
import type { EducationLevel } from "@/lib/career/audience";

const STORAGE_PREFIX = "itmo-career-trajectory";

interface JourneyState {
  configVersionId: string | null;
  sessionId: string | null;
  educationLevel: EducationLevel | null;
  sessionStatus: "IN_PROGRESS" | "COMPLETED" | "UNAVAILABLE" | null;
  answers: Record<string, string[]>;
  currentQuestionId: string | null;
  entrepreneurshipRevealed: boolean;
  result: TrajectoryResult | null;
}

interface JourneyContextValue extends JourneyState {
  hydrated: boolean;
  initializeVersion: (configVersionId: string) => void;
  initializeSession: (session: { sessionId: string; configVersionId: string; educationLevel: EducationLevel; status: "IN_PROGRESS" | "COMPLETED" | "UNAVAILABLE" }) => void;
  setQuestionAnswers: (questionId: string, answerIds: string[]) => void;
  setCurrentQuestionId: (questionId: string) => void;
  setEntrepreneurshipRevealed: (revealed: boolean) => void;
  setTrajectoryResult: (result: TrajectoryResult | null) => void;
  markSessionCompleted: () => void;
  resetJourney: () => void;
}

const initialState: JourneyState = { configVersionId: null, sessionId: null, educationLevel: null, sessionStatus: null, answers: {}, currentQuestionId: null, entrepreneurshipRevealed: false, result: null };
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
  const initializeSession = useCallback((session: { sessionId: string; configVersionId: string; educationLevel: EducationLevel; status: "IN_PROGRESS" | "COMPLETED" | "UNAVAILABLE" }) => {
    setState({ ...initialState, ...session, sessionStatus: session.status });
  }, []);
  const setCurrentQuestionId = useCallback((currentQuestionId: string) => setState((current) => ({ ...current, currentQuestionId })), []);
  const setEntrepreneurshipRevealed = useCallback((entrepreneurshipRevealed: boolean) => setState((current) => ({ ...current, entrepreneurshipRevealed })), []);
  const setTrajectoryResult = useCallback((result: TrajectoryResult | null) => setState((current) => ({ ...current, result })), []);
  const markSessionCompleted = useCallback(() => setState((current) => ({ ...current, sessionStatus: "COMPLETED" })), []);
  const resetJourney = useCallback(() => setState((current) => {
    if (current.configVersionId) window.sessionStorage.removeItem(storageKey(current.configVersionId));
    return initialState;
  }), []);

  const value = useMemo(() => ({ ...state, hydrated, initializeVersion, initializeSession, setQuestionAnswers, setCurrentQuestionId, setEntrepreneurshipRevealed, setTrajectoryResult, markSessionCompleted, resetJourney }), [state, hydrated, initializeVersion, initializeSession, setQuestionAnswers, setCurrentQuestionId, setEntrepreneurshipRevealed, setTrajectoryResult, markSessionCompleted, resetJourney]);
  return <JourneyContext.Provider value={value}>{children}</JourneyContext.Provider>;
}

export function useCareerJourney() {
  const context = useContext(JourneyContext);
  if (!context) throw new Error("useCareerJourney must be used within CareerJourneyProvider");
  return context;
}
