import assert from "node:assert/strict";
import test from "node:test";

import {
  safeMachineErrorCode,
  sessionStartFailureBucket,
} from "./failure-classification.mjs";

test("classifies session-start failures into bounded status groups", () => {
  assert.equal(sessionStartFailureBucket(0), "network_timeout");
  assert.equal(sessionStartFailureBucket(400), "400");
  assert.equal(sessionStartFailureBucket(401), "401_403");
  assert.equal(sessionStartFailureBucket(403), "401_403");
  assert.equal(sessionStartFailureBucket(409), "409");
  assert.equal(sessionStartFailureBucket(422), "422");
  assert.equal(sessionStartFailureBucket(429), "429");
  assert.equal(sessionStartFailureBucket(503), "5xx");
  assert.equal(sessionStartFailureBucket(302), "other");
});

test("accepts only bounded safe machine error codes", () => {
  assert.equal(
    safeMachineErrorCode({ error: "SESSION_START_UNAVAILABLE" }),
    "SESSION_START_UNAVAILABLE",
  );
  assert.equal(safeMachineErrorCode({ error: "contains spaces" }), null);
  assert.equal(safeMachineErrorCode({ error: { nested: true } }), null);
  assert.equal(safeMachineErrorCode(null), null);
});
