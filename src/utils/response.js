export function successResponse(res, data, message, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
  });
}

export function errorResponse(res, message, statusCode = 400) {
  return res.status(statusCode).json({
    success: false,
    message,
  });
}
