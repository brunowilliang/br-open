type ErrorWithData = {
  data?: {
    message?: unknown;
  };
  message?: unknown;
};

function getStringMessage(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const message = value.trim();
  return message.length > 0 ? message : null;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  const candidate = error as ErrorWithData | null;
  const dataMessage = getStringMessage(candidate?.data?.message);

  if (dataMessage) {
    return dataMessage;
  }

  const message = getStringMessage(candidate?.message ?? error);

  if (message) {
    return message;
  }

  return fallback;
}

export function getToastErrorMessage(error: unknown, fallback: string): string {
  return getErrorMessage(error, fallback);
}
