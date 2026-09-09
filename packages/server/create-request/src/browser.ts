import { handleRes } from './handleRes';
import { createRequestFactory } from './requestFactory';

const originFetch = (...params: Parameters<typeof fetch>) => {
  const [url, init] = params;

  if (init?.method?.toLowerCase() === 'get') {
    init.body = undefined;
  }
  return fetch(url, init).then(handleRes);
};

export const createClient = () =>
  createRequestFactory<typeof fetch>({
    target: 'browser',
    getFetch: () => fetch,
    originFetch,
    readIncomingHeaders: () => ({}),
    createInputParamsBody: args =>
      JSON.stringify({
        args,
      }),
    resolveRequestUrl: ({ configDomain, domain, path }) =>
      `${configDomain || domain || ''}${path}`,
    resolveUploadUrl: ({ configDomain, domain, path }) =>
      `${configDomain || domain || ''}${path}`,
  });

export const { configure, createRequest, createUploader } = createClient();

export * from './types';
