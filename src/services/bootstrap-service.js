import bcrypt from "bcryptjs";
import User from "@/models/User";
import { connectMongo } from "@/lib/mongodb";
import { DEFAULT_ADMIN } from "@/lib/constants";

export async function ensureDefaultAdmin() {
  await connectMongo();

  const existingUserCount = await User.countDocuments();
console.log("Existing user count:", existingUserCount);
  if (existingUserCount > 0) {
    return null;
  }

  const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN.password, 12);

  return User.create({
    name: DEFAULT_ADMIN.name,
    email: DEFAULT_ADMIN.email,
    password: hashedPassword,
    role: DEFAULT_ADMIN.role,
    status: "Active",
  });
}