/**
 * In-memory stand-in for the inquiry service, for trying the views without
 * running it. main.js only loads it when VUE_APP_INQUIRY_MOCK=true.
 * Serves copies of the service's example lessons. Progress and authoring
 * changes last until the page reloads.
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

// Other students' sessions, for the Student progress page (they match the seeded events)
const otherSessions = [
  {
    ...newSession(LESSONS[0], 4, "in_progress", 3),
    id: "mock-seed-student1",
    username: "student1",
  },
  {
    ...newSession(LESSONS[0], 2, "in_progress", 2),
    id: "mock-seed-student2",
    username: "student2",
  },
];
let resets = 0;

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

// Research events: a seeded history for two students in Lesson 1a, plus
// whatever the player logs in this tab.
const eventLog = [];
let eventCount = 0;

function storeEvent(fields) {
  eventCount += 1;
  eventLog.push({
    id: `mock-event-${eventCount}`,
    version: 1,
    receivedAt: fields.at,
    pageId: null,
    stepId: null,
    blockId: null,
    data: {},
    ...fields,
  });
}

function seedAnswer(block, n) {
  const pick = (options) => options[n % options.length].id;
  switch (block.type) {
    case "freeText":
      return `Answer ${n + 1} to ${block.key || block.id}`;
    case "choice":
    case "select":
      return block.options ? pick(block.options) : undefined;
    case "fillInBlanks":
      return Object.fromEntries(
        block.blanks.map((b) => [
          b.id,
          b.options ? pick(b.options) : `word ${n}`,
        ])
      );
    default:
      return undefined;
  }
}

(function seedEvents() {
  const { id: lessonId, content } = LESSONS[0];
  const inputs = content.variables.filter((v) => v.role === "input");
  const outputs = content.variables.filter((v) => v.role === "output");
  ["student1", "student2"].forEach((username, n) => {
    let time = Date.now() - (3 - n) * 3600 * 1000;
    const at = (seconds) => new Date((time += seconds * 1000)).toISOString();
    const base = { username, lessonId, sessionId: `mock-seed-${username}` };
    const first = content.pages[0];
    storeEvent({
      ...base,
      type: "lesson_open",
      at: at(0),
      pageId: first.id,
      stepId: first.steps[0].id,
      data: { status: "in_progress", answered: 0 },
    });
    for (const page of content.pages.slice(0, n ? 3 : 5)) {
      for (const step of page.steps) {
        const place = { pageId: page.id, stepId: step.id };
        for (const block of step.blocks) {
          const value = seedAnswer(block, n);
          if (value !== undefined) {
            storeEvent({
              ...base,
              ...place,
              type: "answer",
              blockId: block.id,
              at: at(20),
              data: { value },
            });
          }
          if (block.type === "simulation") {
            for (let run = 1; run <= 2; run++) {
              storeEvent({
                ...base,
                ...place,
                type: "sim_run",
                blockId: block.id,
                at: at(40),
                data: {
                  inputs: Object.fromEntries(
                    inputs.map((v) => [v.key, (v.default || 1) * run])
                  ),
                  outputs: Object.fromEntries(
                    outputs.map((v, i) => [v.key, 1.5 * run + i])
                  ),
                },
              });
            }
          }
        }
        storeEvent({
          ...base,
          ...place,
          type: "step_view",
          at: at(5),
          data: { seconds: 30 + 7 * n },
        });
      }
    }
  });
})();

function matchingEvents({ username, lessonId, sessionId, type } = {}) {
  return eventLog.filter(
    (e) =>
      (!username || e.username === username) &&
      (!lessonId || e.lessonId === lessonId) &&
      (!sessionId || e.sessionId === sessionId) &&
      (!type || e.type === type)
  );
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Uploaded media: id -> { meta, url }. Files stay in this tab as blob addresses.
const media = {};
const MB = 1024 * 1024;

/** The service's kinds and limits, from the browser's idea of the type. */
function mediaKind(file) {
  if (file.type === "image/gif") return { kind: "gif", limit: 10 * MB };
  if (/^image\/(png|jpeg|webp)$/.test(file.type)) {
    return { kind: "image", limit: 10 * MB };
  }
  if (/^video\/(mp4|webm)$/.test(file.type)) {
    return { kind: "video", limit: 100 * MB };
  }
  return null;
}

// Authoring: each example lesson starts with its content published as version 1
const authoring = Object.fromEntries(
  LESSONS.map(({ id, content }) => [
    id,
    {
      draft: copy(content),
      revision: 1,
      versions: [
        {
          version: 1,
          content: copy(content),
          draftRevision: 1,
          publishedBy: "seed",
          publishedAt: hoursAgo(72),
        },
      ],
      createdBy: "seed",
      createdAt: hoursAgo(72),
      updatedBy: "seed",
      updatedAt: hoursAgo(72),
    },
  ])
);
const BLOCK_TYPES = new Set([
  "text",
  "media",
  "freeText",
  "choice",
  "select",
  "fillInBlanks",
  "designTable",
  "hypotheses",
  "trialTable",
  "feedback",
  "simulation",
]);

/** The service's list order: ordered lessons first, then by title (2 before 10). */
function naturalKey(title) {
  return title
    .split(/(\d+)/)
    .map((part) => (/^\d+$/.test(part) ? Number(part) : part.toLowerCase()));
}

function compareLessons(a, b) {
  const place = (x) =>
    x.order === null || x.order === undefined ? Infinity : x.order;
  if (place(a) !== place(b)) return place(a) - place(b);
  const [ka, kb] = [naturalKey(a.title), naturalKey(b.title)];
  for (let i = 0; i < Math.min(ka.length, kb.length); i++) {
    if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1;
  }
  return ka.length - kb.length;
}

// A version without its content, as the service lists them
function summaryOf({ version, draftRevision, publishedBy, publishedAt }) {
  return { version, draftRevision, publishedBy, publishedAt };
}

function lessonDoc(id) {
  const doc = authoring[id];
  if (!doc) throw httpError(404);
  return doc;
}

function summary(id) {
  const doc = authoring[id];
  const latest = doc.versions[doc.versions.length - 1];
  return {
    id,
    title: doc.draft.title || "Untitled lesson",
    draftRevision: doc.revision,
    latestVersion: latest ? latest.version : null,
    publishedRevision: latest ? latest.draftRevision : null,
    hidden: !!doc.hidden,
    order: doc.order === undefined ? null : doc.order,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
    updatedBy: doc.updatedBy,
    updatedAt: doc.updatedAt,
  };
}

// A few of the service's checks, enough to try the issues list
function mockIssues(draft) {
  const issues = [];
  const issue = (path, message) => issues.push({ path, code: "mock", message });
  if (typeof draft.title !== "string" || !draft.title.trim()) {
    issue("title", "A lesson needs a title.");
  }
  if (!Array.isArray(draft.pages) || !draft.pages.length) {
    issue("pages", "A lesson needs at least one page.");
    return issues;
  }
  const ids = new Set();
  draft.pages.forEach((page, p) => {
    (page.steps || []).forEach((step, s) => {
      (step.blocks || []).forEach((block, b) => {
        const path = `pages/${p}/steps/${s}/blocks/${b}`;
        if (!BLOCK_TYPES.has(block.type)) {
          issue(`${path}/type`, `Unknown block type '${block.type}'.`);
        }
        if (ids.has(block.id)) {
          issue(`${path}/id`, `Id '${block.id}' is used more than once.`);
        }
        ids.add(block.id);
      });
    });
  });
  return issues;
}

export function createMockInquiryApi() {
  return {
    catalog() {
      const listed = LESSONS.filter(({ id }) => !authoring[id].hidden).sort(
        (a, b) =>
          compareLessons(
            { order: authoring[a.id].order, title: a.content.title },
            { order: authoring[b.id].order, title: b.content.title }
          )
      );
      return wait(
        listed.map(({ id, content }) => {
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
      // A hidden lesson can't be started; saved work in one resumes
      if (authoring[lessonId].hidden && !sessions[lessonId]) {
        return Promise.reject(httpError(404));
      }
      if (!sessions[lessonId]) {
        sessions[lessonId] = newSession(lesson, 0, "in_progress", 0);
        // A reset session's id is gone for good, as in the service
        if (resets) sessions[lessonId].id += `-${resets}`;
      }
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

    sessions({ lessonId, username, status } = {}) {
      const mine = Object.values(sessions).map((s) => ({
        ...s,
        username: "you",
      }));
      const rows = [...mine, ...otherSessions]
        .filter(
          (s) =>
            (!lessonId || s.lessonId === lessonId) &&
            (!username ||
              s.username.toLowerCase().includes(username.toLowerCase())) &&
            (!status || s.status === status)
        )
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
        .map((s) => {
          // Rows carry no answers or content, as in the service
          const row = { ...s, answered: Object.keys(s.answers).length };
          delete row.answers;
          delete row.content;
          return row;
        });
      return wait(rows);
    },

    resetSession(id) {
      const key = Object.keys(sessions).find((k) => sessions[k].id === id);
      const other = otherSessions.findIndex((s) => s.id === id);
      const session = key ? sessions[key] : otherSessions[other];
      if (!session) return Promise.reject(httpError(404));
      if (key) delete sessions[key];
      else otherSessions.splice(other, 1);
      resets += 1;
      storeEvent({
        username: session.username || "you",
        lessonId: session.lessonId,
        sessionId: id,
        type: "session_reset",
        at: new Date().toISOString(),
        data: { by: "you", status: session.status },
      });
      return wait(null);
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
      const session = byId(id);
      console.log("[mock inquiry] events", JSON.stringify(events));
      for (const event of events) {
        storeEvent({
          ...event,
          username: "you",
          sessionId: id,
          lessonId: session.lessonId,
          version: session.version,
          receivedAt: new Date().toISOString(),
        });
      }
      return wait({ stored: events.length });
    },

    events({ after, limit = 30, ...filters } = {}) {
      const sorted = matchingEvents(filters).sort(
        (a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id)
      );
      const start = after ? sorted.findIndex((e) => e.id === after) + 1 : 0;
      const page = sorted.slice(start, start + limit);
      const more = start + limit < sorted.length;
      return wait({
        events: page,
        total: sorted.length,
        next: more ? page[page.length - 1].id : null,
      });
    },

    eventStudents(lessonId) {
      const byUser = {};
      for (const e of matchingEvents({ lessonId })) {
        const row = (byUser[e.username] = byUser[e.username] || {
          username: e.username,
          events: 0,
          lastAt: e.at,
        });
        row.events += 1;
        if (e.at > row.lastAt) row.lastAt = e.at;
      }
      return wait(
        Object.values(byUser).sort((a, b) => b.lastAt.localeCompare(a.lastAt))
      );
    },

    exportEvents(filters) {
      const columns = [
        "at",
        "receivedAt",
        "username",
        "lessonId",
        "version",
        "sessionId",
        "type",
        "pageId",
        "stepId",
        "blockId",
        "data",
      ];
      const rows = matchingEvents(filters)
        .sort(
          (a, b) =>
            a.sessionId.localeCompare(b.sessionId) || a.at.localeCompare(b.at)
        )
        .map((e) =>
          columns
            .map((c) => csvCell(c === "data" ? JSON.stringify(e.data) : e[c]))
            .join(",")
        );
      const text = [columns.join(","), ...rows].join("\r\n") + "\r\n";
      return wait(null).then(() => new Blob([text], { type: "text/csv" }));
    },

    lessons() {
      return wait(Object.keys(authoring).map(summary).sort(compareLessons));
    },

    orderLessons(ids) {
      const all = Object.keys(authoring);
      const same =
        ids.length === all.length &&
        new Set(ids).size === ids.length &&
        ids.every((id) => authoring[id]);
      if (!same) return Promise.reject(httpError(409));
      ids.forEach((id, index) => (authoring[id].order = index));
      return this.lessons();
    },

    setLessonHidden(id, hidden) {
      lessonDoc(id).hidden = hidden;
      return wait(summary(id));
    },

    createLesson(title, fromLessonId) {
      const draft = fromLessonId
        ? { ...copy(lessonDoc(fromLessonId).draft), title }
        : {
            schemaVersion: 1,
            title,
            variables: [],
            pages: [
              {
                id: "page-1",
                phase: "Orientation",
                steps: [{ id: "step-1", blocks: [] }],
              },
            ],
          };
      const id = `mock-new-${Date.now()}`;
      const now = new Date().toISOString();
      authoring[id] = {
        draft,
        revision: 1,
        versions: [],
        createdBy: "you",
        createdAt: now,
        updatedBy: "you",
        updatedAt: now,
      };
      return wait(summary(id));
    },

    draft(id) {
      const doc = lessonDoc(id);
      return wait({
        id,
        draft: doc.draft,
        revision: doc.revision,
        updatedBy: doc.updatedBy,
        updatedAt: doc.updatedAt,
      });
    },

    saveDraft(id, draft, revision) {
      const doc = lessonDoc(id);
      if (revision !== doc.revision) {
        const error = httpError(409);
        error.response.data = {
          detail: {
            message: `${doc.updatedBy} saved this lesson after you opened it. Reload before saving.`,
          },
        };
        return Promise.reject(error);
      }
      doc.draft = copy(draft);
      doc.revision += 1;
      doc.updatedBy = "you";
      doc.updatedAt = new Date().toISOString();
      return this.draft(id);
    },

    validateDraft(id, draft) {
      lessonDoc(id);
      const issues = mockIssues(draft);
      return wait({ valid: !issues.length, issues });
    },

    publish(id) {
      const doc = lessonDoc(id);
      const latest = doc.versions[doc.versions.length - 1];
      const fail = (status, detail) => {
        const error = httpError(status);
        error.response.data = { detail };
        return Promise.reject(error);
      };
      if (
        latest &&
        JSON.stringify(latest.content) === JSON.stringify(doc.draft)
      ) {
        return fail(
          409,
          `No changes since version ${latest.version}; there is nothing new to publish.`
        );
      }
      const issues = mockIssues(doc.draft);
      if (issues.length) {
        return fail(422, {
          message: "Fix these problems before publishing.",
          issues,
        });
      }
      const version = {
        version: latest ? latest.version + 1 : 1,
        content: copy(doc.draft),
        draftRevision: doc.revision,
        publishedBy: "you",
        publishedAt: new Date().toISOString(),
      };
      doc.versions.push(version);
      // Students who start now get the new version
      const listed = LESSONS.find((l) => l.id === id);
      if (listed) listed.content = version.content;
      else LESSONS.push({ id, content: version.content });
      return wait({ lessonId: id, ...summaryOf(version) });
    },

    versions(id) {
      return wait(
        lessonDoc(id).versions.map((v) => ({ lessonId: id, ...summaryOf(v) }))
      );
    },

    version(id, n) {
      const version = lessonDoc(id).versions.find((v) => v.version === n);
      if (!version) return Promise.reject(httpError(404));
      return wait({ lessonId: id, ...version });
    },

    uploadMedia(file, onProgress) {
      const type = mediaKind(file);
      const fail = (status, detail) => {
        const error = httpError(status);
        error.response.data = { detail };
        return Promise.reject(error);
      };
      if (!type) {
        return fail(
          415,
          "Upload a PNG, JPEG, GIF or WebP picture, or an MP4 or WebM video."
        );
      }
      if (file.size > type.limit) {
        return fail(413, `That file is over ${type.limit / MB} MB.`);
      }
      const id = `mock-media-${Date.now().toString(36)}`;
      const meta = {
        id,
        kind: type.kind,
        contentType: file.type,
        size: file.size,
        filename: file.name,
        uploadedBy: "you",
        uploadedAt: new Date().toISOString(),
      };
      media[id] = { meta, url: URL.createObjectURL(file) };
      // A few progress steps, as a real upload would report
      [0.3, 0.7, 1].forEach((p, i) =>
        setTimeout(() => onProgress && onProgress(p), 150 * (i + 1))
      );
      return new Promise((resolve) => setTimeout(() => resolve(meta), 600));
    },

    media(kind) {
      return wait(
        Object.values(media)
          .map((m) => m.meta)
          .filter((m) => !kind || m.kind === kind)
          .reverse()
      );
    },

    mediaUrl(id) {
      return media[id] ? media[id].url : "";
    },

    saveOnUnload() {},
    logOnUnload() {},
  };
}
