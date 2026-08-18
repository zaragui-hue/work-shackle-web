import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MASCOT_STATES } from "../../assets/mascot";
import { Mascot } from "./Mascot";

afterEach(cleanup);

function renderedMascot(container: HTMLElement): HTMLImageElement {
  const image = container.querySelector("img.ws-mascot");
  expect(image).toBeInstanceOf(HTMLImageElement);
  return image as HTMLImageElement;
}

describe("Mascot", () => {
  it("renders the resolved asset for the requested state", () => {
    const { container } = render(<Mascot state="ddl-anxious" />);
    const image = renderedMascot(container);

    expect(image.getAttribute("src")?.startsWith("data:image/svg+xml")).toBe(
      true,
    );
    expect(image.className.split(" ")).toEqual(
      expect.arrayContaining(["ws-mascot", "ws-mascot--md"]),
    );
    expect(image.getAttribute("data-mascot-state")).toBe("ddl-anxious");
  });

  it("applies size and className without replacing the size contract", () => {
    const { container } = render(
      <Mascot state="overtime-dead-eyes" size="lg" className="hero-mascot" />,
    );
    const classNames = renderedMascot(container).className.split(" ");

    expect(classNames).toEqual(
      expect.arrayContaining(["ws-mascot", "ws-mascot--lg", "hero-mascot"]),
    );
    expect(classNames).not.toContain("ws-mascot--sm");
    expect(classNames).not.toContain("ws-mascot--md");
  });

  it("hides decorative mascots from assistive tech", () => {
    const { container } = render(<Mascot state="fish-relax" />);
    const image = renderedMascot(container);

    expect(image.getAttribute("alt")).toBe("");
    expect(image.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("uses a short alt when the mascot is semantic", () => {
    render(<Mascot state="ddl-panic" alt="DDL 很急" />);

    const image = screen.getByRole("img", { name: "DDL 很急" });
    expect(image.getAttribute("aria-hidden")).toBeNull();
    expect(image.getAttribute("alt")).toBe("DDL 很急");
  });

  it("still renders when an illegal runtime state is forced in", () => {
    const InvalidMascot = Mascot as unknown as (props: {
      state: string;
    }) => ReturnType<typeof Mascot>;

    expect(() => {
      render(<InvalidMascot state="missing-state" />);
    }).not.toThrow();

    const image = renderedMascot(document.body);
    expect(image.getAttribute("src")?.startsWith("data:image/svg+xml")).toBe(
      true,
    );
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
});
