import {
  checkMicroVerticalApiBoundaries,
  checkMicroVerticalApiConsumerFiles,
} from '../microvertical-api-boundary';

export function runMicroVerticalApiCheckCli(
  args = process.argv.slice(2),
  filesOnly = false,
): number {
  let workspaceRoot = process.env.ULTRAMODERN_WORKSPACE_ROOT ?? process.cwd();
  let baselinePackageDirectory: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help' || argument === '-h') {
      console.log(
        `${filesOnly ? 'modern-api-check-files' : 'modern-api-check'} [--workspace-root <path>] [--baseline-package-directory <path>]\n${filesOnly ? 'Checks consumer files, contracts, package exports and owner identity. Does not analyze runtime topology; run the strict Effect source phase separately.' : 'Checks consumer files, contracts, package exports, owner identity and runtime topology once per API entry.'}\nWorkspace defaults to ULTRAMODERN_WORKSPACE_ROOT then cwd. Exit codes: 0 valid, 1 consumer violation, 2 tool/configuration failure.`,
      );
      return 0;
    }
    if (
      !['--workspace-root', '--baseline-package-directory'].includes(
        argument ?? '',
      ) ||
      !args[index + 1] ||
      args[index + 1]?.startsWith('--')
    ) {
      console.error(`Invalid argument: ${argument ?? ''}. Use --help.`);
      return 2;
    }
    const value = args[++index]!;
    if (argument === '--workspace-root') workspaceRoot = value;
    else baselinePackageDirectory = value;
  }
  const result = (
    filesOnly
      ? checkMicroVerticalApiConsumerFiles
      : checkMicroVerticalApiBoundaries
  )({ workspaceRoot, baselinePackageDirectory });
  for (const diagnostic of result.diagnostics)
    console.error(`API violation: ${diagnostic}`);
  for (const error of result.toolErrors)
    console.error(`API tool error: ${error}`);
  if (result.toolErrors.length) return 2;
  if (result.diagnostics.length) return 1;
  console.log(
    `UltraModern API ${filesOnly ? 'consumer files' : 'boundary'} check passed.`,
  );
  return 0;
}
