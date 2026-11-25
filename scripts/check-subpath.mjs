/** 额外回归：暂用 /blog/ 构建，结束后恢复配置与根目录产物。 */
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const config = new URL("../src/config.ts", import.meta.url);
const original = await readFile(config, "utf8");
const root = fileURLToPath(new URL("..", import.meta.url));
function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`验证失败：${args.join(" ")}`);
}
function build() {
  run(["scripts/astro.mjs", "build"]);
  run(["node_modules/pagefind/lib/runner/bin.cjs", "--site", "dist"]);
}
try {
  if (!original.includes('base: "/",'))
    throw new Error("此回归脚本要求当前 base 为 /，避免覆盖自定义配置。");
  await writeFile(config, original.replace('base: "/",', 'base: "/blog/",'));
  build();
  run(["scripts/check-build.mjs"]);
  console.log("/blog/ 子目录部署检查通过。");
} finally {
  await writeFile(config, original);
  build();
}
