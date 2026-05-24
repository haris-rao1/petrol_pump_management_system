export function success(data, status = 200) {
  return Response.json({ success: true, data }, { status });
}

export function failure(message, status = 400, details = null) {
  return Response.json({ success: false, message, details }, { status });
}