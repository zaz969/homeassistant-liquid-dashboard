import { spawnSync } from "node:child_process";
import { realpathSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const source = realpathSync(fileURLToPath(new URL("../", import.meta.url)));
const requestedDestination = path.resolve(
  process.env.HA_ADDON_DIR ??
    "/run/user/1000/gvfs/smb-share:server=homeassistant.local,share=addons/glass_dashboard",
);
const options = process.argv.slice(2);
const dryRun = options.includes("--dry-run");
const changedOnly = options.includes("--changed-only");

if (
  options.some((argument) => argument !== "--dry-run" && argument !== "--changed-only") ||
  new Set(options).size !== options.length
) {
  console.error("Usage: npm run deploy [-- --changed-only] [--dry-run]");
  process.exit(2);
}

let destinationStats;
try {
  destinationStats = statSync(requestedDestination);
} catch (error) {
  console.error(`Cannot access deployment directory "${requestedDestination}": ${error.message}`);
  process.exit(1);
}

if (!destinationStats.isDirectory()) {
  console.error(`Deployment destination is not a directory: "${requestedDestination}"`);
  process.exit(1);
}

const destination = realpathSync(requestedDestination);
const relativeDestination = path.relative(source, destination);
if (
  relativeDestination === "" ||
  (!relativeDestination.startsWith(`..${path.sep}`) &&
    relativeDestination !== ".." &&
    !path.isAbsolute(relativeDestination))
) {
  console.error("Deployment destination must be outside the project directory.");
  process.exit(1);
}

const args = [
  "--recursive",
  "--times",
  "--human-readable",
  "--itemize-changes",
  "--exclude=/.git/",
  "--exclude=/.next/",
  "--exclude=/node_modules/",
  "--exclude=/.data/",
  "--exclude=/coverage/",
  "--exclude=/.env*",
  "--exclude=*.tsbuildinfo",
  "--exclude=/npm-debug.log*",
];

if (changedOnly) {
  args.push("--checksum");
}

if (dryRun) {
  args.push("--dry-run");
}

args.push(`${source}${path.sep}`, `${destination}${path.sep}`);

const result = spawnSync("rsync", args, { stdio: "inherit" });
if (result.error) {
  console.error(`Could not run rsync: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(
  `${dryRun ? "Dry run complete" : "Deployment files synchronized"}: ${destination}`,
);
if (changedOnly) {
  console.log("Only files with content changes were synchronized; unchanged files were skipped.");
}
if (!dryRun) {
  console.log("Rebuild or restart the add-on in Home Assistant to apply the changes.");
}
