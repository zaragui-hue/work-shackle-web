import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BusyRuleSection } from "./BusyRuleSection";

const mockGetBusyRules = vi.fn();
const mockSaveBusyRules = vi.fn();
const mockResetBusyRulesToDefault = vi.fn();

vi.mock("../../services/tauri/busyRules", async () => {
  const actual = await vi.importActual<typeof import("../../services/tauri/busyRules")>(
    "../../services/tauri/busyRules",
  );
  return {
    ...actual,
    getBusyRules: (...args: unknown[]) => mockGetBusyRules(...args),
    saveBusyRules: async (...args: unknown[]) => {
      const saved = await mockSaveBusyRules(...args);
      actual.notifyBusyRulesUpdated();
      return saved;
    },
    resetBusyRulesToDefault: async () => {
      const restored = await mockResetBusyRulesToDefault();
      actual.notifyBusyRulesUpdated();
      return restored;
    },
  };
});

const DEFAULT_RULES = [
  {
    id: "busy-0",
    minTasks: 0,
    maxTasks: 0,
    emoji: "🫧",
    name: "空闲",
    sortOrder: 0,
    messages: [{ id: "msg-0", content: "今天居然没事" }],
  },
  {
    id: "busy-1",
    minTasks: 1,
    maxTasks: 2,
    emoji: "🌿",
    name: "松弛",
    sortOrder: 1,
    messages: [{ id: "msg-1", content: "还能摸会儿鱼" }],
  },
  {
    id: "busy-5",
    minTasks: 13,
    maxTasks: null,
    emoji: "🤯",
    name: "爆满",
    sortOrder: 5,
    messages: [{ id: "msg-5", content: "今天别找我" }],
  },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  mockGetBusyRules.mockResolvedValue(DEFAULT_RULES);
  mockSaveBusyRules.mockImplementation(async (input) => {
    return input.levels.map(
      (
        level: {
          minTasks: number;
          maxTasks: number | null;
          emoji: string;
          name: string;
          messages: string[];
        },
        index: number,
      ) => ({
        id: `saved-${index}`,
        sortOrder: index,
        ...level,
        messages: level.messages.map((content, messageIndex) => ({
          id: `saved-msg-${index}-${messageIndex}`,
          content,
        })),
      }),
    );
  });
  mockResetBusyRulesToDefault.mockResolvedValue(DEFAULT_RULES);
});

describe("BusyRuleSection", () => {
  it("loads default rules", async () => {
    render(<BusyRuleSection />);

    expect(await screen.findByText("🫧")).toBeTruthy();
    expect(screen.getByDisplayValue("空闲")).toBeTruthy();
    expect(screen.getByText("13+")).toBeTruthy();
  });

  it("allows editing emoji and name", async () => {
    render(<BusyRuleSection />);
    await screen.findByDisplayValue("空闲");

    const emojiInput = screen.getByDisplayValue("🫧");
    fireEvent.change(emojiInput, { target: { value: "😎" } });
    fireEvent.change(screen.getByDisplayValue("空闲"), { target: { value: "超闲" } });

    expect(screen.getByDisplayValue("😎")).toBeTruthy();
    expect(screen.getByDisplayValue("超闲")).toBeTruthy();
  });

  it("allows editing min and max", async () => {
    render(<BusyRuleSection />);
    await screen.findByDisplayValue("松弛");

    const minInputs = screen.getAllByLabelText("最小任务数");
    const maxInputs = screen.getAllByLabelText("最大任务数");
    fireEvent.change(minInputs[1], { target: { value: "2" } });
    fireEvent.change(maxInputs[1], { target: { value: "4" } });

    expect((minInputs[1] as HTMLInputElement).value).toBe("2");
    expect((maxInputs[1] as HTMLInputElement).value).toBe("4");
  });

  it("shows X+ for the last sorted level", async () => {
    render(<BusyRuleSection />);
    await screen.findByText("13+");

    expect(screen.getByText("13+")).toBeTruthy();
    expect(screen.getAllByLabelText("最大任务数").length).toBeGreaterThan(0);
  });

  it("can add and delete levels", async () => {
    render(<BusyRuleSection />);
    await screen.findByDisplayValue("爆满");

    fireEvent.click(screen.getByRole("button", { name: "添加档位" }));
    expect(screen.getAllByRole("button", { name: "删除档位" }).length).toBe(4);

    fireEvent.click(screen.getAllByRole("button", { name: "删除档位" })[0]);
    expect(screen.getAllByRole("button", { name: "删除档位" }).length).toBe(3);
  });

  it("can add, edit and delete messages", async () => {
    render(<BusyRuleSection />);
    await screen.findByDisplayValue("今天居然没事");

    fireEvent.click(screen.getAllByRole("button", { name: "添加文案" })[0]);
    const newInputs = screen.getAllByLabelText(/文案/);
    const newMessageInput = newInputs[newInputs.length - 1];
    fireEvent.change(newMessageInput, { target: { value: "新文案" } });
    expect(screen.getByDisplayValue("新文案")).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "删除文案" })[0]);
    expect(screen.queryByDisplayValue("今天居然没事")).toBeNull();
  });

  it("does not save blank messages", async () => {
    render(<BusyRuleSection />);
    await screen.findByDisplayValue("今天居然没事");

    fireEvent.change(screen.getByDisplayValue("空闲"), { target: { value: "空闲改" } });
    fireEvent.click(screen.getAllByRole("button", { name: "添加文案" })[0]);
    const messageInputs = screen.getAllByLabelText(/文案/);
    fireEvent.change(messageInputs[messageInputs.length - 1], {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(mockSaveBusyRules).toHaveBeenCalledTimes(1);
    });

    const payload = mockSaveBusyRules.mock.calls[0][0];
    expect(payload.levels[0].messages).not.toContain("   ");
  });

  it("calls backend once on save and shows success", async () => {
    render(<BusyRuleSection />);
    await screen.findByDisplayValue("空闲");

    fireEvent.change(screen.getByDisplayValue("空闲"), { target: { value: "很闲" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(mockSaveBusyRules).toHaveBeenCalledTimes(1);
      expect(screen.getByText("已保存")).toBeTruthy();
    });
  });

  it("keeps draft when save fails", async () => {
    mockSaveBusyRules.mockRejectedValueOnce({
      code: "INVALID_TASK_INPUT",
      details: { message: "保存失败" },
    });

    render(<BusyRuleSection />);
    await screen.findByDisplayValue("空闲");

    fireEvent.change(screen.getByDisplayValue("空闲"), { target: { value: "草稿名称" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(screen.getByText("保存失败")).toBeTruthy();
    });
    expect(screen.getByDisplayValue("草稿名称")).toBeTruthy();
  });

  it("renders loading state without crashing", () => {
    mockGetBusyRules.mockReturnValue(new Promise(() => undefined));
    render(<BusyRuleSection />);
    expect(screen.getByText("加载中…")).toBeTruthy();
  });

  it("reloads saved config after save", async () => {
    render(<BusyRuleSection />);
    await screen.findByDisplayValue("空闲");

    fireEvent.change(screen.getByDisplayValue("空闲"), { target: { value: "已保存名称" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("已保存名称")).toBeTruthy();
    });
  });

  it("notifies calendar listeners after save", async () => {
    const listener = vi.fn();
    const { subscribeBusyRules } = await import("../../services/tauri/busyRules");
    const unsubscribe = subscribeBusyRules(listener);

    render(<BusyRuleSection />);
    await screen.findByDisplayValue("空闲");
    fireEvent.change(screen.getByDisplayValue("空闲"), { target: { value: "联动测试" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(listener).toHaveBeenCalled();
    });

    unsubscribe();
  });

  it("restores defaults from reset button", async () => {
    render(<BusyRuleSection />);
    await screen.findByDisplayValue("空闲");

    fireEvent.click(screen.getByRole("button", { name: "恢复默认" }));

    await waitFor(() => {
      expect(mockResetBusyRulesToDefault).toHaveBeenCalledTimes(1);
      expect(screen.getByText("已保存")).toBeTruthy();
    });
  });

  it("shows rust validation errors without losing draft", async () => {
    mockSaveBusyRules.mockRejectedValueOnce({
      code: "INVALID_TASK_INPUT",
      details: { message: "忙碌档位之间存在空档" },
    });

    render(<BusyRuleSection />);
    await screen.findByDisplayValue("空闲");

    fireEvent.change(screen.getByDisplayValue("空闲"), { target: { value: "草稿" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(screen.getByText("忙碌档位之间存在空档")).toBeTruthy();
    });
    expect(screen.getByDisplayValue("草稿")).toBeTruthy();
  });
});

describe("busy rule validation boundary", () => {
  it("does not expose a full validateBusyRules helper in the form module", async () => {
    const formModule = await import("./busyRuleForm");
    expect("validateBusyRules" in formModule).toBe(false);
  });
});
