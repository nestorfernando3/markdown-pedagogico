import { useCallback, useState } from 'react';
import type { PedagogicalWarning } from '../utils/markdownParser';

export type TooltipType = 'format' | 'pedagogy';

export interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  type: TooltipType;
  warning: PedagogicalWarning | null;
}

const INITIAL_STATE: TooltipState = {
  visible: false,
  x: 0,
  y: 0,
  type: 'format',
  warning: null,
};

export function useTooltipState() {
  const [tooltipState, setTooltipState] = useState<TooltipState>(INITIAL_STATE);

  const hideTooltip = useCallback(() => {
    setTooltipState((prev) => ({
      ...prev,
      visible: false,
      warning: prev.type === 'pedagogy' ? null : prev.warning,
    }));
  }, []);

  const showFormatTooltip = useCallback((anchorPoint: { x: number; y: number }) => {
    setTooltipState({
      visible: true,
      x: anchorPoint.x,
      y: anchorPoint.y,
      type: 'format',
      warning: null,
    });
  }, []);

  const togglePedagogyTooltip = useCallback((warning: PedagogicalWarning, markerRect: DOMRect) => {
    setTooltipState((prev) => {
      if (prev.visible && prev.warning?.id === warning.id) {
        return {
          ...prev,
          visible: false,
          warning: null,
        };
      }

      return {
        visible: true,
        x: markerRect.left + markerRect.width / 2,
        y: markerRect.bottom + 12,
        type: 'pedagogy',
        warning,
      };
    });
  }, []);

  return {
    tooltipState,
    setTooltipState,
    hideTooltip,
    showFormatTooltip,
    togglePedagogyTooltip,
  };
}
