import axios from "axios";

const axiosInstance = axios.create({
  baseURL: process.env.VUE_APP_API_BASE_URL || "https://agent.c2-stem.org/",
});
export default axiosInstance;
