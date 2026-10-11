// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { HomeButton } = await import("@/components/home-button");

afterEach(cleanup);

describe("HomeButton", () => {
  it("links straight to the welcome page, labelled in each language", () => {
    render(<HomeButton lang="en" />);
    expect(screen.getByRole("link", { name: "Home" }).getAttribute("href")).toBe("/");
    cleanup();
    render(<HomeButton lang="vi" />);
    expect(screen.getByRole("link", { name: "Trang chủ" }).getAttribute("href")).toBe("/");
  });
});
