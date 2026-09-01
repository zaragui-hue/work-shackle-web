import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(root, "src/assets/app-icons/offwork-ghost/svg");
const runtimeDir = join(root, "src/assets/app-icons/offwork-ghost/runtime");
const bundleDir = join(root, "src-tauri/icons");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

const variants = {
  morning: { background: "#9B83FF", body: "#FBFAFF", face: "morning" },
  default: { background: "#7557FF", body: "#FBFAFF", face: "default" },
  afternoon: { background: "#6C5A86", body: "#ECE8F4", face: "afternoon" },
  offwork_soon: { background: "#C7FF5A", body: "#FBFAFF", face: "offwork" },
  deadline_alert: { background: "#FF5E71", body: "#FBFAFF", face: "deadline" },
  overtime: { background: "#171827", body: "#B9B7C3", face: "overtime" },
};

function expression(name) {
  const ink = "#17152A";
  const common = `stroke="${ink}" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"`;

  if (name === "morning") {
    return `<path d="M330 500h90" ${common}/><ellipse cx="625" cy="510" rx="46" ry="64" fill="${ink}"/><path d="M365 665q150 105 295-10" fill="none" ${common}/>`;
  }
  if (name === "afternoon") {
    return `<path d="M300 510h135M585 510h135M365 670h290" ${common}/>`;
  }
  if (name === "offwork") {
    return `<path d="M300 490l70 48 70-48M580 490l70 48 70-48" fill="none" ${common}/><path d="M350 640q160 205 320 0" fill="#FF6D9E" ${common}/>`;
  }
  if (name === "deadline") {
    return `<circle cx="370" cy="510" r="85" fill="#fff" ${common}/><circle cx="650" cy="510" r="85" fill="#fff" ${common}/><circle cx="380" cy="520" r="28" fill="${ink}"/><circle cx="640" cy="520" r="28" fill="${ink}"/><ellipse cx="510" cy="700" rx="75" ry="100" fill="${ink}"/><path d="M775 410q85 75 0 155-70-75 0-155z" fill="#77DFFF" ${common}/>`;
  }
  if (name === "overtime") {
    return `<path d="M300 460l130 80M300 540l130-80M590 460l130 80M590 540l130-80M375 700q135-95 270 0" fill="none" ${common}/>`;
  }
  return `<path d="M285 395q95-85 190-10M555 375q105-50 195 35" fill="none" ${common}/><ellipse cx="390" cy="510" rx="50" ry="68" fill="${ink}"/><ellipse cx="645" cy="510" rx="50" ry="68" fill="${ink}"/><path d="M365 660q150 120 305-15-25 160-165 160-115 0-140-145z" fill="#FF6D9E" ${common}/>`;
}

function renderSvg({ background, body, face }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect x="24" y="24" width="976" height="976" rx="236" fill="${background}"/>
  <circle cx="810" cy="205" r="92" fill="#C7FF5A" stroke="#17152A" stroke-width="30"/>
  <path d="M810 152v62l42 27" fill="none" stroke="#17152A" stroke-width="24" stroke-linecap="round"/>
  <path d="M190 878V470q0-315 322-315t322 315v408L720 802l-104 76-104-76-104 76-104-76z" fill="${body}" stroke="#17152A" stroke-width="38" stroke-linejoin="round"/>
  ${expression(face)}
  </svg>`;
}

mkdirSync(sourceDir, { recursive: true });
mkdirSync(runtimeDir, { recursive: true });

for (const [state, variant] of Object.entries(variants)) {
  const source = join(sourceDir, `${state}.svg`);
  writeFileSync(source, renderSvg(variant));
  const output = mkdtempSync(join(tmpdir(), `work-shackle-${state}-`));
  try {
    execFileSync(
      npm,
      ["exec", "tauri", "icon", "--", "-o", output, "-p", "1024", source],
      { cwd: root, stdio: "inherit" },
    );
    renameSync(
      join(output, "1024x1024.png"),
      join(runtimeDir, `${state}.png`),
    );
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
}

execFileSync(
  npm,
  ["exec", "tauri", "icon", "--", "-o", bundleDir, join(sourceDir, "default.svg")],
  { cwd: root, stdio: "inherit" },
);
copyFileSync(join(sourceDir, "default.svg"), join(root, "public/offwork-ghost.svg"));
