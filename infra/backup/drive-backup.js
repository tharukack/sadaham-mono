#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const https = require("https");
const path = require("path");
const { spawn } = require("child_process");
const { URL } = require("url");
const zlib = require("zlib");

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const TOKEN_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:jwt-bearer";
const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3/files";

async function runBackup(options = {}) {
  loadEnvFile(path.resolve(process.cwd(), ".env"));

  const now = new Date();
  const config = loadConfig();
  const forceUpload = Boolean(options.forceUpload);
  const forcedReason = options.forceReason || "initial-startup-push";

  await ensureDirectory(config.runtimeDir);
  const state = await readJsonFile(config.stateFile, {});

  log(forceUpload ? `Starting forced backup check (${forcedReason})` : "Starting backup check");
  const dumpPath = await createDatabaseDump(config, now);

  try {
    const dumpHash = await sha256File(dumpPath);
    const dumpSizeBytes = await getFileSize(dumpPath);
    log(`Raw dump size: ${formatBytes(dumpSizeBytes)} (${dumpSizeBytes} bytes)`);
    const token = await getAccessToken(config.credentials);
    const rootFolderId = await ensureDriveFolder(token, config.backupRootFolder, config.parentFolderId);

    await cleanupExpiredBackups(token, rootFolderId, config.retentionMonths, now);

    const lastUploadedAt = state.lastUploadedAt ? new Date(state.lastUploadedAt) : null;
    const unchangedBackupDue =
      !lastUploadedAt || now.getTime() - lastUploadedAt.getTime() >= config.unchangedIntervalDays * 24 * 60 * 60 * 1000;
    const hasChanged = state.lastUploadedHash !== dumpHash;

    const shouldUpload = forceUpload || hasChanged || unchangedBackupDue;
    const reason = forceUpload
      ? forcedReason
      : hasChanged
        ? "changed"
        : unchangedBackupDue
          ? "stale-7-day-policy"
          : "unchanged";

    if (!shouldUpload) {
      const event = createEvent({
        status: "skipped",
        reason,
        checkedAt: now,
        dumpHash,
        databaseName: config.database.database,
      });

      await appendEvent(config.eventsFile, event);
      await writeJsonFile(config.stateFile, {
        ...state,
        lastCheckedAt: now.toISOString(),
        lastSeenHash: dumpHash,
        lastStatus: event.status,
        lastReason: event.reason,
      });
      log("Database unchanged and 7-day backup window not reached. Skipping upload.");
      return event;
    }

    const dayFolderName = formatLocalDay(now);
    const dayFolderId = await ensureDriveFolder(token, dayFolderName, rootFolderId);
    const timestampLabel = formatTimestampForFile(now);
    const fileName = `pg_${config.database.database}_${timestampLabel}_${dumpHash.slice(0, 12)}.sql.gz`;
    const gzipPath = `${dumpPath}.gz`;
    const drivePath = `${config.backupRootFolder}/${dayFolderName}/${fileName}`;

    await gzipFile(dumpPath, gzipPath);
    const gzipSizeBytes = await getFileSize(gzipPath);
    log(`Compressed dump size: ${formatBytes(gzipSizeBytes)} (${gzipSizeBytes} bytes)`);
    try {
      await uploadFileToDrive(token, dayFolderId, fileName, gzipPath, dumpHash, now);
    } finally {
      await safeUnlink(gzipPath);
    }

    const event = createEvent({
      status: "uploaded",
      reason,
      checkedAt: now,
      uploadedAt: now,
      fileName,
      drivePath,
      dumpHash,
      databaseName: config.database.database,
    });

    await appendEvent(config.eventsFile, event);
    await writeJsonFile(config.stateFile, {
      lastCheckedAt: now.toISOString(),
      lastSeenHash: dumpHash,
      lastUploadedAt: now.toISOString(),
      lastUploadedHash: dumpHash,
      lastUploadedFile: fileName,
      lastUploadedDrivePath: drivePath,
      lastStatus: event.status,
      lastReason: event.reason,
    });

    log(`Uploaded backup ${drivePath}`);
    return event;
  } catch (error) {
    const event = createEvent({
      status: "failed",
      reason: forceUpload ? forcedReason : "error",
      checkedAt: now,
      fileName: null,
      drivePath: null,
      dumpHash: null,
      databaseName: config.database.database,
      errorMessage: error.message,
    });

    await appendEvent(config.eventsFile, event);
    await writeJsonFile(config.stateFile, {
      ...state,
      lastCheckedAt: now.toISOString(),
      lastStatus: event.status,
      lastReason: event.reason,
      lastErrorMessage: error.message,
    });
    throw error;
  } finally {
    await safeUnlink(dumpPath);
  }
}

function createEvent(input) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    status: input.status,
    reason: input.reason,
    checkedAt: input.checkedAt.toISOString(),
    uploadedAt: input.uploadedAt ? input.uploadedAt.toISOString() : null,
    fileName: input.fileName || null,
    drivePath: input.drivePath || null,
    dumpHash: input.dumpHash || null,
    databaseName: input.databaseName,
    errorMessage: input.errorMessage || null,
  };
}

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    const value = stripOptionalQuotes(rawValue);

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function stripOptionalQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}

function loadConfig() {
  const databaseUrl = requireEnv("DATABASE_URL");
  const credentialsPath = path.resolve(
    process.cwd(),
    process.env.GOOGLE_DRIVE_CREDENTIALS_FILE || "credentials.json",
  );
  const runtimeDir = path.resolve(
    process.cwd(),
    process.env.BACKUP_RUNTIME_DIR || ".backup-runtime",
  );

  return {
    credentials: loadDriveCredentials(credentialsPath),
    runtimeDir,
    stateFile: path.join(runtimeDir, "backup-state.json"),
    eventsFile: path.join(runtimeDir, "backup-events.jsonl"),
    backupRootFolder: process.env.BACKUP_DRIVE_ROOT_FOLDER || "sadaham_backup_dev",
    parentFolderId: process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || "",
    retentionMonths: parsePositiveInt(process.env.BACKUP_RETENTION_MONTHS || "6", "BACKUP_RETENTION_MONTHS"),
    unchangedIntervalDays: parsePositiveInt(
      process.env.BACKUP_UNCHANGED_INTERVAL_DAYS || "7",
      "BACKUP_UNCHANGED_INTERVAL_DAYS",
    ),
    pgDumpCommand: process.env.PG_DUMP_COMMAND || "pg_dump",
    database: parseDatabaseUrl(databaseUrl),
  };
}

function loadDriveCredentials(credentialsPath) {
  if (!fs.existsSync(credentialsPath)) {
    throw new Error(`Google Drive credentials file not found: ${credentialsPath}`);
  }

  const raw = fs.readFileSync(credentialsPath, "utf8");
  const credentials = JSON.parse(raw);

  if (credentials.type === "service_account") {
    for (const key of ["client_email", "private_key", "token_uri"]) {
      if (!credentials[key]) {
        throw new Error(`credentials.json is missing ${key}`);
      }
    }

    return {
      authMode: "service_account",
      clientEmail: credentials.client_email,
      privateKey: credentials.private_key,
      tokenUri: credentials.token_uri,
    };
  }

  const oauth = credentials.installed || credentials.web;
  if (oauth) {
    const refreshToken = credentials.refresh_token || process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
    if (!refreshToken) {
      throw new Error("OAuth credentials are missing refresh_token. Add refresh_token to credentials.json or GOOGLE_DRIVE_REFRESH_TOKEN.");
    }

    for (const key of ["client_id", "client_secret", "token_uri"]) {
      if (!oauth[key]) {
        throw new Error(`credentials.json OAuth config is missing ${key}`);
      }
    }

    return {
      authMode: "oauth_refresh_token",
      clientId: oauth.client_id,
      clientSecret: oauth.client_secret,
      tokenUri: oauth.token_uri,
      refreshToken,
    };
  }

  throw new Error("credentials.json must contain either a service account key or OAuth web/installed credentials");
}

function parseDatabaseUrl(databaseUrl) {
  const parsed = new URL(databaseUrl);
  const database = parsed.pathname.replace(/^\//, "");

  if (!database) {
    throw new Error("DATABASE_URL must include a database name");
  }

  return {
    host: parsed.hostname,
    port: parsed.port || "5432",
    database,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  };
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parsePositiveInt(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

async function ensureDirectory(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function readJsonFile(file, fallbackValue) {
  try {
    const raw = await fsp.readFile(file, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") {
      return fallbackValue;
    }
    throw error;
  }
}

async function writeJsonFile(file, value) {
  await fsp.writeFile(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}

async function appendEvent(file, event) {
  await fsp.appendFile(file, `${JSON.stringify(event)}\n`, "utf8");
}

async function createDatabaseDump(config, now) {
  const stamp = formatTimestampForFile(now).replace(/[+:]/g, "-");
  const dumpPath = path.join(config.runtimeDir, `dump-${stamp}.sql`);
  const args = [
    "--format=plain",
    "--no-owner",
    "--no-privileges",
    "--host",
    config.database.host,
    "--port",
    config.database.port,
    "--username",
    config.database.user,
    "--dbname",
    config.database.database,
    "--file",
    dumpPath,
  ];

  log(`Running ${config.pgDumpCommand} for ${config.database.database}`);

  await new Promise((resolve, reject) => {
    const child = spawn(config.pgDumpCommand, args, {
      env: {
        ...process.env,
        PGPASSWORD: config.database.password,
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(new Error(`Failed to start ${config.pgDumpCommand}: ${error.message}`));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${config.pgDumpCommand} exited with code ${code}${stderr ? `: ${stderr.trim()}` : ""}`,
        ),
      );
    });
  });

  return dumpPath;
}

async function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);

    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function gzipFile(sourcePath, targetPath) {
  await new Promise((resolve, reject) => {
    const source = fs.createReadStream(sourcePath);
    const target = fs.createWriteStream(targetPath);
    const gzip = zlib.createGzip({ level: zlib.constants.Z_BEST_COMPRESSION });

    source.on("error", reject);
    target.on("error", reject);
    gzip.on("error", reject);
    target.on("finish", resolve);
    source.pipe(gzip).pipe(target);
  });
}

async function getAccessToken(credentials) {
  if (credentials.authMode === "oauth_refresh_token") {
    const response = await requestJson(credentials.tokenUri, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        refresh_token: credentials.refreshToken,
        grant_type: "refresh_token",
      }).toString(),
    });

    if (!response.access_token) {
      throw new Error("Failed to obtain Google access token from refresh token");
    }

    return response.access_token;
  }

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;

  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: credentials.clientEmail,
      scope: DRIVE_SCOPE,
      aud: credentials.tokenUri,
      exp,
      iat,
    }),
  );
  const assertionInput = `${header}.${payload}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(assertionInput)
    .sign(credentials.privateKey, "base64url");
  const assertion = `${assertionInput}.${signature}`;

  const response = await requestJson(credentials.tokenUri, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: TOKEN_GRANT_TYPE,
      assertion,
    }).toString(),
  });

  if (!response.access_token) {
    throw new Error("Failed to obtain Google access token");
  }

  return response.access_token;
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function ensureDriveFolder(token, folderName, parentId) {
  if (parentId) {
    const existingParent = await requestJson(
      `${DRIVE_API_BASE}/${parentId}?${new URLSearchParams({
        fields: "id,name,mimeType",
        supportsAllDrives: "true",
      }).toString()}`,
      {
        headers: driveHeaders(token),
      },
    );

    if (existingParent?.mimeType === "application/vnd.google-apps.folder") {
      return parentId;
    }

    throw new Error(`Configured Google Drive parent folder was not found or is not a folder: ${parentId}`);
  }

  const queryParts = [
    "mimeType = 'application/vnd.google-apps.folder'",
    `name = '${escapeDriveQuery(folderName)}'`,
    "trashed = false",
  ];

  const existing = await requestJson(
    `${DRIVE_API_BASE}?${new URLSearchParams({
      q: queryParts.join(" and "),
      fields: "files(id,name)",
      pageSize: "10",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    }).toString()}`,
    {
      headers: driveHeaders(token),
    },
  );

  if (existing.files && existing.files.length > 0) {
    return existing.files[0].id;
  }

  const created = await requestJson(`${DRIVE_API_BASE}?supportsAllDrives=true`, {
    method: "POST",
    headers: {
      ...driveHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });

  return created.id;
}

async function uploadFileToDrive(token, parentId, fileName, filePath, contentHash, now) {
  const metadata = {
    name: fileName,
    parents: [parentId],
    description: `sha256=${contentHash}; localTimestamp=${now.toString()}`,
  };
  const fileBuffer = await fsp.readFile(filePath);
  const boundary = `sadaham-backup-${Date.now()}`;
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        `${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\n` +
        "Content-Type: application/gzip\r\n\r\n",
      "utf8",
    ),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--`, "utf8"),
  ]);

  await requestJson(
    `${DRIVE_UPLOAD_BASE}?${new URLSearchParams({
      uploadType: "multipart",
      supportsAllDrives: "true",
    }).toString()}`,
    {
      method: "POST",
      headers: {
        ...driveHeaders(token),
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": String(body.length),
      },
      body,
    },
  );
}

async function cleanupExpiredBackups(token, rootFolderId, retentionMonths, now) {
  const cutoff = startOfLocalDay(subtractMonths(now, retentionMonths));
  const listed = await requestJson(
    `${DRIVE_API_BASE}?${new URLSearchParams({
      q: `'${rootFolderId}' in parents and trashed = false`,
      fields: "files(id,name,mimeType,createdTime)",
      pageSize: "1000",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    }).toString()}`,
    {
      headers: driveHeaders(token),
    },
  );

  for (const file of listed.files || []) {
    if (!shouldDeleteDriveItem(file, cutoff)) {
      continue;
    }

    log(`Deleting expired backup item ${file.name}`);
    await requestEmpty(`${DRIVE_API_BASE}/${file.id}?supportsAllDrives=true`, {
      method: "DELETE",
      headers: driveHeaders(token),
    });
  }
}

function shouldDeleteDriveItem(file, cutoff) {
  const folderDate = parseFolderDate(file.name);
  if (folderDate) {
    return folderDate < cutoff;
  }

  const createdTime = file.createdTime ? new Date(file.createdTime) : null;
  return createdTime ? createdTime < cutoff : false;
}

function parseFolderDate(name) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(name)) {
    return null;
  }

  const [year, month, day] = name.split("-").map((value) => Number.parseInt(value, 10));
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function driveHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

function escapeDriveQuery(value) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function formatLocalDay(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatTimestampForFile(date) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteMinutes = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absoluteMinutes / 60)).padStart(2, "0");
  const offsetRemainder = String(absoluteMinutes % 60).padStart(2, "0");

  return (
    `${formatLocalDay(date)}T` +
    `${String(date.getHours()).padStart(2, "0")}-` +
    `${String(date.getMinutes()).padStart(2, "0")}-` +
    `${String(date.getSeconds()).padStart(2, "0")}` +
    `${sign}${offsetHours}-${offsetRemainder}`
  );
}

function subtractMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() - months);
  return result;
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

async function getFileSize(filePath) {
  const stats = await fsp.stat(filePath);
  return stats.size;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

async function safeUnlink(filePath) {
  try {
    await fsp.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function requestJson(url, options = {}) {
  const { statusCode, body } = await request(url, options);
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`Request to ${url} failed with ${statusCode}: ${body.toString("utf8")}`);
  }

  return body.length ? JSON.parse(body.toString("utf8")) : {};
}

async function requestEmpty(url, options = {}) {
  const { statusCode, body } = await request(url, options);
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`Request to ${url} failed with ${statusCode}: ${body.toString("utf8")}`);
  }
}

async function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      method: options.method || "GET",
      headers: options.headers || {},
    };

    const req = https.request(url, requestOptions, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode || 0,
          body: Buffer.concat(chunks),
        });
      });
    });

    req.on("error", reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} ${message}`);
}

if (require.main === module) {
  runBackup({
    forceUpload: process.env.BACKUP_FORCE_UPLOAD === "true",
    forceReason: process.env.BACKUP_FORCE_REASON || "manual-force-push",
  }).catch((error) => {
    console.error(`${new Date().toISOString()} Backup failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  runBackup,
};