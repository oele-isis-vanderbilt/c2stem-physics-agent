import { createInquiryApi } from "./api";
import { createInquiryStore } from "./store";

/**
 * Adds the inquiry module to a host app. Nothing in src/inquiry imports the
 * app's own code; the app passes in what's needed here. `api` replaces the
 * real service, e.g. with the mock in ./mock.
 */
export function installInquiry({ store, baseURL, getToken, api }) {
  api = api || createInquiryApi({ baseURL, getToken });
  store.registerModule("inquiry", createInquiryStore(api));

  window.addEventListener("pagehide", () => {
    const { session, unsaved, unsavedPosition } = store.state.inquiry;
    if (!session || session.status === "completed") return;
    if (!Object.keys(unsaved).length && !unsavedPosition) return;
    api.saveOnUnload(session.id, {
      answers: unsaved,
      ...(unsavedPosition && { position: unsavedPosition }),
    });
  });
}
