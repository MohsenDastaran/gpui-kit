<script setup lang="ts">
import { Check, Copy } from "lucide-vue-next";
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";

const props = defineProps<{
    copyLabel: string;
    copiedLabel: string;
}>();

const blocks = ref<number[]>([]);
const copiedId = ref<number | null>(null);
const status = ref("");
let timer: ReturnType<typeof setTimeout> | undefined;
const hosts: HTMLElement[] = [];

onMounted(() => {
    let next = 0;
    document.querySelectorAll<HTMLElement>(".doc-content pre").forEach((pre) => {
        if (pre.closest(".code-block")) return;
        const host = document.createElement("div");
        host.className = "code-block";
        host.dataset.codeBlock = String(next);
        pre.parentNode?.insertBefore(host, pre);
        host.appendChild(pre);
        hosts.push(host);
        blocks.value.push(next);
        next += 1;
    });
});

onBeforeUnmount(() => {
    clearTimeout(timer);
    for (const host of hosts) {
        const pre = host.querySelector("pre");
        if (pre && host.parentNode) host.parentNode.insertBefore(pre, host);
        host.remove();
    }
});

function codeText(id: number) {
    const code = document.querySelector(`.code-block[data-code-block="${id}"] code`);
    return (code?.textContent ?? "").replace(/\n$/, "");
}

async function copy(id: number) {
    const text = codeText(id);
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
    copiedId.value = id;
    status.value = "";
    await nextTick();
    status.value = props.copiedLabel;
    clearTimeout(timer);
    timer = setTimeout(() => {
        if (copiedId.value === id) copiedId.value = null;
        status.value = "";
    }, 1600);
}
</script>

<template>
    <div class="code-block-mount">
        <span class="sr-only" role="status">{{ status }}</span>
        <Teleport v-for="id in blocks" :key="id" :to="`.code-block[data-code-block='${id}']`">
            <button
                type="button"
                class="code-block__copy"
                :aria-label="copiedId === id ? copiedLabel : copyLabel"
                :title="copiedId === id ? copiedLabel : copyLabel"
                :data-copied="copiedId === id || null"
                @click="copy(id)"
            >
                <Check v-if="copiedId === id" :size="14" aria-hidden="true" />
                <Copy v-else :size="14" aria-hidden="true" />
            </button>
        </Teleport>
    </div>
</template>
