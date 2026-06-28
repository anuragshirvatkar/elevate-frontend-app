import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { OnboardingStackScreenProps } from '../../navigation/types';
import { setupApi } from '../../api';
import Button from '../../components/common/Button';
import { colors, spacing, typography } from '../../theme';
import { useAlert } from '../../context/AlertContext';
import type { CompanionDto } from '../../types';
import { getCompanionColor, sortCompanions } from '../../utils/companions';
import { optimizeCloudinaryUrl } from '../../utils/cloudinary';

const CompanionSelectScreen: React.FC<
  OnboardingStackScreenProps<'CompanionSelect'>
> = ({ navigation, route }) => {
  const { width: screenWidth } = useWindowDimensions();
  const { showAlert } = useAlert();
  const [companions, setCompanions] = useState<CompanionDto[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scrollViewReady, setScrollViewReady] = useState(false);
  const [imageLoaded, setImageLoaded] = useState<Record<string, boolean>>({});
  const pendingScrollIndex = useRef<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);

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
        const [{ data: options }, { data: progress }] = await Promise.all([
          setupApi.getOptions(),
          setupApi.getProgress(),
        ]);

        const sortedCompanions = sortCompanions(options.companions);
        setCompanions(sortedCompanions);

        // Always load the previously selected companion if it exists
        if (progress.selectedCompanion) {
          const prevSelected = progress.selectedCompanion;
          setSelected(prevSelected.id);
          // Find the index of the selected companion to scroll to it
          const selectedIndex = sortedCompanions.findIndex(
            (c) => c.id === prevSelected.id
          );
          if (selectedIndex !== -1) {
            setCurrentIndex(selectedIndex);
            pendingScrollIndex.current = selectedIndex;
          }
        } else if (sortedCompanions.length > 0) {
          setSelected(sortedCompanions[0].id);
        }

        // Skip auto-routing when user intentionally navigated back
        if (route.params?.skipRouting) {
          setTimeout(() => setLoading(false), 500);
          return;
        }

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

          if (!progress.gender) {
            console.log('DOB set, no gender → GenderSelect');
            navigation.replace('GenderSelect');
            return;
          }

          // Check actual completion by looking for user-selected data
          const powerDone = (progress.sections?.power?.activities?.length ?? 0) > 0;
          const craftDone = (progress.sections?.craft?.activities?.length ?? 0) > 0;
          const mindDone =
            (progress.sections?.mind?.books?.length ?? 0) > 0 ||
            !!(progress.sections?.mind as any)?.skipMind;

          if (!powerDone) {
            console.log('Gender set, no power activities → SetupPower');
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

        // Delay hiding loader to allow images to preload
        setTimeout(() => setLoading(false), 800);
      } catch (error) {
        console.error('Failed to load data:', error);
        setLoading(false);
      }
    };

    loadData();
  }, [navigation, route.params?.skipRouting, screenWidth]);

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / screenWidth);
    if (index !== currentIndex) {
      setCurrentIndex(index);
      if (companions[index]) {
        setSelected(companions[index].id);
      }
    }
  };

  const scrollToIndex = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * screenWidth, animated: true });
    setCurrentIndex(index);
    if (companions[index]) {
      setSelected(companions[index].id);
    }
  };

  const handleContinue = async () => {
    const currentId = selected ?? companions[0]?.id;
    if (!currentId) return;
    setSaving(true);
    try {
      console.log('Saving companion selection:', selected);
      await setupApi.saveProgress({ companionId: selected ?? companions[0]?.id });
      console.log('Successfully saved companion selection');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.navigate('DOBSelect');
    } catch (error) {
      console.error('Failed to save companion selection:', error);
      showAlert('Error', 'Failed to save selection. Please try again.');
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
        <TouchableOpacity onPress={() => navigation.replace('IntroWelcome')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>

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
              strokeDashoffset={2 * Math.PI * 16 * (1 - 1 / 6)}
              strokeLinecap="round"
              rotation="-90"
              origin="20, 20"
            />
          </Svg>
          <Text style={styles.stepText}>1/6</Text>
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
        onLayout={() => {
          setScrollViewReady(true);
          if (pendingScrollIndex.current !== null && screenWidth > 0) {
            scrollRef.current?.scrollTo({ x: pendingScrollIndex.current * screenWidth, animated: false });
            pendingScrollIndex.current = null;
          }
        }}
      >
        {companions.map((item) => {
          const companionColor = getCompanionColor(item.name);

          return (
            <View key={item.id} style={[styles.page, { width: screenWidth }]}>
              <View style={styles.cardWrapper}>
                <View
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
                    <>
                      {!imageLoaded[item.id] && (
                        <View style={styles.imageLoader}>
                          <ActivityIndicator size="large" color={companionColor} />
                        </View>
                      )}
                      <Image
                        source={{ uri: optimizeCloudinaryUrl(item.image, 360) }}
                        style={[styles.companionImage, !imageLoaded[item.id] && styles.imageHidden]}
                        resizeMode="contain"
                        onLoadEnd={() => setImageLoaded(prev => ({ ...prev, [item.id]: true }))}
                        onError={() => setImageLoaded(prev => ({ ...prev, [item.id]: true }))}
                      />
                    </>
                  ) : (
                    <Text style={styles.emoji}>🏴‍☠️</Text>
                  )}
                </View>
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
        {/* Avatar preview strip */}
        <View style={styles.avatarStrip}>
          {companions.map((item, i) => {
            const isActive = i === currentIndex;
            const companionColor = getCompanionColor(item.name);
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => scrollToIndex(i)}
                activeOpacity={0.75}
                style={[
                  styles.avatarThumb,
                  isActive && {
                    borderColor: companionColor,
                    borderWidth: 2,
                    transform: [{ scale: 1.15 }],
                  },
                ]}
              >
                {item.image ? (
                  <Image
                    source={{ uri: optimizeCloudinaryUrl(item.image, 48) }}
                    style={styles.avatarThumbImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.avatarThumbEmoji}>🏴‍☠️</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.swipeHint}>Swipe to explore · tap to jump</Text>

        <View style={styles.footer}>
          <Button
            title="Continue"
            onPress={handleContinue}
            loading={saving}
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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  backText: {
    ...typography.body,
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    textShadowColor: '#FFFFFF',
    textShadowRadius: 4,
    lineHeight: 20,
    textAlign: 'center',
    includeFontPadding: false,
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
    marginTop: 10,
    lineHeight: 35,
  },
  subtitle: {
    ...typography.body,
    color: '#888',
    marginTop: 6,
    marginBottom: 16,
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
    paddingBottom: 32,
  },
  cardWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible', // so badge can sit outside the card
    marginVertical: 10,
    position: 'relative', // for absolute positioning of badge
  },
  imageCard: {
    width: 255,
    height: 255,
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
  imageHidden: {
    opacity: 0,
  },
  imageLoader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  emoji: {
    fontSize: 100,
    textAlign: 'center',
    textAlignVertical: 'center',
    flex: 1,
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
  avatarStrip: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    paddingVertical: 8,
  },
  avatarThumb: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarThumbImage: {
    width: '100%',
    height: '100%',
  },
  avatarThumbEmoji: {
    fontSize: 22,
    textAlign: 'center',
    lineHeight: 46,
  },
  swipeHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  footer: {
    paddingVertical: 4,
  },
});

export default CompanionSelectScreen;