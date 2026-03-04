import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { TRAINING_MODES, TrainingMode } from './src/data/trainingModes';
import {
  buildRecentWeek,
  clearDay,
  createDefaultState,
  DEFAULT_WEEKLY_GOAL,
  getDashboardMetrics,
  getDayKey,
  normalizeState,
  STORAGE_KEY,
  toggleModeCompletion,
  type StoredAppState,
} from './src/lib/trainingState';

const DAILY_TARGET = 3;
const WEEKLY_GOAL_OPTIONS = [10, DEFAULT_WEEKLY_GOAL, 18];
const TITLE_FONT = Platform.select({
  ios: 'AvenirNext-Bold',
  android: 'sans-serif-condensed',
  default: 'system-ui',
});
const BODY_FONT = Platform.select({
  ios: 'AvenirNext-Medium',
  android: 'sans-serif-medium',
  default: 'system-ui',
});

const getTodayPlan = (completedModeIds: string[]): TrainingMode[] => {
  const remainingModes = TRAINING_MODES.filter(
    (mode) => !completedModeIds.includes(mode.id),
  );

  return remainingModes.slice(0, 3);
};

const createEntranceStyle = (value: Animated.Value) => ({
  opacity: value,
  transform: [
    {
      translateY: value.interpolate({
        inputRange: [0, 1],
        outputRange: [18, 0],
      }),
    },
  ],
});

export default function App() {
  const todayKey = getDayKey(new Date());
  const [state, setState] = useState<StoredAppState>(createDefaultState);
  const [isHydrated, setIsHydrated] = useState(false);
  const hasLoadedRef = useRef(false);
  const heroEntrance = useRef(new Animated.Value(0)).current;
  const planEntrance = useRef(new Animated.Value(0)).current;
  const weekEntrance = useRef(new Animated.Value(0)).current;
  const modesEntrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let isMounted = true;

    const loadState = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);

        if (!isMounted) {
          return;
        }

        setState(normalizeState(raw));
      } finally {
        if (isMounted) {
          hasLoadedRef.current = true;
          setIsHydrated(true);
        }
      }
    };

    void loadState();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      return;
    }

    const persist = async () => {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    };

    void persist();
  }, [state]);

  useEffect(() => {
    Animated.stagger(110, [
      Animated.timing(heroEntrance, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(planEntrance, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(weekEntrance, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(modesEntrance, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
    ]).start();
  }, [heroEntrance, modesEntrance, planEntrance, weekEntrance]);

  const metrics = useMemo(
    () => getDashboardMetrics(state, todayKey),
    [state, todayKey],
  );
  const todayCompleted = state.completedByDay[todayKey] ?? [];
  const todayPlan = useMemo(() => getTodayPlan(todayCompleted), [todayCompleted]);
  const recentWeek = useMemo(
    () => buildRecentWeek(state.completedByDay, todayKey),
    [state.completedByDay, todayKey],
  );
  const weeklyProgress = Math.min(metrics.weeklySessions / state.weeklyGoal, 1);
  const dailyProgress = Math.min(metrics.todayCompletedCount / DAILY_TARGET, 1);

  const handleToggleMode = (modeId: TrainingMode['id']) => {
    setState((current) => toggleModeCompletion(current, todayKey, modeId));
  };

  const handleClearToday = () => {
    setState((current) => clearDay(current, todayKey));
  };

  const handleGoalChange = (weeklyGoal: number) => {
    setState((current) => ({
      ...current,
      weeklyGoal,
    }));
  };

  if (!isHydrated) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <ActivityIndicator color="#0F766E" size="large" />
        <Text style={styles.loadingText}>正在载入你的 N2 训练节奏...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.background}>
        <View style={styles.topGlow} />
        <View style={styles.bottomGlow} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.heroCard, createEntranceStyle(heroEntrance)]}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.eyebrow}>JLPT N2 TRAINER</Text>
              <Text style={styles.heroTitle}>把 2026 年 7 月冲刺拆成今天这 3 步</Text>
            </View>
            <View style={styles.streakBadge}>
              <Text style={styles.streakValue}>{metrics.currentStreak}</Text>
              <Text style={styles.streakLabel}>连练</Text>
            </View>
          </View>

          <Text style={styles.heroBody}>
            今天先保住文法、词汇、读解的基本盘，再用错题回收补弱点。
          </Text>

          <View style={styles.progressBlock}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>今日完成</Text>
              <Text style={styles.progressValue}>
                {metrics.todayCompletedCount}/{DAILY_TARGET}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${dailyProgress * 100}%` }]} />
            </View>
          </View>

          <View style={styles.metricGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricNumber}>{metrics.weeklySessions}</Text>
              <Text style={styles.metricLabel}>本周训练</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricNumber}>{metrics.bestStreak}</Text>
              <Text style={styles.metricLabel}>最佳连练</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricNumber}>{metrics.totalSessions}</Text>
              <Text style={styles.metricLabel}>累计场次</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View style={[styles.section, createEntranceStyle(planEntrance)]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>今日安排</Text>
            <Pressable onPress={handleClearToday} style={styles.ghostButton}>
              <Text style={styles.ghostButtonText}>重置今天</Text>
            </Pressable>
          </View>

          <View style={styles.planCard}>
            <Text style={styles.planLead}>
              {todayPlan.length === 0
                ? '今天的主线训练已经完成，可以去做一次错题回收。'
                : '建议先做这三项，优先保持连续性而不是追求一次练太多。'}
            </Text>

            {todayPlan.length === 0 ? (
              <View style={styles.allDonePill}>
                <Text style={styles.allDoneText}>今日基础训练已达标</Text>
              </View>
            ) : (
              todayPlan.map((mode, index) => (
                <View key={mode.id} style={styles.planRow}>
                  <View style={[styles.planIndex, { backgroundColor: mode.surface }]}>
                    <Text style={[styles.planIndexText, { color: mode.accent }]}>
                      {index + 1}
                    </Text>
                  </View>
                  <View style={styles.planCopy}>
                    <Text style={styles.planTitle}>{mode.title}</Text>
                    <Text style={styles.planMeta}>
                      {mode.duration} · {mode.focus}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </Animated.View>

        <Animated.View style={[styles.section, createEntranceStyle(weekEntrance)]}>
          <Text style={styles.sectionTitle}>本周节奏</Text>
          <View style={styles.weekCard}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>周目标</Text>
              <Text style={styles.progressValue}>
                {metrics.weeklySessions}/{state.weeklyGoal}
              </Text>
            </View>
            <View style={[styles.progressTrack, styles.weekTrack]}>
              <View
                style={[styles.weekFill, { width: `${weeklyProgress * 100}%` }]}
              />
            </View>

            <View style={styles.goalSelector}>
              {WEEKLY_GOAL_OPTIONS.map((goal) => {
                const selected = goal === state.weeklyGoal;

                return (
                  <Pressable
                    key={goal}
                    onPress={() => handleGoalChange(goal)}
                    style={[
                      styles.goalPill,
                      selected && styles.goalPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.goalPillText,
                        selected && styles.goalPillTextActive,
                      ]}
                    >
                      {goal} 场
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.weekBars}>
              {recentWeek.map((item) => {
                const barHeight = 18 + Math.min(item.count, 4) * 18;
                const isToday = item.dayKey === todayKey;

                return (
                  <View key={item.dayKey} style={styles.weekBarColumn}>
                    <View
                      style={[
                        styles.weekBar,
                        {
                          height: barHeight,
                          backgroundColor: item.count > 0 ? '#0F766E' : '#D1D5DB',
                          opacity: isToday ? 1 : 0.82,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.weekBarLabel,
                        isToday && styles.weekBarLabelToday,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </Animated.View>

        <Animated.View style={[styles.section, createEntranceStyle(modesEntrance)]}>
          <Text style={styles.sectionTitle}>八大训练模式</Text>
          {TRAINING_MODES.map((mode) => {
            const completed = todayCompleted.includes(mode.id);

            return (
              <View key={mode.id} style={styles.modeCard}>
                <View style={[styles.modeStripe, { backgroundColor: mode.accent }]} />
                <View style={styles.modeBody}>
                  <View style={styles.modeHeader}>
                    <View style={styles.modeTitleBlock}>
                      <Text style={styles.modeTitle}>{mode.title}</Text>
                      <Text style={styles.modeSubtitle}>{mode.subtitle}</Text>
                    </View>
                    <View style={[styles.modeChip, { backgroundColor: mode.surface }]}>
                      <Text style={[styles.modeChipText, { color: mode.accent }]}>
                        {mode.shortTitle}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.modeDescription}>{mode.description}</Text>
                  <Text style={styles.modeMeta}>
                    {mode.duration} · {mode.focus}
                  </Text>

                  <Pressable
                    onPress={() => handleToggleMode(mode.id)}
                    style={[
                      styles.modeButton,
                      completed
                        ? styles.modeButtonCompleted
                        : { backgroundColor: mode.accent },
                    ]}
                  >
                    <Text
                      style={[
                        styles.modeButtonText,
                        completed && styles.modeButtonTextCompleted,
                      ]}
                    >
                      {completed ? '已完成，点按撤销' : '标记为今日已练'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F3E8',
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F3E8',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#334155',
    fontFamily: BODY_FONT,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  topGlow: {
    position: 'absolute',
    top: -120,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#F9C88F',
    opacity: 0.35,
  },
  bottomGlow: {
    position: 'absolute',
    bottom: 120,
    left: -70,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#99F6E4',
    opacity: 0.3,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 18,
  },
  heroCard: {
    backgroundColor: '#103B36',
    borderRadius: 28,
    padding: 22,
    gap: 18,
    shadowColor: '#0F172A',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  eyebrow: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    marginBottom: 8,
    fontFamily: BODY_FONT,
  },
  heroTitle: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 36,
    maxWidth: '84%',
    fontFamily: TITLE_FONT,
  },
  streakBadge: {
    backgroundColor: 'rgba(248, 250, 252, 0.12)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    minWidth: 70,
  },
  streakValue: {
    color: '#FDE68A',
    fontSize: 22,
    fontWeight: '800',
  },
  streakLabel: {
    color: '#D1FAE5',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: BODY_FONT,
  },
  heroBody: {
    color: '#D7F5EE',
    fontSize: 15,
    lineHeight: 22,
    fontFamily: BODY_FONT,
  },
  progressBlock: {
    gap: 8,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    fontFamily: BODY_FONT,
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    fontFamily: BODY_FONT,
  },
  progressTrack: {
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#FBBF24',
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: 'rgba(248, 250, 252, 0.1)',
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  metricNumber: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  metricLabel: {
    color: '#D1FAE5',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: BODY_FONT,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '800',
    fontFamily: TITLE_FONT,
  },
  ghostButton: {
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  ghostButtonText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: BODY_FONT,
  },
  planCard: {
    backgroundColor: '#FFF8EE',
    borderRadius: 24,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: '#F1E6D4',
  },
  planLead: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
    fontFamily: BODY_FONT,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  planIndex: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planIndexText: {
    fontSize: 15,
    fontWeight: '800',
  },
  planCopy: {
    flex: 1,
    gap: 3,
  },
  planTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: TITLE_FONT,
  },
  planMeta: {
    color: '#64748B',
    fontSize: 13,
    fontFamily: BODY_FONT,
  },
  allDonePill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  allDoneText: {
    color: '#166534',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: BODY_FONT,
  },
  weekCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    gap: 16,
  },
  weekTrack: {
    backgroundColor: '#DDEAE7',
  },
  weekFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#0F766E',
  },
  goalSelector: {
    flexDirection: 'row',
    gap: 10,
  },
  goalPill: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  goalPillActive: {
    backgroundColor: '#103B36',
  },
  goalPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    fontFamily: BODY_FONT,
  },
  goalPillTextActive: {
    color: '#F8FAFC',
  },
  weekBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 4,
  },
  weekBarColumn: {
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  weekBar: {
    width: 22,
    borderRadius: 999,
  },
  weekBarLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    fontFamily: BODY_FONT,
  },
  weekBarLabelToday: {
    color: '#0F172A',
    fontWeight: '800',
  },
  modeCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
  },
  modeStripe: {
    width: 8,
  },
  modeBody: {
    flex: 1,
    padding: 18,
    gap: 10,
  },
  modeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modeTitleBlock: {
    flex: 1,
    gap: 2,
  },
  modeTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: TITLE_FONT,
  },
  modeSubtitle: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: BODY_FONT,
  },
  modeChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  modeChipText: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: BODY_FONT,
  },
  modeDescription: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 21,
    fontFamily: BODY_FONT,
  },
  modeMeta: {
    color: '#475569',
    fontSize: 13,
    fontFamily: BODY_FONT,
  },
  modeButton: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modeButtonCompleted: {
    backgroundColor: '#DCFCE7',
  },
  modeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: BODY_FONT,
  },
  modeButtonTextCompleted: {
    color: '#166534',
  },
});
