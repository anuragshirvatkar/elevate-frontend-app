import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supportApi, helpApi } from '../../api';
import { colors, spacing, typography, radius } from '../../theme';
import type { SupportIssueType, SupportTicket } from '../../types';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';

const ISSUE_TYPES: { label: string; value: SupportIssueType }[] = [
  { label: 'Bug', value: 'bug' },
  { label: 'Feature Request', value: 'feature_request' },
  { label: 'Account', value: 'account' },
  { label: 'Payment', value: 'payment' },
  { label: 'Other', value: 'other' },
];

type Tab = 'new' | 'my_tickets';

const SupportScreen = () => {
  const navigation = useNavigation();
  const [tab, setTab] = useState<Tab>('new');
  const [issueType, setIssueType] = useState<SupportIssueType>('bug');
  const [ticketTitle, setTicketTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  useEffect(() => {
    helpApi.trigger().catch(() => {});
    if (tab === 'my_tickets') loadTickets();
  }, [tab]);

  const loadTickets = async () => {
    setLoadingTickets(true);
    try {
      const { data } = await supportApi.getTickets();
      setTickets(data.tickets);
    } catch {}
    setLoadingTickets(false);
  };

  const handleSubmit = async () => {
    if (!description.trim() || description.trim().length < 10) {
      Alert.alert('Error', 'Description must be at least 10 characters.');
      return;
    }
    setSubmitting(true);
    try {
      await supportApi.createTicket({
        issueType,
        title: ticketTitle.trim() || undefined,
        description: description.trim(),
      });
      Alert.alert('Submitted', 'Your ticket has been submitted. We\'ll be in touch!');
      setTicketTitle('');
      setDescription('');
      setTab('my_tickets');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to submit ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Support</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['new', 'my_tickets'] as Tab[]).map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'new' ? 'New Ticket' : 'My Tickets'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'new' ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Issue Type</Text>
          <View style={styles.issueTypeRow}>
            {ISSUE_TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[styles.issueChip, issueType === t.value && styles.issueChipActive]}
                onPress={() => setIssueType(t.value)}
              >
                <Text style={[styles.issueChipText, issueType === t.value && styles.issueChipTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Title (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Brief summary"
            placeholderTextColor={colors.textMuted}
            value={ticketTitle}
            onChangeText={setTicketTitle}
            maxLength={150}
          />

          <Text style={styles.fieldLabel}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Describe your issue in detail..."
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={5000}
          />
          <Text style={styles.charCount}>{description.length}/5000</Text>

          <Button
            title="Submit Ticket"
            onPress={handleSubmit}
            loading={submitting}
            fullWidth
            style={styles.submitBtn}
          />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {loadingTickets ? (
            <ActivityIndicator color={colors.text} style={{ marginTop: spacing.xl }} />
          ) : tickets.length === 0 ? (
            <Text style={styles.empty}>No support tickets yet.</Text>
          ) : (
            tickets.map((ticket) => (
              <Card key={ticket.id} style={styles.ticketCard}>
                <View style={styles.ticketHeader}>
                  <Text style={styles.ticketType}>{ticket.issueType.replace('_', ' ').toUpperCase()}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ticket.status) + '22' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(ticket.status) }]}>
                      {ticket.status.replace('_', ' ')}
                    </Text>
                  </View>
                </View>
                {ticket.title && <Text style={styles.ticketTitle}>{ticket.title}</Text>}
                <Text style={styles.ticketDesc} numberOfLines={2}>{ticket.description}</Text>
                <Text style={styles.ticketDate}>{new Date(ticket.createdAt).toLocaleDateString()}</Text>
              </Card>
            ))
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'open': return colors.warning;
    case 'in_progress': return colors.info;
    case 'resolved': return colors.success;
    case 'closed': return colors.textMuted;
    default: return colors.textSecondary;
  }
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: spacing.xs },
  title: { ...typography.h2, color: colors.text },
  tabs: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs + 2, borderRadius: radius.full, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.text, borderColor: colors.text },
  tabText: { ...typography.bodySmall, color: colors.textSecondary },
  tabTextActive: { color: colors.background, fontWeight: '600' },
  content: { padding: spacing.lg, gap: spacing.sm },
  fieldLabel: { ...typography.label, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.xs },
  issueTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  issueChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.full, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  issueChipActive: { backgroundColor: colors.text, borderColor: colors.text },
  issueChipText: { ...typography.bodySmall, color: colors.textSecondary },
  issueChipTextActive: { color: colors.background, fontWeight: '600' },
  input: { ...typography.body, color: colors.text, backgroundColor: colors.inputBg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.inputBorder, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.md },
  textarea: { minHeight: 120, textAlignVertical: 'top' },
  charCount: { ...typography.caption, color: colors.textMuted, textAlign: 'right', marginTop: -spacing.sm, marginBottom: spacing.md },
  submitBtn: { marginTop: spacing.sm },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', padding: spacing.xl },
  ticketCard: { marginBottom: spacing.sm },
  ticketHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  ticketType: { ...typography.label, color: colors.textMuted, fontSize: 10, letterSpacing: 1 },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  statusText: { ...typography.caption, fontWeight: '600' },
  ticketTitle: { ...typography.h4, color: colors.text, marginBottom: spacing.xs },
  ticketDesc: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },
  ticketDate: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});

export default SupportScreen;
