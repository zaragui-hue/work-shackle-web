import { describe, expect, it } from "vitest";
import { createDefaultData } from "./defaultData";
import { WebDataSchema } from "./model";

describe("WebDataSchema", () => {
  it("accepts complete first-run data", () => {
    expect(WebDataSchema.parse(createDefaultData(1000))).toMatchObject({ schemaVersion: 1, updatedAtMs: 1000, tasks: [] });
  });

  it("rejects malformed history instead of silently resetting it", () => {
    expect(() => WebDataSchema.parse({ ...createDefaultData(1000), tasks: "broken" })).toThrow();
  });
});
