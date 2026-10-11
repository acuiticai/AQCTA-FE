import requests from "./httpService";

const sendOTP = async (email, templateName = null) => {
  return requests.post(`/otp/send`, { email, templateName });
};

const verifyOTP = async (email, otp) => {
  return requests.post("/otp/verify", { email, otp });
};

export default { sendOTP, verifyOTP };
