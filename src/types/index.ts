// ─── Auth ──────────────────────────────────────────────────────────────────
export interface UserResponse {
  id: string;
  email: string;
  google_id?: string;
  username?: string;
  date_of_birth?: string;
  onboarding_completed: boolean;
  last_login_at?: string;
  last_seen_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserResponse;
  isNewUser: boolean;
  daysSinceLastLogin?: number;
}

export interface RefreshResponse {
  accessToken: string;
}

export interface MeResponse {
  userId: string;
  email: string;
}

// ─── Setup ─────────────────────────────────────────────────────────────────
export type Section = 'power' | 'craft' | 'mind' | 'purity' | 'consistency';
export type LogSection = 'power' | 'craft' | 'mind' | 'purity';

export interface CompanionDto {
  id: string;
  name: string;
  description?: string;
  image?: string;
  slug?: string;
}

export interface ActivityDto {
  id: string;
  name: string;
  section: Section;
  isPrimary?: boolean;
}

export interface BookDto {
  id: string;
  title: string;
  author?: string;
  pages?: number;
}

export interface SetupOptionsResponse {
  companions: CompanionDto[];
  activities: {
    power: ActivityDto[];
    craft: ActivityDto[];
    mind: ActivityDto[];
    purity: ActivityDto[];
    consistency: ActivityDto[];
  };
  books: BookDto[];
}

export interface SectionSetup {
  preferredTime?: string;
  restDays?: string[];
  activities?: Array<{ activityId: string; name: string; isPrimary: boolean }>;
}

export interface MindSetup {
  isActive: boolean;
  preferredTime?: string;
  restDays?: string[];
  books?: Array<{
    userBookId: string;
    title: string;
    author?: string;
    currentPage?: number;
    totalPages?: number;
    isCompleted: boolean;
    completedAt?: string;
    aiSummary?: string;
    summaryPdfUrl?: string | null;
    summaryPdfFilename?: string | null;
  }>;
}

export interface SetupProgressResponse {
  onboardingCompleted: boolean;
  dob?: string | null;
  gender?: 'male' | 'female' | null;
  selectedCompanion?: CompanionDto | null;
  sections: {
    power?: SectionSetup;
    craft?: SectionSetup;
    mind?: SectionSetup & { books?: MindSetup['books'] };
  };
}

export interface SaveProgressDto {
  dob?: string;
  gender?: 'male' | 'female';
  companionId?: string;
  sections?: {
    power?: { preferredTime?: string; restDays?: string[]; activityIds?: string[] };
    craft?: { preferredTime?: string; restDays?: string[]; activityIds?: string[] };
    mind?: {
      skipMind?: boolean;
      preferredTime?: string;
      restDays?: string[];
      bookIds?: string[];
    };
  };
}

// ─── Activities ────────────────────────────────────────────────────────────
export interface ActivityResponse {
  id: string;
  name: string;
  section: Section;
}

export interface LogActivityDto {
  section: LogSection;
  activityId?: string;
  userBookId?: string;
  didUserDo?: boolean;
  hours?: number;
  relapseCount?: number;
  description?: string;
  reasonIfNo?: string;
  date: string;
  images?: string[];
}

export interface ActivityLogEntry {
  id: string;
  section: LogSection;
  activityId?: string;
  activityName?: string;
  userBookId?: string;
  bookTitle?: string;
  didUserDo?: boolean;
  hours?: number;
  relapseCount?: number;
  description?: string;
  reasonIfNo?: string;
  images: string[];
  date: string;
  points?: number;
}

// ─── Activity Logs ─────────────────────────────────────────────────────────
export interface Last7DaysEntry {
  date: string;
  didUserDo?: boolean;
  didUserRelapse?: boolean;
}

export interface Last7DaysResponse {
  power: Last7DaysEntry[];
  craft: Last7DaysEntry[];
  purity: Last7DaysEntry[];
  mind: Last7DaysEntry[] | { isActive: false };
}

export interface MonthlyMonthOption {
  value: string;
  label: string;
}

export interface MonthlyScore {
  green: number;
  total: number;
  percent: number;
}

export interface MonthlyDayEntry {
  date: string;
  didUserDo?: boolean;
  didUserRelapse?: boolean;
}

export interface MonthlyMindPaused {
  isActive: false;
  days?: MonthlyDayEntry[];
}

export interface MonthlyActivityResponse {
  availableMonths: MonthlyMonthOption[];
  selectedMonth: string;
  score: MonthlyScore;
  power: MonthlyDayEntry[];
  craft: MonthlyDayEntry[];
  mind: MonthlyDayEntry[] | MonthlyMindPaused;
  purity: MonthlyDayEntry[];
}

// ─── Books ─────────────────────────────────────────────────────────────────
export interface BookResponse {
  id: string;
  title: string;
  author?: string;
  pages?: number;
}

export interface UserBook {
  userBookId: string;
  title: string;
  author?: string;
  currentPage?: number;
  totalPages?: number;
  isCompleted: boolean;
  completedAt?: string;
  aiSummary?: string;
  isCustom?: boolean;
}

// ─── Journals ──────────────────────────────────────────────────────────────
export interface JournalEntry {
  id: string;
  date: string;
  mood?: number;
  win_of_the_day?: string;
  lesson_learned?: string;
  tomorrow_mission?: string;
  created_at: string;
  pointsEarned?: number;
  updated_at: string;
}

export interface UpsertJournalDto {
  date: string;
  mood?: number;
  win_of_the_day?: string;
  lesson_learned?: string;
  tomorrow_mission?: string;
}

export interface JournalsListResponse {
  data: JournalEntry[];
  total: number;
  page: number;
  limit: number;
}

export interface TodayGoalResponse {
  show: boolean;
  heading?: string;
  goal?: string;
  sourceDate?: string;
}

// ─── Companion Messages ────────────────────────────────────────────────────
export type CompanionMessageType =
  | 'ACHIEVEMENT'
  | 'AVATAR_UNLOCKED'
  | 'AVATAR_REVOKED'
  | 'LEADERBOARD_ENTERED'
  | 'LEADERBOARD_MOVED'
  | 'LEADERBOARD_NEAR'
  | 'MILESTONE'
  | 'RECOVERY'
  | 'INSIGHT'
  | 'MIND_SKIPPED'
  | 'MIND_ACTIVATED'
  | 'MIND_PAUSED';

export interface CompanionMessage {
  id: string;
  type: CompanionMessageType;
  companionName: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  metadata?: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

export interface CompanionMessagesResponse {
  messages: CompanionMessage[];
  pagination: { page: number; limit: number; total: number };
}

// ─── Leaderboard ───────────────────────────────────────────────────────────
export type LeaderboardPeriod = 'weekly' | 'monthly' | 'yearly' | 'all_time';
export type LeaderboardSection = 'all' | 'power' | 'craft' | 'mind' | 'purity';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatar?: string;
  profileImageUrl?: string;
  points: number;
}

export interface LeaderboardResponse {
  rankings: LeaderboardEntry[];
  currentUser: { rank: number; points: number };
}

// ─── Profile ───────────────────────────────────────────────────────────────
export interface SocialLink {
  platform: string;
  url: string;
}

export interface AvatarHistory {
  avatarId: string;
  avatarName: string;
  eventType: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface WeekEntry {
  week: number;
  days: number;
  required: number;
  met: boolean;
  inProgress?: boolean;
}

export interface WeeklyAvatarProgress {
  type: 'weekly';
  currentWeek: number;
  currentWeekDays: number;
  totalWeeks: number;
  requiredDaysPerWeek: number;
  weeks: WeekEntry[];
}

export interface PurityAvatarProgress {
  type: 'purity';
  relapsesThisMonth: number;
  maxRelapsesAllowed: number;
  loggedDays: number;
  requiredLoggedDays: number;
}

export interface DefaultAvatarProgress {
  type: 'default';
}

export type AvatarProgress = WeeklyAvatarProgress | PurityAvatarProgress | DefaultAvatarProgress;

export interface Avatar {
  id: string;
  name: string;
  slug: string;
  title: string;
  story?: string;
  fullBodyImageUrl?: string;
  profileImageUrl?: string;
  unlockCategory?: string;
  unlockRequirement?: number;
  revokeRequirement?: number;
  isUnlocked: boolean;
  isSelected: boolean;
  unlockCount?: number;
  unlockedAt?: string;
  revokedAt?: string;
  lastReason?: string;
  progress?: AvatarProgress;
  history?: AvatarHistory[];
}

export interface Achievement {
  id: string;
  name: string;
  slug: string;
  description: string;
  section?: string;
  iconUrl?: string;
  isUnlocked: boolean;
  unlockedAt?: string;
  usersUnlockedCount?: number;
}

export interface ProfileResponse {
  id: string;
  username?: string;
  email: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | null;
  onboardingCompleted: boolean;
  mindSectionActive: boolean;
  joinedAt: string;
  lastSeenAt?: string;
  socialLinks: SocialLink[];
  stats: {
    totalPoints: number;
    currentStreaks: { power: number; mind: number; craft: number; purity: number };
    longestStreaks: { power: number; mind: number; craft: number; purity: number };
  };
  companions: Array<{
    id: string;
    name: string;
    slug: string;
    description?: string;
    imageUrl?: string;
    isActive: boolean;
    selectedAt?: string;
  }>;
  avatars: Avatar[];
  achievements: Achievement[];
}

export interface EditProfileDto {
  username?: string;
  dateOfBirth?: string;
  socialLinks?: SocialLink[];
  companionId?: string;
  avatarId?: string;
}

// ─── Stats ──────────────────────────────────────────────────────────────────
export type StatsPeriod = '7d' | '30d' | '90d' | '1y' | 'all' | 'custom';

export interface StatsResponse {
  overview: { totalPoints: number; achievementsUnlocked: number; avatarsUnlocked: number };
  filters: { period: string; startDate?: string; endDate?: string };
  power: {
    completedDays: number;
    totalDays: number;
    totalHours: number;
    completionRate: number;
    activities: Array<{ activityId: string; activityName: string; completedDays: number; percentage: number }>;
  };
  mind:
    | {
        completedDays: number;
        totalDays: number;
        booksCompleted: number;
        completionRate: number;
        books: Array<{ bookId: string; title: string; author?: string; completedDays: number; percentage: number; isCompleted: boolean }>;
      }
    | { isActive: false };
  craft: {
    completedDays: number;
    totalDays: number;
    totalHours: number;
    completionRate: number;
    activities: Array<{ activityId: string; activityName: string; completedDays: number; percentage: number }>;
  };
  purity: {
    currentStreak: { days: number; startDate?: string; lastActivityDate?: string };
    longestStreak: { days: number; startDate?: string; endDate?: string };
    totalRelapses: number;
    insightNote?: string;
  };
  journaling: { completedDays: number; totalDays: number; averageMood?: number };
  consistency: {
    overallCompletionRate: number;
    bestSection?: string;
    weakestSection?: string;
    activeDays: number;
    missedDays: number;
  };
}

// ─── Support ───────────────────────────────────────────────────────────────
export type SupportIssueType = 'bug' | 'feature_request' | 'payment' | 'account' | 'other' | 'feedback';
export type SupportStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface CreateSupportTicketDto {
  issueType: SupportIssueType;
  title?: string;
  description: string;
  images?: string[];
}

export interface SupportTicket {
  id: string;
  issueType: SupportIssueType;
  title?: string;
  description: string;
  status: SupportStatus;
  images: Array<{ id: string; imageUrl: string }>;
  createdAt: string;
  updatedAt: string;
}

// ─── Notifications ─────────────────────────────────────────────────────────
export interface RegisterDeviceDto {
  expoPushToken: string;
  deviceId?: string;
  platform?: 'android' | 'ios';
}

// ─── Upload ─────────────────────────────────────────────────────────────────
export interface UploadResponse {
  success: boolean;
  urls: string[];
}
