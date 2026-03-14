import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const seedMobile = process.env.SEED_SUPERADMIN_MOBILE;
  const seedPassword = process.env.SEED_SUPERADMIN_PASSWORD;

  if (!seedMobile || !seedPassword) {
    throw new Error('Missing SEED_SUPERADMIN_MOBILE or SEED_SUPERADMIN_PASSWORD in env.');
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
      firstName: 'Super',
      lastName: 'Admin',
      role: Role.SUPERADMIN,
      passwordHash,
      isActive: true,
    },
  });

  console.log('Seeded SUPERADMIN user');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
