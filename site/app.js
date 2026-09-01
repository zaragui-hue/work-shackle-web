const iconStates = [...document.querySelectorAll(".icon-state")];
const activeIcon = document.querySelector("#active-icon");
const activeIconWrap = document.querySelector(".active-icon-wrap");
const iconStateName = document.querySelector("#icon-state-name");
let activeStateIndex = 0;
let iconTimer;

function showIconState(index) {
  const state = iconStates[index];
  if (!state || !activeIcon || !iconStateName) return;
  activeStateIndex = index;
  iconStates.forEach((item, itemIndex) => item.classList.toggle("active", itemIndex === index));
  activeIconWrap?.classList.add("is-changing");
  window.setTimeout(() => {
    activeIcon.src = state.dataset.icon;
    iconStateName.textContent = state.dataset.label || "应用图标状态";
    activeIcon.alt = `应用图标状态：${state.dataset.label || "当前状态"}`;
    activeIconWrap?.classList.remove("is-changing");
  }, 150);
}

function restartIconTimer() {
  window.clearInterval(iconTimer);
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  iconTimer = window.setInterval(() => showIconState((activeStateIndex + 1) % iconStates.length), 3200);
}

iconStates.forEach((state, index) => state.addEventListener("click", () => { showIconState(index); restartIconTimer(); }));
restartIconTimer();

const detectedOS = /Windows/i.test(navigator.userAgent) ? "windows" : /Macintosh|Mac OS X/i.test(navigator.userAgent) ? "macos" : null;
if (detectedOS) document.querySelectorAll(`[data-os="${detectedOS}"]`).forEach((link) => link.classList.add("recommended"));

const releaseStatus = document.querySelector("#release-status");
fetch("https://api.github.com/repos/zaragui-hue/work-shackle-web/releases?per_page=10", { headers: { Accept: "application/vnd.github+json" } })
  .then((response) => { if (!response.ok) throw new Error("Release API unavailable"); return response.json(); })
  .then((releases) => {
    const published = releases.filter((release) => !release.draft && !release.prerelease);
    if (!published.length) return;
    const assets = new Map();
    published.forEach((release) => release.assets.forEach((asset) => assets.set(`${release.tag_name}/${asset.name}`, asset.browser_download_url)));
    document.querySelectorAll("[data-version][data-asset]").forEach((link) => {
      const key = `${link.dataset.version}/${link.dataset.asset}`;
      if (assets.has(key)) link.href = assets.get(key);
    });
    const latest = published[0];
    if (releaseStatus && latest?.tag_name) releaseStatus.textContent = `当前稳定版 ${latest.tag_name} · 免费下载 · 数据保存在本地`;
  })
  .catch(() => { if (releaseStatus) releaseStatus.textContent = "当前稳定版 v0.1.2 · GitHub Releases 安全下载"; });
