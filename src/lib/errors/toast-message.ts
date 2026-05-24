type ErrorWithData = {
  data?: {
    message?: string;
  };
  message?: string;
};

const CONVEX_CRPC_WRAPPER_PATTERN = /^\[[^\]]+\]\s*Uncaught CRPCError:\s*/u;
const UNCAUGHT_CRPC_ERROR_PATTERN = /^Uncaught CRPCError:\s*/u;
const CRPC_ERROR_PATTERN = /^CRPCError:\s*/u;

function sanitizeErrorMessage(message: string): string {
  return message
    .replace(CONVEX_CRPC_WRAPPER_PATTERN, "")
    .replace(UNCAUGHT_CRPC_ERROR_PATTERN, "")
    .replace(CRPC_ERROR_PATTERN, "")
    .trim();
}

export function getToastErrorMessage(error: unknown, fallback: string): string {
  const candidate = error as ErrorWithData | null;
  const dataMessage = candidate?.data?.message;

  if (typeof dataMessage === "string" && dataMessage.trim().length > 0) {
    return dataMessage.trim();
  }

  const message = candidate?.message;

  if (typeof message === "string" && message.trim().length > 0) {
    const sanitizedMessage = sanitizeErrorMessage(message);

    if (sanitizedMessage.length > 0) {
      return sanitizedMessage;
    }
  }

  return fallback;
}
