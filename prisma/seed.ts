import { PrismaClient, Role, CampaignState, SmsStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const nameSeeds = {
  first: [
    'Ava',
    'Liam',
    'Noah',
    'Mia',
    'Ethan',
    'Zoe',
    'Lucas',
    'Amelia',
    'Oliver',
    'Sophia',
    'Mason',
    'Isla',
    'Leo',
    'Grace',
    'Henry',
    'Nora',
    'Aria',
    'Elijah',
    'Chloe',
    'Jack',
  ],
  last: [
    'Patel',
    'Nguyen',
    'Williams',
    'Brown',
    'Singh',
    'Garcia',
    'Johnson',
    'Martin',
    'Davis',
    'Lopez',
    'Smith',
    'Khan',
    'Chen',
    'Wilson',
    'Taylor',
    'Anderson',
  ],
  streets: [
    'River Road',
    'King Street',
    'Sunset Ave',
    'Hillcrest Dr',
    'Maple Lane',
    'Oxford St',
    'Garden Walk',
    'Lakeside Blvd',
    'Market Street',
    'Highland Way',
  ],
  suburbs: [
    'Riverview',
    'Brookside',
    'Hillpark',
    'Seaview',
    'Greenfield',
    'Lakeshore',
    'Eastwood',
    'Westgate',
  ],
};

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260128);
const pick = (items: string[]) => items[Math.floor(rand() * items.length)];

function toLocalMobile(input: string) {
  if (!input) return input;
  const digits = input.replace(/\D/g, '');
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

async function normalizeExistingMobiles() {
  const users = await prisma.user.findMany({
    where: {
      OR: [{ mobile: { startsWith: '+61' } }, { mobile: { startsWith: '61' } }],
    },
  });
  for (const user of users) {
    const local = toLocalMobile(user.mobile);
    if (local && local !== user.mobile) {
      const existing = await prisma.user.findUnique({ where: { mobile: local } });
      if (!existing) {
        await prisma.user.update({ where: { id: user.id }, data: { mobile: local } });
      }
    }
  }

  const customers = await prisma.customer.findMany({
    where: {
      OR: [{ mobile: { startsWith: '+61' } }, { mobile: { startsWith: '61' } }],
    },
  });
  for (const customer of customers) {
    const local = toLocalMobile(customer.mobile);
    if (local && local !== customer.mobile) {
      const existing = await prisma.customer.findUnique({ where: { mobile: local } });
      if (!existing) {
        await prisma.customer.update({ where: { id: customer.id }, data: { mobile: local } });
      }
    }
  }

  const locations = await prisma.pickupLocation.findMany({
    where: {
      OR: [
        { distributorMobile: { startsWith: '+61' } },
        { distributorMobile: { startsWith: '61' } },
      ],
    },
  });
  for (const location of locations) {
    const local = toLocalMobile(location.distributorMobile);
    if (local && local !== location.distributorMobile) {
      await prisma.pickupLocation.update({
        where: { id: location.id },
        data: { distributorMobile: local },
      });
    }
  }

  const messages = await prisma.smsMessage.findMany({
    where: {
      OR: [{ toMobile: { startsWith: '+61' } }, { toMobile: { startsWith: '61' } }],
    },
  });
  for (const message of messages) {
    const local = toLocalMobile(message.toMobile);
    if (local && local !== message.toMobile) {
      await prisma.smsMessage.update({ where: { id: message.id }, data: { toMobile: local } });
    }
  }
}

async function main() {
  await normalizeExistingMobiles();
  const passwordHash = await bcrypt.hash('1234', 10);

  const [admin, editor1, editor2, viewer] = await Promise.all([
    prisma.user.upsert({
      where: { mobile: '0400000001' },
      update: {},
      create: {
        mobile: '0400000001',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        role: Role.ADMIN,
        passwordHash,
      },
    }),
    prisma.user.upsert({
      where: { mobile: '0400000002' },
      update: {},
      create: {
        mobile: '0400000002',
        email: 'editor1@example.com',
        firstName: 'Ed',
        lastName: 'One',
        role: Role.EDITOR,
        passwordHash,
      },
    }),
    prisma.user.upsert({
      where: { mobile: '0400000003' },
      update: {},
      create: {
        mobile: '0400000003',
        email: 'editor2@example.com',
        firstName: 'Ed',
        lastName: 'Two',
        role: Role.EDITOR,
        passwordHash,
      },
    }),
    prisma.user.upsert({
      where: { mobile: '0400000004' },
      update: {},
      create: {
        mobile: '0400000004',
        email: 'viewer@example.com',
        firstName: 'View',
        lastName: 'Only',
        role: Role.VIEWER,
        passwordHash,
      },
    }),
  ]);

  const campaign = await prisma.campaign.upsert({
    where: { id: 'starter-campaign' },
    update: {},
    create: {
      id: 'starter-campaign',
      name: 'Launch Week',
      state: CampaignState.STARTED,
      eventDate: new Date(),
    },
  });

  const pickupLocations = await Promise.all(
    Array.from({ length: 5 }).map((_, index) =>
      prisma.pickupLocation.upsert({
        where: { id: `loc-${index}` },
        update: {},
        create: {
          id: `loc-${index}`,
          name: `Community Hub ${index + 1}`,
          address: `${index + 1} Main Street`,
          distributorName: `Distributor ${index + 1}`,
          distributorMobile: `040000001${index}`,
        },
      }),
    ),
  );

  const customers = await Promise.all(
    Array.from({ length: 60 }).map((_, index) => {
      const firstName = pick(nameSeeds.first);
      const lastName = pick(nameSeeds.last);
      const streetNo = 10 + Math.floor(rand() * 890);
      const street = pick(nameSeeds.streets);
      const suburb = pick(nameSeeds.suburbs);
      return prisma.customer.upsert({
        where: { mobile: `0420000${String(index).padStart(3, '0')}` },
        update: {},
        create: {
          mobile: `0420000${String(index).padStart(3, '0')}`,
          firstName,
          lastName,
          address: `${streetNo} ${street}, ${suburb}`,
          createdById: admin.id,
          updatedById: admin.id,
        },
      });
    }),
  );

  await Promise.all(
    customers.map((customer, idx) =>
      prisma.order.upsert({
        where: { campaignId_customerId: { campaignId: campaign.id, customerId: customer.id } },
        update: {},
        create: {
          campaignId: campaign.id,
          customerId: customer.id,
          pickupLocationId: pickupLocations[idx % pickupLocations.length].id,
          chickenQty: (idx % 5) + 1,
          fishQty: idx % 2,
          vegQty: 1 + (idx % 3),
          eggQty: idx % 2,
          otherQty: 0,
          createdById: admin.id,
          updatedById: admin.id,
        },
      }),
    ),
  );

  await prisma.smsTemplate.upsert({
    where: { name: 'Order Confirmation' },
    update: {},
    create: { name: 'Order Confirmation', body: 'Hi {{firstName}}, your order is confirmed.' },
  });
  await prisma.smsTemplate.upsert({
    where: { name: 'Order Reminder' },
    update: {},
    create: {
      name: 'Order Reminder',
      body: 'Hi {{firstName}}, just a reminder about your order pickup.',
    },
  });
  await prisma.smsTemplate.upsert({
    where: { name: 'Thank You Note' },
    update: {},
    create: {
      name: 'Thank You Note',
      body: 'Hi {{firstName}}, thank you for your order!',
    },
  });

  await prisma.smsMessage.create({
    data: {
      toMobile: customers[0].mobile,
      body: 'Welcome to the service!',
      status: SmsStatus.SENT,
    },
  });

  console.log('Seed data created');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
