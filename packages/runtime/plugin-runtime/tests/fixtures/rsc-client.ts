// Flight transport double; HTML rendering uses the real React renderer.
export const createFromReadableStream = async (stream: ReadableStream) => {
  await new Response(stream).text();
  return [];
};
export const createFromFetch = async (response: Promise<Response>) =>
  createFromReadableStream((await response).body!);
export const createServerReference = () => () => undefined;
export const setServerCallback = () => {};
