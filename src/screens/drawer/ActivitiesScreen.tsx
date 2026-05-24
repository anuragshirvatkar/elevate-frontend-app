import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { setupApi, activitiesApi } from '../../api';
import { colors, spacing, typography, radius } from '../../theme';
import type { ActivityDto, SectionSetup } from '../../types';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import SectionBadge from '../../components/common/SectionBadge';

const SECTIONS = ['power', 'craft'] as const;

const ActivitiesScreen = () => {
  const navigation = useNavigation();
  const [powerSetup, setPowerSetup] = useState<any>(null);
  const [craftSetup, setCraftSetup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState<'power' | 'craft' | null>(null);
  const [newActivityName, setNewActivityName] = useState('');
  const [adding, setAdding] = useState(false);

  const loadSetup = async () => {
    const [power, craft] = await Promise.allSettled([
      setupApi.getSection('power'),
      setupApi.getSection('craft'),
    ]);
    if (power.status === 'fulfilled') setPowerSetup(power.value.data);
    if (craft.status === 'fulfilled') setCraftSetup(craft.value.data);
  };

  useEffect(() => {
    loadSetup().finally(() => setLoading(false));
  }, []);

  const handleAddActivity = async () => {
    if (!newActivityName.trim() || !showAdd) return;
    setAdding(true);
    try {
      await activitiesApi.createCustom(newActivityName.trim(), showAdd);
      await loadSetup();
      setNewActivityName('');
      setShowAdd(null);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to add activity.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Activities</Text>
      </View>

      {loading ? (
        <View style={styles.loadingCenter}><ActivityIndicator color={colors.text} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Power */}
          <Card>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.power }]}>Power Activities</Text>
              <TouchableOpacity onPress={() => setShowAdd(showAdd === 'power' ? null : 'power')}>
                <Ionicons name="add-circle-outline" size={22} color={colors.power} />
              </TouchableOpacity>
            </View>
            {showAdd === 'power' && (
              <View style={styles.addRow}>
                <TextInput
                  style={styles.addInput}
                  placeholder="Activity name"
                  placeholderTextColor={colors.textMuted}
                  value={newActivityName}
                  onChangeText={setNewActivityName}
                  autoFocus
                />
                <Button title="Add" onPress={handleAddActivity} loading={adding} size="sm" />
              </View>
            )}
            {powerSetup?.activities?.length === 0 && <Text style={styles.empty}>No activities yet.</Text>}
            {powerSetup?.activities?.map((act: any) => (
              <View key={act.activityId} style={styles.activityRow}>
                <Text style={styles.activityName}>{act.name}</Text>
                {act.isPrimary && <Text style={styles.primaryBadge}>Primary</Text>}
              </View>
            ))}
          </Card>

          {/* Craft */}
          <Card>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.craft }]}>Craft Activities</Text>
              <TouchableOpacity onPress={() => setShowAdd(showAdd === 'craft' ? null : 'craft')}>
                <Ionicons name="add-circle-outline" size={22} color={colors.craft} />
              </TouchableOpacity>
            </View>
            {showAdd === 'craft' && (
              <View style={styles.addRow}>
                <TextInput
                  style={styles.addInput}
                  placeholder="Activity name"
                  placeholderTextColor={colors.textMuted}
                  value={newActivityName}
                  onChangeText={setNewActivityName}
                  autoFocus
                />
                <Button title="Add" onPress={handleAddActivity} loading={adding} size="sm" />
              </View>
            )}
            {craftSetup?.activities?.length === 0 && <Text style={styles.empty}>No activities yet.</Text>}
            {craftSetup?.activities?.map((act: any) => (
              <View key={act.activityId} style={styles.activityRow}>
                <Text style={styles.activityName}>{act.name}</Text>
                {act.isPrimary && <Text style={styles.primaryBadge}>Primary</Text>}
              </View>
            ))}
          </Card>

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: spacing.xs },
  title: { ...typography.h2, color: colors.text },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, gap: spacing.md },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  sectionTitle: { ...typography.h4 },
  addRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, alignItems: 'center' },
  addInput: { flex: 1, ...typography.body, color: colors.text, backgroundColor: colors.inputBg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.inputBorder, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  activityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  activityName: { ...typography.body, color: colors.text },
  primaryBadge: { ...typography.caption, color: colors.textSecondary, backgroundColor: colors.cardElevated, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  empty: { ...typography.body, color: colors.textMuted, fontStyle: 'italic', paddingVertical: spacing.sm },
});

export default ActivitiesScreen;
