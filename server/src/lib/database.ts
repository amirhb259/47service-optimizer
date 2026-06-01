import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function ensureDatabaseReady() {
  await execFileAsync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    cwd: process.cwd(),
    env: process.env,
    windowsHide: true,
  });
}
