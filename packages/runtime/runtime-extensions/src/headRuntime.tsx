import React from 'react';
import {
  Helmet as AsyncHelmet,
  type HelmetProps,
  HelmetProvider,
  type HelmetServerState,
} from 'react-helmet-async';
import type { HelmetContextSlot } from './helmetContext';
import * as runtimeHead from './rendererHead';

export interface HeadRenderContext {
  runtimeContext: object;
  helmetContext: HelmetContextSlot;
}

// Keep one adapter per plugin setup. Its component/provider identity is stable;
// each HTML render supplies its own original context and captured helmet slot.
export function createHeadRuntime() {
  const HeadContext = React.createContext<HeadRenderContext | undefined>(
    undefined,
  );

  const collectServerHelmet = (
    { runtimeContext, helmetContext }: HeadRenderContext,
    props: React.PropsWithChildren<HelmetProps>,
  ) => {
    const createRecord = () => runtimeHead.createHelmetRecord(React, props);
    const deriveState = (records: runtimeHead.HelmetCompatRecord[]) =>
      runtimeHead.deriveHelmetServerState(React, records) as HelmetServerState;
    const marker = runtimeHead.collectHeadState(
      runtimeContext,
      createRecord,
      deriveState,
      helmetContext,
    );
    if (marker !== undefined) return marker;
    helmetContext.helmet = runtimeHead.collectImmediateHelmetState(
      React,
      helmetContext,
      createRecord(),
    ) as HelmetServerState;
  };

  const Head = (props: React.PropsWithChildren<HelmetProps>) => {
    const state = React.useContext(HeadContext);
    if (state !== undefined) {
      return runtimeHead.renderHeadMarker(
        React,
        collectServerHelmet(state, props),
      );
    }
    return React.createElement(AsyncHelmet, props);
  };

  const ClientRoot = ({ children }: { children: React.ReactNode }) => {
    const state = React.useContext(HeadContext);
    return state === undefined ? (
      <HelmetProvider>{children}</HelmetProvider>
    ) : (
      children
    );
  };

  return {
    Head,
    wrapServerRoot(root: React.ReactNode, state: HeadRenderContext) {
      return (
        <HeadContext.Provider value={state}>
          <HelmetProvider context={state.helmetContext}>{root}</HelmetProvider>
        </HeadContext.Provider>
      );
    },
    wrapClientRoot(root: React.ReactNode) {
      return <ClientRoot>{root}</ClientRoot>;
    },
  };
}
