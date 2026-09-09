export const findHeaderKey = (headers: Record<string, any>, header: string) => {
  const normalized = header.toLowerCase();
  return Object.keys(headers).find(key => key.toLowerCase() === normalized);
};

export const readHeader = (headers: Record<string, any>, header: string) => {
  const key = findHeaderKey(headers, header);
  return typeof key === 'string' ? headers[key] : undefined;
};

export const writeHeader = (
  headers: Record<string, any>,
  header: string,
  value: unknown,
) => {
  if (typeof value === 'undefined') {
    return;
  }
  const key = findHeaderKey(headers, header);
  if (typeof key === 'string' && key !== header) {
    delete headers[key];
  }
  headers[header] = value;
};
