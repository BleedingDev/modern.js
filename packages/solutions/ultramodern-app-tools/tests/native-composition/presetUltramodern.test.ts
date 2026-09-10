import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createPresetUltramodernConfig,
  presetUltramodern,
} from '@modern-js/ultramodern-app-tools';
import { rspack } from '@rsbuild/core';

describe('presetUltramodern config', () => {
  it('forwards telemetry, BFF and SSR options through the preset table', () => {
    const cases = [
      {
        options: {},
        expected: {
          requestId: 'app',
          ssr: true,
          exporters: undefined,
        },
      },
      {
        options: {
          appId: 'erp-shell',
          enableModuleFederationSSR: true,
          otlpEndpoint: 'http://collector.internal:4318/v1/logs',
        },
        expected: {
          requestId: 'erp-shell',
          ssr: true,
          exporters: {
            otlp: {
              enabled: true,
              endpoint: 'http://collector.internal:4318/v1/logs',
            },
          },
        },
      },
      {
        options: { enableTelemetryExporters: true },
        expected: {
          requestId: 'app',
          ssr: true,
          exporters: {
            otlp: { enabled: true, endpoint: 'http://127.0.0.1:4318/v1/logs' },
            victoriaMetrics: {
              enabled: true,
              endpoint: 'http://127.0.0.1:8428/api/v1/import/prometheus',
            },
          },
        },
      },
    ] as const;

    for (const { options, expected } of cases) {
      const preset = createPresetUltramodernConfig(options);
      expect(preset.bff?.requestId).toBe(expected.requestId);
      expect(
        preset.server?.ssr &&
          typeof preset.server.ssr === 'object' &&
          preset.server.ssr.moduleFederationAppSSR,
      ).toBe(expected.ssr);
      expect(preset.server?.telemetry?.exporters).toEqual(expected.exporters);
    }
  });

  it('evaluates telemetry endpoint environment variables for every call', () => {
    const previousOtlp = process.env.MODERN_TELEMETRY_OTLP_ENDPOINT;
    const previousVictoria = process.env.MODERN_TELEMETRY_VICTORIA_ENDPOINT;
    delete process.env.MODERN_TELEMETRY_OTLP_ENDPOINT;
    delete process.env.MODERN_TELEMETRY_VICTORIA_ENDPOINT;

    try {
      const beforeEndpoint = createPresetUltramodernConfig();
      process.env.MODERN_TELEMETRY_OTLP_ENDPOINT =
        'http://env-collector.internal:4318/v1/logs';
      const afterEndpoint = createPresetUltramodernConfig();

      expect(beforeEndpoint.server?.telemetry?.exporters).toBeUndefined();
      expect(afterEndpoint.server?.telemetry?.exporters).toEqual({
        otlp: {
          enabled: true,
          endpoint: 'http://env-collector.internal:4318/v1/logs',
        },
      });
    } finally {
      if (typeof previousOtlp === 'undefined') {
        delete process.env.MODERN_TELEMETRY_OTLP_ENDPOINT;
      } else {
        process.env.MODERN_TELEMETRY_OTLP_ENDPOINT = previousOtlp;
      }
      if (typeof previousVictoria === 'undefined') {
        delete process.env.MODERN_TELEMETRY_VICTORIA_ENDPOINT;
      } else {
        process.env.MODERN_TELEMETRY_VICTORIA_ENDPOINT = previousVictoria;
      }
    }
  });

  it('stamps minimized browser bytes before content hashes are finalized', async () => {
    const previous = process.env.ULTRAMODERN_SOURCE_REVISION;
    const previousCwd = process.cwd();
    const workspaceRoot = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'modern-preset-rspack-banner-')),
    );
    const sourceRevision = 'b'.repeat(40);
    const entry = path.join(workspaceRoot, 'entry.js');
    fs.writeFileSync(entry, 'globalThis.ultramodernClientLoaded = true;\n');
    process.env.ULTRAMODERN_SOURCE_REVISION = sourceRevision;

    try {
      process.chdir(workspaceRoot);
      const outputs: Array<{ filename: string }> = [];
      for (const [index, generationBuildMarker] of [
        '1111111111111111',
        '2222222222222222',
      ].entries()) {
        const outputPath = path.join(workspaceRoot, `dist-${index}`);
        const preset = createPresetUltramodernConfig({
          deliveryUnit: {
            buildMarker: generationBuildMarker,
            unitId: 'acme/catalog',
            version: '1.2.3',
          },
        });
        const rspackConfig = {
          plugins: [],
        };
        const configureRspack = preset.tools?.rspack as (
          config: typeof rspackConfig,
        ) => typeof rspackConfig;
        configureRspack(rspackConfig);

        await new Promise<void>((resolve, reject) => {
          rspack.rspack(
            {
              entry,
              mode: 'production',
              optimization: {
                minimize: true,
              },
              output: {
                clean: true,
                filename: '[contenthash].js',
                path: outputPath,
              },
              plugins: rspackConfig.plugins,
            },
            (error, stats) => {
              if (error) {
                reject(error);
              } else if (!stats || stats.hasErrors()) {
                reject(
                  new Error(
                    stats?.toString({ all: false, errors: true }) ??
                      'Rspack returned no build stats.',
                  ),
                );
              } else {
                resolve();
              }
            },
          );
        });

        const filename = fs
          .readdirSync(outputPath)
          .find(candidate => candidate.endsWith('.js'));
        expect(filename).toBeDefined();
        delete (globalThis as Record<string, unknown>).ultramodernClientLoaded;
        require(path.join(outputPath, filename!));
        expect(
          (globalThis as Record<string, unknown>).ultramodernClientLoaded,
        ).toBe(true);
        outputs.push({ filename: filename! });
      }

      expect(outputs[0].filename).not.toBe(outputs[1].filename);
    } finally {
      process.chdir(previousCwd);
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
      if (previous === undefined) {
        delete process.env.ULTRAMODERN_SOURCE_REVISION;
      } else {
        process.env.ULTRAMODERN_SOURCE_REVISION = previous;
      }
    }
  });

  it('supports opt-out for strict defaults', () => {
    const preset = createPresetUltramodernConfig({
      enableBffRequestId: false,
      enableModuleFederationSSR: false,
      enableTelemetryExporters: false,
    });

    expect(preset.bff).toBeUndefined();
    expect(preset.server?.ssr).toBeUndefined();
    expect(preset.server?.telemetry?.exporters).toBeUndefined();
  });

  it('allows app config overrides when composed', () => {
    const composed = presetUltramodern({
      output: {
        precompress: false,
      },
      server: {
        ssr: false,
        telemetry: {
          enabled: false,
        },
      },
      bff: {
        requestId: 'custom-app',
      },
    });

    expect(composed.output?.precompress).toBe(false);
    expect(composed.server?.telemetry?.enabled).toBe(false);
    expect(composed.server?.telemetry?.failLoudStartup).toBe(false);
    expect(composed.server?.ssr).toBe(false);
    expect(composed.bff?.requestId).toBe('custom-app');
  });

  it('keeps defaults for omitted and undefined values but honors false', () => {
    const omitted = presetUltramodern({});
    const undefinedOverride = presetUltramodern({
      output: { precompress: undefined },
      source: { reactCompiler: undefined },
      tools: { lightningcssLoader: undefined },
    });
    const falseOverride = presetUltramodern({
      output: { precompress: false },
      source: { reactCompiler: false },
      tools: { lightningcssLoader: false },
    });

    expect(omitted.output?.precompress).toBe(true);
    expect(omitted.source?.reactCompiler).toBe(true);
    expect(omitted.tools?.lightningcssLoader).toBe(true);
    expect(undefinedOverride.output?.precompress).toBe(true);
    expect(undefinedOverride.source?.reactCompiler).toBe(true);
    expect(undefinedOverride.tools?.lightningcssLoader).toBe(true);
    expect(falseOverride.output?.precompress).toBe(false);
    expect(falseOverride.source?.reactCompiler).toBe(false);
    expect(falseOverride.tools?.lightningcssLoader).toBe(false);
  });
});
