const envFile = process as NodeJS.Process & { loadEnvFile?: (path?: string) => void };
envFile.loadEnvFile?.();
