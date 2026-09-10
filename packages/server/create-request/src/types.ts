export type BFFRequestPayload = {
  params?: Record<string, any>;
  query?: Record<string, any>;
  body?: string;
  formUrlencoded?: string | Record<string, any> | URLSearchParams;
  formData?: FormData;
  data?: Record<string, any>;
  headers?: Record<string, any>;
  cookies?: Record<string, any>;
  files?: Record<string, any>;
};

export type Sender<F = typeof fetch> = ((...args: any[]) => Promise<any>) & {
  fetch?: F;
};

export type HttpMethodDecider = 'functionName' | 'inputParams';

/** Target selected by the native browser/server entry. */
export type RequestTarget = 'server' | 'browser';
export type RequestHeaders = Record<string, any>;
export type RequestFetcher = (
  url: string,
  init: Record<string, any>,
) => Promise<any>;

/** A snapshot of the native configuration at the start of one send. */
export type RequestStartContext = {
  requestId: string;
  target: RequestTarget;
  incomingHeaders: RequestHeaders;
  configured: boolean;
  configuredDomain: string | undefined;
};

/** Header maps before native allowlisted forwarding is merged into the request. */
export type RequestHeadersContext = RequestStartContext & {
  headers: RequestHeaders;
  forwardedHeaders: RequestHeaders;
  allowedHeaders: string[];
};

export type RequestDispatchContext = RequestStartContext & {
  path: string;
  method: string;
  url: string;
  init: {
    method: string;
    body: any;
    headers: RequestHeaders;
  };
  fetcher: RequestFetcher;
};

/** Optional, instance-local callbacks around native request construction. */
export type RequestHooks = {
  onStart?: (context: RequestStartContext) => void;
  prepareHeaders?: (context: RequestHeadersContext) => void;
  dispatch?: (context: RequestDispatchContext) => Promise<any>;
};

export type RequestCreatorOptions<F = typeof fetch> = {
  path: string;
  method: string;
  port: number;
  httpMethodDecider?: HttpMethodDecider;
  fetch?: F;
  domain?: string;
  requestId?: string;
  hooks?: RequestHooks;
};

export type RequestCreator<F = typeof fetch> = {
  (options: RequestCreatorOptions<F>): Sender;
  (
    path: string,
    method: string,
    port: number,
    httpMethodDecider?: HttpMethodDecider,
    fetch?: F,
    requestId?: string,
    hooks?: RequestHooks,
  ): Sender;
};

export type UploadCreatorOptions = {
  path: string;
  domain?: string;
  requestId?: string;
  hooks?: RequestHooks;
};

export type UploadCreator = (options: UploadCreatorOptions) => Sender;

export type IOptions<F = typeof fetch> = {
  request?: F;
  interceptor?: (request: F) => F;
  allowedHeaders?: string[];
  setDomain?: (ops?: { target: RequestTarget; requestId?: string }) => string;
  requestId?: string;
};

export type RequestClient<F = typeof fetch> = {
  configure: (options: IOptions<F>) => void;
  createRequest: RequestCreator<F>;
  createUploader: UploadCreator;
};
