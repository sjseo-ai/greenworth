import { readFileSync } from "node:fs";
const s = readFileSync(process.argv[2], "utf8");
const ids = new Set([...s.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
const refs = new Set([...s.matchAll(/\$\('([A-Za-z0-9_-]+)'\)/g), ...s.matchAll(/getElementById\('([A-Za-z0-9_-]+)'\)/g)].map((m) => m[1]));
const missing = [...refs].filter((r) => !ids.has(r));
console.log("ids:", ids.size, "refs:", refs.size, "missing:", missing.join(", ") || "none");
console.log("replacement chars:", s.split("�").length - 1);
