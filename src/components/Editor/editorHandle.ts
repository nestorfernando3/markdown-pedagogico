export interface EditorSelectionRange {
  start: number;
  end: number;
}

export interface EditorTextMetrics {
  font: string;
  fontSize: number;
  lineHeight: number;
  paddingLeft: number;
  paddingTop: number;
  paddingRight: number;
}

export interface EditorHandle {
  focus: () => void;
  getBoundingClientRect: () => DOMRect;
  getScrollTop: () => number;
  getSelection: () => EditorSelectionRange;
  getTextMetrics: () => EditorTextMetrics;
  getValue: () => string;
  isFocused: () => boolean;
  setScrollTop: (scrollTop: number) => void;
  setSelection: (start: number, end: number) => void;
}
