import { useEffect, useRef } from 'react';
import { Animated, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppBackground } from '../../../components/common/AppBackground';
import type { TrainingMode } from '../../../domain/models/training';
import { colors, fonts } from '../../../theme/tokens';
import { HeroCard } from '../components/HeroCard';
import { TodayPlanCard } from '../components/TodayPlanCard';
import { TrainingModeCard } from '../components/TrainingModeCard';
import { WeeklyRhythmCard } from '../components/WeeklyRhythmCard';
import { useDashboardViewModel } from '../hooks/useDashboardViewModel';

type DashboardScreenProps = {
  onOpenMode: (mode: TrainingMode) => void;
  onStartMode: (mode: TrainingMode) => void;
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

export function DashboardScreen({
  onOpenMode,
  onStartMode,
}: DashboardScreenProps) {
  const {
    metrics,
    recentWeek,
    todayPlan,
    todayCompletedModeIds,
    todaySessionCounts,
    reviewBacklogCounts,
    trainingModes,
    weeklyGoal,
    dailyTarget,
    weeklyGoalOptions,
    dailyProgress,
    weeklyProgress,
    insight,
    recommendedMode,
    todayKey,
    clearToday,
    setWeeklyGoal,
  } = useDashboardViewModel();
  const heroEntrance = useRef(new Animated.Value(0)).current;
  const planEntrance = useRef(new Animated.Value(0)).current;
  const weekEntrance = useRef(new Animated.Value(0)).current;
  const modesEntrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(110, [
      Animated.timing(heroEntrance, {
        toValue: 1,
        duration: 420,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(planEntrance, {
        toValue: 1,
        duration: 420,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(weekEntrance, {
        toValue: 1,
        duration: 420,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(modesEntrance, {
        toValue: 1,
        duration: 420,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [heroEntrance, modesEntrance, planEntrance, weekEntrance]);

  return (
    <AppBackground>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={createEntranceStyle(heroEntrance)}>
          <HeroCard
            metrics={metrics}
            dailyProgress={dailyProgress}
            dailyTarget={dailyTarget}
            insight={insight}
          />
        </Animated.View>

        <Animated.View style={createEntranceStyle(planEntrance)}>
          <TodayPlanCard
            todayPlan={todayPlan}
            recommendedMode={recommendedMode}
            insight={insight}
            onOpenMode={onOpenMode}
            onClearToday={clearToday}
          />
        </Animated.View>

        <Animated.View style={createEntranceStyle(weekEntrance)}>
          <WeeklyRhythmCard
            metrics={metrics}
            weeklyGoal={weeklyGoal}
            weeklyProgress={weeklyProgress}
            recentWeek={recentWeek}
            todayKey={todayKey}
            goalOptions={weeklyGoalOptions}
            onGoalChange={setWeeklyGoal}
          />
        </Animated.View>

        <Animated.View style={[styles.section, createEntranceStyle(modesEntrance)]}>
          <Text style={styles.sectionTitle}>全部训练模式</Text>
          <Text style={styles.sectionBody}>
            先用刷题和记忆包稳住基本盘，再用读解、听力和错题回收补强薄弱点。每个模式都能单独进入、独立完成并记录进度。
          </Text>

          {trainingModes.map((mode) => (
            <TrainingModeCard
              key={mode.id}
              mode={mode}
              completed={todayCompletedModeIds.includes(mode.id)}
              sessionCount={todaySessionCounts[mode.id] ?? 0}
              backlogCount={reviewBacklogCounts[mode.id]}
              onOpenMode={onOpenMode}
              onStartMode={onStartMode}
            />
          ))}
        </Animated.View>
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 18,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: colors.inkStrong,
    fontSize: 22,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  sectionBody: {
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.body,
  },
});

