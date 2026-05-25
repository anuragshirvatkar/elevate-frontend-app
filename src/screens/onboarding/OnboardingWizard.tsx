import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  SlideInRight,
  SlideInLeft,
  SlideOutRight,
  SlideOutLeft,
} from 'react-native-reanimated';
import { setupApi } from '../../api';
import IntroWelcomeScreen from './IntroWelcomeScreen';
import CompanionSelectScreen from './CompanionSelectScreen';
import DOBSelectScreen from './DOBSelectScreen';
import SetupPowerScreen from './SetupPowerScreen';
import SetupCraftScreen from './SetupCraftScreen';
import SetupMindScreen from './SetupMindScreen';

type Step = 0 | 1 | 2 | 3 | 4 | 5;
type Direction = 'forward' | 'back';

const SCREEN_NAMES = [
  'IntroWelcome',
  'CompanionSelect',
  'DOBSelect',
  'SetupPower',
  'SetupCraft',
  'SetupMind',
] as const;

const screens = [
  IntroWelcomeScreen,
  CompanionSelectScreen,
  DOBSelectScreen,
  SetupPowerScreen,
  SetupCraftScreen,
  SetupMindScreen,
];

const OnboardingWizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<Step>(0);
  const [direction, setDirection] = useState<Direction>('forward');
  const [isAnimating, setIsAnimating] = useState(false);
  const [routeParams, setRouteParams] = useState<any>({});
  const [introChecked, setIntroChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: progress } = await setupApi.getProgress();
        // Skip intro only once a companion has been chosen
        if (!cancelled && progress.selectedCompanion) {
          setCurrentStep(1);
        }
      } catch {
        // If the request fails just show the intro
      } finally {
        if (!cancelled) setIntroChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const next = useCallback(() => {
    if (isAnimating || currentStep >= 5) return;
    setIsAnimating(true);
    setDirection('forward');
    setCurrentStep((prev) => (prev + 1) as Step);
    setTimeout(() => setIsAnimating(false), 300);
  }, [currentStep, isAnimating]);

  const back = useCallback(() => {
    if (isAnimating || currentStep <= 0) return;
    setIsAnimating(true);
    setDirection('back');
    setCurrentStep((prev) => (prev - 1) as Step);
    setTimeout(() => setIsAnimating(false), 300);
  }, [currentStep, isAnimating]);

  const goToStep = useCallback((step: Step) => {
    if (isAnimating || step === currentStep) return;
    setIsAnimating(true);
    setDirection(step > currentStep ? 'forward' : 'back');
    setCurrentStep(step);
    setTimeout(() => setIsAnimating(false), 300);
  }, [currentStep, isAnimating]);

  // Create navigation adapter that mimics React Navigation interface
  const navigation = useMemo(() => ({
    navigate: (screenName: string, params?: any) => {
      const targetStep = SCREEN_NAMES.indexOf(screenName as any);
      if (targetStep !== -1) {
        // Set params first, then change step after state update
        setRouteParams(params || {});
        setTimeout(() => {
          goToStep(targetStep as Step);
        }, 0);
      }
    },
    replace: (screenName: string, params?: any) => {
      const targetStep = SCREEN_NAMES.indexOf(screenName as any);
      if (targetStep !== -1) {
        setRouteParams(params || {});
        setTimeout(() => {
          goToStep(targetStep as Step);
        }, 0);
      }
    },
    goBack: () => {
      back();
    },
    reset: (state: any) => {
      // Navigate to first screen in state
      if (state?.routes?.[0]?.name) {
        const targetStep = SCREEN_NAMES.indexOf(state.routes[0].name as any);
        if (targetStep !== -1) {
          goToStep(targetStep as Step);
        }
      }
    },
    setParams: (params: any) => {
      setRouteParams(params);
    },
    addListener: () => () => {}, // No-op
    removeListener: () => {}, // No-op
    isFocused: () => true,
    canGoBack: () => currentStep > 0,
    getId: () => `step-${currentStep}`,
    getParent: () => null,
    getState: () => ({
      routes: SCREEN_NAMES.map((name, index) => ({
        name,
        key: `step-${index}`,
      })),
      index: currentStep,
      history: [],
      key: 'wizard-root',
      routeNames: SCREEN_NAMES,
      type: 'stack',
    }),
  }), [currentStep, goToStep, back, setRouteParams]);

  const route = useMemo(() => {
    const screenName = SCREEN_NAMES[currentStep];
    const params: any = { ...routeParams };
    
    return {
      params,
      key: `step-${currentStep}`,
      name: screenName as any,
      path: undefined,
    };
  }, [currentStep, routeParams]);

  const renderScreen = useCallback(() => {
    const CurrentScreen = screens[currentStep] as React.FC<any>;
    
    const enterAnimation = direction === 'forward' ? SlideInRight : SlideInLeft;
    const exitAnimation = direction === 'forward' ? SlideOutLeft : SlideOutRight;

    return (
      <Animated.View
        entering={enterAnimation.duration(300)}
        exiting={exitAnimation.duration(300)}
        style={StyleSheet.absoluteFill}
        key={`step-${currentStep}-${direction}`}
      >
        <CurrentScreen navigation={navigation} route={route} />
      </Animated.View>
    );
  }, [currentStep, direction, navigation, route]);

  if (!introChecked) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      {renderScreen()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});

export default OnboardingWizard;
