import fs from 'node:fs';
import path from 'node:path';

/** Install a controlled Node command for package scripts executed by a shell. */
export function writeNodeCommandFixture(
  binDir: string,
  command: string,
  source: string,
) {
  fs.mkdirSync(binDir, { recursive: true });
  const scriptPath = path.join(binDir, `${command}.cjs`);
  fs.writeFileSync(scriptPath, source);
  const executablePath = path.join(
    binDir,
    process.platform === 'win32' ? `${command}.cmd` : command,
  );
  if (process.platform === 'win32') {
    fs.writeFileSync(
      executablePath,
      `@echo off\r\nsetlocal DisableDelayedExpansion\r\n"${process.execPath.replace(/%/gu, '%%')}" "%~dp0${command}.cjs" %*\r\nexit /b %errorlevel%\r\n`,
    );
  } else {
    const quote = (value: string) => `'${value.replace(/'/gu, "'\\''")}'`;
    fs.writeFileSync(
      executablePath,
      `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(scriptPath)} "$@"\n`,
      { mode: 0o755 },
    );
  }
  return executablePath;
}

export function prependCommandFixturePath(
  binDir: string,
  sourceEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const env = { ...sourceEnv };
  const currentPath = env.PATH ?? env.Path ?? '';
  if (process.platform === 'win32') {
    for (const key of Object.keys(env)) {
      if (key.toLowerCase() === 'path') delete env[key];
    }
    env.PATHEXT = `.CMD;.EXE;.BAT;.COM;${env.PATHEXT ?? ''}`;
  }
  env.PATH = `${binDir}${path.delimiter}${currentPath}`;
  return env;
}
