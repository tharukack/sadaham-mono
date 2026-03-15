const { PrismaClient, Role } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { readFile } = require('fs/promises');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const seedPath = path.resolve(process.cwd(), 'prisma', 'superadminseeder.json');
  const raw = await readFile(seedPath, 'utf-8');
  const parsed = JSON.parse(raw);

  const seedMobile = parsed.mobile;
  const seedPassword = parsed.password;

  if (!seedMobile || !seedPassword) {
    throw new Error('Missing mobile or password in superadminseeder.json.');
  }

  const passwordHash = await bcrypt.hash(seedPassword, 10);

  await prisma.user.upsert({
    where: { mobile: seedMobile },
    update: {
      role: Role.SUPERADMIN,
      passwordHash,
      isActive: true,
    },
    create: {
      mobile: seedMobile,
      firstName: parsed.firstName || 'Super',
      lastName: parsed.lastName || 'Admin',
      email: parsed.email ?? undefined,
      role: Role.SUPERADMIN,
      passwordHash,
      isActive: true,
    },
  });

  console.log('Seeded SUPERADMIN user');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
