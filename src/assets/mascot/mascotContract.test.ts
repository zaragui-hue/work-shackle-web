import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import type { DdlEmotion } from "../../services/tauri/ddl";
import {
  FALLBACK_MASCOT_STATE,
  MASCOT_ASSETS,
  MASCOT_STATES,
  isMascotState,
  mascotStateForDdlEmotion,
  mascotStateForReminderKind,
  mascotStateForWorkStatus,
  resolveMascotAsset,
  resolveMascotAssetOrFallback,
  type MascotState,
} from "./index";

const CANONICAL_STATES = [
  "work-neutral",
  "meeting-empty",
  "fish-relax",
  "lunch-happy",
  "ddl-calm",
  "ddl-anxious",
  "ddl-panic",
  "ddl-due",
  "ddl-overdue",
  "overtime-dead-eyes",
  "offwork-run",
] as const satisfies readonly MascotState[];

describe("Mascot asset contract", () => {
  it("exposes exactly 11 unique canonical states", () => {
    expect(MASCOT_STATES).toEqual([...CANONICAL_STATES]);
    expect(new Set(MASCOT_STATES).size).toBe(11);
    expect(MASCOT_STATES).toHaveLength(11);
  });

  it("maps every canonical state to a resolvable asset URL", () => {
    for (const state of MASCOT_STATES) {
      const asset = resolveMascotAsset(state);
      expect(asset.src.length).toBeGreaterThan(0);
      expect(asset.src.startsWith("data:image/svg+xml")).toBe(true);
      expect(asset.placeholder).toBe(true);
      expect(MASCOT_ASSETS[state]).toEqual(asset);
    }
  });

  it("keeps a single asset map keyed by every MascotState", () => {
    expect(Object.keys(MASCOT_ASSETS).sort()).toEqual(
      [...MASCOT_STATES].sort(),
    );
  });

  it("falls back without throwing for unknown runtime states", () => {
    const fallback = resolveMascotAsset(FALLBACK_MASCOT_STATE);

    expect(isMascotState("not-a-real-state")).toBe(false);
    expect(resolveMascotAssetOrFallback("not-a-real-state")).toEqual(fallback);
    expect(resolveMascotAssetOrFallback("")).toEqual(fallback);
    expect(() => resolveMascotAssetOrFallback("ddl-panic!!!")).not.toThrow();
  });
});

describe("DDL business level → MascotState", () => {
  it("maps all six progress emotions onto the five DDL mascot states", () => {
    const mapping: Record<DdlEmotion, MascotState> = {
      calm: "ddl-calm",
      notice: "ddl-calm",
      anxious: "ddl-anxious",
      panic: "ddl-panic",
      burning: "ddl-due",
      overdue: "ddl-overdue",
    };

    for (const [emotion, state] of Object.entries(mapping) as Array<
      [DdlEmotion, MascotState]
    >) {
      expect(mascotStateForDdlEmotion(emotion)).toBe(state);
    }
  });

  it("maps reminder kinds onto DDL mascot states", () => {
    expect(mascotStateForReminderKind("ddl_60")).toBe("ddl-calm");
    expect(mascotStateForReminderKind("ddl_30")).toBe("ddl-anxious");
    expect(mascotStateForReminderKind("ddl_10")).toBe("ddl-panic");
    expect(mascotStateForReminderKind("ddl_due")).toBe("ddl-due");
    expect(mascotStateForReminderKind("custom")).toBe(FALLBACK_MASCOT_STATE);
    expect(mascotStateForReminderKind("unknown")).toBe(FALLBACK_MASCOT_STATE);
  });
});

describe("work status → MascotState", () => {
  it("maps fixed work statuses onto canonical mascot states without new keys", () => {
    expect(mascotStateForWorkStatus("working")).toBe("work-neutral");
    expect(mascotStateForWorkStatus("focus_brick")).toBe("work-neutral");
    expect(mascotStateForWorkStatus("meeting")).toBe("meeting-empty");
    expect(mascotStateForWorkStatus("daydream")).toBe("meeting-empty");
    expect(mascotStateForWorkStatus("slacking")).toBe("fish-relax");
    expect(mascotStateForWorkStatus("gossip")).toBe("fish-relax");
    expect(mascotStateForWorkStatus("drinking")).toBe("fish-relax");
    expect(mascotStateForWorkStatus("nap")).toBe("fish-relax");
    expect(mascotStateForWorkStatus("lunch")).toBe("lunch-happy");
    expect(mascotStateForWorkStatus("preparing_leave")).toBe("offwork-run");
    expect(mascotStateForWorkStatus("overtime")).toBe("overtime-dead-eyes");
    expect(mascotStateForWorkStatus("urgent_insert")).toBe("work-neutral");
    expect(mascotStateForWorkStatus("chased_by_requirements")).toBe(
      "work-neutral",
    );
    expect(mascotStateForWorkStatus("unknown-status")).toBe(
      FALLBACK_MASCOT_STATE,
    );
  });
});

describe("mascot asset import boundary", () => {
  it("keeps svg imports inside the mascot contract", () => {
    const srcRoot = join(process.cwd(), "src");
    const allowed = join(srcRoot, "assets/mascot/index.ts");
    const offenders: string[] = [];
    const svgImport = /from\s+["'][^"']*assets\/mascot\/[^"']+\.svg["']/;

    function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        const stats = statSync(path);
        if (stats.isDirectory()) {
          walk(path);
          continue;
        }
        if (!path.endsWith(".ts") && !path.endsWith(".tsx")) {
          continue;
        }
        if (path === allowed) {
          continue;
        }
        const source = readFileSync(path, "utf8");
        if (svgImport.test(source)) {
          offenders.push(relative(srcRoot, path));
        }
      }
    }

    walk(srcRoot);
    expect(offenders).toEqual([]);
  });
});
