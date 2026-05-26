import { success, failure } from "@/lib/response";
import { authenticateRequest } from "@/lib/auth";
import { getReportData } from "@/services/report-service";

export async function GET(request) {
  const user = await authenticateRequest(request);
  if (!user) {
    return failure("Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const report = await getReportData({
    startDate: searchParams.get("startDate"),
    endDate: searchParams.get("endDate"),
    fuelType: searchParams.get("fuelType"),
    employee: searchParams.get("employee"),
    shift: searchParams.get("shift"),
  }, user.activePumpId);

  return success(report);
}