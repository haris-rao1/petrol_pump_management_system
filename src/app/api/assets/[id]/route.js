import { connectMongo } from "@/lib/mongodb";
import { authenticateRequest } from "@/lib/auth";
import { success, failure } from "@/lib/response";
import * as AssetModule from "@/models/Asset";
const Asset = AssetModule.default || AssetModule.Asset || AssetModule;

export async function GET(request, { params }) {
  const user = await authenticateRequest(request);
  if (!user) return failure("Unauthorized", 401);

  const { id } = await params;
  await connectMongo();
  const asset = await Asset.findById(id).lean();
  if (!asset) return failure("Asset not found", 404);
  return success(asset);
}

export async function PATCH(request, { params }) {
  const user = await authenticateRequest(request);
  if (!user) return failure("Unauthorized", 401);

  const { id } = await params;
  const body = await request.json();
  await connectMongo();
  const asset = await Asset.findById(id);
  if (!asset) return failure("Asset not found", 404);

  const fields = ["name", "category", "description", "serialNumber", "purchaseDate", "purchasePrice", "currentValue", "location", "status", "documents"];
  for (const key of fields) {
    if (body[key] !== undefined) {
      asset[key] = key === "purchaseDate" ? (body[key] ? new Date(body[key]) : undefined) : body[key];
    }
  }

  await asset.save();
  return success(asset);
}

export async function DELETE(request, { params }) {
  const user = await authenticateRequest(request);
  if (!user) return failure("Unauthorized", 401);

  const { id } = await params;
  await connectMongo();
  const asset = await Asset.findById(id);
  if (!asset) return failure("Asset not found", 404);
  await asset.deleteOne();

  return success({});
}
