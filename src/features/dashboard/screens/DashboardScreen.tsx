import { useEffect, useRef } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';

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
          />
        </Animated.View>

        <Animated.View style={createEntranceStyle(planEntrance)}>
          <TodayPlanCard
            todayPlan={todayPlan}
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
          <Text style={styles.sectionTitle}>八大训练模式</Text>
          <Text style={styles.sectionBody}>
            现在文法刷题、词汇刷题和错题回收已经接上真实训练流；其余模式继续用引导式 session 承担节奏管理。
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
