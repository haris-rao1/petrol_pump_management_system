import { connectMongo } from "@/lib/mongodb";
import { authenticateRequest } from "@/lib/auth";
import { success, failure } from "@/lib/response";
import * as AssetModule from "@/models/Asset";
const Asset = AssetModule.default || AssetModule.Asset || AssetModule;

function toCSV(items) {
  const headers = ["_id", "name", "category", "serialNumber", "purchaseDate", "purchasePrice", "currentValue", "location", "status", "createdAt"];
  if (!items?.length) {
    return headers.join(",");
  }
  const rows = items.map((item) => headers.map((key) => {
    const value = item[key] === undefined || item[key] === null ? "" : item[key];
    if (key === "purchaseDate" || key === "createdAt") {
      return new Date(value).toISOString();
    }
    return String(value).replace(/"/g, '""');
  }).map((cell) => `"${cell}"`).join(","));

  return `${headers.join(",")}\n${rows.join("\n")}`;
}

export async function GET(request) {
  const user = await authenticateRequest(request);
  if (!user) return failure("Unauthorized", 401);

  await connectMongo();
  const query = Asset.find({}).sort({ createdAt: -1 });
  const assets = await query.lean();
  const url = new URL(request.url);
  if (url.searchParams.get("download") === "csv") {
    const csv = toCSV(assets);
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=assets.csv",
      },
    });
  }

  return success(assets);
}

export async function POST(request) {
  const user = await authenticateRequest(request);
  if (!user) return failure("Unauthorized", 401);

  const body = await request.json();
  if (!body?.name) return failure("Asset name is required", 400);

  await connectMongo();
  const asset = new Asset({
    name: body.name,
    category: body.category || "",
    description: body.description || "",
    serialNumber: body.serialNumber || "",
    purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : undefined,
    purchasePrice: Number(body.purchasePrice || 0),
    currentValue: Number(body.currentValue || 0),
    location: body.location || "",
    status: body.status || "active",
    documents: Array.isArray(body.documents) ? body.documents : [],
    createdBy: user._id,
  });
  await asset.save();

  return success(asset, 201);
}
