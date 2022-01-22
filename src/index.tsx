import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  GestureStateChangeEvent,
  GestureUpdateEvent,
  PanGestureHandlerEventPayload,
  PinchGestureHandlerEventPayload,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { clamp, useVector } from 'react-native-redash';
import type { PanPinchViewProps } from './types';

export default function PanPinchView({
  containerDimensions = { width: 0, height: 0 },
  contentDimensions = { width: 0, height: 0 },
  minScale = 0.5,
  maxScale = 4,
  initialScale = 1,
  shouldAdjustFocal = false,
  children,
}: PanPinchViewProps) {
  const scale = useSharedValue(initialScale);
  const lastScale = useSharedValue(initialScale);

  const translation = useVector(0, 0);
  const adjustedFocal = useVector(0, 0);
  const offset = useVector(0, 0);
  const origin = useVector(0, 0);

  const isPinching = useSharedValue(false);
  const isResetting = useSharedValue(false);

  const layout = useVector(contentDimensions.width, contentDimensions.height);

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = offset.x.value + translation.x.value;
    const translateY = offset.y.value + translation.y.value;
    return {
      transform: [
        { translateX },
        { translateY },
        { translateX: -layout.x.value / 2 },
        { translateY: -layout.y.value / 2 },
        { scale: scale.value },
        { translateX: (-layout.x.value / 2) * -1 },
        { translateY: (-layout.y.value / 2) * -1 },
      ],
    };
  });

  const animateToInitialState = () => {
    'worklet';

    isResetting.value = true;

    scale.value = withTiming(initialScale);
    lastScale.value = withTiming(initialScale);

    translation.x.value = withTiming(0);
    translation.y.value = withTiming(0);

    offset.x.value = withTiming(0);
    offset.y.value = withTiming(0);

    adjustedFocal.x.value = withTiming(0);
    adjustedFocal.y.value = withTiming(0);

    origin.x.value = withTiming(0);
    origin.y.value = withTiming(0);

    layout.x.value = contentDimensions.width;
    layout.y.value = contentDimensions.height;

    isPinching.value = false;
  };

  const setAdjustedFocal = ({
    focalX,
    focalY,
  }: {
    focalX: number;
    focalY: number;
  }) => {
    'worklet';

    adjustedFocal.x.value = focalX - (layout.x.value / 2 + offset.x.value);
    adjustedFocal.y.value = focalY - (layout.y.value / 2 + offset.y.value);
  };

  const getAdjustedTranslation = () => {
    'worklet';
    return {
      x:
        adjustedFocal.x.value +
        ((-1 * scale.value) / lastScale.value) * origin.x.value,
      y:
        adjustedFocal.y.value +
        ((-1 * scale.value) / lastScale.value) * origin.y.value,
    };
  };

  const getEdges = () => {
    'worklet';
    const pointX =
      (layout.x.value * scale.value - containerDimensions.width) * -1;
    const pointY =
      (layout.y.value * scale.value - containerDimensions.height) * -1;
    return {
      x: {
        min: Math.min(pointX, 0),
        max: Math.max(0, pointX),
      },
      y: {
        min: Math.min(pointY, 0),
        max: Math.max(0, pointY),
      },
    };
  };

  const onGestureStart = () => {
    'worklet';
    offset.x.value = offset.x.value + translation.x.value;
    offset.y.value = offset.y.value + translation.y.value;

    translation.x.value = 0;
    translation.y.value = 0;
  };

  const panGesture = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => {
      'worklet';
      onGestureStart();
    })
    .onUpdate((event: GestureUpdateEvent<PanGestureHandlerEventPayload>) => {
      'worklet';
      if (event.numberOfPointers === 1 && !isPinching.value) {
        translation.x.value = event.translationX;
        translation.y.value = event.translationY;
      }
    });

  const pinchGesture = Gesture.Pinch()
    .onBegin(
      (event: GestureStateChangeEvent<PinchGestureHandlerEventPayload>) => {
        'worklet';

        onGestureStart();

        if (shouldAdjustFocal) {
          setAdjustedFocal({ focalX: event.focalX, focalY: event.focalY });
          origin.x.value = adjustedFocal.x.value;
          origin.y.value = adjustedFocal.y.value;
        }

        lastScale.value = scale.value;
      }
    )
    .onChange((event) => {
      'worklet';

      if (event.numberOfPointers < 2) {
        return;
      }

      isPinching.value = true;
      scale.value = Math.max(scale.value * event.scaleChange, minScale);

      if (shouldAdjustFocal) {
        setAdjustedFocal({ focalX: event.focalX, focalY: event.focalY });
        const adjustedTranslation = getAdjustedTranslation();
        translation.x.value = adjustedTranslation.x;
        translation.y.value = adjustedTranslation.y;
      }
    })
    .onFinalize(() => {
      'worklet';
      if (isPinching.value) {
        isPinching.value = false;

        lastScale.value = scale.value;

        if (lastScale.value > maxScale || lastScale.value < minScale) {
          scale.value = withTiming(clamp(scale.value, minScale, maxScale));
        }
      }
    });

  useAnimatedReaction(
    () => {
      return {
        translationX: translation.x.value,
        translationY: translation.y.value,
        isResetting: isResetting.value,
        scale: scale.value,
        isPinching: isPinching.value,
        offsetX: offset.x.value,
        offsetY: offset.y.value,
      };
    },
    (newTransform, previousTransform) => {
      if (previousTransform !== null) {
        if (isPinching.value) {
          return;
        }
        if (isResetting.value) {
          isResetting.value = false;
          return;
        }
        const edges = getEdges();

        let boundedX = clamp(
          newTransform.translationX,
          edges.x.min - offset.x.value,
          edges.x.max - offset.x.value
        );
        let boundedY = clamp(
          newTransform.translationY,
          edges.y.min - offset.y.value,
          edges.y.max - offset.y.value
        );

        translation.x.value = withTiming(boundedX);
        translation.y.value = withTiming(boundedY);
      }
    }
  );

  const gestures = Gesture.Race(panGesture, pinchGesture);

  useEffect(() => {
    animateToInitialState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    containerDimensions.width,
    containerDimensions.height,
    contentDimensions.width,
    contentDimensions.height,
  ]);

  return (
    <GestureHandlerRootView>
      <GestureDetector gesture={gestures}>
        <View
          style={[
            styles.container,
            {
              width: containerDimensions.width,
              height: containerDimensions.height,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.content,
              {
                width: contentDimensions.width,
                height: contentDimensions.height,
              },
              animatedStyle,
            ]}
          >
            {children}
          </Animated.View>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  content: {
    alignSelf: 'flex-start',
  },
});
