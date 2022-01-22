import React from 'react';

type Dimensions = {
  width: number;
  height: number;
};
export type PanPinchViewProps = {
  /**
   * Dimensions of the container holding the zoomable View.
   * @default {width: 0, height: 0}
   */
  containerDimensions: Dimensions;
  /**
   * Dimensions of the zoomable View.
   */
  contentDimensions: Dimensions;

  /**
   * Elements inside the Animated.View which will be dragged/scaled.
   */
  children: React.ReactNode;
  /**
   * Minimum value of scale.
   * @default 0.5
   */
  minScale?: number;

  /**
   * Maximum value of scale.
   * @default 4
   */
  maxScale?: number;

  /**
   * Initial value of scale.
   * @default 1
   */
  initialScale?: number;

  /**
   * Scale the view based on center of pinching.
   * @default true
   */
  shouldAdjustFocal?: boolean;
};
