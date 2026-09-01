import "server-only";

import { z } from "zod";

import type { EducationLevel } from "@/lib/career/audience";
import { pinnedEngineConfigRpcSchema } from "@/lib/public-config/engine-config";
import {
  callAdminRpc,
  type AdminRpcCallOptions,
  type AdminRpcClient,
} from "@/lib/supabase/admin-rpc";

const sessionStatusSchema = z.enum(["IN_PROGRESS", "COMPLETED", "UNAVAILABLE"]);
const sessionContextSchema = z
  .object({
    id: z.uuid(),
    configVersionId: z.uuid(),
    educationLevel: z.enum(["BACHELOR", "MASTER"]),
    status: sessionStatusSchema,
  })
  .nullable();
const mutationResultSchema = z.object({ ok: z.literal(true) });
const publishedSummarySchema = z
  .object({
    id: z.uuid(),
    versionNumber: z.number().int().positive(),
    publishedAt: z.iso.datetime({ offset: true }),
  })
  .nullable();
const pinnedQuestionnaireSchema = z
  .object({
    configVersionId: z.uuid(),
    educationLevel: z.enum(["BACHELOR", "MASTER"]),
    branchQuestionIds: z.array(z.string()),
    signalTag: z.string().min(1),
    questions: z.array(z.object({
      id: z.string(),
      block: z.string(),
      title: z.string(),
      selectionType: z.enum(["SINGLE", "MULTI"]),
      minSelect: z.number().int().nonnegative(),
      maxSelect: z.number().int().positive(),
      required: z.boolean(),
      answers: z.array(z.object({
        id: z.string(),
        text: z.string(),
        tags: z.array(z.string()),
      })),
    })),
  })
  .nullable();

export interface TrajectoryCompletionPayload {
  scores: Array<{
    moduleId: string;
    totalScore: number;
    finalRank: number;
    q2Score: number;
    q3Score: number;
    q1Score: number;
    q5Score: number;
  }>;
  contributions: Array<{
    questionId: string;
    answerOptionId: string;
    moduleId: string;
    weight: number;
  }>;
  moduleResults: Array<{
    moduleId: string;
    kind: "PRIMARY" | "SUPPORT";
    position: number;
  }>;
  recommendations: Array<{
    recommendationId: string;
    position: number;
    sourceModuleId: string | null;
  }>;
  resultSnapshot: unknown;
}

export function createTrajectoryDataApi(client?: AdminRpcClient) {
  const rpc = <T>(
    name: string,
    args: Record<string, unknown>,
    schema: z.ZodType<T>,
    options?: AdminRpcCallOptions,
  ) =>
    client
      ? callAdminRpc(name, args, schema, client, options)
      : callAdminRpc(name, args, schema, undefined, options);

  return {
    getLatestPublishedSummary() {
      return rpc(
        "admin_get_latest_published_summary",
        {},
        publishedSummarySchema,
        { retryTransportOnce: true, timeoutMs: 10_000 },
      );
    },
    start(input: { isu: string; educationLevel: EducationLevel; configVersionId: string }) {
      return rpc(
        "public_start_trajectory_session",
        {
          p_isu: input.isu,
          p_education_level: input.educationLevel,
          p_config_version_id: input.configVersionId,
        },
        z.object({
          sessionId: z.uuid(),
          configVersionId: z.uuid(),
          educationLevel: z.enum(["BACHELOR", "MASTER"]),
          status: sessionStatusSchema,
        }),
        { timeoutMs: 15_000 },
      );
    },
    getContext(sessionId: string) {
      return rpc(
        "public_get_trajectory_session",
        { p_session_id: sessionId },
        sessionContextSchema,
        { retryTransportOnce: true, timeoutMs: 10_000 },
      );
    },
    getPinnedQuestionnaireData(configVersionId: string, educationLevel: EducationLevel) {
      return rpc(
        "public_get_pinned_questionnaire",
        {
          p_config_version_id: configVersionId,
          p_education_level: educationLevel,
        },
        pinnedQuestionnaireSchema,
        { retryTransportOnce: true, timeoutMs: 10_000 },
      );
    },
    getPinnedEngineConfig(configVersionId: string) {
      return rpc(
        "public_get_pinned_engine_config",
        { p_config_version_id: configVersionId },
        pinnedEngineConfigRpcSchema,
        { retryTransportOnce: true, timeoutMs: 10_000 },
      );
    },
    replaceAnswers(input: { sessionId: string; questionId: string; answerOptionIds: string[] }) {
      return rpc(
        "public_replace_session_answers",
        {
          p_session_id: input.sessionId,
          p_question_id: input.questionId,
          p_answer_option_ids: input.answerOptionIds,
        },
        mutationResultSchema,
      );
    },
    replaceAnswerSet(input: {
      sessionId: string;
      answers: Array<{ questionId: string; answerOptionIds: string[] }>;
    }) {
      return rpc(
        "public_replace_session_answer_set",
        {
          p_session_id: input.sessionId,
          p_answers: input.answers,
        },
        mutationResultSchema,
      );
    },
    complete(input: {
      sessionId: string;
      selectedAnswerIds: string[];
      payload: TrajectoryCompletionPayload;
    }) {
      return rpc(
        "public_complete_trajectory_session",
        {
          p_session_id: input.sessionId,
          p_selected_answer_ids: input.selectedAnswerIds,
          p_payload: input.payload,
        },
        mutationResultSchema,
      );
    },
  };
}

export const trajectoryDataApi = createTrajectoryDataApi();
