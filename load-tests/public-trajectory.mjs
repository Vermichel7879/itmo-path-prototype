import http from "k6/http";
import exec from "k6/execution";
import { check, fail, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

import { buildValidAnswerPlan } from "./lib/questionnaire.mjs";

const PROFILE = __ENV.PROFILE || "smoke";
const BASE_URL = (__ENV.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const TEST_ISU_PREFIX = __ENV.TEST_ISU_PREFIX || "990000000";
const TEST_RUN_ID = (__ENV.TEST_RUN_ID || String(Date.now())).replace(/\D/g, "").slice(-8);
const MANUAL_VUS = __ENV.VUS ? Number(__ENV.VUS) : null;

const profiles = {
  smoke: {
    executor: "per-vu-iterations",
    vus: 5,
    iterations: 1,
    maxDuration: "5m",
  },
  normal: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "30s", target: 50 },
      { duration: "2m", target: 50 },
      { duration: "30s", target: 0 },
    ],
    gracefulRampDown: "30s",
  },
  target: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "1m", target: 300 },
      { duration: "3m", target: 300 },
      { duration: "1m", target: 0 },
    ],
    gracefulRampDown: "30s",
  },
  spike: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "5s", target: 500 },
      { duration: "1m", target: 500 },
      { duration: "20s", target: 0 },
    ],
    gracefulRampDown: "30s",
  },
};

if (!profiles[PROFILE]) throw new Error("PROFILE must be smoke, normal, target, or spike");
if (MANUAL_VUS !== null && (!Number.isInteger(MANUAL_VUS) || MANUAL_VUS < 1 || MANUAL_VUS > 500)) {
  throw new Error("VUS must be an integer between 1 and 500");
}
if (!/^https?:\/\//.test(BASE_URL)) throw new Error("BASE_URL must use http or https");
if (!/^\d{3,15}$/.test(TEST_ISU_PREFIX)) {
  throw new Error("TEST_ISU_PREFIX must contain 3-15 reserved test digits");
}
if ((PROFILE === "target" || PROFILE === "spike" || (MANUAL_VUS ?? 0) >= 300) && __ENV.CONFIRM_HIGH_LOAD !== "yes") {
  throw new Error("Set CONFIRM_HIGH_LOAD=yes only for an authorized test/staging target");
}

const selectedScenario = MANUAL_VUS === null ? profiles[PROFILE] : {
  executor: "ramping-vus",
  startVUs: 0,
  stages: [
    { duration: __ENV.RAMP_DURATION || "30s", target: MANUAL_VUS },
    { duration: __ENV.HOLD_DURATION || "2m", target: MANUAL_VUS },
    { duration: __ENV.RAMP_DOWN_DURATION || "30s", target: 0 },
  ],
  gracefulRampDown: "30s",
};

const sessionStartDuration = new Trend("session_start_duration", true);
const questionnaireDuration = new Trend("questionnaire_duration", true);
const answerSaveDuration = new Trend("answer_save_duration", true);
const trajectoryResultDuration = new Trend("trajectory_result_duration", true);
const flowErrors = new Rate("flow_error_rate");
const serverTotalDuration = new Trend("server_total_duration", true);
const serverSessionReadDuration = new Trend("server_session_read_duration", true);
const serverSessionWriteDuration = new Trend("server_session_write_duration", true);
const serverDataApiDuration = new Trend("server_data_api_duration", true);
const serverConfigReadDuration = new Trend("server_config_read_duration", true);
const serverRuleEngineDuration = new Trend("server_rule_engine_duration", true);
const serverCompletionWriteDuration = new Trend("server_completion_write_duration", true);
const configCacheHits = new Counter("config_cache_hits");
const configCacheMisses = new Counter("config_cache_misses");
const configCacheCoalesced = new Counter("config_cache_coalesced");

const serverTimingMetrics = {
  total: serverTotalDuration,
  session_read: serverSessionReadDuration,
  session_write: serverSessionWriteDuration,
  data_api: serverDataApiDuration,
  config_read: serverConfigReadDuration,
  rule_engine: serverRuleEngineDuration,
  completion_write: serverCompletionWriteDuration,
};

export const options = {
  scenarios: { public_trajectory: selectedScenario },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    flow_error_rate: ["rate<0.01"],
  },
  summaryTrendStats: ["avg", "min", "med", "p(95)", "p(99)", "max"],
  discardResponseBodies: false,
};

function think() {
  sleep(1 + Math.random() * 2);
}

function requestParams(name) {
  return {
    headers: { "content-type": "application/json" },
    tags: { name },
    redirects: 0,
  };
}

function stop(stage) {
  flowErrors.add(1, { stage });
  fail(`${stage}_FAILED`);
}

function responseJson(response, stage) {
  try {
    return response.json();
  } catch {
    stop(stage);
    return null;
  }
}

function recordServerTiming(response, endpoint) {
  const header = response.headers["Server-Timing"] || response.headers["server-timing"];
  if (!header) return;
  for (const entry of header.split(",")) {
    const match = entry.trim().match(/^([a-z][a-z0-9_]*);dur=([0-9]+(?:\.[0-9]+)?)$/);
    if (!match) continue;
    if (match[1] === "config_cache_hit") configCacheHits.add(1, { endpoint });
    if (match[1] === "config_cache_miss") configCacheMisses.add(1, { endpoint });
    if (match[1] === "config_cache_coalesced") configCacheCoalesced.add(1, { endpoint });
    const metric = serverTimingMetrics[match[1]];
    if (metric) metric.add(Number(match[2]), { endpoint });
  }
}

function syntheticIsu() {
  const vu = String(exec.vu.idInTest).padStart(5, "0");
  const iteration = String(exec.scenario.iterationInTest).padStart(7, "0");
  return `${TEST_ISU_PREFIX}${TEST_RUN_ID}${vu}${iteration}`;
}

export default function publicTrajectoryFlow() {
  const startResponse = http.post(
    `${BASE_URL}/api/trajectory-sessions`,
    JSON.stringify({ isu: syntheticIsu(), educationLevel: "MASTER" }),
    requestParams("SESSION_START"),
  );
  recordServerTiming(startResponse, "SESSION_START");
  sessionStartDuration.add(startResponse.timings.duration);
  if (!check(startResponse, {
    "session start returns 201": (response) => response.status === 201,
  })) stop("SESSION_START");
  const session = responseJson(startResponse, "SESSION_START");
  if (
    !session ||
    typeof session.sessionId !== "string" ||
    typeof session.configVersionId !== "string" ||
    session.educationLevel !== "MASTER" ||
    session.status !== "IN_PROGRESS"
  ) stop("SESSION_START_DTO");

  think();
  const questionnaireResponse = http.get(
    `${BASE_URL}/api/questionnaire?sessionId=${encodeURIComponent(session.sessionId)}`,
    { tags: { name: "QUESTIONNAIRE" }, redirects: 0 },
  );
  recordServerTiming(questionnaireResponse, "QUESTIONNAIRE");
  questionnaireDuration.add(questionnaireResponse.timings.duration);
  if (!check(questionnaireResponse, {
    "questionnaire returns 200": (response) => response.status === 200,
  })) stop("QUESTIONNAIRE");
  const questionnaire = responseJson(questionnaireResponse, "QUESTIONNAIRE");
  if (
    !questionnaire ||
    questionnaire.configVersionId !== session.configVersionId ||
    questionnaire.educationLevel !== "MASTER"
  ) stop("QUESTIONNAIRE_DTO");

  let answerPlan;
  try {
    answerPlan = buildValidAnswerPlan(
      questionnaire,
      exec.vu.idInTest + exec.scenario.iterationInTest,
    );
  } catch {
    stop("ANSWER_PLAN");
  }

  for (const answer of answerPlan) {
    think();
    const saveResponse = http.put(
      `${BASE_URL}/api/trajectory-sessions/answers`,
      JSON.stringify({
        sessionId: session.sessionId,
        questionId: answer.questionId,
        answerOptionIds: answer.answerOptionIds,
      }),
      requestParams("ANSWER_SAVE"),
    );
    recordServerTiming(saveResponse, "ANSWER_SAVE");
    answerSaveDuration.add(saveResponse.timings.duration);
    if (!check(saveResponse, {
      "answer save returns 200": (response) => response.status === 200,
    })) stop("ANSWER_SAVE");
  }

  think();
  const selectedAnswerIds = answerPlan.flatMap((answer) => answer.answerOptionIds);
  const trajectoryResponse = http.post(
    `${BASE_URL}/api/trajectory`,
    JSON.stringify({
      sessionId: session.sessionId,
      configVersionId: questionnaire.configVersionId,
      selectedAnswerIds,
    }),
    requestParams("TRAJECTORY_RESULT"),
  );
  recordServerTiming(trajectoryResponse, "TRAJECTORY_RESULT");
  trajectoryResultDuration.add(trajectoryResponse.timings.duration);
  if (!check(trajectoryResponse, {
    "trajectory returns 200": (response) => response.status === 200,
  })) stop("TRAJECTORY_RESULT");
  const result = responseJson(trajectoryResponse, "TRAJECTORY_RESULT");
  if (
    !result ||
    result.configVersionId !== questionnaire.configVersionId ||
    !result.primaryModule
  ) stop("TRAJECTORY_RESULT_DTO");

  flowErrors.add(0);
}
