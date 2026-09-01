import { describe, expect, it } from "vitest";

import { DYNAMIC_APP_ICON_STATES } from "./dynamicAppIconState";
import { DYNAMIC_APP_ICON_ASSETS } from "./dynamicAppIconAssets";

describe("DYNAMIC_APP_ICON_ASSETS", () => {
  it("maps every icon state to one unique bundled PNG", () => {
    expect(Object.keys(DYNAMIC_APP_ICON_ASSETS)).toEqual(DYNAMIC_APP_ICON_STATES);
    expect(new Set(Object.values(DYNAMIC_APP_ICON_ASSETS)).size).toBe(6);
    for (const asset of Object.values(DYNAMIC_APP_ICON_ASSETS)) {
      expect(asset).toMatch(/\.png$/);
    }
  });
});
