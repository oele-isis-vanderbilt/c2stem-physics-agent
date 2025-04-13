import axios from "axios";

const axiosInstance = axios.create({
  // baseURL: "https://run.c2-stem.org/",
  baseURL: "http://localhost:8000/",
});
export default axiosInstance;
