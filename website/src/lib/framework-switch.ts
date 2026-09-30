const STORAGE_KEY = 'selected-framework';
const FRAMEWORKS = ['gpui', 'slint'] as const;
type Framework = (typeof FRAMEWORKS)[number];

// The loading beat is long enough to read as a reload of the page's code, and
// short enough that switching back and forth never feels like waiting.
const LOADING_MS = 420;
const ENTER_MS = 280;
const EASE_OUT = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

const root = document.documentElement;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const isFramework = (value: unknown): value is Framework =>
  FRAMEWORKS.includes(value as Framework);

let target: Framework = isFramework(root.dataset.framework) ? root.dataset.framework : 'gpui';
let loadingTimer: number | undefined;
let enterTimer: number | undefined;

function syncSwitches(framework: Framework) {
  document.querySelectorAll<HTMLElement>('.framework-switch').forEach((group) => {
    // The package-manager switch reuses this class for its look. It has no
    // framework options, and writing `data-selected` here would replace its
    // own selection.
    if (!group.querySelector('[data-framework-option]')) return;
    group.dataset.selected = framework;
    group.querySelectorAll<HTMLButtonElement>('[data-framework-option]').forEach((option) => {
      const selected = option.dataset.frameworkOption === framework;
      option.setAttribute('aria-checked', String(selected));
      option.tabIndex = selected ? 0 : -1;
    });
  });
}

function announce(framework: Framework) {
  document.querySelectorAll<HTMLElement>('.framework-bar').forEach((bar) => {
    const status = bar.querySelector<HTMLElement>('[data-framework-status]');
    const key = `status${framework[0].toUpperCase()}${framework.slice(1)}`;
    if (status) status.textContent = bar.dataset[key] ?? '';
  });
}

const progress = (() => {
  let bar: HTMLElement | undefined;
  let animation: Animation | undefined;

  const element = () => {
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'framework-progress';
      bar.setAttribute('aria-hidden', 'true');
      document.body.append(bar);
    }
    return bar;
  };

  return {
    start() {
      animation?.cancel();
      animation = element().animate(
        [
          { transform: 'scaleX(0)', opacity: 1 },
          { transform: 'scaleX(0.75)', opacity: 1 },
        ],
        { duration: LOADING_MS, easing: 'cubic-bezier(0.1, 0.7, 0.3, 1)', fill: 'forwards' },
      );
    },
    finish() {
      animation?.cancel();
      animation = element().animate(
        [
          { transform: 'scaleX(0.75)', opacity: 1 },
          { transform: 'scaleX(1)', opacity: 1, offset: 0.55 },
          { transform: 'scaleX(1)', opacity: 0 },
        ],
        { duration: 440, easing: 'ease-out', fill: 'forwards' },
      );
    },
  };
})();

function show(framework: Framework) {
  root.dataset.framework = framework;
  announce(framework);
  document.dispatchEvent(new Event('framework-change'));
}

function select(framework: Framework, persist = true) {
  if (framework === target) return;
  target = framework;
  syncSwitches(framework);
  if (persist) localStorage.setItem(STORAGE_KEY, framework);

  const groups = [...document.querySelectorAll<HTMLElement>('[data-framework-code]')];
  if (reduceMotion.matches || groups.length === 0) {
    show(framework);
    return;
  }

  window.clearTimeout(loadingTimer);
  window.clearTimeout(enterTimer);
  root.classList.remove('framework-entering');
  root.classList.add('framework-loading');
  document.querySelector('.doc-content')?.setAttribute('aria-busy', 'true');
  progress.start();

  loadingTimer = window.setTimeout(() => {
    const before = groups.map((group) => group.offsetHeight);
    show(framework);
    root.classList.remove('framework-loading');
    root.classList.add('framework-entering');
    document.querySelector('.doc-content')?.removeAttribute('aria-busy');
    progress.finish();

    const viewport = window.innerHeight;
    groups.forEach((group, index) => {
      const after = group.offsetHeight;
      const { top, bottom } = group.getBoundingClientRect();
      if (after === before[index] || bottom < 0 || top > viewport) return;
      group.animate([{ height: `${before[index]}px` }, { height: `${after}px` }], {
        duration: ENTER_MS,
        easing: EASE_OUT,
      });
    });

    enterTimer = window.setTimeout(() => root.classList.remove('framework-entering'), ENTER_MS + 40);
  }, LOADING_MS);
}

function optionFrom(event: Event) {
  return (event.target as Element | null)?.closest<HTMLButtonElement>('[data-framework-option]');
}

document.addEventListener('click', (event) => {
  const option = optionFrom(event);
  if (option && isFramework(option.dataset.frameworkOption)) select(option.dataset.frameworkOption);
});

document.addEventListener('keydown', (event) => {
  const option = optionFrom(event);
  if (!option) return;
  const options = [
    ...(option.closest('.framework-switch')?.querySelectorAll<HTMLButtonElement>('[data-framework-option]') ?? []),
  ];
  const index = options.indexOf(option);
  const next = {
    ArrowRight: index + 1,
    ArrowDown: index + 1,
    ArrowLeft: index - 1,
    ArrowUp: index - 1,
    Home: 0,
    End: options.length - 1,
  }[event.key];
  if (next === undefined) return;
  event.preventDefault();
  const chosen = options[(next + options.length) % options.length];
  chosen.focus();
  if (isFramework(chosen.dataset.frameworkOption)) select(chosen.dataset.frameworkOption);
});

window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY && isFramework(event.newValue)) select(event.newValue, false);
});

syncSwitches(target);
