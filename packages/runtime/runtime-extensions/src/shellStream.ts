import { abortHeadRender, createHeadChunkProcessor } from './rendererHead';

const MISSING_SHELL_MARKER_ERROR =
  'React SSR stream ended before the shell marker';

export const createConservingWebShellStream = (
  source: ReadableStream<Uint8Array>,
  context: object,
  marker: string,
  onMissingMarker?: (error: Error) => void,
): ReadableStream<Uint8Array> => {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const headProcessor = createHeadChunkProcessor(context);
  let markerCarry = '';
  let markerFound = false;

  const observeMarker = (chunk: string) => {
    if (markerFound) {
      return;
    }
    const candidate = markerCarry + chunk;
    markerFound = candidate.includes(marker);
    markerCarry = markerFound ? '' : candidate.slice(-(marker.length - 1));
  };

  const transform = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      const decoded = decoder.decode(chunk, { stream: true });
      observeMarker(decoded);
      const output = headProcessor.push(decoded);
      if (output) {
        controller.enqueue(encoder.encode(output));
      }
    },
    flush(controller) {
      const decoded = decoder.decode();
      observeMarker(decoded);
      if (!markerFound) {
        abortHeadRender(context);
        const error = new Error(MISSING_SHELL_MARKER_ERROR);
        onMissingMarker?.(error);
        throw error;
      }
      const output = headProcessor.finish(decoded);
      if (output) {
        controller.enqueue(encoder.encode(output));
      }
    },
  });
  const piping = source.pipeTo(transform.writable);
  piping.catch(() => {});
  const reader = transform.readable.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const result = await reader.read();
        if (result.done) {
          await piping;
          controller.close();
          reader.releaseLock();
        } else controller.enqueue(result.value);
      } catch (error) {
        await piping.catch(() => {});
        controller.error(error);
        reader.releaseLock();
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        try {
          await piping.catch(error => {
            if (error !== reason) throw error;
          });
        } finally {
          reader.releaseLock();
        }
      }
    },
  });
};
