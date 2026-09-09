exports.modifyClient = async (draft, context) => {
  await Promise.resolve();
  if (context.options.requestId === 'reject-transform') {
    throw new Error('neutral transform rejected');
  }
  if (
    !draft.handlers.every(
      (entry, index) => entry.handlerInfo === context.handlerInfos[index],
    )
  ) {
    throw new Error('handler identity changed');
  }
  draft.requestCreator =
    context.options.requestCreator || 'neutral-request-runtime';
  draft.statements.push(
    `export const extensionReport = ${JSON.stringify({ count: context.handlerInfos.length, resourcePath: context.options.resourcePath })};`,
  );
  for (const entry of draft.handlers) {
    entry.optionProperties.push('extensionValue: 42');
  }
};
