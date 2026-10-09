import { mkdir, copyFile, writeFile } from "node:fs/promises";
await mkdir("dist-pages", { recursive: true });
await copyFile("offline/Special-Chess-Offline.html", "dist-pages/index.html");
await writeFile("dist-pages/.nojekyll", "");
await copyFile("online-config.json", "dist-pages/online-config.json");
console.log(
  "Static site prepared in dist-pages. All assets and bot code are embedded in index.html.",
);
