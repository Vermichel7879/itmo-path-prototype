"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/ui/site-header";
import { Toast } from "@/components/ui/toast";
import { mockCareerConfig } from "@/config/mock-career-config";
import { useCareerJourney } from "@/components/journey/career-journey-provider";
import { canContinue, toggleQuestionAnswer } from "@/lib/questionnaire/answers";
import { getQuestionSequence, hasEntrepreneurSignal } from "@/lib/mock-rule-engine";
import { AnswerCards } from "./answer-cards";
import { QuestionnaireProgress } from "./questionnaire-progress";

export function QuestionnaireClient() {
  const router = useRouter();
  const {
    answers,
    currentQuestionId,
    entrepreneurshipRevealed,
    hydrated,
    setQuestionAnswers,
    setCurrentQuestionId,
    setEntrepreneurshipRevealed,
    clearEntrepreneurshipAnswers,
  } = useCareerJourney();
  const [showEntrepreneurToast, setShowEntrepreneurToast] = useState(false);
  const entrepreneurSignal = hasEntrepreneurSignal(answers);
  const entrepreneurshipEnabled = entrepreneurshipRevealed && entrepreneurSignal;
  const sequence = useMemo(
    () => getQuestionSequence(entrepreneurshipEnabled),
    [entrepreneurshipEnabled],
  );
  const currentIndex = Math.max(
    0,
    sequence.findIndex((question) => question.id === currentQuestionId),
  );
  const question = sequence[currentIndex] ?? mockCareerConfig.questions[0];
  const selected = answers[question.id] ?? [];
  const allowContinue = canContinue(question, selected);

  useEffect(() => {
    if (!sequence.some((item) => item.id === currentQuestionId)) {
      setCurrentQuestionId("Q1");
    }
  }, [currentQuestionId, sequence, setCurrentQuestionId]);

  const dismissToast = useCallback(() => setShowEntrepreneurToast(false), []);

  function handleToggle(answerId: (typeof selected)[number]) {
    setQuestionAnswers(question.id, toggleQuestionAnswer(question, selected, answerId));
  }

  function handleBack() {
    if (currentIndex === 0) {
      router.push("/");
      return;
    }
    setCurrentQuestionId(sequence[currentIndex - 1].id);
  }

  function handleContinue() {
    if (!allowContinue) return;

    if (question.id === "Q5") {
      const shouldReveal = hasEntrepreneurSignal(answers);
      if (shouldReveal && !entrepreneurshipRevealed) {
        setEntrepreneurshipRevealed(true);
        setShowEntrepreneurToast(true);
      } else if (!shouldReveal) {
        clearEntrepreneurshipAnswers();
      }
      setCurrentQuestionId("Q6");
      return;
    }

    const nextQuestion = sequence[currentIndex + 1];
    if (nextQuestion) {
      setCurrentQuestionId(nextQuestion.id);
      return;
    }

    router.push("/result");
  }

  if (!hydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50">
        <p className="text-sm text-zinc-500">Открываем анкету…</p>
      </main>
    );
  }

  const buttonLabel = !question.required && selected.length === 0 ? "Пропустить →" : "Продолжить →";

  return (
    <div className="min-h-screen bg-zinc-50">
      <SiteHeader />
      <main className="page-enter mx-auto w-full max-w-[980px] px-5 pb-32 pt-8 sm:px-8 sm:pt-12 md:pb-16">
        <div className="mb-8 flex items-center justify-between gap-4 text-sm">
          <p className="font-semibold text-zinc-800">{question.block}</p>
          <p className="shrink-0 font-medium text-zinc-500">
            Вопрос {currentIndex + 1} из {sequence.length}
          </p>
        </div>

        <QuestionnaireProgress
          current={currentIndex + 1}
          total={sequence.length}
          entrepreneurshipRevealed={entrepreneurshipEnabled}
        />

        <section className="mt-10 rounded-[14px] border border-zinc-200 bg-white p-5 shadow-[0_14px_50px_rgba(24,24,27,0.05)] sm:p-9 md:p-11">
          {question.entrepreneurshipOnly ? (
            <p className="mb-4 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              Предпринимательство
            </p>
          ) : null}
          <h1 className="max-w-3xl text-[1.8rem] font-semibold leading-[1.12] tracking-[-0.035em] text-zinc-950 sm:text-[2.35rem]">
            {question.title}
          </h1>
          <p id={`${question.id}-instruction`} className="mb-8 mt-4 text-base leading-6 text-zinc-600">
            {question.instruction}
          </p>
          <AnswerCards question={question} selected={selected} onToggle={handleToggle} />
        </section>
      </main>

      <nav className="question-nav" aria-label="Навигация по анкете">
        <div className="mx-auto flex w-full max-w-[980px] items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <button type="button" onClick={handleBack} className="button-secondary">
            <span aria-hidden="true">←</span> Назад
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={!allowContinue}
            className="button-primary"
          >
            {buttonLabel}
          </button>
        </div>
      </nav>

      {showEntrepreneurToast ? (
        <Toast
          title="Добавили предпринимательский блок"
          message="Ты отметил(а) интерес к собственному проекту — в конце будет ещё два коротких вопроса."
          onDismiss={dismissToast}
        />
      ) : null}
    </div>
  );
}
