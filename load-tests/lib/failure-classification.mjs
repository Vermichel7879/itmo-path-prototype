const safeMachineErrorPattern = /^[A-Z][A-Z0-9_]{2,63}$/;

export function sessionStartFailureBucket(status) {
  if (status === 0) return "network_timeout";
  if (status === 400) return "400";
  if (status === 401 || status === 403) return "401_403";
  if (status === 409) return "409";
  if (status === 422) return "422";
  if (status === 429) return "429";
  if (status >= 500 && status <= 599) return "5xx";
  return "other";
}

export function safeMachineErrorCode(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const code = body.error;
  return typeof code === "string" && safeMachineErrorPattern.test(code)
    ? code
    : null;
}
