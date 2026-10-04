import { existsSync } from "node:fs";

const envFile = process as NodeJS.Process & { loadEnvFile?: (path?: string) => void };
if (existsSync(".env")) envFile.loadEnvFile?.();
