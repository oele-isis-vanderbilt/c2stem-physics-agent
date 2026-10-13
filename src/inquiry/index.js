import { createInquiryApi } from "./api";
import { createInquiryStore, eventBatches } from "./store";

/**
 * Adds the inquiry module to a host app. Nothing in src/inquiry imports the
 * app's own code; the app passes in what's needed here. `api` replaces the
 * real service, e.g. with the mock in ./mock.
 */
export function installInquiry({ store, baseURL, getToken, api }) {
  api = api || createInquiryApi({ baseURL, getToken });
  store.registerModule("inquiry", createInquiryStore(api));

  window.addEventListener("pagehide", () => {
    const inquiry = store.state.inquiry;
    const { session, unsaved, unsavedPosition } = inquiry;

    if (session) {
      store.commit("inquiry/logTyped");
      store.commit("inquiry/logStepView");
      store.commit("inquiry/logEvent", { type: "lesson_exit" });
    }
    const queued = inquiry.events;
    if (queued.length) {
      store.commit("inquiry/takeEvents");
      for (const [sessionId, events] of eventBatches(queued)) {
        api.logOnUnload(sessionId, events);
      }
    }

    if (!session || session.status === "completed") return;
    if (!Object.keys(unsaved).length && !unsavedPosition) return;
    api.saveOnUnload(session.id, {
      answers: unsaved,
      ...(unsavedPosition && { position: unsavedPosition }),
    });
  });
}
