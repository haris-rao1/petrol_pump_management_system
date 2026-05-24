import { success, failure } from "@/lib/response";
import { authenticateRequest } from "@/lib/auth";

export async function GET(request) {
  const user = await authenticateRequest(request);

  if (!user) {
    return failure("Unauthorized", 401);
  }

  return success({ user });
}