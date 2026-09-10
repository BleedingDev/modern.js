import { render } from '@testing-library/react';
import React from 'react';
import { Link, NavLink } from '../../src/runtime/prefetchLink';

type CapturedOptions = {
  preload?: unknown;
};

type MockLinkAnchorProps = Record<string, unknown> & {
  href?: string;
  ref?: unknown;
};

let capturedOptions: CapturedOptions[] = [];
let mockReturnProps: MockLinkAnchorProps = { href: '/settings' };

rstest.mock('@tanstack/react-router', () => ({
  useLinkProps: (options: CapturedOptions) => {
    capturedOptions.push(options);
    return mockReturnProps;
  },
}));

describe('tanstack prefetch link adapter - preload mapping', () => {
  beforeEach(() => {
    capturedOptions = [];
    mockReturnProps = { href: '/settings' };
  });

  it.each([
    { expected: 'intent', preload: 'intent' },
    { expected: false, preload: false },
  ])('preserves an explicit $expected preload override', ({
    expected,
    preload,
  }) => {
    render(
      <Link to="/settings" prefetch="render" preload={preload}>
        Settings
      </Link>,
    );

    expect(capturedOptions[0]?.preload).toBe(expected);
  });

  it('maps none prefetch to disabled TanStack preload', () => {
    render(
      <Link to="/settings" prefetch="none">
        Settings
      </Link>,
    );

    expect(capturedOptions[0]?.preload).toBe(false);
  });

  it('forwards a supported prefetch mode to TanStack preload', () => {
    render(
      <Link to="/settings" prefetch="intent">
        Settings
      </Link>,
    );

    expect(capturedOptions[0]?.preload).toBe('intent');
  });

  it.each([
    Link,
    NavLink,
  ])('lets explicit preload re-enable prefetch=none', Component => {
    render(
      <Component to="/settings" prefetch="none" preload="render">
        Settings
      </Component>,
    );

    expect(capturedOptions.map(o => o.preload)).toEqual(['render']);
  });
});
