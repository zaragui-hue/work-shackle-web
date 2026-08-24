import { describe, expect, it } from "vitest";

import { copy } from "./copy";

describe("default product copy pool", () => {
  it("exports one typed tree for brand UI copy", () => {
    expect(copy.today.emptyTitle).toBeTruthy();
    expect(copy.reminder.headline.one_hour_remaining).toBeTruthy();
    expect(copy.ddl.emotions.burning).toBeTruthy();
    expect(copy.overtime.title).toBeTruthy();
    expect(copy.workEnd.completeTitle).toBeTruthy();
    expect(copy.lunch.title).toBeTruthy();
  });

  it("does not duplicate Rust-owned work-status or busy seed lines", () => {
    const serialized = JSON.stringify(copy);
    expect(serialized).not.toContain("键盘已经热起来了");
    expect(serialized).not.toContain("今天居然没事");
    expect(serialized).not.toContain("班味上来了");
    expect(serialized).not.toContain("加班结束，今天真的收工啦");
    expect(serialized).not.toContain("到饭点了。工作可以等等");
  });
});
