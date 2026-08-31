"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCareerJourney } from "@/components/journey/career-journey-provider";
import { LandingPage } from "@/components/landing/landing-page";
import { SiteHeader } from "@/components/ui/site-header";
import { Toast } from "@/components/ui/toast";
import type { PublicQuestionnaireDTO } from "@/lib/public-config/questionnaire";
import { canContinue, toggleQuestionAnswer } from "@/lib/questionnaire/answers";
import type { EducationLevel } from "@/lib/career/audience";
import {
  publicEntryPath,
  trajectorySessionStartPayload,
  unavailableQuestionnaireMessage,
} from "@/lib/public-flow/entry";
import type { TrajectoryResult } from "@/lib/rule-engine/types";
import { AnswerCards } from "./answer-cards";
import { QuestionnaireProgress } from "./questionnaire-progress";

export function QuestionnaireClient({
  initialConfigVersionId,
  educationLevel,
}: {
  initialConfigVersionId: string | null;
  educationLevel: EducationLevel;
}) {
  const router = useRouter();
  const journey = useCareerJourney();
  const { initializeVersion, currentQuestionId, setCurrentQuestionId } = journey;
  const [questionnaire, setQuestionnaire] = useState<PublicQuestionnaireDTO | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showEntrepreneurToast, setShowEntrepreneurToast] = useState(false);
  const [startError, setStartError] = useState(false);
  const [starting, setStarting] = useState(false);
  const startRequestInFlight = useRef(false);
  const [saving, setSaving] = useState(false);
  const entryPath = publicEntryPath(educationLevel);

  useEffect(() => {
    if (journey.hydrated && initialConfigVersionId && !journey.configVersionId) {
      initializeVersion(initialConfigVersionId);
    }
  }, [initialConfigVersionId, initializeVersion, journey.configVersionId, journey.hydrated]);

  useEffect(() => {
    if (
      journey.hydrated &&
      journey.educationLevel &&
      journey.educationLevel !== educationLevel
    ) {
      journey.resetJourney();
    }
  }, [educationLevel, journey]);

  useEffect(() => {
    if (!journey.sessionId || journey.sessionStatus !== "IN_PROGRESS") return;
    const controller = new AbortController();
    const query = initialConfigVersionId ? `?configVersionId=${encodeURIComponent(initialConfigVersionId)}` : "";
    const separator = query ? "&" : "?";
    fetch(`/api/questionnaire${query}${separator}sessionId=${encodeURIComponent(journey.sessionId)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("QUESTIONNAIRE_UNAVAILABLE");
        return (await response.json()) as PublicQuestionnaireDTO;
      })
      .then((dto) => {
        initializeVersion(dto.configVersionId);
        setQuestionnaire(dto);
        if (!initialConfigVersionId) router.replace(`${entryPath}?configVersionId=${encodeURIComponent(dto.configVersionId)}`);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setLoadError(true);
      });
    return () => controller.abort();
  }, [entryPath, initialConfigVersionId, initializeVersion, journey.sessionId, journey.sessionStatus, router]);

  async function startJourney(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (startRequestInFlight.current) return;
    startRequestInFlight.current = true;
    setStarting(true);
    setStartError(false);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/trajectory-sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(trajectorySessionStartPayload(form.get("isu"), educationLevel)),
      });
      if (!response.ok) throw new Error("SESSION_START_UNAVAILABLE");
      journey.initializeSession(await response.json());
    } catch {
      setStartError(true);
    } finally {
      startRequestInFlight.current = false;
      setStarting(false);
    }
  }

  const entrepreneurSignal = useMemo(() => {
    if (!questionnaire) return false;
    const selectedIds = new Set(Object.values(journey.answers).flat());
    return questionnaire.questions.some((question) => question.answers.some((answer) => answer.entrepreneurSignal && selectedIds.has(answer.id)));
  }, [journey.answers, questionnaire]);
  const entrepreneurshipEnabled = journey.entrepreneurshipRevealed && entrepreneurSignal;
  const sequence = useMemo(() => questionnaire?.questions.filter((question) => !question.entrepreneurshipOnly || entrepreneurshipEnabled) ?? [], [entrepreneurshipEnabled, questionnaire]);
  const currentIndex = Math.max(0, sequence.findIndex((question) => question.id === currentQuestionId));
  const question = sequence[currentIndex];
  const selected = question ? journey.answers[question.id] ?? [] : [];
  const allowContinue = question ? canContinue(question, selected) : false;

  useEffect(() => {
    if (sequence.length && !sequence.some((item) => item.id === currentQuestionId)) setCurrentQuestionId("Q1");
  }, [currentQuestionId, setCurrentQuestionId, sequence]);

  const dismissToast = useCallback(() => setShowEntrepreneurToast(false), []);

  async function submitTrajectory() {
    if (!questionnaire || submitting) return;
    setSubmitting(true);
    setSubmitError(false);
    try {
      const response = await fetch("/api/trajectory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: journey.sessionId, configVersionId: questionnaire.configVersionId, selectedAnswerIds: Object.values(journey.answers).flat() }),
      });
      if (!response.ok) throw new Error("TRAJECTORY_UNAVAILABLE");
      journey.setTrajectoryResult((await response.json()) as TrajectoryResult);
      journey.markSessionCompleted();
      router.push(`/result?configVersionId=${encodeURIComponent(questionnaire.configVersionId)}`);
    } catch {
      setSubmitError(true);
      setSubmitting(false);
    }
  }

  async function handleContinue() {
    if (!question || !allowContinue) return;
    if (!journey.sessionId) return;
    setSaving(true);
    setSubmitError(false);
    try {
      const saveResponse = await fetch("/api/trajectory-sessions/answers", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: journey.sessionId, questionId: question.id, answerOptionIds: selected }),
      });
      if (!saveResponse.ok) throw new Error("ANSWER_SAVE_UNAVAILABLE");
    } catch {
      setSubmitError(true);
      setSaving(false);
      return;
    }
    if (question.id === "Q5") {
      if (entrepreneurSignal && !journey.entrepreneurshipRevealed) {
        journey.setEntrepreneurshipRevealed(true);
        setShowEntrepreneurToast(true);
      } else if (!entrepreneurSignal) journey.setEntrepreneurshipRevealed(false);
      journey.setCurrentQuestionId("Q6");
      setSaving(false);
      return;
    }
    const nextQuestion = sequence[currentIndex + 1];
    if (nextQuestion) {
      journey.setCurrentQuestionId(nextQuestion.id);
      setSaving(false);
    } else await submitTrajectory();
  }

  if (journey.hydrated && !journey.sessionId) return <LandingPage onStart={startJourney} starting={starting} startError={startError} />;
  if (journey.hydrated && journey.sessionStatus === "UNAVAILABLE") return <div className="public-shell questionnaire-page"><SiteHeader /><main className="questionnaire-main page-enter"><section className="question-sheet"><div className="question-sheet__content"><h1>{unavailableQuestionnaireMessage(educationLevel)}</h1><button type="button" className="button-secondary" onClick={journey.resetJourney}>Попробовать снова</button></div></section></main></div>;
  if (journey.hydrated && journey.sessionStatus === "COMPLETED") return <div className="public-shell questionnaire-page"><SiteHeader /><main className="questionnaire-main page-enter"><section className="question-sheet"><div className="question-sheet__content"><h1>Это прохождение уже завершено.</h1><button type="button" className="button-primary" onClick={journey.resetJourney}>Начать новое прохождение</button></div></section></main></div>;

  if (loadError) return <main className="public-shell route-status"><p>Карьерная траектория временно недоступна.</p></main>;
  if (!journey.hydrated || !questionnaire || journey.configVersionId !== questionnaire.configVersionId || !question) return <main className="public-shell route-status"><p>Открываем анкету…</p></main>;

  const buttonLabel = submitting ? "Собираем результат…" : !question.required && selected.length === 0 ? "Пропустить →" : "Продолжить →";
  return (
    <div className="public-shell questionnaire-page">
      <SiteHeader />
      <main className="questionnaire-main page-enter">
        <header className="questionnaire-heading">
          <p className="questionnaire-heading__block">{question.block}</p>
          <p className="questionnaire-heading__count">
            <span>{String(currentIndex + 1).padStart(2, "0")}</span>
            <span aria-hidden="true">/</span>
            <span>{String(sequence.length).padStart(2, "0")}</span>
          </p>
        </header>
        <QuestionnaireProgress current={currentIndex + 1} total={sequence.length} />
        <section className="question-sheet">
          <div className="question-sheet__content">
            {question.entrepreneurshipOnly ? <p className="question-sheet__branch">Предпринимательская ветка</p> : null}
            <h1>{question.title}</h1>
            <p id={`${question.id}-instruction`} className="question-sheet__instruction">{question.instruction}</p>
            <AnswerCards question={question} selected={selected} onToggle={(answerId) => journey.setQuestionAnswers(question.id, toggleQuestionAnswer(question, selected, answerId))} />
            {submitError ? <p className="question-sheet__error" role="alert">Не удалось собрать результат. Попробуйте ещё раз.</p> : null}
          </div>
        </section>
      </main>
      <nav className="question-nav" aria-label="Навигация по анкете">
        <div className="question-nav__inner">
          <button type="button" onClick={() => currentIndex === 0 ? router.push(entryPath) : journey.setCurrentQuestionId(sequence[currentIndex - 1].id)} className="button-secondary"><span aria-hidden="true">←</span> Назад</button>
          <p className="question-nav__hint">Ответ сохраняется автоматически</p>
          <button type="button" onClick={() => void handleContinue()} disabled={!allowContinue || submitting || saving} className="button-primary">{saving ? "Сохраняем…" : buttonLabel}</button>
        </div>
      </nav>
      {showEntrepreneurToast ? <Toast title="Добавили предпринимательский блок" message="Ты отметил(а) интерес к собственному проекту — в конце будет ещё два коротких вопроса." onDismiss={dismissToast} /> : null}
    </div>
  );
}
