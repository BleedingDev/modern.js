export const renderedFlightRoots: unknown[] = [];
export const renderRsc = ({ element }: { element: unknown }) => {
  renderedFlightRoots.push(element);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('test Flight payload'));
      controller.close();
    },
  });
};
