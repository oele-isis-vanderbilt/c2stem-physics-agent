/**
 * The data table tool (@c2stem/data-plot) set up for this app: saves and logs
 * go to the agent server with the student's login token.
 */
import { createHttpAdapter } from "@c2stem/data-plot";
import axiosInstance from "@/services/Axios";
import Token from "@/services/Token";

export { getDataTable, dataTableLessons } from "./tasks";

export const dataTableApi = createHttpAdapter({
  baseURL: axiosInstance.defaults.baseURL,
  getToken: () => Token.getAccessToken(),
});

// Sends any waiting save and log events from the tools on the page; logout
// calls this before the login token is cleared
export async function flushDataTools() {
  const tools = Array.from(document.querySelectorAll("data-plot-tool"));
  try {
    await Promise.all(tools.map((tool) => tool.flush()));
  } catch (error) {
    console.error("[DataTool] Could not send the last save:", error);
  }
}
