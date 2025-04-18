import axiosInstance from "@/services/Axios";

export default {
  async getAllUserConversations() {
    try {
      return await axiosInstance.post("app/api/conversations", {
        withCredentials: true,
      });
    } catch (error) {
      return error;
    }
  },
  async getUserConversationById(conversationId) {
    try {
      return await axiosInstance.post(
        "app/api/conversations/" + conversationId,
        {
          withCredentials: true,
        }
      );
    } catch (error) {
      return error;
    }
  },
};
