import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { Router } from "wouter";
import ClockIt from "./ClockIt";

type PassthroughProps = {
  children?: React.ReactNode;
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
  transition?: unknown;
  layout?: unknown;
  whileHover?: unknown;
  whileTap?: unknown;
  [key: string]: unknown;
};

function makeMotionComponent(tag: string) {
  return function MotionElement({ children, initial: _i, animate: _a, exit: _e, transition: _t, layout: _l, whileHover: _wh, whileTap: _wt, ...rest }: PassthroughProps) {
    return React.createElement(tag, rest, children);
  };
}

vi.mock("framer-motion", () => ({
  motion: {
    div: makeMotionComponent("div"),
    button: makeMotionComponent("button"),
    span: makeMotionComponent("span"),
    p: makeMotionComponent("p"),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  useReducedMotion: () => false,
}));

vi.mock("@/components/fx", () => ({
  fireConfetti: vi.fn(),
  fireBigCelebration: vi.fn(),
}));

vi.mock("@/components/fx/Doodles", () => ({
  StarDoodle: () => null,
  LightningDoodle: () => null,
}));

vi.mock("@/lib/sfx", () => ({
  useSfx: () => ({
    playCorrect: vi.fn(),
    playWrong: vi.fn(),
    playVictory: vi.fn(),
  }),
}));

vi.mock("@/lib/haptics", () => ({
  hapticCorrect: vi.fn(),
  hapticWrong: vi.fn(),
  hapticVictory: vi.fn(),
}));

vi.mock("@/lib/motion", () => ({
  useReducedMotion: () => false,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/components/ui/BackArrow", () => ({
  BackArrow: () => <button>Back</button>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, className }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("lucide-react", () => {
  const icon = () => null;
  return {
    Calendar: icon,
    Share2: icon,
    ChevronDown: icon,
    Clock: icon,
    Trophy: icon,
    RotateCcw: icon,
    Lock: icon,
    Unlock: icon,
  };
});

const TODAY = new Date().toISOString().split("T")[0];
const STORAGE_KEY = `ptq-guess-the-year-${TODAY}`;

const PUZZLE_YEAR = 1999;

function mockFetch(overrides?: { giveUpYear?: number; guessCorrect?: boolean }) {
  const giveUpYear = overrides?.giveUpYear ?? PUZZLE_YEAR;
  const guessCorrect = overrides?.guessCorrect ?? true;

  global.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
    if (url === "/api/daily/clock-it" && !opts?.method) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          id: TODAY,
          date: TODAY,
          year: PUZZLE_YEAR,
          hints: ["Hint one", "Hint two", "Hint three"] as [string, string, string],
        }),
      } as Response);
    }
    if ((url as string).endsWith("/check") && opts?.method === "POST") {
      const body = JSON.parse(opts.body as string) as { giveUp?: boolean; guess?: number };
      if (body.giveUp) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ correct: false, year: giveUpYear }),
        } as Response);
      }
      if (guessCorrect) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ correct: true, year: PUZZLE_YEAR }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ correct: false }),
      } as Response);
    }
    return Promise.reject(new Error(`Unhandled fetch: ${url}`));
  });
}

function renderClockIt() {
  return render(
    <Router>
      <ClockIt />
    </Router>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mockFetch();
});

afterEach(() => {
  localStorage.clear();
});

describe("ClockIt — failure card (give-up flow)", () => {
  it("shows GAVE UP and the correct year after clicking Give up", async () => {
    renderClockIt();

    await waitFor(() => {
      expect(screen.getByText(/Give up — show me the year/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Give up — show me the year/i));

    await waitFor(() => {
      expect(screen.getByText(/GAVE UP/i)).toBeInTheDocument();
    });

    expect(screen.getByText(String(PUZZLE_YEAR))).toBeInTheDocument();
  });

  it("restore from localStorage: shows failure card with saved year immediately", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        completed: true,
        score: 0,
        hintsUsed: 1,
        gaveUp: true,
        year: PUZZLE_YEAR,
        date: TODAY,
      }),
    );

    renderClockIt();

    await waitFor(() => {
      expect(screen.getByText(/GAVE UP/i)).toBeInTheDocument();
    });

    expect(screen.getByText(String(PUZZLE_YEAR))).toBeInTheDocument();
  });
});

describe("ClockIt — success card (correct guess flow)", () => {
  it("shows a success message and the correct year after entering the right year", async () => {
    renderClockIt();

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/e\.g\. 2007/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/e\.g\. 2007/i);
    fireEvent.change(input, { target: { value: String(PUZZLE_YEAR) } });

    const guessBtn = screen.getByText("Guess!");
    fireEvent.click(guessBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/PERFECT|NICE|CLOCKED/i),
      ).toBeInTheDocument();
    });

    expect(screen.getByText(String(PUZZLE_YEAR))).toBeInTheDocument();
  });

  it("restore from localStorage: shows success card with saved year immediately", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        completed: true,
        score: 3,
        hintsUsed: 1,
        gaveUp: false,
        year: PUZZLE_YEAR,
        date: TODAY,
      }),
    );

    renderClockIt();

    await waitFor(() => {
      expect(screen.getByText(/PERFECT|NICE|CLOCKED/i)).toBeInTheDocument();
    });

    expect(screen.getByText(String(PUZZLE_YEAR))).toBeInTheDocument();
  });
});
