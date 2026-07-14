import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, "../src/routes/_student.courses.$courseId.tsx");

let content = readFileSync(filePath, "utf-8");

// Insert useMemo into React imports
content = content.replace(
  `import { useState, useEffect } from "react";`,
  `import { useState, useEffect, useMemo } from "react";`
);

writeFileSync(filePath, content, "utf-8");
console.log("✅ Successfully added useMemo import to course details page!");
