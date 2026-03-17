const { PrismaClient, Role } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { readFile } = require('fs/promises');
const path = require('path');

const prisma = new PrismaClient();

function normalizeAuMobile(input) {
  const digits = String(input || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('61')) {
    const rest = digits.slice(2);
    if (rest.startsWith('0')) return rest;
    if (rest.length === 9) return `0${rest}`;
    return rest;
  }
  if (digits.length === 9 && digits.startsWith('4')) {
    return `0${digits}`;
  }
  return digits;
}

function splitName(fullName) {
  const cleaned = String(fullName || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) {
    return { firstName: 'Unknown', lastName: '' };
  }
  const [firstName, ...rest] = cleaned.split(' ');
  return {
    firstName,
    lastName: rest.join(' '),
  };
}

function buildPlaceholderMobile(index) {
  return String(index).padStart(10, '0');
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    const row = { __line: index + 2 };
    headers.forEach((header, headerIndex) => {
      row[header] = values[headerIndex] || '';
    });
    return row;
  });
}

async function upsertSystemUser({ mobile, fullName, role, mainCollectorId, passwordHash }) {
  const { firstName, lastName } = splitName(fullName);
  const existing = await prisma.user.findUnique({
    where: { mobile },
  });

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        firstName,
        lastName,
        role,
        mainCollectorId: mainCollectorId ?? existing.mainCollectorId ?? existing.id,
        passwordHash,
        mustChangePassword: true,
        isActive: false,
      },
    });
  }

  return prisma.user.create({
    data: {
      mobile,
      firstName,
      lastName,
      role,
      passwordHash,
      mustChangePassword: true,
      isActive: false,
      mainCollectorId,
    },
  });
}

async function main() {
  const importFile = process.env.CUSTOMER_IMPORT_FILE || path.resolve(process.cwd(), 'prisma', 'customers2.csv');
  const defaultPassword = process.env.CUSTOMER_IMPORT_PASSWORD || 'temptestt!123A';

  const raw = await readFile(importFile, 'utf-8');
  const rows = parseCsv(raw).map((row) => ({
    line: row.__line,
    name: String(row.Name || '').trim(),
    mobile: normalizeAuMobile(row.Mobile || ''),
    userName: String(row.User || '').trim(),
    mainCollectorName: String(row['Main Collector'] || '').trim(),
  }));

  if (!rows.length) {
    throw new Error(`No rows found in ${importFile}.`);
  }

  const nameToRow = new Map();
  for (const row of rows) {
    if (!row.name || !row.mobile) {
      throw new Error(`Row ${row.line}: Name and Mobile are required.`);
    }
    if (nameToRow.has(row.name)) {
      throw new Error(`Duplicate Name "${row.name}" found. Names must be unique to resolve User/Main Collector.`);
    }
    nameToRow.set(row.name, row);
  }

  for (const row of rows) {
    if (!row.userName) {
      throw new Error(`Row ${row.line}: User is required.`);
    }
    if (!row.mainCollectorName) {
      throw new Error(`Row ${row.line}: Main Collector is required.`);
    }
  }

  const passwordHash = await bcrypt.hash(defaultPassword, 10);
  const mainCollectorUsers = new Map();
  const placeholderMobileByName = new Map();
  let placeholderIndex = 1;

  const getPlaceholderMobile = (name) => {
    if (!placeholderMobileByName.has(name)) {
      placeholderMobileByName.set(name, buildPlaceholderMobile(placeholderIndex));
      placeholderIndex += 1;
    }
    return placeholderMobileByName.get(name);
  };

  for (const mainCollectorName of new Set(rows.map((row) => row.mainCollectorName))) {
    const collector = await upsertSystemUser({
      mobile: getPlaceholderMobile(mainCollectorName),
      fullName: mainCollectorName,
      role: Role.ADMIN,
      passwordHash,
    });

    if (collector.mainCollectorId !== collector.id) {
      await prisma.user.update({
        where: { id: collector.id },
        data: { mainCollectorId: collector.id },
      });
      collector.mainCollectorId = collector.id;
    }

    mainCollectorUsers.set(mainCollectorName, collector);
  }

  const systemUsers = new Map(mainCollectorUsers);

  for (const userName of new Set(rows.map((row) => row.userName))) {
    if (systemUsers.has(userName)) {
      continue;
    }

    const mainCollector = mainCollectorUsers.get(
      rows.find((row) => row.userName === userName).mainCollectorName,
    );

    const editor = await upsertSystemUser({
      mobile: getPlaceholderMobile(userName),
      fullName: userName,
      role: Role.EDITOR,
      mainCollectorId: mainCollector.id,
      passwordHash,
    });

    systemUsers.set(userName, editor);
  }

  for (const row of rows) {
    const relatedUser = systemUsers.get(row.userName);
    await prisma.customer.upsert({
      where: { mobile: row.mobile },
      update: {
        name: row.name,
        deletedAt: null,
        updatedById: relatedUser.id,
      },
      create: {
        mobile: row.mobile,
        name: row.name,
        createdById: relatedUser.id,
        updatedById: relatedUser.id,
      },
    });
  }

  console.log(
    `Imported ${rows.length} customers, ${mainCollectorUsers.size} main collectors, and ${systemUsers.size} total system users.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
