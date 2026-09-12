import React from "react";

interface Props {
  children: React.ReactNode;
  /** Shown in the console message, to identify which layer failed. */
  label?: string;
  /** Change this to let the boundary try rendering again (e.g. the equations changed). */
  resetKey?: string;
}

interface State {
  failed: boolean;
}

/**
 * Keeps one bad plot from blanking the whole graph. Without it, a single curve that
 * throws while rendering takes the entire Mafs canvas down with it, which looks like
 * the graph "disappearing" with no explanation.
 */
export class PlotErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      `[math-node] ${this.props.label ?? "plot"} failed to render — the rest of the graph is still shown.`,
      error,
      info.componentStack,
    );
  }

  componentDidUpdate(prevProps: Props) {
    // Only retry on an explicit reset signal; retrying on every render would loop.
    if (this.state.failed && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
