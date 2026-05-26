import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { setupApi, booksApi } from '../../api';
import { colors, spacing, typography, radius } from '../../theme';
import { useAlert } from '../../context/AlertContext';
import type { UserBook } from '../../types';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';

const BooksScreen = () => {
  const navigation = useNavigation();
  const { showAlert } = useAlert();
  const [books, setBooks] = useState<UserBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [adding, setAdding] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState<string | null>(null);

  const loadBooks = async () => {
    try {
      const { data } = await setupApi.getMind();
      setBooks(data.books || []);
    } catch {}
  };

  useEffect(() => {
    loadBooks().finally(() => setLoading(false));
  }, []);

  const handleAddBook = async () => {
    if (!title.trim()) { showAlert('Error', 'Title is required.'); return; }
    setAdding(true);
    try {
      await booksApi.createCustom({ title: title.trim(), author: author.trim() || undefined });
      await loadBooks();
      setTitle(''); setAuthor(''); setShowAddForm(false);
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.message || 'Failed to add book.');
    } finally {
      setAdding(false);
    }
  };

  const handleGenerateSummary = async (bookId: string) => {
    setGeneratingSummary(bookId);
    try {
      const { data } = await booksApi.generateSummary(bookId);
      if (data.success) {
        showAlert('Summary Generated', data.summary || 'Summary saved to your book.');
        await loadBooks();
      } else {
        showAlert('Info', data.message || 'Could not generate summary yet.');
      }
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.message || 'Failed to generate summary.');
    } finally {
      setGeneratingSummary(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>My Books</Text>
        <TouchableOpacity onPress={() => setShowAddForm(!showAddForm)} style={styles.addBtn}>
          <Ionicons name="add" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {showAddForm && (
        <Card style={styles.addForm}>
          <Text style={styles.addFormTitle}>Add Book</Text>
          <TextInput
            style={styles.input}
            placeholder="Title *"
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={styles.input}
            placeholder="Author (optional)"
            placeholderTextColor={colors.textMuted}
            value={author}
            onChangeText={setAuthor}
          />
          <View style={styles.addFormBtns}>
            <Button title="Cancel" onPress={() => setShowAddForm(false)} variant="ghost" size="sm" />
            <Button title="Add" onPress={handleAddBook} loading={adding} size="sm" />
          </View>
        </Card>
      )}

      {loading ? (
        <View style={styles.loadingCenter}><ActivityIndicator color={colors.text} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {books.length === 0 && (
            <Text style={styles.empty}>No books yet. Add one to start tracking your reading!</Text>
          )}
          {books.map((book) => (
            <Card key={book.userBookId} style={[styles.bookCard, book.isCompleted ? styles.bookCardCompleted : undefined]}>
              <View style={styles.bookHeader}>
                <View style={styles.bookInfo}>
                  <Text style={styles.bookTitle}>{book.title}</Text>
                  {book.author && <Text style={styles.bookAuthor}>{book.author}</Text>}
                </View>
                {book.isCompleted && (
                  <View style={styles.completedBadge}>
                    <Text style={styles.completedText}>Done ✓</Text>
                  </View>
                )}
              </View>
              {book.totalPages && (
                <View style={styles.pagesRow}>
                  <Text style={styles.pagesLabel}>Pages</Text>
                  <Text style={styles.pagesVal}>{book.currentPage || 0}/{book.totalPages}</Text>
                </View>
              )}
              {book.aiSummary ? (
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryLabel}>AI Summary</Text>
                  <Text style={styles.summaryText} numberOfLines={3}>{book.aiSummary}</Text>
                </View>
              ) : (
                book.isCompleted && (
                  <TouchableOpacity
                    style={styles.genSummaryBtn}
                    onPress={() => handleGenerateSummary(book.userBookId)}
                    disabled={generatingSummary === book.userBookId}
                  >
                    {generatingSummary === book.userBookId ? (
                      <ActivityIndicator size="small" color={colors.mind} />
                    ) : (
                      <Text style={styles.genSummaryText}>✨ Generate AI Summary</Text>
                    )}
                  </TouchableOpacity>
                )
              )}
            </Card>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: spacing.xs, marginRight: spacing.sm },
  title: { ...typography.h2, color: colors.text, flex: 1 },
  addBtn: { padding: spacing.xs },
  addForm: { margin: spacing.lg, gap: spacing.sm },
  addFormTitle: { ...typography.h4, color: colors.text },
  input: { ...typography.body, color: colors.text, backgroundColor: colors.inputBg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.inputBorder, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  addFormBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, gap: spacing.md },
  bookCard: {},
  bookCardCompleted: { borderColor: colors.mind + '55' },
  bookHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.sm },
  bookInfo: { flex: 1 },
  bookTitle: { ...typography.h4, color: colors.text },
  bookAuthor: { ...typography.bodySmall, color: colors.textMuted },
  completedBadge: { backgroundColor: colors.mind + '22', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  completedText: { ...typography.caption, color: colors.mind },
  pagesRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  pagesLabel: { ...typography.bodySmall, color: colors.textSecondary },
  pagesVal: { ...typography.bodySmall, color: colors.text },
  summaryBox: { marginTop: spacing.sm, padding: spacing.sm, backgroundColor: colors.inputBg, borderRadius: radius.sm },
  summaryLabel: { ...typography.label, color: colors.mind, marginBottom: 4, textTransform: 'uppercase', fontSize: 10 },
  summaryText: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },
  genSummaryBtn: { marginTop: spacing.sm, paddingVertical: spacing.xs },
  genSummaryText: { ...typography.bodySmall, color: colors.mind },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', padding: spacing.xl },
});

export default BooksScreen;
