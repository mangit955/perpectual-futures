import type { JsonValue, OutboxEventWrite } from "./records";

export interface CreateOutboxEventInput {
  id?: string;
  aggregateType: string;
  aggregateId: string;
  type: string;
  payload: JsonValue;
  now?: Date;
}

export function createOutboxEvent(
  input: CreateOutboxEventInput,
): OutboxEventWrite {
  const now = input.now ?? new Date();

  return {
    id: input.id ?? crypto.randomUUID(),
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    type: input.type,
    payload: input.payload,
    status: "PENDING",
    attempts: 0,
    lastError: null,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}
