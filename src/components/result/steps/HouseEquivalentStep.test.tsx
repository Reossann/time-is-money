import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { LifetimeMoneySummary } from "../../../types/aggregation";
import type { ResultFlowPreviewContent } from "../../../types/resultFlow";
import { HouseEquivalentStep } from "./HouseEquivalentStep";

const content: ResultFlowPreviewContent = {
  title: "家への換算",
  description: "累計金額を家の建築状況として表示します。",
  responsibleIssue: "#34",
};

function summary(overrides: Partial<LifetimeMoneySummary> = {}): LifetimeMoneySummary {
  return {
    earnedYen: 0,
    netYen: 0,
    ownerId: "owner-1",
    sessionCount: 0,
    wastedYen: 0,
    ...overrides,
  };
}

function renderConnectedStep(
  getSummary: (ownerId: string) => Promise<LifetimeMoneySummary>,
) {
  return render(
    <HouseEquivalentStep
      animationSkipped={false}
      content={content}
      lifetimeSummary={{ getSummary }}
      ownerIdentity={{ getCurrentOwnerId: async () => "owner-1" }}
      status="ready"
    />,
  );
}

describe("HouseEquivalentStep", () => {
  it("keeps preview as a placeholder and does not read persisted data", () => {
    const getSummary = vi.fn(async () => summary());

    render(
      <HouseEquivalentStep
        animationSkipped={false}
        content={content}
        lifetimeSummary={{ getSummary }}
        ownerIdentity={{ getCurrentOwnerId: async () => "owner-1" }}
        status="placeholder"
      />,
    );

    expect(screen.getByText("準備中")).toBeInTheDocument();
    expect(getSummary).not.toHaveBeenCalled();
  });

  it("shows a loading state before the owner-scoped summary resolves", async () => {
    let resolveSummary: ((value: LifetimeMoneySummary) => void) | undefined;
    const getSummary = vi.fn(
      () =>
        new Promise<LifetimeMoneySummary>((resolve) => {
          resolveSummary = resolve;
        }),
    );

    renderConnectedStep(getSummary);

    expect(screen.getByRole("status")).toHaveTextContent(
      "累計金額を読み込んでいます。",
    );
    await waitFor(() => expect(getSummary).toHaveBeenCalledWith("owner-1"));

    resolveSummary?.(summary());
    expect(await screen.findByText("記録がまだありません。")).toBeInTheDocument();
  });

  it("shows an empty house state when no persisted session exists", async () => {
    renderConnectedStep(async () => summary());

    expect(await screen.findByText("記録がまだありません。")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "家0軒と0%分" }),
    ).toBeInTheDocument();
  });

  it("converts the persisted earned and wasted totals", async () => {
    renderConnectedStep(async () =>
      summary({
        earnedYen: 45_000_000,
        netYen: 42_000_000,
        sessionCount: 4,
        wastedYen: 3_000_000,
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "家1軒と50%分" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("累計浪費額は家0軒分を失った可能性があります。"),
    ).toBeInTheDocument();
  });

  it("shows a retry action after an owner or summary error", async () => {
    const user = userEvent.setup();
    const getSummary = vi
      .fn<(ownerId: string) => Promise<LifetimeMoneySummary>>()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce(summary());

    renderConnectedStep(getSummary);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "累計金額を取得できませんでした。",
    );
    await user.click(screen.getByRole("button", { name: "再試行" }));

    expect(await screen.findByText("記録がまだありません。")).toBeInTheDocument();
    expect(getSummary).toHaveBeenCalledTimes(2);
  });
});
