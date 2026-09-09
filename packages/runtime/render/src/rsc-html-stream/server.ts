/**
 * forked and modified from https://github.com/devongovett/rsc-html-stream/blob/main/server.js
 * license at https://github.com/devongovett/rsc-html-stream/blob/main/LICENSE
 */
const encoder = new TextEncoder();
const closingTagsPattern = /<\/body>\s*<\/html>\s*$/i;

export function injectRSCPayload(
  rscStream: ReadableStream,
  {
    injectClosingTags = true,
  }: {
    injectClosingTags?: boolean;
  },
): TransformStream {
  const decoder = new TextDecoder();
  let pendingHtml = '';
  let closingBody = false;
  let closingHtml = false;
  let closingProbe = '';
  let flightReader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let flightPromise: Promise<void> | undefined;

  function startFlight(
    controller: TransformStreamDefaultController<Uint8Array>,
  ) {
    if (!flightPromise) {
      flightReader = rscStream.getReader();
      flightPromise = writeRSCStream(flightReader, controller).finally(() => {
        flightReader = undefined;
      });
      void flightPromise.catch(error => controller.error(error));
    }
    return flightPromise;
  }

  async function writeHtml(
    value: string,
    controller: TransformStreamDefaultController<Uint8Array>,
  ) {
    let html = pendingHtml + value;
    pendingHtml = '';
    if (!closingBody) {
      const bodyIndex = html.search(
        /<\/body>\s*(?:<\/html>\s*|<\/h(?:t(?:m(?:l>?)?)?)?|<\/?|<)?$/i,
      );
      if (bodyIndex !== -1) {
        controller.enqueue(encoder.encode(html.slice(0, bodyIndex)));
        await startFlight(controller);
        closingBody = true;
        html = html.slice(bodyIndex);
      }
    }
    if (closingBody) {
      if (!injectClosingTags) {
        pendingHtml = html;
        return;
      }
      closingHtml ||= /<\/html>/i.test(closingProbe + html);
      closingProbe = (closingProbe + html).slice(-6);
    } else {
      // Keep an incomplete tag out of the output while Flight scripts stream.
      const tagIndex = html.lastIndexOf('<');
      if (tagIndex > html.lastIndexOf('>')) {
        pendingHtml = html.slice(tagIndex);
        html = html.slice(0, tagIndex);
      }
    }
    if (html) {
      controller.enqueue(encoder.encode(html));
      void startFlight(controller);
    }
  }

  // Transformer.cancel is standard but is still missing from the DOM typings.
  const transformer: Transformer<Uint8Array, Uint8Array> & {
    cancel(reason: unknown): Promise<void>;
  } = {
    transform(chunk: Uint8Array, controller) {
      return writeHtml(decoder.decode(chunk, { stream: true }), controller);
    },
    async flush(controller) {
      await writeHtml(decoder.decode(), controller);
      await startFlight(controller);
      const tail = injectClosingTags
        ? pendingHtml
        : pendingHtml.replace(closingTagsPattern, '');
      if (tail) {
        controller.enqueue(encoder.encode(tail));
      }
      if (injectClosingTags && !closingHtml) {
        controller.enqueue(
          encoder.encode(closingBody ? '</html>' : '</body></html>'),
        );
      }
    },
    cancel(reason) {
      return flightReader
        ? flightReader.cancel(reason)
        : rscStream.cancel(reason);
    },
  };
  return new TransformStream(transformer);
}

async function writeRSCStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  controller: TransformStreamDefaultController<Uint8Array>,
): Promise<void> {
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }
      let chunk: string;
      try {
        // Decode complete chunks only: split or invalid UTF-8 must retain every byte.
        chunk = JSON.stringify(decoder.decode(value));
      } catch {
        let binary = '';
        for (const byte of value) {
          binary += String.fromCharCode(byte);
        }
        chunk = `Uint8Array.from(atob(${JSON.stringify(btoa(binary))}), m => m.codePointAt(0))`;
      }
      writeChunk(chunk, controller);
    }
  } finally {
    reader.releaseLock();
  }
}

function writeChunk(
  chunk: string,
  controller: TransformStreamDefaultController<Uint8Array>,
): void {
  controller.enqueue(
    encoder.encode(
      `<script>${escapeScript(`(self.__FLIGHT_DATA||=[]).push(${chunk})`)}</script>`,
    ),
  );
}

// Escape closing script tags and HTML comments in JS content.
// https://www.w3.org/TR/html52/semantics-scripting.html#restrictions-for-contents-of-script-elements
// Avoid replacing </script with <\/script as it would break the following valid JS: 0</script/ (i.e. regexp literal).
// Instead, escape the s character.
function escapeScript(script: string): string {
  return script.replace(/<!--/g, '<\\!--').replace(/<\/(script)/gi, '</\\$1');
}

/**
 * Inject CSS link tags into HTML stream before closing head tag
 */
export function injectCSS(
  cssFiles: string[],
  {
    injectClosingTags = true,
  }: {
    injectClosingTags?: boolean;
  } = {},
): TransformStream {
  if (cssFiles.length === 0) {
    // Return a pass-through stream if no CSS files
    return new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk);
      },
      flush(controller) {
        if (injectClosingTags) {
          controller.enqueue(encoder.encode('</body></html>'));
        }
      },
    });
  }

  const decoder = new TextDecoder();
  const headTrailer = '</head>';
  let pendingHtml = '';
  let cssInjected = false;
  const cssLinks = cssFiles
    .map(css => `<link href="${css}" rel="stylesheet" />`)
    .join('');

  function writeHtml(
    value: string,
    controller: TransformStreamDefaultController<Uint8Array>,
    final = false,
  ) {
    let html = pendingHtml + value;
    pendingHtml = '';
    if (!cssInjected) {
      const headIndex = html.toLowerCase().indexOf(headTrailer);
      if (headIndex !== -1) {
        html = html.slice(0, headIndex) + cssLinks + html.slice(headIndex);
        cssInjected = true;
      } else if (!final) {
        // Only a suffix shorter than </head> can be part of a split closing tag.
        let retain = Math.min(headTrailer.length - 1, html.length);
        while (
          retain &&
          !html.toLowerCase().endsWith(headTrailer.slice(0, retain))
        ) {
          retain--;
        }
        pendingHtml = html.slice(html.length - retain);
        html = html.slice(0, html.length - retain);
      }
    }
    if (html) {
      controller.enqueue(encoder.encode(html));
    }
  }

  return new TransformStream({
    transform(chunk: Uint8Array, controller) {
      writeHtml(decoder.decode(chunk, { stream: true }), controller);
    },
    flush(controller) {
      writeHtml(decoder.decode(), controller, true);
      if (!cssInjected) {
        controller.enqueue(encoder.encode(cssLinks));
      }
      if (injectClosingTags) {
        controller.enqueue(encoder.encode('</body></html>'));
      }
    },
  });
}
