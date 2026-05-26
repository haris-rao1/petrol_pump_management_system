import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import User from "@/models/User";
import { connectMongo } from "@/lib/mongodb";
import { issueAuthCookie, setAuthCookie } from "@/lib/auth";
import { failure, success } from "@/lib/response";
import { DEFAULT_ADMIN } from "@/lib/constants";
import { isAdmin } from "@/lib/permissions";
import { ensureDefaultAdmin, ensureDefaultPump } from "@/services/bootstrap-service";

export async function POST(request) {
  try {
    const body = await request.json();

    await connectMongo();
    if (body.email === DEFAULT_ADMIN.email && body.password === DEFAULT_ADMIN.password) {
      await ensureDefaultAdmin();
    }

    await ensureDefaultPump();

    const user = await User.findOne({ email: body.email }).select("+password pumpId");
    console.log("Login attempt for email:", body.email,user);
    if (!user) {
      return failure("Invalid email or password", 401);
    }

    const passwordValid = await bcrypt.compare(body.password, user.password);

    if (!passwordValid) {
      return failure("Invalid email or password", 401);
    }

    const isDefaultAdminCredentials = body.email === DEFAULT_ADMIN.email && body.password === DEFAULT_ADMIN.password;
    const adminLogin = isAdmin(user.role) || user.email === DEFAULT_ADMIN.email || isDefaultAdminCredentials;

    if (isDefaultAdminCredentials) {
      user.role = DEFAULT_ADMIN.role;
      user.pumpId = null;
      user.activePumpId = null;
    }

    if (!adminLogin && !user.pumpId) {
      return failure("This user is not assigned to any petrol pump", 400);
    }

    const activePumpId = adminLogin ? body.pumpId || null : user.pumpId || null;

    user.lastLoginAt = new Date();
    user.activePumpId = activePumpId || user.pumpId || null;
    await user.save();

    const response = NextResponse.json(success({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        pumpId: user.pumpId ? user.pumpId.toString() : null,
        activePumpId: activePumpId ? activePumpId.toString() : null,
      },
    }));

    const token = await issueAuthCookie(user, activePumpId);
    setAuthCookie(response, token);
    return response;
  } catch (error) {
    console.error("Login route failed:", error);
    return failure(
      error instanceof Error && error.message.includes("MONGODB_URI")
        ? "Database connection is not configured"
        : "Unable to sign in right now. Check MongoDB connectivity.",
      503,
    );
  }
}