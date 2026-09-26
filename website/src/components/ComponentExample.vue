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
import WindowZoomButton from "./WindowZoomButton.vue";

const props = defineProps<{
    frontmatter: {
        example?: string | false;
        exampleKind?: 'base' | 'component';
    };
    pathname: string;
    baseUrl: string;
    devVersion?: string;
    /** Frameworks besides GPUI with a live example of this component. */
    frameworks?: string[];
    lang?: 'en' | 'zh-CN';
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
    const base = props.baseUrl.replace(/\/$/, '');
    if (kind.value === "base") {
        const query = new URLSearchParams({ component: component.value });
        if (props.devVersion) query.set("v", props.devVersion);
        return `${base}/examples/base?${query.toString()}`;
    }
    return `${base}/gallery?story=${encodeURIComponent(storyName.value ?? '')}`;
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
        live: "Rust & WASM",
        library: kind.value === "base" ? "gpui-base" : "gpui-component",
        src: () => src.value,
    },
    slint: {
        name: "Slint",
        live: "Slint & WASM",
        library: "Slint",
        src: () => {
            if (!pageSlug.value) return undefined;
            const base = props.baseUrl.replace(/\/$/, '');
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
        .filter((frame): frame is { name: string; src: string } => Boolean(frame.src)),
);

const windowTitle = computed(() => {
    if (!storyName.value) return "";
    const title = framework.value === "gpui"
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
const zoomLabel = computed(() => zoomed.value ? "Restore window" : "Zoom window");

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
    const selector = document.querySelector<HTMLElement>(".doc-content .framework-bar");
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
    observer?.disconnect();
    target.value?.remove();
    setZoomed(false);
});
</script>

<template>
    <Teleport
        v-if="target && src && frontmatter.example !== false"
        :to="target"
    >
        <section
            class="component-example"
            :class="`component-example--${kind}`"
            data-pagefind-ignore
        >
            <div class="component-example__label">
                <span>Example</span>
                <span class="component-example__live">{{ active.live }}</span>
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
                    <WindowZoomButton
                        :zoomed="zoomed"
                        :label="zoomLabel"
                        @click="setZoomed(!zoomed)"
                    />
                </div>
                <div class="component-example__frames">
                    <iframe
                        v-for="frame in frames"
                        v-show="available && frame.name === framework"
                        :key="frame.src"
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
