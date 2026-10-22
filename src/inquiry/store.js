const PICK_DELAY = 800; // dropdowns and choices
const TYPING_DELAY = 5000; // typed answers save at most this often
const RETRY_DELAYS = [2000, 5000, 10000];
const EVENT_DELAY = 5000; // events are sent at most this often
const EVENT_BATCH = 100; // the service takes up to 100 per request
const MAX_QUEUED_EVENTS = 500; // while offline; the oldest go first

function emptyLesson() {
  return {
    lessonStatus: "idle", // idle | loading | ready | error
    session: null, // { id, lessonId, version, status, position, content, ... }
    answers: {}, // blockId -> value, what the screens show
    unsaved: {}, // blockId -> value, changed since the last save
    unsavedPosition: null,
    saveStatus: "saved", // saved | saving | retrying | loginRequired | reset
  };
}

/** Queued events as [sessionId, events] batches the service accepts. */
export function eventBatches(queued) {
  const batches = [];
  for (const { sessionId, event } of queued) {
    const last = batches[batches.length - 1];
    if (last && last[0] === sessionId && last[1].length < EVENT_BATCH) {
      last[1].push(event);
    } else {
      batches.push([sessionId, [event]]);
    }
  }
  return batches;
}

export function createInquiryStore(api) {
  let timer = null;
  let dueAt = 0;
  let retries = 0;
  let saving = Promise.resolve(); // saves run one at a time, in order
  let eventTimer = null;
  let logging = Promise.resolve(); // event sends, separate from saves
  let shownAt = Date.now(); // when the current step appeared

  // Save after `delay`, unless a save is already due sooner.
  function schedule(dispatch, delay) {
    const due = Date.now() + delay;
    if (timer && dueAt <= due) return;
    clearTimeout(timer);
    dueAt = due;
    timer = setTimeout(() => {
      timer = null;
      dispatch("flush");
    }, delay);
  }

  async function send({ state, commit, dispatch }) {
    const { session, unsaved: answers, unsavedPosition: position } = state;
    if (!session || session.status === "completed") return;
    if (!Object.keys(answers).length && !position) return;

    clearTimeout(timer);
    timer = null;
    commit("takeUnsaved");
    commit("setSaveStatus", "saving");
    try {
      await api.saveSession(session.id, {
        answers,
        ...(position && { position }),
      });
      retries = 0;
      // Answers typed during the save are still waiting for the next one.
      const pending =
        Object.keys(state.unsaved).length || state.unsavedPosition;
      commit("setSaveStatus", pending ? "saving" : "saved");
    } catch (error) {
      commit("restoreUnsaved", { answers, position });
      const code = error.response && error.response.status;
      if (code === 401) {
        commit("setSaveStatus", "loginRequired");
      } else if (code === 409) {
        commit("markCompleted"); // finished in another tab; now read-only
      } else if (code === 404) {
        // A teacher reset this lesson: the session is gone, retrying won't help
        commit("setSaveStatus", "reset");
      } else {
        commit("setSaveStatus", "retrying");
        schedule(
          dispatch,
          RETRY_DELAYS[Math.min(retries++, RETRY_DELAYS.length - 1)]
        );
      }
    }
  }

  function scheduleEvents(dispatch, delay = EVENT_DELAY) {
    if (eventTimer) return;
    eventTimer = setTimeout(() => {
      eventTimer = null;
      dispatch("flushEvents");
    }, delay);
  }

  async function sendEvents({ state, commit, dispatch }) {
    clearTimeout(eventTimer);
    eventTimer = null;
    const queued = state.events;
    if (!queued.length) return;
    commit("takeEvents");
    const failed = [];
    for (const [sessionId, events] of eventBatches(queued)) {
      try {
        await api.logEvents(sessionId, events);
      } catch (error) {
        const code = error.response && error.response.status;
        // A gone session or a refused batch would fail the same way again
        if (code !== 404 && code !== 422) {
          failed.push(...events.map((event) => ({ sessionId, event })));
        }
      }
    }
    if (failed.length) {
      commit("restoreEvents", failed);
      scheduleEvents(dispatch, RETRY_DELAYS[RETRY_DELAYS.length - 1]);
    }
  }

  // Adds one event at the student's current step
  function queue(state, { type, blockId, data }) {
    const { session } = state;
    if (!session) return;
    const { pageId, stepId } = session.position;
    state.events.push({
      sessionId: session.id,
      event: {
        type,
        at: new Date().toISOString(),
        pageId,
        stepId,
        ...(blockId && { blockId }),
        data: data || {},
      },
    });
    const extra = state.events.length - MAX_QUEUED_EVENTS;
    if (extra > 0) state.events.splice(0, extra);
  }

  return {
    namespaced: true,
    state: () => ({
      catalog: [],
      catalogStatus: "idle",
      events: [], // [{ sessionId, event }] waiting to be sent; outlives the lesson
      typed: {}, // blockId -> typed answer, logged when the student leaves the box
      ...emptyLesson(),
    }),

    getters: {
      readOnly: (state) =>
        !state.session || state.session.status === "completed",
      hasUnsaved: (state) =>
        Object.keys(state.unsaved).length > 0 || !!state.unsavedPosition,
    },

    mutations: {
      setCatalog(state, catalog) {
        state.catalog = catalog;
      },
      setCatalogStatus(state, status) {
        state.catalogStatus = status;
      },
      setLessonStatus(state, status) {
        state.lessonStatus = status;
      },
      setSession(state, session) {
        state.session = session;
        state.answers = { ...session.answers };
      },
      setAnswer(state, { blockId, value }) {
        state.answers[blockId] = value;
        state.unsaved[blockId] = value;
      },
      setPosition(state, position) {
        state.session.position = position;
        state.unsavedPosition = position;
      },
      showPosition(state, position) {
        state.session.position = position;
      },
      takeUnsaved(state) {
        state.unsaved = {};
        state.unsavedPosition = null;
      },
      // Put back a failed batch without overwriting anything changed since.
      restoreUnsaved(state, { answers, position }) {
        state.unsaved = { ...answers, ...state.unsaved };
        state.unsavedPosition = state.unsavedPosition || position;
      },
      logEvent(state, event) {
        queue(state, event);
      },
      // Picks are logged now; typed text when the student leaves the box
      logAnswer(state, { blockId, value, typing }) {
        if (typing) {
          state.typed[blockId] = value;
        } else {
          delete state.typed[blockId];
          queue(state, { type: "answer", blockId, data: { value } });
        }
      },
      logTyped(state) {
        for (const [blockId, value] of Object.entries(state.typed)) {
          queue(state, { type: "answer", blockId, data: { value } });
        }
        state.typed = {};
      },
      // The step being left, and how long it was on screen
      logStepView(state) {
        const seconds = Math.round((Date.now() - shownAt) / 100) / 10;
        queue(state, { type: "step_view", data: { seconds } });
        shownAt = Date.now();
      },
      takeEvents(state) {
        state.events = [];
      },
      restoreEvents(state, failed) {
        state.events = [...failed, ...state.events].slice(-MAX_QUEUED_EVENTS);
      },
      setSaveStatus(state, status) {
        state.saveStatus = status;
      },
      markCompleted(state) {
        state.session.status = "completed";
        state.unsaved = {};
        state.unsavedPosition = null;
        state.saveStatus = "saved";
      },
      resetLesson(state) {
        Object.assign(state, emptyLesson());
      },
      reset(state) {
        Object.assign(state, {
          catalog: [],
          catalogStatus: "idle",
          events: [],
          typed: {},
          ...emptyLesson(),
        });
      },
    },

    actions: {
      async loadCatalog({ commit }) {
        commit("setCatalogStatus", "loading");
        try {
          commit("setCatalog", await api.catalog());
          commit("setCatalogStatus", "ready");
        } catch (error) {
          commit("setCatalogStatus", "error");
        }
      },

      /** Start the lesson, or resume where the student left off. */
      async openLesson({ state, commit, dispatch }, lessonId) {
        if (state.session && state.session.lessonId === lessonId) return;
        await dispatch("closeLesson");
        commit("setLessonStatus", "loading");
        try {
          const session = await api.startSession(lessonId);
          commit("setSession", session);
          commit("setLessonStatus", "ready");
          shownAt = Date.now();
          commit("logEvent", {
            type: "lesson_open",
            data: {
              status: session.status,
              answered: Object.keys(session.answers).length,
            },
          });
          scheduleEvents(dispatch);
        } catch (error) {
          commit("setLessonStatus", "error");
        }
      },

      /**
       * `typing: true` for text boxes; they save less often. `log: false`
       * for changes that get their own event (simulation runs) or that the
       * student didn't make (clearing stale picks).
       */
      setAnswer(
        { getters, commit, dispatch },
        { blockId, value, typing = false, log = true }
      ) {
        if (getters.readOnly) return;
        commit("setAnswer", { blockId, value });
        if (log) {
          commit("logAnswer", { blockId, value, typing });
          scheduleEvents(dispatch);
        }
        schedule(dispatch, typing ? TYPING_DELAY : PICK_DELAY);
      },

      /** A research event at the current step: { type, blockId?, data? }. */
      log({ commit, dispatch }, event) {
        commit("logEvent", event);
        scheduleEvents(dispatch);
      },

      /** The student left a text box: log what they typed and save it. */
      leave({ commit, dispatch }) {
        commit("logTyped");
        return dispatch("flush");
      },

      /** Back/Next. Saves the new position along with any waiting answers. */
      goTo({ getters, commit, dispatch }, position) {
        commit("logTyped");
        commit("logStepView");
        if (getters.readOnly) {
          commit("showPosition", position); // reviewing; nothing to save
          return dispatch("flushEvents");
        }
        commit("setPosition", position);
        return dispatch("flush");
      },

      /** Save and send everything waiting now. Never throws. */
      flush(context) {
        saving = saving.then(() => send(context));
        return Promise.all([saving, context.dispatch("flushEvents")]);
      },

      flushEvents(context) {
        logging = logging.then(() => sendEvents(context));
        return logging;
      },

      async complete({ state, getters, commit, dispatch }) {
        await dispatch("flush");
        if (getters.hasUnsaved) return false; // couldn't save; stay in progress
        commit("setSession", await api.completeSession(state.session.id));
        commit("logEvent", { type: "lesson_complete" });
        dispatch("flushEvents");
        return true;
      },

      async closeLesson({ state, commit, dispatch }) {
        if (state.session) {
          commit("logTyped");
          commit("logStepView");
          commit("logEvent", { type: "lesson_exit" });
        }
        await dispatch("flush");
        clearTimeout(timer);
        timer = null;
        commit("resetLesson");
      },
    },
  };
}
