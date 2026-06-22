import { mkdir, copyFile } from "node:fs/promises";

await mkdir("dist/ui", { recursive: true });
await copyFile("src/ui/popup.html", "dist/ui/popup.html");
await copyFile("src/ui/popup.css", "dist/ui/popup.css");
