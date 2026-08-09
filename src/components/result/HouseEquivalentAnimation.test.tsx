import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HOUSE_UNIT_YEN } from "../../constants/houseEquivalent";
import { calculateHouseEquivalent } from "../../services/houseEquivalentService";
import { HouseEquivalentAnimation } from "./HouseEquivalentAnimation";

function renderHouseEquivalent(earnedYen: number, wastedYen = 0) {
  return render(
    <HouseEquivalentAnimation
      equivalent={calculateHouseEquivalent({ earnedYen, wastedYen })}
    />,
  );
}

describe("HouseEquivalentAnimation", () => {
  it("shows a foundation and guidance when no money has been earned", () => {
    renderHouseEquivalent(0);

    expect(
      screen.getByRole("heading", { name: "家0軒と0%分" }),
    ).toBeInTheDocument();
    expect(screen.getByText("まずは基礎づくりから。")).toBeInTheDocument();
    expect(screen.getByTestId("house-equivalent-current-house")).toHaveAttribute(
      "data-stage",
      "foundation",
    );
    expect(
      screen.queryByText(/失った可能性があります/),
    ).not.toBeInTheDocument();
  });

  it.each([
    [0, "foundation"],
    [20, "frame"],
    [45, "walls"],
    [70, "roof"],
    [90, "finishing"],
  ] as const)("renders the %i%% construction stage", (progress, stage) => {
    renderHouseEquivalent((HOUSE_UNIT_YEN * progress) / 100);

    expect(screen.getByTestId("house-equivalent-current-house")).toHaveAttribute(
      "data-stage",
      stage,
    );
    expect(
      screen.getByText(`建設中: ${progress}%`, { exact: false }),
    ).toBeInTheDocument();
  });

  it("renders up to three completed houses and summarizes the rest", () => {
    renderHouseEquivalent(HOUSE_UNIT_YEN * 4 + HOUSE_UNIT_YEN / 2);

    expect(
      screen.getByRole("heading", { name: "家4軒と50%分" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByTestId("house-equivalent-completed-house"),
    ).toHaveLength(3);
    expect(screen.getByTestId("house-equivalent-additional-count")).toHaveTextContent(
      "ほか1軒",
    );
    expect(screen.getByText("次の1軒まで")).toBeInTheDocument();
    expect(screen.getByText("あと15,000,000円")).toBeInTheDocument();
  });

  it("does not reduce completed houses when waste is recorded", () => {
    renderHouseEquivalent(HOUSE_UNIT_YEN * 3, HOUSE_UNIT_YEN * 2);

    expect(screen.getByText("完成した家")).toBeInTheDocument();
    expect(screen.getByText("3軒")).toBeInTheDocument();
    expect(
      screen.getAllByTestId("house-equivalent-completed-house"),
    ).toHaveLength(3);
    expect(
      screen.getByText("累計浪費額は家2軒分を失った可能性があります。"),
    ).toBeInTheDocument();
  });

  it("keeps the rendered house count bounded for large totals", () => {
    renderHouseEquivalent(HOUSE_UNIT_YEN * 10_000);

    expect(
      screen.getAllByTestId("house-equivalent-completed-house"),
    ).toHaveLength(3);
    expect(screen.getByTestId("house-equivalent-additional-count")).toHaveTextContent(
      "ほか9997軒",
    );
    expect(screen.getByText("累計獲得額:")).toBeInTheDocument();
    expect(screen.getByText("300,000,000,000円")).toBeInTheDocument();
  });
});
