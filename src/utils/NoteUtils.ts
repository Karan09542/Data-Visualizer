const MOBILE_BREAKPOINT = 640;

export const getMinNoteWidth = () => {
    if (typeof window === 'undefined') return 360;

    return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches
        ? 300
        : 360;
};