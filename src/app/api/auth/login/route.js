import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import User from "@/models/User";
import { connectMongo } from "@/lib/mongodb";
import { issueAuthCookie, setAuthCookie } from "@/lib/auth";
import { failure, success } from "@/lib/response";
import { DEFAULT_ADMIN } from "@/lib/constants";
import { ensureDefaultAdmin } from "@/services/bootstrap-service";

export async function POST(request) {
  try {
    const body = await request.json();

    await connectMongo();
console.log(body.email, body.password);
    if (body.email === DEFAULT_ADMIN.email && body.password === DEFAULT_ADMIN.password) {
        console.log("Default admin login attempt detected");
      await ensureDefaultAdmin();
    }

    const user = await User.findOne({ email: body.email }).select("+password");

    if (!user) {
      return failure("Invalid email or password", 401);
    }

    const passwordValid = await bcrypt.compare(body.password, user.password);

    if (!passwordValid) {
      return failure("Invalid email or password", 401);
    }

    user.lastLoginAt = new Date();
    await user.save();

    const response = NextResponse.json(success({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    }));

    const token = await issueAuthCookie(user);
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