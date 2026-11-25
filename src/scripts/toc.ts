import { onPageLoad } from "./lifecycle";

onPageLoad((signal) => {
  const toggle = document.getElementById("toc-mobile-toggle");
  const card = document.getElementById("toc-mobile-card");
  function setOpen(open: boolean) {
    card?.classList.toggle("open", open);
    toggle?.classList.toggle("toc-active", open);
    toggle?.setAttribute("aria-expanded", String(open));
    card?.setAttribute("aria-hidden", String(!open));
    if (card) card.inert = !open;
  }
  setOpen(false);
  document.addEventListener(
    "click",
    (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("#toc-mobile-toggle")) setOpen(!card?.classList.contains("open"));
      else if (
        event.target.closest("#toc-mobile-close, #toc-mobile-card a") ||
        !event.target.closest("#toc-mobile-card")
      )
        setOpen(false);
    },
    { signal },
  );
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && card?.classList.contains("open")) {
        setOpen(false);
        toggle?.focus();
      }
    },
    { signal },
  );
  const links = [...document.querySelectorAll<HTMLAnchorElement>("#toc-desktop [data-toc]")];
  const targets = links
    .map((link) => document.getElementById(link.dataset.toc!))
    .filter((el): el is HTMLElement => Boolean(el));
  let frame = 0;
  const linksById = new Map(links.map((link) => [link.dataset.toc, link]));
  let activeLink: HTMLAnchorElement | undefined;
  function highlight() {
    const scale = Number(getComputedStyle(document.body).zoom) || 1;
    const current =
      targets.findLast((el) => el.getBoundingClientRect().top <= 100 * scale) ?? targets[0];
    const next = linksById.get(current?.id);
    // 同一标题范围内滚动不重复写属性，避免整张目录每帧触发样式失效。
    if (next !== activeLink) {
      if (activeLink) {
        activeLink.dataset.active = "false";
        activeLink.removeAttribute("aria-current");
      }
      if (next) {
        next.dataset.active = "true";
        next.setAttribute("aria-current", "location");
      }
      activeLink = next;
    }
    frame = 0;
  }
  // 完整标题列表判断滚动位置，上滚与跨标题跳转时也能保持高亮准确。
  window.addEventListener(
    "scroll",
    () => {
      if (!frame) frame = requestAnimationFrame(highlight);
    },
    { passive: true, signal },
  );
  window.addEventListener("resize", highlight, { signal });
  highlight();
  return () => cancelAnimationFrame(frame);
});
