import { mkdir, readFile, writeFile } from "node:fs/promises";
await mkdir("offline", { recursive: true });
const licenses = await Promise.all(
  ["three", "chess.js", "vite", "@thi.ng/dsp"].map(async (name) =>
    `${name}\n${await readFile(`node_modules/${name}/${name === "vite" ? "LICENSE.md" : "LICENSE"}`, "utf8")}`,
  ),
);
const html = await readFile("dist-offline/offline.html", "utf8");
licenses.push(await readFile("third-party/thi-ng-dsp/NOTICE", "utf8"));
const notices = licenses.join("\n\n").replaceAll("-->", "-- >");
await writeFile(
  "offline/Special-Chess-Offline.html",
  html.replace("</head>", `<!-- Third-party notices\n${notices}\n-->\n</head>`),
);
console.log("Offline game: offline/Special-Chess-Offline.html — open directly in your browser.");
