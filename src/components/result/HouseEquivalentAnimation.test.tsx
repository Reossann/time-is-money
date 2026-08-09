import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HOUSE_UNIT_YEN } from "../../constants/houseEquivalent";
import { calculateHouseEquivalent } from "../../services/houseEquivalentService";
import {
  HouseEquivalentAnimation,
  HOUSE_EQUIVALENT_ANIMATION_DURATION_MS,
} from "./HouseEquivalentAnimation";

let prefersReducedMotion = false;

function mockReducedMotion() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      addEventListener: vi.fn(),
      matches: prefersReducedMotion,
      removeEventListener: vi.fn(),
    })),
    writable: true,
  });
}

function renderHouseEquivalent(earnedYen: number, wastedYen = 0) {
  return render(
    <HouseEquivalentAnimation
      equivalent={calculateHouseEquivalent({ earnedYen, wastedYen })}
    />,
  );
}

describe("HouseEquivalentAnimation", () => {
  beforeEach(() => {
    prefersReducedMotion = false;
    mockReducedMotion();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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

  it("reports completion once after the house animation finishes", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();

    render(
      <HouseEquivalentAnimation
        equivalent={calculateHouseEquivalent({
          earnedYen: HOUSE_UNIT_YEN / 2,
          wastedYen: 0,
        })}
        onComplete={onComplete}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(HOUSE_EQUIVALENT_ANIMATION_DURATION_MS);
      vi.advanceTimersByTime(HOUSE_EQUIVALENT_ANIMATION_DURATION_MS);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("house-equivalent-animation")).toHaveAttribute(
      "data-animation-state",
      "playing",
    );
  });

  it("cancels the animation and reports a skip once", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const onSkip = vi.fn();
    const equivalent = calculateHouseEquivalent({
      earnedYen: HOUSE_UNIT_YEN / 2,
      wastedYen: 0,
    });
    const view = render(
      <HouseEquivalentAnimation
        equivalent={equivalent}
        onComplete={onComplete}
        onSkip={onSkip}
      />,
    );

    view.rerender(
      <HouseEquivalentAnimation
        animationSkipped
        equivalent={equivalent}
        onComplete={onComplete}
        onSkip={onSkip}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(HOUSE_EQUIVALENT_ANIMATION_DURATION_MS);
    });

    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByTestId("house-equivalent-animation")).toHaveAttribute(
      "data-animation-state",
      "skipped",
    );
  });

  it("uses a static display for zero money and reduced motion", () => {
    const onComplete = vi.fn();
    const zero = calculateHouseEquivalent({ earnedYen: 0, wastedYen: 0 });
    const view = render(
      <HouseEquivalentAnimation equivalent={zero} onComplete={onComplete} />,
    );

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("house-equivalent-animation")).toHaveAttribute(
      "data-animation-state",
      "static",
    );

    prefersReducedMotion = true;
    mockReducedMotion();
    view.unmount();
    render(
      <HouseEquivalentAnimation
        equivalent={calculateHouseEquivalent({
          earnedYen: HOUSE_UNIT_YEN / 2,
          wastedYen: 0,
        })}
      />,
    );

    expect(screen.getByTestId("house-equivalent-animation")).toHaveClass(
      "house-equivalent-animation--reduced-motion",
    );
    expect(screen.getByTestId("house-equivalent-animation")).toHaveAttribute(
      "data-animation-state",
      "static",
    );
  });
});
