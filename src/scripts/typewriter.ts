import { onPageLoad } from "./lifecycle";

onPageLoad(() => {
  const root = document.getElementById("typewriter");
  const text = document.getElementById("typewriter-text");
  if (!root || !text) return;
  const lines: string[] = JSON.parse(decodeURIComponent(root.dataset.lines ?? "[]"));
  if (!lines.length) return;
  const once = root.dataset.once === "1";
  const speed = Number(root.dataset.typingSpeed) || 40;
  const deletingSpeed = Number(root.dataset.deletingSpeed) || 20;
  const pause = Number(root.dataset.pauseDuration) || 5000;
  let line = 0,
    character = 0,
    deleting = false;
  let timer: ReturnType<typeof setTimeout>;
  function show(completed: string[], current = "") {
    text!.replaceChildren();
    [...completed, current].forEach((value, index) => {
      if (index) text!.append(document.createElement("br"));
      text!.append(document.createTextNode(value));
    });
  }
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    show(lines.slice(0, -1), lines.at(-1));
    root.dataset.cursor = "0";
    return;
  }
  text.replaceChildren();
  root.dataset.cursor = "1";
  function tick() {
    const current = Array.from(lines[line]);
    show(once ? lines.slice(0, line) : [], current.slice(0, character).join(""));
    if (deleting) {
      if (--character < 0) {
        character = 0;
        deleting = false;
        line = (line + 1) % lines.length;
        timer = setTimeout(tick, 300);
      } else timer = setTimeout(tick, deletingSpeed);
    } else if (++character > current.length) {
      if (once && line === lines.length - 1) {
        root!.dataset.cursor = "0";
        return;
      }
      if (once) {
        line++;
        character = 0;
        timer = setTimeout(tick, 300);
      } else {
        deleting = true;
        timer = setTimeout(tick, pause);
      }
    } else timer = setTimeout(tick, speed);
  }
  timer = setTimeout(tick, 500);
  return () => clearTimeout(timer);
});
