const apiResponse = {
  success: (message, data = {}, meta = null) => {
    const response = { success: true, message, data };
    if (meta) response.meta = meta;
    return response;
  },
  error: (message, error = null) => {
    const response = { success: false, message };
    if (error !== null) response.error = error;
    return response;
  },
};

export default apiResponse;
