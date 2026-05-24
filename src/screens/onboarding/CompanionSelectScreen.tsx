import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { OnboardingStackScreenProps } from '../../navigation/types';
import { setupApi } from '../../api';
import Button from '../../components/common/Button';
import { colors, spacing, typography } from '../../theme';
import type { CompanionDto } from '../../types';

const CompanionSelectScreen: React.FC<
  OnboardingStackScreenProps<'CompanionSelect'>
> = ({ navigation, route }) => {
  const { width: screenWidth } = useWindowDimensions();
  const [companions, setCompanions] = useState<CompanionDto[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const getCompanionColor = (name: string): string => {
    const colorMap: { [key: string]: string } = {
      'Captain Blackvein': '#3DFF86',
      'Tharok Warborn': '#FFC857',
      'Arkan Veylor': '#FF5A5A',
      'Seris Astraea': '#54A9FF',
      Monk: '#FFC857',
      Warrior: '#FF5A5A',
      Sage: '#54A9FF',
    };
    return colorMap[name] || '#3DFF86';
  };

  const truncateDescription = (description: string): string => {
    const emDashIndex = description.indexOf('—');
    if (emDashIndex !== -1) {
      return description.substring(0, emDashIndex).trim();
    }
    return description;
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        // Skip auto-routing when user intentionally navigated back
        if (route.params?.skipRouting) {
          const [{ data: options }, { data: progress }] = await Promise.all([
            setupApi.getOptions(),
            setupApi.getProgress(),
          ]);
          setCompanions(options.companions);
          if (progress.selectedCompanion) {
            setSelected(progress.selectedCompanion.id);
          }
          setLoading(false);
          return;
        }

        // Check existing progress first
        const { data: progress } = await setupApi.getProgress();
        console.log('Existing progress:', progress);

        // Route to the first incomplete onboarding step
        if (progress.onboardingCompleted) {
          return; // Root navigator handles this case
        }

        if (progress.selectedCompanion) {
          if (!progress.dob) {
            console.log('Companion set, no DOB → DOBSelect');
            navigation.replace('DOBSelect');
            return;
          }

          // Check actual completion by looking for user-selected data
          const powerDone = (progress.sections?.power?.activities?.length ?? 0) > 0;
          const craftDone = (progress.sections?.craft?.activities?.length ?? 0) > 0;
          const mindDone =
            (progress.sections?.mind?.books?.length ?? 0) > 0 ||
            !!(progress.sections?.mind as any)?.skipMind;

          if (!powerDone) {
            console.log('DOB set, no power activities → SetupPower');
            navigation.replace('SetupPower');
            return;
          }
          if (!craftDone) {
            console.log('Power done, no craft activities → SetupCraft');
            navigation.replace('SetupCraft');
            return;
          }
          if (!mindDone) {
            console.log('Craft done, no mind books → SetupMind');
            navigation.replace('SetupMind');
            return;
          }

          console.log('All sections done → SetupMind');
          navigation.replace('SetupMind');
          return;
        }

        // Load companions for selection
        const { data: options } = await setupApi.getOptions();
        setCompanions(options.companions);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load data:', error);
        setLoading(false);
      }
    };

    loadData();
  }, [navigation]);

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / screenWidth);
    setCurrentIndex(index);
  };

  const handleContinue = async () => {
    if (!selected) {
      Alert.alert('Error', 'Please select a companion first');
      return;
    }
    setSaving(true);
    try {
      console.log('Saving companion selection:', selected);
      await setupApi.saveProgress({ companionId: selected });
      console.log('Successfully saved companion selection');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.navigate('DOBSelect');
    } catch (error) {
      console.error('Failed to save companion selection:', error);
      Alert.alert('Error', 'Failed to save selection. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ width: 40 }} />

        <View style={styles.progressRing}>
          <Svg width={40} height={40} viewBox="0 0 40 40">
            <Circle
              cx={20} cy={20} r={16}
              stroke={colors.border}
              strokeWidth={3}
              fill="none"
            />
            <Circle
              cx={20} cy={20} r={16}
              stroke={colors.text}
              strokeWidth={3}
              fill="none"
              strokeDasharray={2 * Math.PI * 16}
              strokeDashoffset={2 * Math.PI * 16 * (1 - 1 / 5)}
              strokeLinecap="round"
              rotation="-90"
              origin="20, 20"
            />
          </Svg>
          <Text style={styles.stepText}>1/5</Text>
        </View>
      </View>
      <View style={styles.headerContainer}>
        <Text style={styles.title}>Choose your{'\n'}companion</Text>
        <Text style={styles.subtitle}>
          Your companion will guide you through your journey.
        </Text>
      </View>

      {/* Full-width carousel */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
        style={styles.carousel}
      >
        {companions.map((item) => {
          const isSelected = selected === item.id;
          const companionColor = getCompanionColor(item.name);

          return (
            <View key={item.id} style={[styles.page, { width: screenWidth }]}>
              <View style={styles.cardWrapper}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setSelected(item.id)}
                  style={[
                    styles.imageCard,
                    {
                      borderColor: companionColor,
                      shadowColor: companionColor,
                      shadowOpacity: 0.85,
                      shadowRadius: 28,
                      shadowOffset: { width: 0, height: 0 },
                      elevation: 28,
                    },
                  ]}
                >
                  {item.image ? (
                    <Image
                      source={{ uri: item.image }}
                      style={styles.companionImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={styles.emoji}>🏴‍☠️</Text>
                  )}
                </TouchableOpacity>

                {/* Selection badge – placed outside imageCard to avoid clipping */}
                {isSelected && (
                  <View
                    style={[
                      styles.selectionBadge,
                      {
                        backgroundColor: companionColor,
                        shadowColor: companionColor,
                      },
                    ]}
                  >
                    <Text style={styles.selectionBadgeText}>✓</Text>
                  </View>
                )}
              </View>

              <Text style={styles.companionName}>{item.name}</Text>
              {!!item.description && (
                <Text numberOfLines={2} style={styles.companionDesc}>
                  {truncateDescription(item.description)}
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Footer section with padding */}
      <View style={styles.footerContainer}>
        <View style={styles.indicatorContainer}>
          {companions.map((_, i) => (
            <View
              key={i}
              style={[
                styles.indicator,
                i === currentIndex && styles.indicatorActive,
              ]}
            />
          ))}
        </View>
        <View style={styles.footer}>
          <Button
            title="Continue"
            onPress={handleContinue}
            loading={saving}
            disabled={!selected}
            fullWidth
            size="lg"
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#000',
  },
  loading: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  progressRing: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    ...typography.label,
    color: colors.text,
    fontSize: 11,
    position: 'absolute',
  },
  headerContainer: {
    paddingHorizontal: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: '#fff',
    marginTop: 20,
    lineHeight: 35,
  },
  subtitle: {
    ...typography.body,
    color: '#888',
    marginTop: 8,
    marginBottom: 30,
  },
  carousel: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 0,
  },
  page: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  cardWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible', // so badge can sit outside the card
    marginVertical: 10,
    position: 'relative', // for absolute positioning of badge
  },
  imageCard: {
    width: 280,
    height: 280,
    borderRadius: 25,
    overflow: 'hidden', // keeps image inside rounded corners
    borderWidth: 2,
    backgroundColor: '#111',
    shadowOpacity: 0.9,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 30,
  },
  companionImage: {
    width: '100%',
    height: '100%',
  },
  emoji: {
    fontSize: 100,
    textAlign: 'center',
    textAlignVertical: 'center',
    flex: 1,
  },
  selectionBadge: {
    position: 'absolute',
    top: -8,        // half outside the card
    right: -8,      // half outside the card
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 0.8,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
    zIndex: 20,
  },
  selectionBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 10,
  },
  companionName: {
    ...typography.h3,
    color: '#fff',
    marginTop: 20,
    textAlign: 'center',
  },
  companionDesc: {
    ...typography.body,
    color: '#888',
    textAlign: 'center',
    paddingHorizontal: 30,
    marginTop: 8,
  },
  footerContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 20,
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 8,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  indicatorActive: {
    backgroundColor: '#fff',
  },
  footer: {
    paddingVertical: 10,
  },
});

export default CompanionSelectScreen;