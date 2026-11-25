import { readFile } from "node:fs/promises";

// 在加载 CLI 前关闭当前进程的遥测，避免首次运行写入受限的用户全局目录。
// 直接执行包声明的 CLI，保留 Astro 原有参数、错误码和信号处理。
process.env.ASTRO_TELEMETRY_DISABLED = "1";
const packageUrl = new URL(import.meta.resolve("astro/package.json"));
const { bin } = JSON.parse(await readFile(packageUrl, "utf8"));
await import(new URL(bin.astro, packageUrl).href);
