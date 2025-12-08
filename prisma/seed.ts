import { PrismaClient, Role, CampaignState, SmsStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('1234', 10);

  const [admin, editor1, editor2, viewer] = await Promise.all([
    prisma.user.upsert({
      where: { mobile: '+61400000001' },
      update: {},
      create: {
        mobile: '+61400000001',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        role: Role.ADMIN,
        passwordHash,
      },
    }),
    prisma.user.upsert({
      where: { mobile: '+61400000002' },
      update: {},
      create: {
        mobile: '+61400000002',
        email: 'editor1@example.com',
        firstName: 'Ed',
        lastName: 'One',
        role: Role.EDITOR,
        passwordHash,
      },
    }),
    prisma.user.upsert({
      where: { mobile: '+61400000003' },
      update: {},
      create: {
        mobile: '+61400000003',
        email: 'editor2@example.com',
        firstName: 'Ed',
        lastName: 'Two',
        role: Role.EDITOR,
        passwordHash,
      },
    }),
    prisma.user.upsert({
      where: { mobile: '+61400000004' },
      update: {},
      create: {
        mobile: '+61400000004',
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
    create: { id: 'starter-campaign', name: 'Launch Week', state: CampaignState.STARTED },
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
          distributorMobile: `+6140000001${index}`,
        },
      }),
    ),
  );

  const customers = await Promise.all(
    Array.from({ length: 10 }).map((_, index) =>
      prisma.customer.upsert({
        where: { mobile: `+6141000001${index}` },
        update: {},
        create: {
          mobile: `+6141000001${index}`,
          firstName: `Customer ${index + 1}`,
          lastName: 'Sample',
          address: `${index + 1} Sample Street`,
          createdById: admin.id,
          updatedById: admin.id,
        },
      }),
    ),
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
          chickenQty: idx,
          fishQty: 0,
          vegQty: 1,
          eggQty: 0,
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
    where: { name: 'Campaign Blast' },
    update: {},
    create: { name: 'Campaign Blast', body: 'Hello! Check out our latest campaign offers.' },
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
