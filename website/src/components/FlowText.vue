<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";

const props = defineProps<{
  text: string;
}>();

const root = ref<HTMLElement | null>(null);
const reduce = ref(false);
let generation = 0;

const chars = computed(() => Array.from(props.text));

onMounted(() => {
  reduce.value = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
});

watch(
  () => props.text,
  async (_next, prev) => {
    const el = root.value;
    if (!el || prev === undefined || reduce.value) return;
    const id = ++generation;
    const from = el.getBoundingClientRect().width;
    await nextTick();
    if (id !== generation || root.value !== el) return;
    el.style.transition = "none";
    el.style.width = "max-content";
    const to = el.getBoundingClientRect().width;
    el.style.width = `${from}px`;
    void el.offsetWidth;
    el.style.transition = "";
    el.style.width = `${to}px`;

    const unlock = (event: TransitionEvent) => {
      if (event.propertyName !== "width" || event.target !== el || id !== generation) return;
      el.removeEventListener("transitionend", unlock);
      el.style.width = "";
    };
    el.addEventListener("transitionend", unlock);
  },
);

function glyph(char: string) {
  return char === " " ? "\u00a0" : char;
}
</script>

<template>
  <span ref="root" class="flow-text">
    <span v-for="(char, index) in chars" :key="index" class="flow-text__cell">
      <Transition name="flow">
        <span
          :key="char"
          class="flow-text__glyph"
          :style="{ '--flow-i': index }"
        >{{ glyph(char) }}</span>
      </Transition>
    </span>
  </span>
</template>

<style>
.flow-text {
  display: inline-flex;
  height: 1.5em;
  overflow: hidden;
  vertical-align: bottom;
  transition: width 460ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.flow-text__cell {
  display: grid;
  height: 1.5em;
  overflow: hidden;
}

.flow-text__glyph {
  grid-area: 1 / 1;
  line-height: 1.5;
}

.flow-enter-active,
.flow-leave-active {
  transition: transform 440ms cubic-bezier(0.2, 0.8, 0.2, 1);
  transition-delay: calc(var(--flow-i) * 18ms);
}

.flow-enter-from {
  transform: translateY(100%);
}

.flow-leave-to {
  transform: translateY(-100%);
}

@media (prefers-reduced-motion: reduce) {
  .flow-text,
  .flow-enter-active,
  .flow-leave-active {
    transition: none;
  }
}
</style>
