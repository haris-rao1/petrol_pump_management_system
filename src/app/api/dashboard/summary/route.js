import { success, failure } from "@/lib/response";
import { authenticateRequest } from "@/lib/auth";
import { getDashboardSummary } from "@/services/dashboard-service";

export async function GET(request) {
  const user = await authenticateRequest(request);
  if (!user) {
    return failure("Unauthorized", 401);
  }

  const summary = await getDashboardSummary();
  return success(summary);
}