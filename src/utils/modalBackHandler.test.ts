import test from "node:test";
import assert from "node:assert/strict";
import {
  pushModal,
  popModal,
  getModalStack,
  clearModalStack,
  handlePopstate,
  isBackButtonCloseEnabled,
  setBackButtonCloseEnabled,
  _resetForTesting,
} from "./modalBackHandler";

// Mock minimal browser history & window globals for node testing
class MockHistory {
  stack: any[] = [{ state: null, url: "http://localhost/" }];
  index = 0;

  get state() {
    return this.stack[this.index]?.state ?? null;
  }

  get length() {
    return this.stack.length;
  }

  pushState(state: any, _title: string, url?: string) {
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push({ state, url: url || "http://localhost/" });
    this.index = this.stack.length - 1;
  }

  replaceState(state: any, _title: string, url?: string) {
    this.stack[this.index] = { state, url: url || "http://localhost/" };
  }

  back() {
    this.go(-1);
  }

  go(delta: number) {
    const newIdx = this.index + delta;
    if (newIdx >= 0 && newIdx < this.stack.length) {
      this.index = newIdx;
      if (typeof (globalThis as any).window !== "undefined") {
        (globalThis as any).window.dispatchEvent(
          new (globalThis as any).PopStateEvent("popstate", {
            state: this.state,
          })
        );
      }
    }
  }
}

// Set up mock window if not present
if (typeof (globalThis as any).window === "undefined") {
  const listeners: Record<string, ((e: any) => void)[]> = {};
  const mockHistory = new MockHistory();

  (globalThis as any).window = {
    history: mockHistory,
    location: { href: "http://localhost/", pathname: "/" },
    addEventListener: (event: string, cb: any) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(cb);
    },
    removeEventListener: (event: string, cb: any) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((fn) => fn !== cb);
      }
    },
    dispatchEvent: (e: any) => {
      const cbs = listeners[e.type] || [];
      cbs.forEach((fn) => fn(e));
      return true;
    },
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  };
  (globalThis as any).PopStateEvent = class PopStateEvent {
    type: string;
    state: any;
    constructor(type: string, init?: any) {
      this.type = type;
      this.state = init?.state ?? null;
    }
  };
}

test("modalBackHandler: pushes modals and reflects stack in order", () => {
  _resetForTesting();
  setBackButtonCloseEnabled(true);

  let closedA = false;
  let closedB = false;

  pushModal("modal-a", () => {
    closedA = true;
  });
  assert.deepEqual(getModalStack(), ["modal-a"]);

  pushModal("modal-b", () => {
    closedB = true;
  });
  assert.deepEqual(getModalStack(), ["modal-a", "modal-b"]);

  // Topmost modal is modal-b (LIFO)
  handlePopstate();
  assert.equal(closedB, true);
  assert.equal(closedA, false);
  assert.deepEqual(getModalStack(), ["modal-a"]);

  // Next back closes modal-a
  handlePopstate();
  assert.equal(closedA, true);
  assert.deepEqual(getModalStack(), []);

  // Back button on empty stack does nothing
  assert.doesNotThrow(() => handlePopstate());
  assert.deepEqual(getModalStack(), []);
});

test("modalBackHandler: LIFO closing for multi-level nested popups", () => {
  _resetForTesting();
  setBackButtonCloseEnabled(true);

  const closeOrder: string[] = [];

  pushModal("mobile-menu", () => closeOrder.push("mobile-menu"));
  pushModal("quick-utils", () => closeOrder.push("quick-utils"));
  pushModal("media-carousel", () => closeOrder.push("media-carousel"));

  assert.deepEqual(getModalStack(), [
    "mobile-menu",
    "quick-utils",
    "media-carousel",
  ]);

  // 1st back click closes media-carousel
  handlePopstate();
  assert.deepEqual(closeOrder, ["media-carousel"]);
  assert.deepEqual(getModalStack(), ["mobile-menu", "quick-utils"]);

  // 2nd back click closes quick-utils
  handlePopstate();
  assert.deepEqual(closeOrder, ["media-carousel", "quick-utils"]);
  assert.deepEqual(getModalStack(), ["mobile-menu"]);

  // 3rd back click closes mobile-menu
  handlePopstate();
  assert.deepEqual(closeOrder, [
    "media-carousel",
    "quick-utils",
    "mobile-menu",
  ]);
  assert.deepEqual(getModalStack(), []);

  // 4th back click (empty stack, on home screen): normal navigation, no-op in handler
  handlePopstate();
  assert.deepEqual(closeOrder, [
    "media-carousel",
    "quick-utils",
    "mobile-menu",
  ]);
});

test("modalBackHandler: programmatic close removes modal from stack", async () => {
  _resetForTesting();
  setBackButtonCloseEnabled(true);

  let closedA = false;
  let closedB = false;

  pushModal("modal-a", () => {
    closedA = true;
  });
  pushModal("modal-b", () => {
    closedB = true;
  });

  assert.deepEqual(getModalStack(), ["modal-a", "modal-b"]);

  // User closed modal-b programmatically (e.g. clicked 'X')
  popModal("modal-b");
  assert.deepEqual(getModalStack(), ["modal-a"]);
  // onClose was NOT called by popModal (it's called by the UI event that triggered popModal)
  assert.equal(closedB, false);

  // Allow the batched programmatic history rewind to process
  await new Promise((resolve) => setTimeout(resolve, 10));

  // Now back button closes modal-a
  handlePopstate();
  assert.equal(closedA, true);
  assert.deepEqual(getModalStack(), []);
});

test("modalBackHandler: disabled mode does not intercept back navigation", () => {
  _resetForTesting();
  setBackButtonCloseEnabled(false);
  assert.equal(isBackButtonCloseEnabled(), false);

  let closed = false;
  pushModal("modal-disabled", () => {
    closed = true;
  });

  // Since disabled, back button does not close the modal
  handlePopstate();
  assert.equal(closed, false);

  // Clean up
  clearModalStack();
  setBackButtonCloseEnabled(true);
});

test("modalBackHandler: duplicate push moves modal to top of stack", () => {
  _resetForTesting();
  setBackButtonCloseEnabled(true);

  pushModal("modal-1", () => {});
  pushModal("modal-2", () => {});
  assert.deepEqual(getModalStack(), ["modal-1", "modal-2"]);

  // Re-pushing modal-1 should bring it to the top
  pushModal("modal-1", () => {});
  assert.deepEqual(getModalStack(), ["modal-2", "modal-1"]);
});
