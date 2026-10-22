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

  // A request sent while the tab closes; keepalive lets it finish after the page is gone
  function onUnload(method, path, body) {
    fetch(`${baseURL}${path}`, {
      method,
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(body),
    });
  }

  return {
    catalog: () => http.get("/catalog").then(data),
    startSession: (lessonId) => http.post("/sessions", { lessonId }).then(data),
    saveSession: (id, body) => http.patch(`/sessions/${id}`, body).then(data),
    completeSession: (id) => http.post(`/sessions/${id}/complete`).then(data),
    logEvents: (id, events) =>
      http.post(`/sessions/${id}/events`, { events }).then(data),

    // Authoring (admins and researchers)
    lessons: () => http.get("/lessons").then(data),
    orderLessons: (ids) => http.put("/lessons/order", { ids }).then(data),
    setLessonHidden: (id, hidden) =>
      http.patch(`/lessons/${id}`, { hidden }).then(data),
    // Students' sessions: list them, and reset one (it is deleted)
    sessions: (params) => http.get("/sessions", { params }).then(data),
    resetSession: (id) => http.delete(`/sessions/${id}`).then(data),

    // Media (authors upload and list; anyone can fetch a file)
    uploadMedia(file, onProgress) {
      const form = new FormData();
      form.append("file", file);
      return http
        .post("/media", form, {
          onUploadProgress: (e) => {
            if (onProgress && e.total) onProgress(e.loaded / e.total);
          },
        })
        .then(data);
    },
    media: (kind) =>
      http.get("/media", { params: kind ? { kind } : {} }).then(data),
    mediaUrl: (id) => `${baseURL}/media/${encodeURIComponent(id)}`,

    // Research events, for the Logs page (authors)
    events: (params) => http.get("/events", { params }).then(data),
    eventStudents: (lessonId) =>
      http
        .get("/events/students", { params: lessonId ? { lessonId } : {} })
        .then(data),
    exportEvents: (params) =>
      http.get("/events/export", { params, responseType: "blob" }).then(data),
    createLesson: (title, fromLessonId) =>
      http
        .post("/lessons", { title, ...(fromLessonId && { fromLessonId }) })
        .then(data),
    draft: (id) => http.get(`/lessons/${id}/draft`).then(data),
    saveDraft: (id, draft, revision) =>
      http.put(`/lessons/${id}/draft`, { draft, revision }).then(data),
    validateDraft: (id, draft) =>
      http.post(`/lessons/${id}/validate`, { draft }).then(data),
    publish: (id) => http.post(`/lessons/${id}/publish`).then(data),
    versions: (id) => http.get(`/lessons/${id}/versions`).then(data),
    version: (id, n) => http.get(`/lessons/${id}/versions/${n}`).then(data),

    saveOnUnload: (id, body) => onUnload("PATCH", `/sessions/${id}`, body),
    logOnUnload: (id, events) =>
      onUnload("POST", `/sessions/${id}/events`, { events }),
  };
}
