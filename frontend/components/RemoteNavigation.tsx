"use client";

import { useEffect } from "react";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

type Direction = "up" | "down" | "left" | "right";

export function RemoteNavigation() {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      if (event.key === "Escape") {
        active?.blur();
        return;
      }

      const direction = keyDirection(event.key);
      if (!direction || !remoteNavigationApplies()) {
        return;
      }

      if (active?.matches("input, textarea, select, [contenteditable='true']")) {
        return;
      }

      const focusables = visibleFocusables();
      if (focusables.length === 0) {
        return;
      }

      const next = active && focusables.includes(active)
        ? nearestInDirection(active, focusables, direction)
        : focusables.find((element) => element.hasAttribute("data-remote-start")) ?? focusables[0];

      if (!next) {
        return;
      }

      event.preventDefault();
      next.focus({ preventScroll: true });
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      next.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return null;
}

function remoteNavigationApplies(): boolean {
  return window.innerWidth >= 1600 || window.matchMedia("(pointer: coarse)").matches;
}

function visibleFocusables(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(focusableSelector))
    .filter((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();

      return style.display !== "none"
        && style.visibility !== "hidden"
        && element.getAttribute("aria-hidden") !== "true"
        && !element.hasAttribute("data-remote-skip")
        && rect.width > 0
        && rect.height > 0;
    })
    .sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      return leftRect.top - rightRect.top || leftRect.left - rightRect.left;
    });
}

function nearestInDirection(current: HTMLElement, candidates: HTMLElement[], direction: Direction): HTMLElement | null {
  const origin = center(current.getBoundingClientRect());
  let winner: { element: HTMLElement; score: number } | null = null;

  for (const candidate of candidates) {
    if (candidate === current) {
      continue;
    }

    const target = center(candidate.getBoundingClientRect());
    const horizontal = target.x - origin.x;
    const vertical = target.y - origin.y;
    const inDirection = direction === "left" ? horizontal < -1
      : direction === "right" ? horizontal > 1
        : direction === "up" ? vertical < -1
          : vertical > 1;

    if (!inDirection) {
      continue;
    }

    const primary = direction === "left" || direction === "right" ? Math.abs(horizontal) : Math.abs(vertical);
    const secondary = direction === "left" || direction === "right" ? Math.abs(vertical) : Math.abs(horizontal);
    const score = primary + secondary * 2.5;

    if (!winner || score < winner.score) {
      winner = { element: candidate, score };
    }
  }

  return winner?.element ?? null;
}

function center(rect: DOMRect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function keyDirection(key: string): Direction | null {
  if (key === "ArrowUp") return "up";
  if (key === "ArrowDown") return "down";
  if (key === "ArrowLeft") return "left";
  if (key === "ArrowRight") return "right";
  return null;
}
