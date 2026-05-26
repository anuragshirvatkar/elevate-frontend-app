import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { OnboardingStackScreenProps } from '../../navigation/types';

const LOGO_IMAGE = require('../../../assets/elevate-logo.png');
import BicepIcon from '../../../assets/bicep.svg';
import BrainIcon from '../../../assets/brain.svg';
import CraftIcon from '../../../assets/craft.svg';
import PurityIcon from '../../../assets/purity.svg';
import Button from '../../components/common/Button';
import { colors, spacing } from '../../theme';

const MOUNTAIN_IMAGE = require('../../../assets/mountain.png');


const PILLARS = [
  { label: 'Power', Icon: BicepIcon },
  { label: 'Mind', Icon: BrainIcon },
  { label: 'Craft', Icon: CraftIcon },
  { label: 'Purity', Icon: PurityIcon },
] as const;

const IntroWelcomeScreen: React.FC<OnboardingStackScreenProps<'IntroWelcome'>> = ({
  navigation,
}) => {
  const { width: screenWidth } = useWindowDimensions();

  const heroHeight = useMemo(() => {
    const source = Image.resolveAssetSource(MOUNTAIN_IMAGE);
    const ratio = source.height / source.width;
    return screenWidth * ratio;
  }, [screenWidth]);

  const handleContinue = () => {
    navigation.navigate('CompanionSelect');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.main}>
        <View style={styles.body}>
          <View style={styles.topBlock}>
            <View style={styles.header}>
              <Image source={LOGO_IMAGE} style={styles.logoImage} resizeMode="contain" />
              <Text style={styles.brand}>ELEVATE</Text>
            </View>

            <Text style={styles.headline}>Elevate Your Life{'\n'}With Discipline</Text>
          </View>

          <Image
            source={MOUNTAIN_IMAGE}
            style={{ width: screenWidth, height: heroHeight }}
            resizeMode="stretch"
            accessibilityLabel="Mountain path illustration"
          />

          <View style={styles.infoBlock}>
            <Text style={styles.pillarsTitle}>We focus on 4 pillars</Text>

            <View style={styles.pillarRow}>
              {PILLARS.map(({ label, Icon }) => (
                <View key={label} style={styles.pillarItem}>
                  <View style={styles.pillarIconWrap}>
                    <Icon
                      width={26}
                      height={26}
                      fill={colors.text}
                      stroke={colors.text}
                      color={colors.text}
                    />
                  </View>
                  <Text style={styles.pillarLabel}>{label}</Text>
                </View>
              ))}
            </View>

            {/* <Text style={styles.description}>
              Balance is everything. Power, Mind, Craft, and Purity – master all four pillars for
              true elevation.
            </Text> */}

            <Text style={styles.features}>
              Track your progress • Daily logs & records • Gamified challenges • Stay motivated
              every step
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Button
            title="Let's Elevate  →"
            onPress={handleContinue}
            fullWidth
            size="lg"
            variant="light"
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  main: {
    flex: 1,
    justifyContent: 'space-between',
  },
  body: {
    flex: 1,
  },
  topBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  logoImage: {
    width: 32,
    height: 32,
    marginBottom: 6,
  },
  brand: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 5,
  },
  headline: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: spacing.lg,
  },
  infoBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    alignItems: 'center',
  },
  pillarsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  pillarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: spacing.md,
  },
  pillarItem: {
    flex: 1,
    alignItems: 'center',
    gap: 7,
  },
  pillarIconWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillarLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  description: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.72)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  features: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.42)',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
});

export default IntroWelcomeScreen;