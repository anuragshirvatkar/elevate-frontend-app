import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing } from '../../theme';

const PILLARS = [
  { label: 'Power', sub: 'Train your body' },
  { label: 'Mind', sub: 'Sharpen your thinking' },
  { label: 'Craft', sub: 'Build your skill' },
  { label: 'Purity', sub: 'Protect your energy' },
];

const PHILOSOPHY_LINES = [
  'Growth is not one big moment.',
  'It is daily repetition.',
  'Miss a day, continue tomorrow.',
  'Keep moving forward.',
];

const CONNECT_ITEMS: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  url: string;
}[] = [
  {
    icon: 'logo-instagram',
    label: 'Instagram',
    value: '@elevate42426',
    url: 'https://instagram.com/elevate42426',
  },
  {
    icon: 'globe-outline',
    label: 'Website',
    value: 'elevateyourlife.app',
    url: 'https://elevateyourlife.app',
  },
];

const AboutScreen = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <Text style={s.headerTitle}>About</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Hero ── */}
        <View style={s.heroBlock}>
          <Text style={s.heroName}>Elevate</Text>
          <Text style={s.heroTagline}>Build yourself daily.</Text>
          <Text style={s.heroBody}>
            Built for people who want to improve one day at a time. Small actions, repeated every day, become a stronger life.
          </Text>
        </View>

        <View style={s.sep} />

        {/* ── Pillars 2×2 grid ── */}
        <Text style={s.sectionTitle}>What we build</Text>
        <View style={s.pillarsGrid}>
          {PILLARS.map((p) => (
            <View key={p.label} style={s.pillarCard}>
              <Text style={s.pillarLabel}>{p.label}</Text>
              <Text style={s.pillarSub}>{p.sub}</Text>
            </View>
          ))}
        </View>

        <View style={s.sep} />

        {/* ── Philosophy ── */}
        <Text style={s.sectionTitle}>Our Philosophy</Text>
        <View style={s.manifestoBlock}>
          {PHILOSOPHY_LINES.map((line, idx) => (
            <View key={idx} style={s.manifestoRow}>
              <View style={s.manifestoDot} />
              <Text style={[
                s.manifestoLine,
                idx === 0 || idx === 2 ? s.manifestoLineStrong : s.manifestoLineMuted,
              ]}>
                {line}
              </Text>
            </View>
          ))}
        </View>

        <View style={s.sep} />

        {/* ── Connect ── */}
        <Text style={s.sectionTitle}>Connect</Text>
        {CONNECT_ITEMS.map((item, idx) => (
          <TouchableOpacity
            key={item.label}
            style={[s.connectRow, idx < CONNECT_ITEMS.length - 1 && s.connectRowBorder]}
            onPress={() => Linking.openURL(item.url)}
            activeOpacity={0.7}
          >
            <View style={s.connectIcon}>
              <Ionicons name={item.icon} size={18} color="#888" />
            </View>
            <View style={s.connectBody}>
              <Text style={s.connectLabel}>{item.label}</Text>
              <Text style={s.connectValue}>{item.value}</Text>
            </View>
            <Ionicons name="arrow-forward" size={14} color="#333" />
          </TouchableOpacity>
        ))}

        <View style={s.sep} />

        {/* ── Bottom tagline ── */}
        <View style={s.bottomBlock}>
          <Text style={s.bottomLine}>Become stronger than your excuses.</Text>
          <View style={s.bottomPillarsRow}>
            {['Mind', 'Power', 'Craft', 'Purity'].map((p, i) => (
              <React.Fragment key={p}>
                <Text style={s.bottomPillar}>{p}</Text>
                {i < 3 && <View style={s.bottomDot} />}
              </React.Fragment>
            ))}
          </View>
        </View>

        <View style={{ height: 52 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { width: 36 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.text },

  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  sep: { height: 1, backgroundColor: '#1E1E1E', marginVertical: spacing.lg },
  sectionTitle: { fontSize: 11, fontWeight: '600', color: '#444', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: spacing.md },

  // Hero
  heroBlock: { gap: 12 },
  heroName: { fontSize: 48, fontWeight: '800', color: colors.text, letterSpacing: -2, lineHeight: 52 },
  heroTagline: { fontSize: 18, color: '#666', fontWeight: '400' },
  heroBody: { fontSize: 15, color: '#555', lineHeight: 24 },

  // Pillars grid
  pillarsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pillarCard: {
    width: '47.5%',
    backgroundColor: '#0d0d0d',
    borderWidth: 1,
    borderColor: '#1a1a1a',
    borderRadius: 12,
    padding: spacing.md,
    gap: 6,
  },
  pillarLabel: { fontSize: 17, fontWeight: '700', color: colors.text },
  pillarSub: { fontSize: 12, color: '#555', lineHeight: 17 },

  // Manifesto
  manifestoBlock: { gap: 14 },
  manifestoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  manifestoDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#333', marginTop: 9, flexShrink: 0 },
  manifestoLine: { flex: 1, fontSize: 16, lineHeight: 24 },
  manifestoLineStrong: { color: colors.text, fontWeight: '600' },
  manifestoLineMuted: { color: '#555', fontWeight: '400' },

  // Connect
  connectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
  },
  connectRowBorder: { borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  connectIcon: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: '#0d0d0d',
    borderWidth: 1, borderColor: '#1a1a1a',
    alignItems: 'center', justifyContent: 'center',
  },
  connectBody: { flex: 1 },
  connectLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  connectValue: { fontSize: 12, color: '#555', marginTop: 2 },

  // Bottom
  bottomBlock: { alignItems: 'center', gap: 12, paddingVertical: spacing.md },
  bottomLine: { fontSize: 17, fontWeight: '700', color: '#fff', textAlign: 'center', letterSpacing: -0.3 },
  bottomPillarsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bottomPillar: { fontSize: 12, color: '#3a3a3a', fontWeight: '600', letterSpacing: 0.5 },
  bottomDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#2a2a2a' },
});

export default AboutScreen;
