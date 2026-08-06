import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RESULT_FLOW_STEPS } from "../../constants/resultFlow";
import { useResultFlowStore } from "../../stores/useResultFlowStore";
import { RESULT_FLOW_PREVIEW_CONTENT } from "../../test/fixtures/resultFlowPreview";
import { ResultFlow } from "./ResultFlow";

describe("ResultFlow", () => {
  beforeEach(() => {
    useResultFlowStore.getState().reset();
    useResultFlowStore.getState().start("preview");
  });

  it("shows all eight preview steps in order and exits once", async () => {
    const user = userEvent.setup();
    const onExit = vi.fn();
    render(<ResultFlow onExit={onExit} />);

    expect(screen.getByText("ステップ 1 / 8")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: RESULT_FLOW_PREVIEW_CONTENT.finalizing.title,
      }),
    ).toBeInTheDocument();

    for (const step of RESULT_FLOW_STEPS.slice(1)) {
      await user.click(screen.getByRole("button", { name: "次へ" }));
      expect(
        screen.getByRole("heading", {
          level: 1,
          name: RESULT_FLOW_PREVIEW_CONTENT[step].title,
        }),
      ).toBeInTheDocument();
    }

    await user.dblClick(
      screen.getByRole("button", { name: "プレビューを完了" }),
    );
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("keeps previous navigation inside the first boundary", async () => {
    const user = userEvent.setup();
    render(<ResultFlow onExit={vi.fn()} />);

    const previousButton = screen.getByRole("button", { name: "戻る" });
    expect(previousButton).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "次へ" }));
    expect(previousButton).toBeEnabled();
    await user.click(previousButton);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: RESULT_FLOW_PREVIEW_CONTENT.finalizing.title,
      }),
    ).toBeInTheDocument();
    expect(previousButton).toBeDisabled();
  });

  it("does not jump over a step on a rapid double click", async () => {
    const user = userEvent.setup();
    render(<ResultFlow onExit={vi.fn()} />);

    await user.dblClick(screen.getByRole("button", { name: "次へ" }));

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: RESULT_FLOW_PREVIEW_CONTENT["app-breakdown"].title,
      }),
    ).toBeInTheDocument();
  });

  it("sets the slide direction for forward and backward navigation", async () => {
    const user = userEvent.setup();
    render(<ResultFlow onExit={vi.fn()} />);

    expect(screen.getByTestId("result-step-transition")).toHaveClass(
      "result-step-transition--initial",
    );

    await user.click(screen.getByRole("button", { name: "次へ" }));
    expect(screen.getByTestId("result-step-transition")).toHaveClass(
      "result-step-transition--forward",
    );

    await user.click(screen.getByRole("button", { name: "戻る" }));
    expect(screen.getByTestId("result-step-transition")).toHaveClass(
      "result-step-transition--backward",
    );
  });

  it("skips only the current placeholder animation", async () => {
    const user = userEvent.setup();
    render(<ResultFlow onExit={vi.fn()} />);

    const skipButton = screen.getByRole("button", {
      name: "この演出をスキップ",
    });
    await user.click(skipButton);

    expect(
      screen.getByText(
        "このステップの演出をスキップしました。表示内容は変わりません。",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "演出スキップ済み" }),
    ).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "次へ" }));
    expect(
      screen.getByRole("button", { name: "この演出をスキップ" }),
    ).toBeEnabled();
  });

  it("handles repeated full-skip completion without duplicate exits", async () => {
    const user = userEvent.setup();
    const onExit = vi.fn();
    render(<ResultFlow onExit={onExit} />);

    await user.dblClick(
      screen.getByRole("button", { name: "結果演出をすべてスキップ" }),
    );

    expect(onExit).toHaveBeenCalledTimes(1);

    act(() => {
      useResultFlowStore.getState().skipAll();
      useResultFlowStore.getState().finish();
    });
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("labels every step as preparation without fake result values", () => {
    render(<ResultFlow onExit={vi.fn()} />);

    expect(screen.getByText("準備中")).toBeInTheDocument();
    expect(
      screen.getByText(
        "これは開発用プレビューです。実際の金額・保存結果・設定変更は行いません。",
      ),
    ).toBeInTheDocument();
  });
});
