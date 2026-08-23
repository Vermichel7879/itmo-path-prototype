"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AnswerId, CareerAnswers, QuestionId } from "@/types/career";

const STORAGE_KEY = "itmo-career-trajectory-v1";

interface JourneyState {
  answers: CareerAnswers;
  currentQuestionId: QuestionId;
  entrepreneurshipRevealed: boolean;
}

interface JourneyContextValue extends JourneyState {
  hydrated: boolean;
  setQuestionAnswers: (questionId: QuestionId, answerIds: AnswerId[]) => void;
  setCurrentQuestionId: (questionId: QuestionId) => void;
  setEntrepreneurshipRevealed: (revealed: boolean) => void;
  clearEntrepreneurshipAnswers: () => void;
  resetJourney: () => void;
}

const initialState: JourneyState = {
  answers: {},
  currentQuestionId: "Q1",
  entrepreneurshipRevealed: false,
};

const JourneyContext = createContext<JourneyContextValue | null>(null);

export function CareerJourneyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<JourneyState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      try {
        const saved = window.sessionStorage.getItem(STORAGE_KEY);
        if (saved) setState({ ...initialState, ...(JSON.parse(saved) as JourneyState) });
      } catch {
        window.sessionStorage.removeItem(STORAGE_KEY);
      } finally {
        setHydrated(true);
      }
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    if (hydrated) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const setQuestionAnswers = useCallback((questionId: QuestionId, answerIds: AnswerId[]) => {
    setState((current) => ({
      ...current,
      answers: { ...current.answers, [questionId]: answerIds },
    }));
  }, []);

  const setCurrentQuestionId = useCallback((currentQuestionId: QuestionId) => {
    setState((current) => ({ ...current, currentQuestionId }));
  }, []);

  const setEntrepreneurshipRevealed = useCallback((entrepreneurshipRevealed: boolean) => {
    setState((current) => ({ ...current, entrepreneurshipRevealed }));
  }, []);

  const clearEntrepreneurshipAnswers = useCallback(() => {
    setState((current) => {
      const answers = { ...current.answers };
      delete answers.Q9;
      delete answers.Q10;
      return { ...current, answers, entrepreneurshipRevealed: false };
    });
  }, []);

  const resetJourney = useCallback(() => {
    setState(initialState);
    window.sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      hydrated,
      setQuestionAnswers,
      setCurrentQuestionId,
      setEntrepreneurshipRevealed,
      clearEntrepreneurshipAnswers,
      resetJourney,
    }),
    [
      state,
      hydrated,
      setQuestionAnswers,
      setCurrentQuestionId,
      setEntrepreneurshipRevealed,
      clearEntrepreneurshipAnswers,
      resetJourney,
    ],
  );

  return <JourneyContext.Provider value={value}>{children}</JourneyContext.Provider>;
}

export function useCareerJourney() {
  const context = useContext(JourneyContext);
  if (!context) throw new Error("useCareerJourney must be used within CareerJourneyProvider");
  return context;
}
