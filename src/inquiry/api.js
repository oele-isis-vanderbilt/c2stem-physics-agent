import axios from "axios";

/** Calls to the inquiry service. Adds the login token to every request. */
export function createInquiryApi({ baseURL, getToken }) {
  const http = axios.create({ baseURL });
  http.interceptors.request.use((config) => {
    const token = getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  const data = (response) => response.data;

  return {
    catalog: () => http.get("/catalog").then(data),
    startSession: (lessonId) => http.post("/sessions", { lessonId }).then(data),
    saveSession: (id, body) => http.patch(`/sessions/${id}`, body).then(data),
    completeSession: (id) => http.post(`/sessions/${id}/complete`).then(data),

    /** Last save while the tab closes; keepalive lets it finish after the page is gone. */
    saveOnUnload(id, body) {
      fetch(`${baseURL}/sessions/${id}`, {
        method: "PATCH",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(body),
      });
    },
  };
}
