import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MONEY_ANIMATION_MAX_PARTICLE_COUNT } from "../../constants/moneyAnimation";
import { MoneyAnimation } from "./MoneyAnimation";

const originalIntersectionObserver = window.IntersectionObserver;
type ObserverCallback = (
  entries: readonly Readonly<{ isIntersecting: boolean }>[],
  observer: unknown,
) => void;

afterEach(() => {
  Object.defineProperty(window, "IntersectionObserver", {
    configurable: true,
    value: originalIntersectionObserver,
  });
});

describe("MoneyAnimation", () => {
  it("shows the earned amount as text and animated decorative particles", () => {
    const { container } = render(
      <MoneyAnimation
        amountYen={1_234}
        mode="earned"
        playState="playing"
        runId="earned-run"
        onStart={vi.fn()}
      />,
    );

    expect(screen.getByText("獲得")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "今回得になった金額" }),
    ).toBeInTheDocument();
    expect(screen.getByText("1,234円")).toBeInTheDocument();
    expect(container.querySelector(".money-animation--earned")).not.toBeNull();
    expect(container.querySelector(".money-animation--playing")).not.toBeNull();
    expect(screen.getAllByTestId("money-animation-particle")).toHaveLength(5);
    expect(
      container.querySelector(".money-animation__stage"),
    ).toHaveAttribute("aria-hidden", "true");
  });

  it("uses distinct wasted copy and styling", () => {
    const { container } = render(
      <MoneyAnimation
        amountYen={10_000}
        mode="wasted"
        playState="idle"
        runId="wasted-run"
      />,
    );

    expect(screen.getByText("浪費")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "今回浪費した金額" }),
    ).toBeInTheDocument();
    expect(screen.getByText("10,000円")).toBeInTheDocument();
    expect(container.querySelector(".money-animation--wasted")).not.toBeNull();
    expect(container.querySelector(".money-animation--playing")).toBeNull();
  });

  it.each(["earned", "wasted"] as const)(
    "shows %s zero yen without particles or movement",
    (mode) => {
      const { container } = render(
        <MoneyAnimation
          amountYen={0}
          mode={mode}
          playState="playing"
          runId={`${mode}-zero-run`}
        />,
      );

      expect(screen.getByText("0円")).toBeInTheDocument();
      expect(screen.getByText(
        "今回は0円です。動きはありません。",
      )).toBeInTheDocument();
      expect(container.querySelector(".money-animation--zero")).not.toBeNull();
      expect(container.querySelector(".money-animation--playing")).toBeNull();
      expect(screen.queryAllByTestId("money-animation-particle")).toHaveLength(0);
    },
  );

  it("caps a large amount at the fixed particle count", () => {
    render(
      <MoneyAnimation
        amountYen={Number.MAX_SAFE_INTEGER}
        mode="earned"
        playState="playing"
        runId="large-run"
      />,
    );

    expect(screen.getByText("9,007,199,254,740,991円")).toBeInTheDocument();
    expect(screen.getAllByTestId("money-animation-particle")).toHaveLength(
      MONEY_ANIMATION_MAX_PARTICLE_COUNT,
    );
  });

  it("waits until its stage enters the viewport before animating", () => {
    let observerCallback: ObserverCallback | undefined;
    const disconnect = vi.fn();

    class IntersectionObserverMock {
      constructor(callback: ObserverCallback) {
        observerCallback = callback;
      }

      observe = vi.fn();
      disconnect = disconnect;
      root = null;
      rootMargin = "";
      thresholds = [];
      takeRecords = () => [];
      unobserve = vi.fn();
    }

    Object.defineProperty(window, "IntersectionObserver", {
      configurable: true,
      value: IntersectionObserverMock,
    });

    const { container } = render(
      <MoneyAnimation
        amountYen={1_000}
        mode="earned"
        playState="playing"
        runId="viewport-run"
      />,
    );

    expect(container.querySelector(".money-animation--playing")).toBeNull();

    act(() => {
      observerCallback?.(
        [{ isIntersecting: true }],
        {},
      );
    });

    expect(container.querySelector(".money-animation--playing")).not.toBeNull();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
