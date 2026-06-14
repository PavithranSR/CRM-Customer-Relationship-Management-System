import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_ADMIN_EMAIL = "admin@mattengg.com";
const DEFAULT_ADMIN_PASSWORD = "Matt@321admin";

async function main() {
  console.log("Seeding default admin user...");

  const adminPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
  const admin = await prisma.user.upsert({
    where: { email: DEFAULT_ADMIN_EMAIL },
    update: {
      password: adminPassword,
      name: "Admin",
      role: 'ADMIN' as any,
      department: "Management",
      position: "System Administrator",
      isActive: true,
    },
    create: {
      email: DEFAULT_ADMIN_EMAIL,
      password: adminPassword,
      name: "Admin",
      role: 'ADMIN' as any,
      department: "Management",
      position: "System Administrator",
      isActive: true,
    },
  });

  console.log("Default admin ready:", admin.email);
  console.log("\nLogin credentials:");
  console.log(`Admin: ${DEFAULT_ADMIN_EMAIL} / ${DEFAULT_ADMIN_PASSWORD}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
