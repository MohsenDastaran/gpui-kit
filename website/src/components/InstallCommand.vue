<script setup lang="ts">
import { Check, Copy } from "lucide-vue-next";
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";

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

const command = computed(() => {
  if (!slug.value) return "";
  const runner =
    manager.value === "pnpm"
      ? "pnpm dlx"
      : manager.value === "bun"
        ? "bunx"
        : "npx";
  return `${runner} ${PACKAGE} add ${framework.value} ${slug.value}`;
});

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

function pageSlug() {
  const match = location.pathname.match(/\/component\/([^/]+)\/?$/);
  const value = match?.[1];
  return !value || value === "index" ? "" : value;
}

onMounted(() => {
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
          {{ name }}
        </button>
      </div>
      <div class="install-command__line">
        <code>{{ command }}</code>
        <button
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
