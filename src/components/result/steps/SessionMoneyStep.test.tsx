import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ResultFlowPreviewContent } from "../../../types/resultFlow";
import { SessionMoneyStep } from "./SessionMoneyStep";

const content: ResultFlowPreviewContent = {
  title: "今回のお金への換算",
  description: "今回の獲得額、浪費額、純増減と、お金の演出を表示します。",
  responsibleIssue: "Issue #33",
};

describe("SessionMoneyStep", () => {
  it("shows earned, wasted, and zero-yen development fixtures", () => {
    render(
      <SessionMoneyStep
        content={content}
        status="placeholder"
        animationSkipped={false}
      />,
    );

    expect(screen.getByText("10,000円")).toBeInTheDocument();
    expect(screen.getByText("1,234円")).toBeInTheDocument();
    expect(screen.getByText("0円")).toBeInTheDocument();
    expect(screen.getAllByText("獲得")).toHaveLength(2);
    expect(screen.getByText("浪費")).toBeInTheDocument();
    expect(screen.getByText("開発用fixtureです。実際の金額・保存結果・設定変更は行いません。")).toBeInTheDocument();
  });

  it("keeps the static final state when the result-flow skip is active", () => {
    render(
      <SessionMoneyStep
        content={content}
        status="placeholder"
        animationSkipped
      />,
    );

    expect(screen.getByText(
      "このステップの演出をスキップしました。表示内容は変わりません。",
    )).toBeInTheDocument();
    expect(document.querySelector(".money-animation--playing")).toBeNull();
  });
});
