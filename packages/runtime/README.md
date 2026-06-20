# runtime

Runtime orchestration for the exchange backend.

This package wires together:

- `packages/matching-engine`
- `packages/risk`
- `packages/websocket`
- runtime stream bus
- matching worker
- persistence worker

## Local Runtime

The default runtime uses `InMemoryStreamBus` and `RuntimeStore`. The API app runs
workers in-process, so a local learning backend can run as one process:

```bash
bun run apps/api/src/index.ts
```

## Production Shape

The runtime is written around a small `StreamBus` interface:

```ts
interface StreamBus {
  append<T>(stream: string, payload: T): Promise<StreamMessage<T>>;
  readAfter<T>(stream: string, afterId?: string, limit?: number): Promise<StreamMessage<T>[]>;
}
```

A Redis Streams adapter can replace `InMemoryStreamBus` without changing the
matching or persistence workers.

## Tests

```bash
bun test packages/runtime
bunx tsc --noEmit -p packages/runtime/tsconfig.json
```
