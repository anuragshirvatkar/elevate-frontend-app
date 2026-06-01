import React, { useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Image, Modal,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { supportApi, helpApi } from '../../api';
import { colors, spacing, typography } from '../../theme';
import { useAlert } from '../../context/AlertContext';
import type { SupportIssueType, SupportTicket } from '../../types';

const ISSUE_TYPES: { label: string; value: SupportIssueType }[] = [
  { label: 'Bug', value: 'bug' },
  { label: 'Feature Request', value: 'feature' },
  { label: 'Feedback', value: 'feedback' },
  { label: 'Account', value: 'account' },
  { label: 'Other', value: 'other' },
];

interface PickedImage {
  uri: string;
  name: string;
  type: string;
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const today = new Date();
  const yest = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const SupportScreen = () => {
  const navigation = useNavigation();
  const { showAlert } = useAlert();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [issueType, setIssueType] = useState<SupportIssueType>('bug');
  const [ticketTitle, setTicketTitle] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<PickedImage[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const formScrollRef = useRef<ScrollView>(null);

  const loadTickets = useCallback(async () => {
    try {
      const { data } = await supportApi.getTickets();
      setTickets(data.tickets);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      helpApi.trigger().catch(() => {});
      loadTickets();
    }, [loadTickets])
  );

  const openForm = () => {
    setIssueType('bug');
    setTicketTitle('');
    setDescription('');
    setImages([]);
    setShowForm(true);
  };

  const handlePickImage = async () => {
    if (images.length >= 5) {
      showAlert('Limit reached', 'You can attach up to 5 images.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5 - images.length,
      quality: 0.8,
    });
    if (!result.canceled) {
      const picked: PickedImage[] = result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.fileName || `image_${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      }));
      setImages((prev) => [...prev, ...picked].slice(0, 5));
    }
  };

  const handleSubmit = async () => {
    if (!description.trim() || description.trim().length < 10) {
      showAlert('Error', 'Description must be at least 10 characters.');
      return;
    }
    setSubmitting(true);
    try {
      let imageUrls: string[] = [];
      if (images.length > 0) {
        const { data } = await supportApi.uploadImages(images);
        imageUrls = data.urls;
      }
      await supportApi.createTicket({
        issueType,
        title: ticketTitle.trim() || undefined,
        description: description.trim(),
        images: imageUrls.length > 0 ? imageUrls : undefined,
      });
      setShowForm(false);
      await loadTickets();
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.message || 'Failed to submit ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedLabel = ISSUE_TYPES.find((t) => t.value === issueType)?.label ?? 'Bug';

  const renderTicket = ({ item }: { item: SupportTicket }) => (
    <View style={styles.ticketRow}>
      <View style={styles.ticketTop}>
        <Text style={styles.ticketDate}>{formatDate(item.createdAt)}</Text>
        <Text style={styles.ticketStatus}>{STATUS_LABELS[item.status] ?? item.status}</Text>
      </View>
      <View style={styles.ticketMeta}>
        <Text style={styles.ticketIssueType}>
          {ISSUE_TYPES.find((t) => t.value === item.issueType)?.label ?? item.issueType}
        </Text>
        {item.title ? (
          <Text style={styles.ticketTitle} numberOfLines={1}>{item.title}</Text>
        ) : null}
      </View>
      <Text style={styles.ticketDesc} numberOfLines={2}>{item.description}</Text>
      {item.images?.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ticketImageRow}>
          {item.images.map((img) => (
            <Image key={img.id} source={{ uri: img.imageUrl }} style={styles.ticketThumb} resizeMode="cover" />
          ))}
        </ScrollView>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <Text style={styles.headerTitle}>Support</Text>
      </View>

      {/* Ticket list */}
      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={colors.text} />
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.id}
          renderItem={renderTicket}
          contentContainerStyle={tickets.length === 0 ? styles.emptyContainer : styles.listContainer}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No tickets yet.</Text>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.addBtn} onPress={openForm} activeOpacity={0.85}>
          <Text style={styles.addBtnText}>Add Ticket</Text>
        </TouchableOpacity>
      </View>

      {/* New Ticket form sheet */}
      <Modal
        visible={showForm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowForm(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalWrapper}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowForm(false)} />
          <View style={styles.formSheet}>
            {/* Sheet header */}
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>New Ticket</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView ref={formScrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Issue Type dropdown */}
              <Text style={styles.fieldLabel}>Issue Type</Text>
              <TouchableOpacity style={styles.dropdown} onPress={() => setShowDropdown(true)} activeOpacity={0.7}>
                <Text style={styles.dropdownValue}>{selectedLabel}</Text>
                <Ionicons name="chevron-down" size={16} color="#666" />
              </TouchableOpacity>

              {/* Title */}
              <Text style={styles.fieldLabel}>Title (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Brief summary"
                placeholderTextColor={colors.textMuted}
                value={ticketTitle}
                onChangeText={setTicketTitle}
                maxLength={150}
                onFocus={() => setTimeout(() => formScrollRef.current?.scrollToEnd({ animated: true }), 300)}
              />

              {/* Description */}
              <Text style={styles.fieldLabel}>Description *</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Describe your issue in detail..."
                placeholderTextColor={colors.textMuted}
                value={description}
                onChangeText={setDescription}
                multiline
                maxLength={5000}
                textAlignVertical="top"
                onFocus={() => setTimeout(() => formScrollRef.current?.scrollToEnd({ animated: true }), 300)}
              />
              <Text style={styles.charCount}>{description.length}/5000</Text>

              {/* Attachments */}
              <Text style={styles.fieldLabel}>Attachments (optional)</Text>
              <View style={styles.imageRow}>
                {images.map((img, idx) => (
                  <View key={idx} style={styles.thumbWrapper}>
                    <Image source={{ uri: img.uri }} style={styles.thumb} resizeMode="cover" />
                    <TouchableOpacity
                      style={styles.thumbRemove}
                      onPress={() => setImages((p) => p.filter((_, i) => i !== idx))}
                    >
                      <Ionicons name="close-circle" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}
                {images.length < 5 && (
                  <TouchableOpacity style={styles.addThumb} onPress={handlePickImage} activeOpacity={0.7}>
                    <Ionicons name="image-outline" size={22} color={colors.textMuted} />
                    <Text style={styles.addThumbText}>{images.length === 0 ? 'Add' : 'More'}</Text>
                  </TouchableOpacity>
                )}
              </View>
              {images.length > 0 && (
                <Text style={styles.imageCount}>{images.length}/5 attached</Text>
              )}

              {/* Submit */}
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                activeOpacity={0.85}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color={colors.background} size="small" />
                  : <Text style={styles.submitBtnText}>Submit Ticket</Text>
                }
              </TouchableOpacity>

              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Issue type dropdown picker */}
      <Modal
        visible={showDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDropdown(false)}
      >
        <TouchableOpacity style={styles.dropdownOverlay} activeOpacity={1} onPress={() => setShowDropdown(false)}>
          <View style={styles.dropdownSheet}>
            {ISSUE_TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={styles.dropdownOption}
                onPress={() => { setIssueType(t.value); setShowDropdown(false); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.dropdownOptionText, issueType === t.value && styles.dropdownOptionActive]}>
                  {t.label}
                </Text>
                {issueType === t.value && (
                  <Ionicons name="checkmark" size={16} color={colors.text} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBack: { width: 36 },
  headerTitle: { ...typography.body, color: colors.text, fontWeight: '700', fontSize: 16 },

  listContainer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 24 },
  emptyContainer: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  emptyText: { ...typography.body, color: colors.textMuted },

  ticketRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 4,
  },
  ticketTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ticketDate: { ...typography.body, color: colors.text, fontWeight: '700', fontSize: 15 },
  ticketStatus: { ...typography.bodySmall, color: colors.textMuted },
  ticketMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  ticketIssueType: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  ticketTitle: { ...typography.bodySmall, color: colors.textSecondary, flex: 1 },
  ticketDesc: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 18 },
  ticketImageRow: { marginTop: spacing.xs },
  ticketThumb: {
    width: 56, height: 56,
    borderRadius: 6,
    marginRight: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },

  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  addBtn: {
    backgroundColor: colors.text,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  addBtnText: { color: colors.background, fontSize: 15, fontWeight: '700' },

  // Form sheet
  modalWrapper: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)' },
  formSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderTopColor: '#ffffff',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    maxHeight: '90%',
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  formTitle: { ...typography.body, color: colors.text, fontWeight: '700', fontSize: 16 },

  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  dropdownValue: { ...typography.body, color: colors.text },

  input: {
    ...typography.body,
    color: colors.text,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    marginBottom: 0,
  },
  textarea: { minHeight: 100, textAlignVertical: 'top' },
  charCount: { ...typography.caption, color: colors.textMuted, textAlign: 'right', marginTop: 4 },

  imageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  thumbWrapper: { position: 'relative', width: 72, height: 72 },
  thumb: { width: 72, height: 72, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  thumbRemove: { position: 'absolute', top: -6, right: -6 },
  addThumb: {
    width: 72, height: 72, borderRadius: 8,
    borderWidth: 1, borderColor: '#2a2a2a',
    borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  addThumbText: { ...typography.caption, color: colors.textMuted },
  imageCount: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },

  submitBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.text,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: colors.background, fontSize: 15, fontWeight: '700' },

  // Dropdown picker
  dropdownOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  dropdownSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  dropdownOptionText: { ...typography.body, color: colors.textSecondary },
  dropdownOptionActive: { color: colors.text, fontWeight: '600' },
});

export default SupportScreen;
