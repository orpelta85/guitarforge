"use client";
import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex flex-col items-center justify-center gap-4" style={{ background: "#121214" }}>
          <div className="font-heading text-2xl font-bold text-[#C41E3A]">Something went wrong</div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 rounded-md text-sm font-medium cursor-pointer"
            style={{ background: "#D4A843", color: "#121214" }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
