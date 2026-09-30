<script setup lang="ts">
import { Check, Copy } from "lucide-vue-next";
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { toggleLogos } from "../lib/toggle-logos.js";
import catalog from "../lib/registry-slugs.json" with { type: "json" };
import FlowText from "./FlowText.vue";

const MANAGERS = ["npx", "pnpm", "bun"] as const;
type Manager = (typeof MANAGERS)[number];

const STORAGE_KEY = "selected-package-manager";
const PACKAGE = "@dastaran/uni-kit@latest";

const props = defineProps<{
  lang?: "en" | "zh-CN";
}>();

const slug = ref("");
const manager = ref<Manager>("npx");
const framework = ref("gpui");
const copied = ref(false);
const status = ref("");
let timer: ReturnType<typeof setTimeout> | undefined;
let observer: MutationObserver | undefined;

const isManager = (value: unknown): value is Manager =>
  MANAGERS.includes(value as Manager);

const runner = computed(() =>
  manager.value === "pnpm"
    ? "pnpm dlx"
    : manager.value === "bun"
      ? "bunx"
      : "npx",
);

const namesFor = (name: string) =>
  (catalog as Record<string, string[]>)[name] ?? [];

/** A registry entry copies files into the app. GPUI Kit itself is the crate. */
const packaged = computed(() => namesFor(framework.value).includes(slug.value));
const crateInstall = computed(
  () => framework.value === "gpui" && !packaged.value,
);

const command = computed(() => {
  if (!slug.value) return "";
  if (packaged.value) {
    return `${runner.value} ${PACKAGE} add ${framework.value} ${slug.value}`;
  }
  if (crateInstall.value) return "cargo add gpui-kit";
  return "";
});

const unavailableLabel = computed(() =>
  props.lang === "zh-CN"
    ? "此框架没有可安装的组件文件。"
    : "No files to install for this framework.",
);
const crateLabel = computed(() =>
  props.lang === "zh-CN"
    ? "包含在 gpui-kit crate 中。"
    : "Ships in the gpui-kit crate.",
);

const copyLabel = computed(() =>
  props.lang === "zh-CN" ? "复制命令" : "Copy command",
);
const copiedLabel = computed(() =>
  props.lang === "zh-CN" ? "已复制" : "Copied",
);
const managerLabel = computed(() =>
  props.lang === "zh-CN" ? "包管理器" : "Package manager",
);

function readManager(): Manager {
  const stored = localStorage.getItem(STORAGE_KEY);
  return isManager(stored) ? stored : "npx";
}

function readFramework() {
  return document.documentElement.dataset.framework === "slint"
    ? "slint"
    : "gpui";
}

function onStorage(event: StorageEvent) {
  if (event.key === STORAGE_KEY && isManager(event.newValue))
    manager.value = event.newValue;
}

function mountFrameworkLogos() {
  document
    .querySelectorAll<HTMLButtonElement>("[data-framework-option]")
    .forEach((button) => {
      if (
        button.querySelector("svg") ||
        button.closest("[data-framework-select]")
      )
        return;
      const name = button.dataset.frameworkOption;
      const logo = name
        ? toggleLogos[name as keyof typeof toggleLogos]
        : undefined;
      if (!logo) return;
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "framework-switch__logo");
      svg.setAttribute("viewBox", logo.viewBox);
      svg.setAttribute("aria-hidden", "true");
      for (const path of logo.paths) {
        const el = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path",
        );
        el.setAttribute("d", path.d);
        el.setAttribute("fill", path.fill);
        if (path.accent)
          el.setAttribute("class", "framework-switch__logo-accent");
        svg.append(el);
      }
      button.prepend(svg);
    });
}

function pageSlug() {
  const match = location.pathname.match(/\/component\/([^/]+)\/?$/);
  const value = match?.[1];
  return !value || value === "index" ? "" : value;
}

onMounted(() => {
  mountFrameworkLogos();
  let host = document.querySelector<HTMLElement>(".install-command-host");
  if (!host) {
    const bar = document.querySelector(".doc-content .framework-bar");
    const value = pageSlug();
    if (!bar || !value) return;
    host = document.createElement("div");
    host.className = "install-command-host";
    host.dataset.installSlug = value;
    bar.insertBefore(host, bar.querySelector("[data-framework-status]"));
  }
  const page = host.dataset.installSlug;
  if (!page || page === "index") return;
  slug.value = page;
  manager.value = readManager();
  framework.value = readFramework();
  observer = new MutationObserver(() => {
    framework.value = readFramework();
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-framework"],
  });
  window.addEventListener("storage", onStorage);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  window.removeEventListener("storage", onStorage);
  clearTimeout(timer);
});

function select(next: Manager) {
  manager.value = next;
  localStorage.setItem(STORAGE_KEY, next);
}

function onKeydown(event: KeyboardEvent) {
  const step = {
    ArrowRight: 1,
    ArrowDown: 1,
    ArrowLeft: -1,
    ArrowUp: -1,
  }[event.key];
  const edge =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? MANAGERS.length - 1
        : undefined;
  if (step === undefined && edge === undefined) return;
  event.preventDefault();
  const index = MANAGERS.indexOf(manager.value);
  const next = edge ?? (index + step! + MANAGERS.length) % MANAGERS.length;
  select(MANAGERS[next]);
}

async function copy() {
  const text = command.value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
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
    if (!ok) return;
  }
  copied.value = true;
  status.value = "";
  await nextTick();
  status.value = copiedLabel.value;
  clearTimeout(timer);
  timer = setTimeout(() => {
    copied.value = false;
    status.value = "";
  }, 1600);
}
</script>

<template>
  <div class="install-command-mount">
    <span class="sr-only" role="status">{{ status }}</span>
    <Teleport v-if="slug" to=".install-command-host">
      <div
        v-if="packaged"
        class="install-command__switch framework-switch"
        role="radiogroup"
        :aria-label="managerLabel"
        :data-selected="manager"
        @keydown="onKeydown"
      >
        <span class="framework-switch__thumb" aria-hidden="true" />
        <button
          v-for="name in MANAGERS"
          :key="name"
          type="button"
          class="framework-switch__option install-command__option capitalize"
          role="radio"
          :aria-checked="manager === name"
          :tabindex="manager === name ? 0 : -1"
          @click="select(name)"
        >
          <svg
            class="framework-switch__logo"
            :viewBox="toggleLogos[name].viewBox"
            aria-hidden="true"
          >
            <path
              v-for="(path, index) in toggleLogos[name].paths"
              :key="index"
              :d="path.d"
              :fill="path.fill"
            />
          </svg>
          {{ name }}
        </button>
      </div>
      <div class="install-command__line">
        <div class="install-command__body">
          <p v-if="!packaged && !crateInstall" class="install-command__note">
            {{ unavailableLabel }}
          </p>
          <code v-if="packaged">
            <FlowText class="install-command__run" :text="runner" />
            <span class="install-command__package">{{ PACKAGE }}</span>
            <span>add</span>
            <FlowText class="install-command__arg" :text="framework" />
            <span class="install-command__arg">{{ slug }}</span>
          </code>
          <code v-else-if="crateInstall">
            <span class="install-command__run">cargo</span>
            <span>add</span>
            <span class="install-command__package">gpui-kit</span>
            <span class="install-command__comment"># {{ crateLabel }}</span>
          </code>
        </div>
        <button
          v-if="command"
          type="button"
          class="install-command__copy"
          :aria-label="copied ? copiedLabel : copyLabel"
          :title="copied ? copiedLabel : copyLabel"
          :data-copied="copied || null"
          @click="copy"
        >
          <Check v-if="copied" :size="14" aria-hidden="true" />
          <Copy v-else :size="14" aria-hidden="true" />
        </button>
      </div>
    </Teleport>
  </div>
</template>
