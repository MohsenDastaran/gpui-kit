<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  shallowRef,
  watch,
} from "vue";
import { RotateCw } from "lucide-vue-next";
import WindowZoomButton from "./WindowZoomButton.vue";

const props = defineProps<{
  frontmatter: {
    example?: string | false;
    exampleKind?: "base" | "component";
  };
  pathname: string;
  baseUrl: string;
  devVersion?: string;
  /** Frameworks besides GPUI with a live example of this component. */
  frameworks?: string[];
  lang?: "en" | "zh-CN";
}>();

const isDev = props.devVersion !== undefined;

const component = computed(() => {
  if (typeof props.frontmatter.example === "string") {
    return props.frontmatter.example;
  }
  if (props.frontmatter.example === false) return undefined;

  const match = props.pathname.match(
    /\/(?:component|base\/primitives)\/([^/]+)$/,
  );
  return match?.[1] === "index" ? undefined : match?.[1];
});

const pageSlug = computed(() => {
  const match = props.pathname.match(/\/component\/([^/]+)$/);
  return match?.[1] === "index" ? undefined : match?.[1];
});

const kind = computed(() =>
  props.frontmatter.exampleKind === "base" ||
  props.pathname.includes("/base/primitives/")
    ? "base"
    : "component",
);

const storyNames: Record<string, string> = {
  "alert-dialog": "AlertDialog",
  "color-picker": "ColorPicker",
  "data-table": "DataTable",
  "date-picker": "DatePicker",
  "description-list": "DescriptionList",
  dropdown_button: "DropdownButton",
  "focus-trap": "Dialog",
  "group-box": "GroupBox",
  "hover-card": "HoverCard",
  "input-group": "Input Group",
  "native-menu": "NativeMenu",
  notification: "Notification",
  "number-input": "NumberInput",
  "otp-input": "OtpInput",
  plot: "Chart",
  scrollable: "Scrollbar",
  "status-bar": "StatusBar",
  "text-view": "Editor",
  "title-bar": "Introduction",
  "virtual-list": "VirtualList",
};

const titleCase = (value: string) =>
  value
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

const storyName = computed(() =>
  component.value
    ? (storyNames[component.value] ?? titleCase(component.value))
    : undefined,
);

const src = computed(() => {
  if (!component.value) return undefined;
  const base = props.baseUrl.replace(/\/$/, "");
  if (kind.value === "base") {
    const query = new URLSearchParams({ component: component.value });
    if (props.devVersion) query.set("v", props.devVersion);
    return `${base}/examples/base?${query.toString()}`;
  }
  return `${base}/gallery?story=${encodeURIComponent(storyName.value ?? "")}`;
});

// Every framework the selector offers, with where its live example is served.
// GPUI is the fallback: base primitives and pages without a selector show it.
interface Framework {
  name: string;
  live: string;
  library: string;
  src: () => string | undefined;
}

const frameworkList: Record<string, Framework> = {
  gpui: {
    name: "GPUI",
    live: "Rust, GPUI & WASM",
    library: kind.value === "base" ? "gpui-base" : "gpui-component",
    src: () => src.value,
  },
  slint: {
    name: "Slint",
    live: "Rust, Slint & WASM",
    library: "Slint",
    src: () => {
      if (!pageSlug.value) return undefined;
      const base = props.baseUrl.replace(/\/$/, "");
      return `${base}/slint-gallery?component=${encodeURIComponent(pageSlug.value)}`;
    },
  },
};

const readFramework = () => {
  const value = document.documentElement.dataset.framework ?? "gpui";
  return value in frameworkList ? value : "gpui";
};

const selected = shallowRef("gpui");
const framework = computed(() =>
  kind.value === "component" ? selected.value : "gpui",
);
const available = computed(
  () =>
    framework.value === "gpui" ||
    (props.frameworks ?? []).includes(framework.value),
);
const active = computed(() => frameworkList[framework.value]);

// A frame stays mounted once opened, so switching back is instant.
const opened = reactive(new Set<string>());
const loaded = reactive(new Set<string>());
watch(
  [framework, available],
  ([name, ready]) => {
    if (ready) opened.add(name);
  },
  { immediate: true },
);

const frames = computed(() =>
  [...opened]
    .map((name) => ({ name, src: frameworkList[name].src() }))
    .filter((frame): frame is { name: string; src: string } =>
      Boolean(frame.src),
    ),
);

const windowTitle = computed(() => {
  if (!storyName.value) return "";
  const title =
    framework.value === "gpui"
      ? storyName.value
      : titleCase(pageSlug.value ?? "");
  return `${title} — ${active.value.library}`;
});

const missingLabel = computed(() =>
  props.lang === "zh-CN"
    ? `此组件暂无 ${active.value.name} 示例。`
    : `No ${active.value.name} example for this component yet.`,
);
const loadingLabel = computed(() =>
  props.lang === "zh-CN"
    ? `正在加载 ${active.value.name} 示例…`
    : `Loading the ${active.value.name} example…`,
);

const target = shallowRef<HTMLElement>();

// Zoom state
const zoomed = shallowRef(false);
const zoomLabel = computed(() =>
  zoomed.value ? "Restore window" : "Zoom window",
);
const reloadLabel = computed(() =>
  props.lang === "zh-CN" ? "重新加载示例" : "Reload example",
);

const exampleRoot = shallowRef<HTMLElement | null>(null);
let marked: HTMLElement[] = [];

function words(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function usageBlocks(): { heading: HTMLElement; code: HTMLElement }[] {
  const root = document.querySelector(".doc-content");
  const usage = root?.querySelector<HTMLElement>("#usage");
  if (!root || !usage) return [];
  const blocks: { heading: HTMLElement; code: HTMLElement }[] = [];
  let heading: HTMLElement | null = null;
  let seen = false;
  for (const node of root.querySelectorAll<HTMLElement>(
    "h2, h3, h4, h5, h6, .framework-code, pre",
  )) {
    if (node === usage) {
      seen = true;
      heading = null;
      continue;
    }
    if (!seen) continue;
    if (node.tagName === "H2") break;
    if (/^H[3-6]$/.test(node.tagName)) {
      heading = node;
      continue;
    }
    if (node.tagName === "PRE" && node.closest(".framework-code")) continue;
    blocks.push({ heading: heading ?? usage, code: node });
  }
  return blocks;
}

function markSource(heading: HTMLElement, code: HTMLElement) {
  for (const node of marked) node.classList.remove("is-example-source");
  marked = [heading, code];
  heading.classList.add("is-example-source");
  if (code !== heading) code.classList.add("is-example-source");
}

function scrollToSource(destination: HTMLElement) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  destination.scrollIntoView({
    behavior: reduce ? "auto" : "smooth",
    block: "start",
  });
  if (destination.id) {
    history.replaceState(null, "", `#${destination.id}`);
  }
}

function showExample(title: string, index: number | null) {
  const blocks = usageBlocks();
  const wanted = words(title);
  let match: (typeof blocks)[number] | undefined;
  if (wanted.length > 0) {
    const ranked = blocks
      .map((block) => {
        const heading = words(block.heading.textContent ?? "");
        const exact = heading.join(" ") === wanted.join(" ");
        const covered =
          !exact && wanted.every((word) => heading.includes(word));
        const score = exact ? 2 : covered ? 1 : 0;
        return { block, score, size: heading.length };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.size - b.size);
    match = ranked[0]?.block;
  }
  if (!match && index !== null && index >= 0 && index < blocks.length) {
    match = blocks[index];
  }
  if (!match) return;
  markSource(match.heading, match.code);
  scrollToSource(match.heading);
}

function onExampleMessage(event: MessageEvent) {
  if (event.origin !== window.location.origin) return;
  const frames = exampleRoot.value?.querySelectorAll("iframe");
  if (!frames) return;
  const fromExample = [...frames].some(
    (frame) => frame.contentWindow === event.source,
  );
  if (!fromExample) return;
  let payload: { source?: string; title?: unknown; index?: unknown } | null =
    null;
  if (typeof event.data === "string") {
    try {
      payload = JSON.parse(event.data);
    } catch {
      return;
    }
  } else if (event.data && typeof event.data === "object") {
    payload = event.data;
  }
  if (!payload || payload.source !== "gpui-kit") return;
  const title = typeof payload.title === "string" ? payload.title : "";
  const index = typeof payload.index === "number" ? payload.index : null;
  showExample(title, index);
}
const reloadNonce = reactive<Record<string, number>>({});

function reloadExample() {
  if (!available.value) return;
  const name = framework.value;
  loaded.delete(name);
  reloadNonce[name] = (reloadNonce[name] ?? 0) + 1;
}

function setZoomed(value: boolean) {
  zoomed.value = value;
  document.documentElement.classList.toggle("has-zoomed-window", value);
}

const createTargetAfterDescription = async () => {
  await nextTick();
  target.value?.remove();
  target.value = undefined;

  if (!src.value || props.frontmatter.example === false) return;
  const title = document.querySelector<HTMLElement>(".doc-content h1");
  const description = title?.nextElementSibling;
  if (!title) return;

  const mountPoint = document.createElement("div");
  mountPoint.className = "component-example-mount";
  const selector = document.querySelector<HTMLElement>(
    ".doc-content .framework-bar",
  );
  if (selector) {
    selector.after(mountPoint);
  } else if (description?.tagName === "P") {
    description.after(mountPoint);
  } else {
    title.after(mountPoint);
  }
  target.value = mountPoint;
};

let observer: MutationObserver | undefined;

onMounted(() => {
  window.addEventListener("message", onExampleMessage);
  selected.value = readFramework();
  observer = new MutationObserver(() => {
    selected.value = readFramework();
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-framework"],
  });
  createTargetAfterDescription();
});
onBeforeUnmount(() => {
  window.removeEventListener("message", onExampleMessage);
  observer?.disconnect();
  target.value?.remove();
  setZoomed(false);
});
</script>

<template>
  <Teleport v-if="target && src && frontmatter.example !== false" :to="target">
    <section
      id="live-example"
      ref="exampleRoot"
      class="component-example"
      :class="`component-example--${kind}`"
      data-pagefind-ignore
    >
      <div class="component-example__label">
        <span>Example</span>
        <span class="component-example__meta">
          <span class="component-example__live">{{ active.live }}</span>
        </span>
      </div>
      <div class="mac-window" :class="{ 'mac-window--zoomed': zoomed }">
        <div class="mac-window__bar">
          <span class="mac-window__lights">
            <i aria-hidden="true" /><i aria-hidden="true" /><button
              type="button"
              class="mac-window__zoom"
              :title="zoomLabel"
              :aria-label="zoomLabel"
              :aria-pressed="zoomed"
              @click="setZoomed(!zoomed)"
            />
          </span>
          <span class="mac-window__title">{{ windowTitle }}</span>
          <span class="mac-window__tools">
            <button
              type="button"
              class="mac-window__action"
              :title="reloadLabel"
              :aria-label="reloadLabel"
              :disabled="!available"
              @click="reloadExample"
            >
              <RotateCw :size="14" />
            </button>
            <WindowZoomButton
              :zoomed="zoomed"
              :label="zoomLabel"
              @click="setZoomed(!zoomed)"
            />
          </span>
        </div>
        <div class="component-example__frames">
          <iframe
            v-for="frame in frames"
            v-show="available && frame.name === framework"
            :key="`${frame.src}:${reloadNonce[frame.name] ?? 0}`"
            :src="frame.src"
            :class="`component-example__frame--${frame.name}`"
            :title="`${component} interactive example (${frameworkList[frame.name].name})`"
            allow="cross-origin-isolated"
            @load="loaded.add(frame.name)"
          />
          <div
            v-if="available && !loaded.has(framework)"
            class="component-example__status"
            role="status"
          >
            <span class="component-example__spinner" aria-hidden="true" />
            {{ loadingLabel }}
          </div>
          <div
            v-if="!available"
            class="component-example__status component-example__status--missing"
          >
            {{ missingLabel }}
          </div>
        </div>
      </div>
    </section>
  </Teleport>
</template>
