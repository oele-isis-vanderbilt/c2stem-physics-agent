/**
 * In-memory stand-in for the inquiry service, for trying the views without
 * running it. main.js only loads it when VUE_APP_INQUIRY_MOCK=true.
 * Serves copies of the service's example lessons. Progress lasts until the
 * page reloads.
 */
import lesson1a from "./lessons/lesson-1a.json";
import lesson1b from "./lessons/lesson-1b.json";
import lesson2 from "./lessons/lesson-2.json";
import lesson3 from "./lessons/lesson-3.json";

const LESSONS = [
  { id: "mock-1a", content: lesson1a },
  { id: "mock-1b", content: lesson1b },
  { id: "mock-2", content: lesson2 },
  { id: "mock-3", content: lesson3 },
];

function hoursAgo(hours) {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

function newSession(lesson, pageIndex, status, updatedHoursAgo) {
  const page = lesson.content.pages[pageIndex];
  return {
    id: `session-${lesson.id}`,
    lessonId: lesson.id,
    version: 1,
    status,
    position: { pageId: page.id, stepId: page.steps[0].id },
    answers: {},
    content: lesson.content,
    startedAt: hoursAgo(updatedHoursAgo + 1),
    updatedAt: hoursAgo(updatedHoursAgo),
    completedAt: status === "completed" ? hoursAgo(updatedHoursAgo) : null,
  };
}

// One lesson part-way through and one finished, so every card state shows.
const sessions = {
  "mock-1a": newSession(LESSONS[0], 3, "in_progress", 2),
  "mock-2": newSession(LESSONS[2], 6, "completed", 48),
};

const copy = (value) => JSON.parse(JSON.stringify(value));
const wait = (value) =>
  new Promise((resolve) => setTimeout(() => resolve(copy(value)), 400));

function httpError(status) {
  const error = new Error(`Mock inquiry service: ${status}`);
  error.response = { status };
  return error;
}

function byId(id) {
  const session = Object.values(sessions).find((s) => s.id === id);
  if (!session) throw httpError(404);
  return session;
}

export function createMockInquiryApi() {
  return {
    catalog() {
      return wait(
        LESSONS.map(({ id, content }) => {
          const s = sessions[id];
          return {
            id,
            title: content.title,
            description: content.description || "",
            progress: s && {
              sessionId: s.id,
              status: s.status,
              page:
                content.pages.findIndex((p) => p.id === s.position.pageId) + 1,
              pageCount: content.pages.length,
              updatedAt: s.updatedAt,
              completedAt: s.completedAt,
            },
          };
        })
      );
    },

    startSession(lessonId) {
      const lesson = LESSONS.find((l) => l.id === lessonId);
      if (!lesson) return Promise.reject(httpError(404));
      sessions[lessonId] =
        sessions[lessonId] || newSession(lesson, 0, "in_progress", 0);
      return wait(sessions[lessonId]);
    },

    saveSession(id, { answers, position }) {
      const session = byId(id);
      if (session.status === "completed") return Promise.reject(httpError(409));
      console.log("[mock inquiry] save", { answers, position });
      for (const [blockId, value] of Object.entries(answers)) {
        if (value === null) delete session.answers[blockId];
        else session.answers[blockId] = value;
      }
      if (position) session.position = position;
      session.updatedAt = new Date().toISOString();
      return wait({ position: session.position, updatedAt: session.updatedAt });
    },

    completeSession(id) {
      const session = byId(id);
      if (session.status !== "completed") {
        session.status = "completed";
        session.completedAt = new Date().toISOString();
      }
      return wait(session);
    },

    logEvents(id, events) {
      byId(id);
      console.log("[mock inquiry] events", JSON.stringify(events));
      return wait({ stored: events.length });
    },

    saveOnUnload() {},
    logOnUnload() {},
  };
}
