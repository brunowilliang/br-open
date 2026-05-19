import { z } from "zod";

export const requiredString = (message: string) =>
  z
    .string({
      error: (issue) => (issue.input === undefined ? message : undefined),
    })
    .trim()
    .min(1, message);

export const enumField = <T extends readonly [string, ...string[]]>(
  options: T,
  message: string
) =>
  z.enum(options, {
    error: (issue) => (issue.input === undefined ? message : undefined),
  });

export const requiredNumber = (message: string, invalidMessage: string) =>
  z
    .number({
      error: (issue) => (issue.input === undefined ? message : invalidMessage),
    })
    .int(invalidMessage)
    .min(1, invalidMessage);
