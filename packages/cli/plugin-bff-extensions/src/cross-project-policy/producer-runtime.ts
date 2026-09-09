interface ProducerClientOptions {
  requestId?: string;
  requireEnvelope?: boolean;
  identityBinding?: {
    enabled?: boolean;
    strict?: boolean;
    protectedHeaders?: string[];
  };
  operationContract?: {
    enabled?: boolean;
    strict?: boolean;
    requireSchemaHash?: boolean;
    requireOperationVersion?: boolean;
  };
}

/** Bind producer defaults once while preserving every per-call nested override. */
export function createProducerClient<
  Options extends ProducerClientOptions,
  Result,
>(
  configure: (options: Options) => Result,
  { requestId }: { requestId: string },
) {
  return (options?: Options): Result =>
    configure({
      requestId,
      requireEnvelope: true,
      ...options,
      identityBinding: {
        enabled: true,
        strict: true,
        ...options?.identityBinding,
      },
      operationContract: {
        enabled: true,
        strict: true,
        requireSchemaHash: true,
        requireOperationVersion: true,
        ...options?.operationContract,
      },
    } as Options);
}
