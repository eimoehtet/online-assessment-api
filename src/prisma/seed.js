require("dotenv").config();

const bcrypt = require("bcrypt");
const prisma = require("../config/prisma");

const users = [
  {
    name: "Admin User",
    email: "admin@lightlms.test",
    rawPassword: "Admin@123",
    role: "ADMIN",
    student_id: null,
    phone_number: "09110000001",
    date_of_birth: new Date("1990-01-15"),
    address: "Yangon, Myanmar",
  },
  {
    name: "Teacher User",
    email: "teacher@lightlms.test",
    rawPassword: "Teacher@123",
    role: "TEACHER",
    student_id: null,
    phone_number: "09110000002",
    date_of_birth: new Date("1992-06-10"),
    address: "Mandalay, Myanmar",
  },
  {
    name: "Student User",
    email: "student@lightlms.test",
    rawPassword: "Student@123",
    role: "STUDENT",
    student_id: "STU-0001",
    phone_number: "09110000003",
    date_of_birth: new Date("2004-09-05"),
    address: "Naypyidaw, Myanmar",
  },
];

async function seedUsers() {
  for (const user of users) {
    const password = await bcrypt.hash(user.rawPassword, 10);

    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        password,
        role: user.role,
        student_id: user.student_id,
        phone_number: user.phone_number,
        date_of_birth: user.date_of_birth,
        address: user.address,
      },
      create: {
        name: user.name,
        email: user.email,
        password,
        role: user.role,
        student_id: user.student_id,
        phone_number: user.phone_number,
        date_of_birth: user.date_of_birth,
        address: user.address,
      },
    });
  }
}

async function main() {
  await seedUsers();
  console.log("Seed completed. Test users are ready for login.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
