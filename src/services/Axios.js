import axios from "axios";

const axiosInstance = axios.create({
  // baseURL: "http://localhost:8000/",
  baseURL: "https://agent.c2-stem.org/",
});
export default axiosInstance;
