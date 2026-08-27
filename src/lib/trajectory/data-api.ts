import "server-only";

import { z } from "zod";

import type { EducationLevel } from "@/lib/career/audience";
import { callAdminRpc, type AdminRpcClient } from "@/lib/supabase/admin-rpc";

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
  const rpc = <T>(name: string, args: Record<string, unknown>, schema: z.ZodType<T>) =>
    client ? callAdminRpc(name, args, schema, client) : callAdminRpc(name, args, schema);

  return {
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
      );
    },
    getContext(sessionId: string) {
      return rpc(
        "public_get_trajectory_session",
        { p_session_id: sessionId },
        sessionContextSchema,
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
