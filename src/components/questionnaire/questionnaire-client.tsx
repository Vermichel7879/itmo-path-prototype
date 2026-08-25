"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCareerJourney } from "@/components/journey/career-journey-provider";
import { SiteHeader } from "@/components/ui/site-header";
import { Toast } from "@/components/ui/toast";
import type { PublicQuestionnaireDTO } from "@/lib/public-config/questionnaire";
import { canContinue, toggleQuestionAnswer } from "@/lib/questionnaire/answers";
import type { TrajectoryResult } from "@/lib/rule-engine/types";
import { AnswerCards } from "./answer-cards";
import { QuestionnaireProgress } from "./questionnaire-progress";

export function QuestionnaireClient({ initialConfigVersionId }: { initialConfigVersionId: string | null }) {
  const router = useRouter();
  const journey = useCareerJourney();
  const { initializeVersion, currentQuestionId, setCurrentQuestionId } = journey;
  const [questionnaire, setQuestionnaire] = useState<PublicQuestionnaireDTO | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showEntrepreneurToast, setShowEntrepreneurToast] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const query = initialConfigVersionId ? `?configVersionId=${encodeURIComponent(initialConfigVersionId)}` : "";
    fetch(`/api/questionnaire${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("QUESTIONNAIRE_UNAVAILABLE");
        return (await response.json()) as PublicQuestionnaireDTO;
      })
      .then((dto) => {
        initializeVersion(dto.configVersionId);
        setQuestionnaire(dto);
        if (!initialConfigVersionId) router.replace(`/questionnaire?configVersionId=${encodeURIComponent(dto.configVersionId)}`);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setLoadError(true);
      });
    return () => controller.abort();
  }, [initialConfigVersionId, initializeVersion, router]);

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
        body: JSON.stringify({ configVersionId: questionnaire.configVersionId, selectedAnswerIds: Object.values(journey.answers).flat() }),
      });
      if (!response.ok) throw new Error("TRAJECTORY_UNAVAILABLE");
      journey.setTrajectoryResult((await response.json()) as TrajectoryResult);
      router.push(`/result?configVersionId=${encodeURIComponent(questionnaire.configVersionId)}`);
    } catch {
      setSubmitError(true);
      setSubmitting(false);
    }
  }

  function handleContinue() {
    if (!question || !allowContinue) return;
    if (question.id === "Q5") {
      if (entrepreneurSignal && !journey.entrepreneurshipRevealed) {
        journey.setEntrepreneurshipRevealed(true);
        setShowEntrepreneurToast(true);
      } else if (!entrepreneurSignal) journey.setEntrepreneurshipRevealed(false);
      journey.setCurrentQuestionId("Q6");
      return;
    }
    const nextQuestion = sequence[currentIndex + 1];
    if (nextQuestion) journey.setCurrentQuestionId(nextQuestion.id);
    else void submitTrajectory();
  }

  if (loadError) return <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-5 text-center"><p className="text-zinc-700">Карьерная траектория временно недоступна.</p></main>;
  if (!journey.hydrated || !questionnaire || journey.configVersionId !== questionnaire.configVersionId || !question) return <main className="flex min-h-screen items-center justify-center bg-zinc-50"><p className="text-sm text-zinc-500">Открываем анкету…</p></main>;

  const buttonLabel = submitting ? "Собираем результат…" : !question.required && selected.length === 0 ? "Пропустить →" : "Продолжить →";
  return (
    <div className="min-h-screen bg-zinc-50">
      <SiteHeader />
      <main className="page-enter mx-auto w-full max-w-[980px] px-5 pb-32 pt-8 sm:px-8 sm:pt-12 md:pb-16">
        <div className="mb-8 flex items-center justify-between gap-4 text-sm"><p className="font-semibold text-zinc-800">{question.block}</p><p className="shrink-0 font-medium text-zinc-500">Вопрос {currentIndex + 1} из {sequence.length}</p></div>
        <QuestionnaireProgress current={currentIndex + 1} total={sequence.length} entrepreneurshipRevealed={entrepreneurshipEnabled} />
        <section className="mt-10 rounded-[14px] border border-zinc-200 bg-white p-5 shadow-[0_14px_50px_rgba(24,24,27,0.05)] sm:p-9 md:p-11">
          {question.entrepreneurshipOnly ? <p className="mb-4 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Предпринимательство</p> : null}
          <h1 className="max-w-3xl text-[1.8rem] font-semibold leading-[1.12] tracking-[-0.035em] text-zinc-950 sm:text-[2.35rem]">{question.title}</h1>
          <p id={`${question.id}-instruction`} className="mb-8 mt-4 text-base leading-6 text-zinc-600">{question.instruction}</p>
          <AnswerCards question={question} selected={selected} onToggle={(answerId) => journey.setQuestionAnswers(question.id, toggleQuestionAnswer(question, selected, answerId))} />
          {submitError ? <p className="mt-5 text-sm font-medium text-red-700">Не удалось собрать результат. Попробуйте ещё раз.</p> : null}
        </section>
      </main>
      <nav className="question-nav" aria-label="Навигация по анкете"><div className="mx-auto flex w-full max-w-[980px] items-center justify-between gap-3 px-5 py-3 sm:px-8"><button type="button" onClick={() => currentIndex === 0 ? router.push("/") : journey.setCurrentQuestionId(sequence[currentIndex - 1].id)} className="button-secondary"><span aria-hidden="true">←</span> Назад</button><button type="button" onClick={handleContinue} disabled={!allowContinue || submitting} className="button-primary">{buttonLabel}</button></div></nav>
      {showEntrepreneurToast ? <Toast title="Добавили предпринимательский блок" message="Ты отметил(а) интерес к собственному проекту — в конце будет ещё два коротких вопроса." onDismiss={dismissToast} /> : null}
    </div>
  );
}
