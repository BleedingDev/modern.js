import { storage } from '@modern-js/runtime-utils/node';
import { handleRes } from './handleRes';
import { createRequestFactory } from './requestFactory';

type Fetch = typeof fetch;

const readIncomingWebHeaders = (): Record<string, any> => {
  try {
    return storage.useContext().headers || {};
  } catch (error) {
    return {};
  }
};

const originFetch = (...params: Parameters<Fetch>) => {
  const [, init] = params;

  if (init?.method?.toLowerCase() === 'get') {
    init.body = undefined;
  }

  return fetch(...params).then(handleRes);
};

export const createClient = () =>
  createRequestFactory<Fetch>({
    target: 'server',
    getFetch: () => fetch,
    originFetch,
    readIncomingHeaders: readIncomingWebHeaders,
    createInputParamsBody: args => args as any,
    resolveRequestUrl: ({ configDomain, path, port }) =>
      `${configDomain || `http://127.0.0.1:${port}`}${path}`,
    resolveUploadUrl: ({ configDomain, path }) =>
      `${configDomain || ''}${path}`,
  });

export const { configure, createRequest, createUploader } = createClient();

export * from './types';
