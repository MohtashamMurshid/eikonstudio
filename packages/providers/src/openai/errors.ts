import type { OperationType, ProviderId, TaskType } from "@eikonstudio/core";

export class ProviderOperationUnsupportedError extends Error {
  readonly providerId: ProviderId;
  readonly operation: string;

  constructor(providerId: ProviderId, operation: string) {
    super("Provider operation is not supported.");
    this.name = "ProviderOperationUnsupportedError";
    this.providerId = providerId;
    this.operation = operation;
  }
}

export class ProviderInputValidationError extends Error {
  constructor() {
    super("Provider input is invalid.");
    this.name = "ProviderInputValidationError";
  }
}

export function unsupportedOpenAI(operation: OperationType | TaskType | string): ProviderOperationUnsupportedError {
  return new ProviderOperationUnsupportedError("openai", operation);
}
