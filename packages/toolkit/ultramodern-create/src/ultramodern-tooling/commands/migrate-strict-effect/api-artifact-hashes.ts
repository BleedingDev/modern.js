import { createHash } from 'node:crypto';
import { parse } from '@babel/parser';

/** Whole released program identity; formatting is ignored, authored comments are retained. */
export function apiArtifactSyntaxHash(source: string): string | undefined {
  try {
    const parsed = parse(source, {
      sourceType: 'module',
      plugins: ['typescript'],
    });
    return createHash('sha256')
      .update(
        JSON.stringify(parsed, (key, value) =>
          [
            'start',
            'end',
            'loc',
            'extra',
            'leadingComments',
            'trailingComments',
            'innerComments',
          ].includes(key)
            ? undefined
            : value,
        ),
      )
      .digest('hex');
  } catch {
    return undefined;
  }
}

// Released template fingerprints: raw source and canonical Oxfmt output.
export default {
  'packages/shared-contracts/src/microvertical-api-baseline.ts': [
    {
      sha256:
        '34000fad9b9c0652b68971b39cd215bb8dc1a712932cf977b5113e8ac3327ff8',
      ref: '68465b0bf02054ef92a9ac9411c4cd5d74f4c1a9',
    },
    {
      sha256:
        '02568b020dfe73c7ee9c51b4bc18ac352cafbd15e49769e82466f1ae1a8a3e15',
      ref: '68465b0bf02054ef92a9ac9411c4cd5d74f4c1a9',
    },
  ],
  'scripts/microvertical-api-baseline-boundary.mts': [
    {
      sha256:
        '85aac686b0d03d258c9d8f618dbb6053ae8e0a56d97ea2fa4ba259fda0c64a79',
      ref: '6c071b02c98e700e97f89c45bc8d56fb8b31d157',
    },
    {
      sha256:
        '9ee3df935360a8a0e05caba53f37d273e6a2bbad530e43748c7c6d0b70636c10',
      ref: '6c071b02c98e700e97f89c45bc8d56fb8b31d157',
    },
    {
      sha256:
        '06d470b9bd66bbf16b2028ae6f9201e64f1972c205ba46bc6ea899a9f7ae58b3',
      ref: 'e9f855db7ee1e0447e8bb0e8fb85c76371f7ffea',
    },
    {
      sha256:
        'c70969bb29772dee3f2c4f19ea2131817da5165aa3c2ed8400172d1e9dc110bb',
      ref: 'e9f855db7ee1e0447e8bb0e8fb85c76371f7ffea',
    },
    {
      sha256:
        'f34f66fb2372c62518e80cb8d35b11aae5a571d48161978cc1738ac706739d2f',
      ref: '68465b0bf02054ef92a9ac9411c4cd5d74f4c1a9',
    },
    {
      sha256:
        '22cc170376eb32567fdfc07692664109a22171fcb4f25bf7cf06a4ba2b3ddcf1',
      ref: '68465b0bf02054ef92a9ac9411c4cd5d74f4c1a9',
    },
  ],
  'scripts/check-ultramodern-api-boundaries.mts': [
    {
      sha256:
        '68108f6c9dfa355b3ae55db982109d9eed6ec6d4f2196bb02fdfcb3c5b697a6e',
      ref: 'e9f855db7ee1e0447e8bb0e8fb85c76371f7ffea',
    },
    {
      sha256:
        'c478605d37d82e0bdf0e0d3dc712c58a4e2adbfa25a3053d3e552f2f532f7fb9',
      ref: 'e9f855db7ee1e0447e8bb0e8fb85c76371f7ffea',
    },
    {
      sha256:
        '474d65a294e10a99cebb5bc5fa1de9634afd41ff1d2a62b149a23c46feee5ff8',
      ref: '68465b0bf02054ef92a9ac9411c4cd5d74f4c1a9',
    },
    {
      sha256:
        '3e1e8fbe410526bc5d194f2db3e5b774ae3f7daabba275966d17406bab733564',
      ref: '68465b0bf02054ef92a9ac9411c4cd5d74f4c1a9',
    },
    {
      sha256:
        '44d0745c4fed7642ed1492650b5b9d4818276f39a5ceb8951e6c8a4e6a28e69c',
      ref: 'b6794e933d0bce99eb5c9324b0dc38b721ff2435',
    },
    {
      sha256:
        '7db1ccbbf20ce72aae877b8f6f4abedbdc3a20c7e232c5e094bee715126e4bc2',
      ref: 'b6794e933d0bce99eb5c9324b0dc38b721ff2435',
    },
  ],
};

// AST identities from npm-SRI-verified creator tarballs, with only the generated
// workspaceValidationContract literal replaced by {}. Comments remain owned.
export const historicalValidatorHashes = [
  {
    version: '3.8.2-ultramodern.12',
    sha256: 'eb91080a86fd38fd2663baf8e6db5c5c949f3386cfa79cea409f67ad43118c49',
  },
  {
    version: '3.9.0-ultramodern.3',
    sha256: 'd922fb39b37b6ee1e88ff851ece6615f7f4ebcdfb7b96ecef58b4d11425f4739',
  },
  {
    version: '3.9.0-ultramodern.4',
    sha256: 'd922fb39b37b6ee1e88ff851ece6615f7f4ebcdfb7b96ecef58b4d11425f4739',
  },
];

// Frozen syntax fingerprints from the same reviewed template refs above, raw and
// Ultracite-formatted. No consumer-provided ownership metadata is trusted.
export const historicalApiSyntaxHashes: Record<
  string,
  readonly { sha256: string; ref: string }[]
> = {
  'packages/shared-contracts/src/microvertical-api-baseline.ts': [
    {
      sha256:
        '590e63c98c9d6d92b13ae2b76a2dfa45b5b6a49ed5fb310ccb6db731c297c794',
      ref: '68465b0bf02054ef92a9ac9411c4cd5d74f4c1a9',
    },
  ],
  'scripts/microvertical-api-baseline-boundary.mts': [
    {
      sha256:
        'e8ea9a8665f7b90a626dc729a11b30c095945f17f368b898ef1f0eafd2792a24',
      ref: '6c071b02c98e700e97f89c45bc8d56fb8b31d157',
    },
    {
      sha256:
        '1a626f0bdab477a423b77e6c01d42526ce1be50f7003178ff1414819f8160f43',
      ref: 'e9f855db7ee1e0447e8bb0e8fb85c76371f7ffea',
    },
    {
      sha256:
        'ead993e593c37112dbad8f34b07eda926a2a5ec0616e998d077d35e54a0bd680',
      ref: '68465b0bf02054ef92a9ac9411c4cd5d74f4c1a9',
    },
  ],
  'scripts/check-ultramodern-api-boundaries.mts': [
    {
      sha256:
        'eaf78b679dfc4d4fea28449ead13b64a67931b893885fb5df2a625fbb53b07bc',
      ref: 'e9f855db7ee1e0447e8bb0e8fb85c76371f7ffea',
    },
    {
      sha256:
        'daa90f784b5471b5dd0792841b6f9d2b6464d908bc0ae0e1423a688bbfc0220c',
      ref: 'e9f855db7ee1e0447e8bb0e8fb85c76371f7ffea',
    },
    {
      sha256:
        '796d0c995cc94e7843ac3544e65988ceb3a2d7216fc5a22c27f1f2382bd3ae36',
      ref: '68465b0bf02054ef92a9ac9411c4cd5d74f4c1a9',
    },
    {
      sha256:
        'f1355a5d63e3b3973a7444bca8272d1d1e4b1fe913aa09a54332a255112a62d9',
      ref: '68465b0bf02054ef92a9ac9411c4cd5d74f4c1a9',
    },
    {
      sha256:
        '379a812c78ed5bf603ad05cd62df70c109d902512c1274865137b72d9716a114',
      ref: 'b6794e933d0bce99eb5c9324b0dc38b721ff2435',
    },
  ],
};
