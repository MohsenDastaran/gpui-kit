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
import { Check, RotateCw, Sparkles } from "lucide-vue-next";
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
const reloadLabel = computed(() => "Reload example");
const promptLabel = computed(() => "Copy Usage Prompt for AI");
const promptCopiedLabel = computed(() => "Copied");

const promptIds = shallowRef<string[]>([]);
const copiedPrompt = shallowRef<string | null>(null);
const promptStatus = shallowRef("");
let promptTimer: ReturnType<typeof setTimeout> | undefined;

function plainHeading(node: HTMLElement) {
  const clone = node.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".heading-anchor, .example-prompt").forEach((el) => {
    el.remove();
  });
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
}

function codeLanguage(pre: HTMLElement, name: string) {
  const data = pre.getAttribute("data-language");
  if (data) return data;
  const match = pre
    .querySelector("code")
    ?.className.match(/language-([\w+-]+)/);
  if (match) return match[1];
  return name === "slint" ? "slint" : "rust";
}

function samplePre(node: HTMLElement, name: string) {
  if (node.classList.contains("framework-code")) {
    return (
      node
        .querySelector<HTMLElement>(`[data-framework-panel="${name}"]`)
        ?.querySelector("pre") ?? null
    );
  }
  if (node.tagName === "PRE" && !node.closest(".framework-code")) return node;
  return null;
}

interface ExampleSample {
  headingId: string;
  title: string;
  lang: string;
  code: string;
}

function collectSamples(name: string): ExampleSample[] {
  const root = document.querySelector(".doc-content");
  if (!root) return [];
  const samples: ExampleSample[] = [];
  let heading: HTMLElement | null = null;
  let untitled = 0;
  for (const node of root.querySelectorAll<HTMLElement>(
    "h2, h3, h4, .framework-code, pre",
  )) {
    if (/^H[2-4]$/.test(node.tagName)) {
      heading = /^api reference\b/i.test(plainHeading(node)) ? null : node;
      continue;
    }
    const pre = samplePre(node, name);
    const code =
      pre?.querySelector("code")?.textContent?.replace(/\n$/, "") ?? "";
    if (!pre || !heading || !code.trim()) continue;
    if (!heading.id) {
      untitled += 1;
      heading.id = `example-${untitled}`;
    }
    samples.push({
      headingId: heading.id,
      title: plainHeading(heading),
      lang: codeLanguage(pre, name),
      code,
    });
  }
  return samples;
}

function iconFile(variant: string) {
  const kebab = variant
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
  return `icons/${kebab}.svg`;
}

function pathsIn(code: string, name: string) {
  const paths = new Set<string>();
  if (name === "slint") {
    for (const match of code.matchAll(/@image-url\("([^"]+)"\)/g)) {
      paths.add(match[1]);
    }
    for (const match of code.matchAll(/\bicon:\s*"([^"]+)"/g)) {
      paths.add(`icons/${match[1]}.svg`);
    }
    for (const match of code.matchAll(/from\s+"([^"]+\.slint)"/g)) {
      paths.add(match[1]);
    }
  } else {
    for (const match of code.matchAll(/IconName::([A-Za-z0-9]+)/g)) {
      paths.add(`${match[1]} → ${iconFile(match[1])}`);
    }
    for (const match of code.matchAll(/\.path\("([^"]+)"\)/g)) {
      paths.add(match[1]);
    }
  }
  return [...paths];
}

function tableText(table: Element) {
  return [...table.querySelectorAll("tr")]
    .map((row) =>
      [...row.querySelectorAll("th, td")]
        .map((cell) => (cell.textContent ?? "").replace(/\s+/g, " ").trim())
        .join(" | "),
    )
    .join("\n");
}

function blockText(node: Element) {
  if (node.tagName === "TABLE") return tableText(node);
  const chunks: string[] = [];
  if (node.children.length === 0) {
    return (node.textContent ?? "").replace(/[ \t]+\n/g, "\n").trim();
  }
  for (const child of node.children) {
    const text =
      child.tagName === "TABLE"
        ? tableText(child)
        : (child.textContent ?? "").replace(/[ \t]+\n/g, "\n").trim();
    if (text) chunks.push(text);
  }
  return chunks.join("\n\n");
}

function apiReference(name: string) {
  const root = document.querySelector(".doc-content");
  if (!root) return "";
  const headings = [...root.querySelectorAll<HTMLElement>("h2, h3, h4")].filter(
    (heading) => /^api reference\b/i.test(plainHeading(heading)),
  );
  return headings
    .map((heading) => {
      const rank = Number(heading.tagName[1]);
      const chunks = [plainHeading(heading)];
      let node = heading.nextElementSibling;
      while (node) {
        if (/^H[1-6]$/.test(node.tagName) && Number(node.tagName[1]) <= rank) {
          break;
        }
        if (node.classList.contains("framework-api")) {
          const panel = node.querySelector(`[data-framework-panel="${name}"]`);
          if (panel) chunks.push(blockText(panel));
        } else if (!node.closest(".framework-api")) {
          const text = blockText(node);
          if (text) chunks.push(text);
        }
        node = node.nextElementSibling;
      }
      return chunks.filter(Boolean).join("\n\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

function installCommand() {
  const line = document.querySelector(".install-command__line code");
  return (line?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function buildPrompt(samples: ExampleSample[], name: string) {
  const current = frameworkList[name];
  const pageTitle =
    document.querySelector(".doc-content h1")?.textContent?.trim() ??
    component.value ??
    "Example";
  const code = samples.map((sample) => sample.code).join("\n");
  const paths = pathsIn(code, name);
  const lines = [
    `Use this ${current.name} example in my application. Keep the framework, file layout, and API below; do not invent a different component or asset path.`,
    "",
    "## Framework",
    `${current.name} (${current.live}). Library: ${current.library}.`,
    "",
    "## Component",
    pageTitle,
    `Page: ${window.location.href.split("#")[0]}`,
  ];
  const command = installCommand();
  if (command) {
    lines.push("", "## Install", command);
  }
  lines.push("", "## Files");
  if (name === "slint") {
    lines.push(
      '- Installed components live in `ui/components`. That directory is on the Slint include path, so import by file name, for example `import { Button } from "button.slint";`.',
      "- Copy `icon.slint` together with an `icons/` folder. An icon name such as `search` loads `icons/search.svg`.",
    );
  } else {
    lines.push(
      `- Render the sample below. Its \`use\` lines are the modules it needs.`,
      "- `Cargo.toml`: `gpui-kit`, whose default features include `component` and `assets`.",
      kind.value === "base"
        ? "- This sample is a `gpui-base` primitive. Behavior comes from Base; presentation stays in the application or `gpui-component`."
        : "- UI components come from `gpui-component` through `gpui_kit::component`.",
    );
  }
  lines.push("", "## Default paths");
  if (name === "slint") {
    lines.push(
      "- Component file: `ui/components/<name>.slint`.",
      '- Icons and images: `icons/<name>.svg` beside `icon.slint`, referenced as `@image-url("icons/<name>.svg")`.',
    );
  } else {
    lines.push(
      "- Built-in icons: `icons/<name>.svg`, loaded by `gpui_kit::assets::Assets`. Register that source with `with_assets` before the first window. `IconName::Inbox` is `icons/inbox.svg`. Confirm a name with `IconName::path()` when it is not a simple word.",
      "- Icons outside the default set: select them with `icon_assets!` and register that source beside `Assets`.",
      "- Application files: `assets/icons/` and `assets/images/` next to `Cargo.toml`, served by your own `AssetSource`. A key such as `icons/brand-mark.svg` is relative to the `assets` folder.",
    );
  }
  if (paths.length > 0) {
    lines.push(
      "",
      "Paths used by this example:",
      ...paths.map((path) => `- ${path}`),
    );
  }
  lines.push("", "## Example");
  let previous = "";
  for (const sample of samples) {
    if (sample.title !== previous) {
      lines.push("", `### ${sample.title}`);
      previous = sample.title;
    }
    lines.push("", "```" + sample.lang, sample.code, "```");
  }
  const api = apiReference(name);
  if (api) {
    lines.push("", "## API Reference", "", api);
  }
  lines.push("", "## Also");
  if (name === "slint") {
    lines.push(
      "- Import installed components by file name from `ui/components`.",
      "- Keep icon SVGs in `icons/` next to `icon.slint`.",
      "- Use the Slint API Reference, not the GPUI Rust types.",
    );
  } else {
    lines.push(
      "- Call `gpui_kit::init(cx)` before creating any component.",
      "- The first view of every window is `Root`.",
      "- Stay on GPUI. Do not rewrite this sample as Slint.",
    );
  }
  return (
    lines
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim() + "\n"
  );
}

async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

async function copyPrompt(id: string) {
  const samples = collectSamples(framework.value);
  const chosen =
    id === "live-example"
      ? samples
      : samples.filter((sample) => sample.headingId === id);
  if (chosen.length === 0) return;
  const ok = await writeClipboard(buildPrompt(chosen, framework.value));
  if (!ok) return;
  copiedPrompt.value = id;
  promptStatus.value = "";
  await nextTick();
  promptStatus.value = promptCopiedLabel.value;
  clearTimeout(promptTimer);
  promptTimer = setTimeout(() => {
    if (copiedPrompt.value === id) copiedPrompt.value = null;
    promptStatus.value = "";
  }, 1600);
}

async function syncPrompts() {
  const ids = [
    ...new Set(
      collectSamples(framework.value).map((sample) => sample.headingId),
    ),
  ];
  for (const id of ids) {
    const heading = document.getElementById(id);
    if (!heading) continue;
    heading.dataset.examplePrompt = id;
    heading.classList.add("has-example-prompt");
  }
  promptIds.value = ids;
  await nextTick();
  document
    .querySelectorAll<HTMLElement>("[data-example-prompt]")
    .forEach((heading) => {
      if (ids.includes(heading.dataset.examplePrompt ?? "")) return;
      heading.classList.remove("has-example-prompt");
      delete heading.dataset.examplePrompt;
    });
}

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
  syncPrompts();
});
watch(framework, () => {
  syncPrompts();
});
onBeforeUnmount(() => {
  window.removeEventListener("message", onExampleMessage);
  observer?.disconnect();
  clearTimeout(promptTimer);
  document
    .querySelectorAll<HTMLElement>("[data-example-prompt]")
    .forEach((heading) => {
      heading.classList.remove("has-example-prompt");
      delete heading.dataset.examplePrompt;
    });
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
        <span class="component-example__heading">
          <span>Example</span>
          <button
            type="button"
            class="example-prompt"
            :aria-label="
              copiedPrompt === 'live-example' ? promptCopiedLabel : promptLabel
            "
            :title="
              copiedPrompt === 'live-example' ? promptCopiedLabel : promptLabel
            "
            :data-copied="copiedPrompt === 'live-example' || null"
            @click="copyPrompt('live-example')"
          >
            <Check
              v-if="copiedPrompt === 'live-example'"
              :size="13"
              aria-hidden="true"
            />
            <Sparkles v-else :size="13" aria-hidden="true" />
            {{
              copiedPrompt === "live-example" ? promptCopiedLabel : promptLabel
            }}
          </button>
        </span>
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
  <span class="sr-only" role="status">{{ promptStatus }}</span>
  <Teleport
    v-for="id in promptIds"
    :key="id"
    :to="`[data-example-prompt='${id}']`"
  >
    <button
      type="button"
      class="example-prompt"
      :aria-label="copiedPrompt === id ? promptCopiedLabel : promptLabel"
      :title="copiedPrompt === id ? promptCopiedLabel : promptLabel"
      :data-copied="copiedPrompt === id || null"
      @click.stop="copyPrompt(id)"
    >
      <Check v-if="copiedPrompt === id" :size="13" aria-hidden="true" />
      <Sparkles v-else :size="13" aria-hidden="true" />
      {{ copiedPrompt === id ? promptCopiedLabel : promptLabel }}
    </button>
  </Teleport>
</template>
