const PICK_DELAY = 800; // dropdowns and choices
const TYPING_DELAY = 5000; // typed answers save at most this often
const RETRY_DELAYS = [2000, 5000, 10000];

function emptyLesson() {
  return {
    lessonStatus: "idle", // idle | loading | ready | error
    session: null, // { id, lessonId, version, status, position, content, ... }
    answers: {}, // blockId -> value, what the screens show
    unsaved: {}, // blockId -> value, changed since the last save
    unsavedPosition: null,
    saveStatus: "saved", // saved | saving | retrying | loginRequired
  };
}

export function createInquiryStore(api) {
  let timer = null;
  let dueAt = 0;
  let retries = 0;
  let saving = Promise.resolve(); // saves run one at a time, in order

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
      } else {
        commit("setSaveStatus", "retrying");
        schedule(
          dispatch,
          RETRY_DELAYS[Math.min(retries++, RETRY_DELAYS.length - 1)]
        );
      }
    }
  }

  return {
    namespaced: true,
    state: () => ({ catalog: [], catalogStatus: "idle", ...emptyLesson() }),

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
          commit("setSession", await api.startSession(lessonId));
          commit("setLessonStatus", "ready");
        } catch (error) {
          commit("setLessonStatus", "error");
        }
      },

      /** `typing: true` for text boxes; they save less often. */
      setAnswer(
        { getters, commit, dispatch },
        { blockId, value, typing = false }
      ) {
        if (getters.readOnly) return;
        commit("setAnswer", { blockId, value });
        schedule(dispatch, typing ? TYPING_DELAY : PICK_DELAY);
      },

      /** Back/Next. Saves the new position along with any waiting answers. */
      goTo({ getters, commit, dispatch }, position) {
        if (getters.readOnly) {
          commit("showPosition", position); // reviewing; nothing to save
          return;
        }
        commit("setPosition", position);
        return dispatch("flush");
      },

      /** Save everything waiting now (leaving a text box, logout). Never throws. */
      flush(context) {
        saving = saving.then(() => send(context));
        return saving;
      },

      async complete({ state, getters, commit, dispatch }) {
        await dispatch("flush");
        if (getters.hasUnsaved) return false; // couldn't save; stay in progress
        commit("setSession", await api.completeSession(state.session.id));
        return true;
      },

      async closeLesson({ commit, dispatch }) {
        await dispatch("flush");
        clearTimeout(timer);
        timer = null;
        commit("resetLesson");
      },
    },
  };
}
