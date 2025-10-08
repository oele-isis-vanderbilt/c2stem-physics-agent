import axiosInstance from "@/services/Axios";

export default {
  async getUsers() {
    try {
      return await axiosInstance.get("app/logs/users", {
        withCredentials: true,
      });
    } catch (error) {
      return error;
    }
  },
  async getUserLogById(userId) {
    try {
      return await axiosInstance.get("app/logs/user/" + userId, {
        withCredentials: true,
      });
    } catch (error) {
      return error;
    }
  },
};
