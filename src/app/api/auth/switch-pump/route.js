import { NextResponse } from "next/server";
import Pump from "@/models/Pump";
import User from "@/models/User";
import { connectMongo } from "@/lib/mongodb";
import { authenticateRequest, issueAuthCookie, setAuthCookie } from "@/lib/auth";
import { failure, success } from "@/lib/response";
import { isAdmin } from "@/lib/permissions";

export async function POST(request) {
  const user = await authenticateRequest(request);
  if (!user) {
    return failure("Unauthorized", 401);
  }

  if (!isAdmin(user.role)) {
    return failure("Forbidden", 403);
  }

  const body = await request.json();
  if (!body.pumpId) {
    return failure("Missing pumpId", 400);
  }

  await connectMongo();
  const pump = await Pump.findById(body.pumpId).lean();
  if (!pump) {
    return failure("Pump not found", 404);
  }

  await User.findByIdAndUpdate(user._id, { activePumpId: pump._id });

  const activePumpId = pump._id;
  const response = NextResponse.json(success({
    pump,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      pumpId: user.pumpId || null,
      activePumpId,
    },
  }));
  const token = await issueAuthCookie({ _id: user._id, email: user.email, role: user.role, name: user.name, pumpId: user.pumpId, activePumpId }, activePumpId);
  setAuthCookie(response, token);
  return response;
}
