import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const CHECKLIST = [
  "Water-fed pole & brushes inspected",
  "Squeegees & scrapers accounted for",
  "Ladders secured / undamaged",
  "Vacuum / detail kit complete",
  "PPE (gloves, glasses, shoes) packed",
  "Chemicals sealed & labeled",
  "Vehicle inventory photo taken",
  "Customer keys / access cards returned",
];

const UPSELL_RULES = [
  {
    title: "Bi-annual plan",
    description: "Lock in 2 visits/year with $50 off each service.",
    tip: "Pitch after quoting exterior-only jobs over $200.",
    sortOrder: 1,
  },
  {
    title: "Inside + outside",
    description: "Upgrade to full-service inside/outside cleaning (×1.8).",
    tip: "Best after showing the exterior quote first.",
    sortOrder: 2,
  },
  {
    title: "Screen cleaning add-on",
    description: "Remove, wash, and reinstall screens — $5–8 per screen.",
    tip: "Offer when screens are dusty or pollen-heavy.",
    sortOrder: 3,
  },
  {
    title: "Track & sill detail",
    description: "Deep-clean window tracks and sills — flat $40–75.",
    tip: "Point out visible debris during the walkthrough.",
    sortOrder: 4,
  },
  {
    title: "Hard water stain treatment",
    description: "Specialized mineral stain removal on glass.",
    tip: "Identify etching vs. removable deposits before quoting.",
    sortOrder: 5,
  },
];

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@quickclean.local";
  const password = process.env.ADMIN_PASSWORD ?? "changeme123";
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: Role.ADMIN, active: true, name: "QuickClean Admin" },
    create: {
      email,
      passwordHash,
      name: "QuickClean Admin",
      role: Role.ADMIN,
      active: true,
    },
  });

  const existingTemplates = await prisma.checklistTemplate.count();
  if (existingTemplates === 0) {
    await prisma.checklistTemplate.createMany({
      data: CHECKLIST.map((label, i) => ({ label, sortOrder: i + 1 })),
    });
  }

  const existingRules = await prisma.upsellRule.count();
  if (existingRules === 0) {
    await prisma.upsellRule.createMany({ data: UPSELL_RULES });
  }

  console.log(`Seeded admin: ${email}`);
  console.log(`Checklist templates: ${CHECKLIST.length}`);
  console.log(`Upsell rules: ${UPSELL_RULES.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
