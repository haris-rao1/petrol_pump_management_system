import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import User from "@/models/User";
import { connectMongo } from "@/lib/mongodb";
import { signAuthToken, verifyAuthToken } from "@/lib/jwt";

export const AUTH_COOKIE_NAME = "petrol_pump_token";

function toSerializableUser(user) {
  if (!user) {
    return null;
  }

  return {
    _id: user._id?.toString?.() || String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    pumpId: user.pumpId ? user.pumpId.toString() : null,
    activePumpId: user.activePumpId ? user.activePumpId.toString() : null,
  };
}

export async function issueAuthCookie(user, activePumpId = null) {
  return signAuthToken({
    sub: user._id.toString(),
    email: user.email,
    role: user.role,
    name: user.name,
    pumpId: user.pumpId ? user.pumpId.toString() : null,
    activePumpId: activePumpId ? activePumpId.toString() : user.activePumpId ? user.activePumpId.toString() : user.pumpId ? user.pumpId.toString() : null,
  });
}

export function setAuthCookie(response, token) {
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearAuthCookie(response) {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const payload = await verifyAuthToken(token);
    await connectMongo();
    const user = await User.findById(payload.sub).select("name email role status pumpId activePumpId").lean();
    if (!user) {
      return null;
    }

    return {
      ...toSerializableUser(user),
      activePumpId: payload.activePumpId || user.activePumpId?.toString?.() || user.pumpId?.toString?.() || null,
    };
  } catch {
    return null;
  }
}

export async function authenticateRequest(request) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const payload = await verifyAuthToken(token);
    await connectMongo();
    const user = await User.findById(payload.sub).select("name email role status pumpId activePumpId").lean();
    if (!user) {
      return null;
    }

    return {
      ...toSerializableUser(user),
      activePumpId: payload.activePumpId || user.activePumpId?.toString?.() || user.pumpId?.toString?.() || null,
    };
  } catch {
    return null;
  }
}

export function requireUser(user) {
  if (!user) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  return null;
}