<template>
  <div class="lesson-editor" :style="fitStyle">
    <header class="editor-bar">
      <nav aria-label="Breadcrumb" class="crumbs">
        <button type="button" class="crumb-link" @click="$emit('list')">
          Authoring
        </button>
        <span class="crumb-sep" aria-hidden="true">/</span>
        <span class="crumb-current">{{ title }}</span>
      </nav>
      <span class="status" role="status">{{ statusLabel }}</span>
      <div class="actions">
        <button
          type="button"
          class="btn btn-sm btn-outline-purple"
          :disabled="!ready || !!viewing || !!syntaxError"
          @click="validate"
        >
          Validate
        </button>
        <button
          type="button"
          class="btn btn-sm btn-outline-purple"
          :disabled="!ready || !!viewing || !dirty || saving"
          @click="save"
        >
          Save
        </button>
        <button
          type="button"
          class="btn btn-sm btn-purple"
          :disabled="!ready || !!viewing || publishing"
          @click="publish"
        >
          {{ publishing ? "Publishing…" : "Publish" }}
        </button>
        <div class="versions">
          <button
            type="button"
            class="btn btn-sm btn-outline-purple"
            :aria-expanded="showVersions ? 'true' : 'false'"
            :disabled="!ready"
            @click="showVersions = !showVersions"
          >
            Versions ▾
          </button>
          <ul v-if="showVersions" class="versions-menu list-unstyled">
            <li v-if="!versions.length" class="versions-empty">
              Not published yet
            </li>
            <li v-for="v in versionsNewestFirst" :key="v.version">
              <button type="button" @click="viewVersion(v.version)">
                <strong>Version {{ v.version }}</strong>
                <span>{{ v.publishedBy }} · {{ when(v.publishedAt) }}</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </header>

    <div v-if="viewing" class="banner banner-info">
      Viewing version {{ viewing.version }}, read-only.
      <button
        type="button"
        class="btn btn-sm btn-purple ms-2"
        @click="restoreVersion"
      >
        Restore into draft
      </button>
      <button
        type="button"
        class="btn btn-sm btn-outline-purple ms-1"
        @click="viewing = null"
      >
        Back to draft
      </button>
    </div>
    <div v-if="conflict" class="banner banner-warn" role="alert">
      {{ conflict }}
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary ms-2"
        @click="copyMine"
      >
        Copy my JSON
      </button>
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary ms-1"
        @click="reloadTheirs"
      >
        Reload theirs
      </button>
    </div>
    <div
      v-if="message"
      class="banner"
      :class="message.ok ? 'banner-ok' : 'banner-warn'"
      role="status"
    >
      {{ message.text }}
      <button
        type="button"
        class="btn-close btn-sm ms-2"
        aria-label="Dismiss"
        @click="message = null"
      ></button>
    </div>

    <div v-if="loadError" class="banner banner-warn">
      Couldn't open this lesson.
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary ms-2"
        @click="load"
      >
        Retry
      </button>
    </div>
    <div v-else-if="!ready" class="text-center my-5">
      <div class="spinner-border" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>

    <template v-else>
      <div v-if="!wide" class="tabs" role="tablist">
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          role="tab"
          :aria-selected="tab === t.id ? 'true' : 'false'"
          :class="{ active: tab === t.id }"
          @click="pickTab(t.id)"
        >
          {{ t.label }}
        </button>
      </div>
      <div class="panes">
        <section v-show="wide || tab === 'json'" class="pane pane-json">
          <div class="json-area">
            <json-editor
              ref="json"
              :model-value="viewing ? viewing.text : text"
              :read-only="!!viewing"
              @update:model-value="text = $event"
              @save="save"
            />
          </div>
          <issues-panel
            v-if="wide"
            class="issues-area"
            :issues="issues"
            :syntax-error="syntaxError"
            :checking="checking"
            @pick="pick"
          />
        </section>
        <section v-show="wide || tab === 'preview'" class="pane pane-preview">
          <lesson-preview :content="previewContent" />
        </section>
        <section v-if="!wide" v-show="tab === 'issues'" class="pane">
          <issues-panel
            :issues="issues"
            :syntax-error="syntaxError"
            :checking="checking"
            @pick="pick"
          />
        </section>
      </div>
    </template>
  </div>
</template>

<script>
import { inquiryApi } from "../connection";
import IssuesPanel from "./IssuesPanel.vue";
import JsonEditor from "./JsonEditor.vue";
import LessonPreview from "./LessonPreview.vue";
import { parseJson, rangeOf } from "./jsonLocation";

const CHECK_DELAY = 1500; // validate this long after typing stops
const PREVIEW_DELAY = 600;
const MIN_HEIGHT = 480;
const WIDE = 992; // side by side from Bootstrap's lg

const show = (draft) => JSON.stringify(draft, null, 2);

function detailOf(error) {
  const detail =
    error.response && error.response.data && error.response.data.detail;
  return detail || {};
}

/**
 * Edits one lesson's draft as JSON beside a live preview. Save keeps the
 * draft; Publish freezes it as the next version. Emits list to go back.
 */
export default {
  name: "LessonEditor",
  components: { IssuesPanel, JsonEditor, LessonPreview },
  props: {
    lessonId: { type: String, required: true },
  },
  emits: ["list"],
  data() {
    return {
      ready: false,
      loadError: false,
      text: "",
      savedText: "",
      revision: 0,
      issues: null,
      checking: false,
      previewContent: null,
      versions: [],
      showVersions: false,
      viewing: null, // { version, text, content }
      saving: false,
      publishing: false,
      conflict: null,
      message: null,
      lastTitle: "",
      fitHeight: null,
      wide: window.innerWidth >= WIDE,
      tab: "json",
    };
  },
  computed: {
    parsed() {
      return parseJson(this.text);
    },
    syntaxError() {
      return this.viewing ? null : this.parsed.error || null;
    },
    dirty() {
      return this.ready && this.text !== this.savedText;
    },
    title() {
      // While the JSON has a syntax error, keep the last title that parsed
      const value = this.parsed.value;
      if (value) return value.title || "Untitled lesson";
      return this.lastTitle || "Untitled lesson";
    },
    latestVersion() {
      return this.versions.reduce((n, v) => Math.max(n, v.version), 0);
    },
    versionsNewestFirst() {
      return [...this.versions].sort((a, b) => b.version - a.version);
    },
    statusLabel() {
      if (!this.ready) return "";
      if (this.saving) return "Saving…";
      if (this.dirty) return "Unsaved changes";
      return this.latestVersion
        ? `Saved · version ${this.latestVersion} published`
        : "Saved · not published";
    },
    tabs() {
      const count = this.syntaxError ? 1 : (this.issues || []).length;
      return [
        { id: "json", label: "JSON" },
        { id: "preview", label: "Preview" },
        { id: "issues", label: count ? `Issues (${count})` : "Issues" },
      ];
    },
    fitStyle() {
      return this.fitHeight ? { height: `${this.fitHeight}px` } : {};
    },
  },
  watch: {
    title(title) {
      if (this.parsed.value) this.lastTitle = title;
    },
    text() {
      if (this.viewing) return;
      clearTimeout(this.checkTimer);
      clearTimeout(this.previewTimer);
      if (this.parsed.error) return;
      this.checkTimer = setTimeout(this.validate, CHECK_DELAY);
      this.previewTimer = setTimeout(() => {
        this.previewContent = this.parsed.value;
      }, PREVIEW_DELAY);
    },
    viewing(version) {
      this.previewContent = version ? version.content : this.parsed.value;
      this.showVersions = false;
    },
  },
  created() {
    this.api = inquiryApi();
  },
  mounted() {
    this.load();
    this.fit();
    window.addEventListener("resize", this.fit);
    window.addEventListener("beforeunload", this.warnUnsaved);
  },
  beforeUnmount() {
    clearTimeout(this.checkTimer);
    clearTimeout(this.previewTimer);
    window.removeEventListener("resize", this.fit);
    window.removeEventListener("beforeunload", this.warnUnsaved);
  },
  methods: {
    async load() {
      this.loadError = false;
      this.ready = false;
      try {
        const [draft, versions] = await Promise.all([
          this.api.draft(this.lessonId),
          this.api.versions(this.lessonId),
        ]);
        this.useDraft(draft);
        this.versions = versions;
        this.ready = true;
        this.$nextTick(this.fit);
      } catch (e) {
        this.loadError = true;
      }
    },
    useDraft(draft) {
      this.text = this.savedText = show(draft.draft);
      this.revision = draft.revision;
      this.previewContent = draft.draft;
      this.conflict = null;
    },
    fit() {
      this.wide = window.innerWidth >= WIDE;
      const top = this.$el.getBoundingClientRect().top + window.scrollY;
      this.fitHeight = Math.max(window.innerHeight - top, MIN_HEIGHT);
    },
    pickTab(id) {
      this.tab = id;
      // The player sizes itself to the window; let it measure once shown
      this.$nextTick(() => window.dispatchEvent(new Event("resize")));
    },
    warnUnsaved(event) {
      if (!this.dirty) return;
      event.preventDefault();
      event.returnValue = "";
    },
    async validate() {
      clearTimeout(this.checkTimer);
      if (this.parsed.error || this.viewing) return;
      const text = this.text;
      this.checking = true;
      try {
        const result = await this.api.validateDraft(
          this.lessonId,
          this.parsed.value
        );
        if (text === this.text) this.issues = result.issues;
      } catch (e) {
        this.message = {
          text: "Couldn't check the lesson. Try Validate again.",
        };
      } finally {
        this.checking = false;
      }
    },
    /** Saves the draft. Resolves to true when it's saved. */
    async save() {
      if (!this.dirty || this.saving || this.viewing) return !this.dirty;
      if (this.parsed.error) {
        this.message = { text: "Fix the JSON syntax error before saving." };
        this.pick(this.parsed.error);
        return false;
      }
      this.saving = true;
      const text = this.text;
      try {
        const saved = await this.api.saveDraft(
          this.lessonId,
          this.parsed.value,
          this.revision
        );
        this.revision = saved.revision;
        this.savedText = text;
        return true;
      } catch (e) {
        const code = e.response && e.response.status;
        if (code === 409) {
          this.conflict =
            detailOf(e).message || "Someone else saved this lesson.";
        } else {
          this.message = {
            text: "Couldn't save. Check your connection and try again.",
          };
        }
        return false;
      } finally {
        this.saving = false;
      }
    },
    async publish() {
      if (this.parsed.error) {
        this.message = { text: "Fix the JSON syntax error before publishing." };
        return;
      }
      if (!(await this.save())) return;
      const next = this.latestVersion + 1;
      const ok = window.confirm(
        this.latestVersion
          ? `Publish version ${next}? New students get it; students already in this lesson stay on version ${this.latestVersion}.`
          : "Publish version 1? Students will see this lesson in their list."
      );
      if (!ok) return;
      this.publishing = true;
      try {
        const version = await this.api.publish(this.lessonId);
        this.versions = [...this.versions, version];
        this.issues = [];
        this.message = {
          ok: true,
          text: `Published version ${version.version}.`,
        };
      } catch (e) {
        const code = e.response && e.response.status;
        const detail = detailOf(e);
        if (code === 422) {
          this.issues = detail.issues || [];
          this.message = { text: "Fix the issues listed before publishing." };
          if (!this.wide) this.tab = "issues";
        } else if (code === 409) {
          this.message = {
            text:
              typeof detail === "string" ? detail : "Nothing new to publish.",
          };
        } else {
          this.message = { text: "Couldn't publish. Try again." };
        }
      } finally {
        this.publishing = false;
      }
    },
    async viewVersion(n) {
      try {
        const version = await this.api.version(this.lessonId, n);
        this.message = null;
        this.viewing = {
          version: n,
          text: show(version.content),
          content: version.content,
        };
        if (!this.wide) this.tab = "json";
      } catch (e) {
        this.message = { text: `Couldn't open version ${n}.` };
      }
    },
    restoreVersion() {
      this.text = this.viewing.text;
      this.message = {
        ok: true,
        text: `Version ${this.viewing.version} copied into the draft. Save to keep it.`,
      };
      this.viewing = null;
    },
    pick(issue) {
      if (!this.wide) this.tab = "json";
      const range =
        issue.offset !== undefined ? issue : rangeOf(this.text, issue.path);
      if (range) {
        this.$nextTick(() =>
          this.$refs.json.select(range.offset, range.length)
        );
      }
    },
    async copyMine() {
      try {
        await navigator.clipboard.writeText(this.text);
        this.message = { ok: true, text: "Your JSON is on the clipboard." };
      } catch (e) {
        this.message = {
          text: "Couldn't copy. Select the text and copy it yourself.",
        };
      }
    },
    async reloadTheirs() {
      try {
        this.useDraft(await this.api.draft(this.lessonId));
        this.issues = null;
        this.message = { ok: true, text: "Loaded the latest saved draft." };
      } catch (e) {
        this.message = { text: "Couldn't reload the draft." };
      }
    },
    when(iso) {
      return new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    },
  },
};
</script>

<style scoped>
.lesson-editor {
  --inq-purple: #615195;
  --inq-purple-dark: #463a73;
  --inq-ink: #2e2645;
  --inq-tint: #f4f2f9;
  --inq-line: #ddd8ea;
  --inq-muted: #5c5670;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: #f1eff6;
}
.lesson-editor div {
  height: auto; /* App.vue sets height: 100% on every div */
}
.editor-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  padding: 10px 16px;
  background: #fff;
  border-bottom: 1px solid var(--inq-line);
}
.crumbs {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1 1 260px;
}
.crumb-link {
  border: 0;
  padding: 0;
  background: none;
  color: var(--inq-purple);
  text-decoration: underline;
}
.crumb-sep {
  color: var(--inq-muted);
}
.crumb-current {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.status {
  color: var(--inq-muted);
  font-size: 14px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.btn-purple {
  background: var(--inq-purple);
  border-color: var(--inq-purple);
  color: #fff;
}
.btn-purple:hover:not(:disabled) {
  background: var(--inq-purple-dark);
  color: #fff;
}
.btn-outline-purple {
  border-color: var(--inq-purple);
  color: var(--inq-purple);
}
.btn-outline-purple:hover:not(:disabled) {
  background: var(--inq-tint);
}
.versions {
  position: relative;
}
.versions-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 20;
  min-width: 240px;
  max-height: 320px;
  overflow-y: auto;
  margin: 0;
  background: #fff;
  border: 1px solid var(--inq-line);
  border-radius: 6px;
  box-shadow: 0 6px 20px rgba(46, 38, 69, 0.15);
}
.versions-menu button {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border: 0;
  background: none;
  text-align: left;
}
.versions-menu button:hover {
  background: var(--inq-tint);
}
.versions-menu span {
  display: block;
  font-size: 13px;
  color: var(--inq-muted);
}
.versions-empty {
  padding: 8px 12px;
  color: var(--inq-muted);
}
.banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  padding: 8px 16px;
  font-size: 14px;
  border-bottom: 1px solid var(--inq-line);
}
.banner-info {
  background: var(--inq-tint);
}
.banner-ok {
  background: #e7f4ec;
}
.banner-warn {
  background: #fdf1e3;
}
.tabs {
  display: flex;
  background: #fff;
  border-bottom: 1px solid var(--inq-line);
}
.tabs button {
  flex: 1 1 0;
  padding: 8px;
  border: 0;
  border-bottom: 3px solid transparent;
  background: none;
  color: var(--inq-muted);
}
.tabs button.active {
  border-bottom-color: var(--inq-purple);
  color: var(--inq-ink);
  font-weight: 600;
}
.panes {
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
}
.pane {
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.pane-json {
  padding: 8px;
  gap: 8px;
}
.json-area {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.json-area > * {
  flex: 1 1 auto;
  min-height: 0;
}
.issues-area {
  flex: 0 0 auto;
  height: 160px !important;
  border: 1px solid var(--inq-line);
  border-radius: 6px;
  background: #fff;
}
.pane-preview {
  border-left: 1px solid var(--inq-line);
}
.pane-preview > * {
  flex: 1 1 auto;
  min-height: 0;
}
</style>
