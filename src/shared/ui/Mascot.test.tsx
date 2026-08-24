import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { MASCOT_STATES } from "../../assets/mascot";
import { Mascot } from "./Mascot";

afterEach(cleanup);

function renderedMascot(container: HTMLElement): HTMLImageElement {
  const image = container.querySelector("img.ws-mascot");
  expect(image).toBeInstanceOf(HTMLImageElement);
  return image as HTMLImageElement;
}

function renderedFrame(container: HTMLElement): HTMLElement {
  const frame = container.querySelector(".ws-mascot-frame");
  expect(frame).toBeInstanceOf(HTMLElement);
  return frame as HTMLElement;
}

describe("Mascot", () => {
  it("renders the resolved asset for the requested state", () => {
    const { container } = render(<Mascot state="ddl-anxious" />);
    const image = renderedMascot(container);

    expect(image.getAttribute("src")).toMatch(/power-down-v1\.png$/);
    expect(renderedFrame(container).className.split(" ")).toEqual(
      expect.arrayContaining(["ws-mascot-frame", "ws-mascot-frame--md"]),
    );
    expect(image.getAttribute("data-mascot-state")).toBe("ddl-anxious");
    expect(image.getAttribute("data-mascot-animation")).toBe("none");
    expect(image.className.split(" ")).not.toContain("ws-mascot--breathe");
  });

  it("applies size and className without replacing the size contract", () => {
    const { container } = render(
      <Mascot state="overtime-dead-eyes" size="lg" className="hero-mascot" />,
    );
    const frameClassNames = renderedFrame(container).className.split(" ");

    expect(frameClassNames).toEqual(
      expect.arrayContaining([
        "ws-mascot-frame",
        "ws-mascot-frame--lg",
        "hero-mascot",
      ]),
    );
    expect(frameClassNames).not.toContain("ws-mascot-frame--sm");
    expect(frameClassNames).not.toContain("ws-mascot-frame--md");
  });

  it("hides decorative mascots from assistive tech", () => {
    const { container } = render(<Mascot state="fish-relax" />);
    const image = renderedMascot(container);

    expect(image.getAttribute("alt")).toBe("");
    expect(image.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("uses a short alt when the mascot is semantic", () => {
    render(<Mascot state="ddl-panic" alt="DDL 很急" animation="panic" />);

    const image = screen.getByRole("img", { name: "DDL 很急" });
    expect(image.getAttribute("aria-hidden")).toBeNull();
    expect(image.getAttribute("alt")).toBe("DDL 很急");
    expect(image.getAttribute("data-mascot-animation")).toBe("panic");
  });

  it("still renders when an illegal runtime state is forced in", () => {
    const InvalidMascot = Mascot as unknown as (props: {
      state: string;
    }) => ReturnType<typeof Mascot>;

    expect(() => {
      render(<InvalidMascot state="missing-state" />);
    }).not.toThrow();

    const image = renderedMascot(document.body);
    expect(image.getAttribute("src")).toMatch(/professional-smile-v2\.png$/);
    expect(image.getAttribute("data-mascot-state")).toBe("work-neutral");
  });

  it("can render every canonical state", () => {
    const { container, rerender } = render(<Mascot state="work-neutral" />);

    for (const state of MASCOT_STATES) {
      rerender(<Mascot state={state} />);
      const image = renderedMascot(container);
      expect(image.getAttribute("data-mascot-state")).toBe(state);
      expect(image.getAttribute("src")).toBeTruthy();
    }
  });

  it.each([
    ["none", null],
    ["breathe", "ws-mascot--breathe"],
    ["shake", "ws-mascot--shake"],
    ["panic", "ws-mascot--panic"],
    ["angry", "ws-mascot--angry"],
    ["run", "ws-mascot--run"],
  ] as const)("applies the %s animation class", (animation, className) => {
    const { container } = render(
      <Mascot state="work-neutral" animation={animation} />,
    );
    const image = renderedMascot(container);
    const classNames = image.className.split(" ");

    expect(image.getAttribute("data-mascot-animation")).toBe(animation);
    if (className) {
      expect(classNames).toContain(className);
    } else {
      expect(classNames.some((name) => name.startsWith("ws-mascot--"))).toBe(
        false,
      );
    }
  });

  it("falls back to none for an illegal runtime animation", () => {
    const InvalidMascot = Mascot as unknown as (props: {
      state: "work-neutral";
      animation: string;
    }) => ReturnType<typeof Mascot>;
    const { container } = render(
      <InvalidMascot state="work-neutral" animation="spin-out-of-control" />,
    );
    const image = renderedMascot(container);

    expect(image.getAttribute("data-mascot-animation")).toBe("none");
    expect(image.className.split(" ")).not.toContain("ws-mascot--spin-out-of-control");
  });

  it("keeps reduced-motion CSS that disables mascot animation", () => {
    const css = readFileSync(
      join(process.cwd(), "src/shared/ui/Mascot.css"),
      "utf8",
    );

    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toMatch(/animation:\s*none/);

    const keyframes = css.match(/@keyframes[\s\S]*?(?=@keyframes|@media|$)/g) ?? [];
    expect(keyframes).toHaveLength(5);
    for (const block of keyframes) {
      expect(block).toContain("transform:");
      expect(block).not.toMatch(/\b(top|left|margin|padding|width|height):/);
    }
  });
});
