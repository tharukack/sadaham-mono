#!/usr/bin/env node

const { runBackup } = require("./drive-backup");

const intervalMinutes = Number.parseInt(process.env.BACKUP_CHECK_INTERVAL_MINUTES || "30", 10);
const intervalMs = Number.isInteger(intervalMinutes) && intervalMinutes > 0 ? intervalMinutes * 60 * 1000 : 30 * 60 * 1000;

async function loop() {
  try {
    await runBackup({
      forceUpload: true,
      forceReason: "initial-startup-push",
    });
  } catch (error) {
    console.error(`${new Date().toISOString()} Initial backup push failed: ${error.message}`);
  }

  while (true) {
    try {
      await runBackup();
    } catch (error) {
      console.error(`${new Date().toISOString()} Backup worker iteration failed: ${error.message}`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

loop().catch((error) => {
  console.error(`${new Date().toISOString()} Backup worker failed: ${error.message}`);
  process.exit(1);
});