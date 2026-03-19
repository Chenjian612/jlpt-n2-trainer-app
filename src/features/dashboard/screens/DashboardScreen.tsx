import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { AppBackground } from '../../../components/common/AppBackground';
import {
  isReviewModeId,
  type TrainingMode,
} from '../../../domain/models/training';
import { colors, fonts } from '../../../theme/tokens';
import { HeroCard } from '../components/HeroCard';
import { TodayPlanCard } from '../components/TodayPlanCard';
import { TrainingModeCard } from '../components/TrainingModeCard';
import { WeaknessCoachCard } from '../components/WeaknessCoachCard';
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
  const { width } = useWindowDimensions();
  const isWide = width >= 1080;
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
    weaknessSnapshot,
    weaknessRecommendedMode,
    todayKey,
    clearToday,
    setWeeklyGoal,
  } = useDashboardViewModel();
  const heroEntrance = useRef(new Animated.Value(0)).current;
  const planEntrance = useRef(new Animated.Value(0)).current;
  const coachEntrance = useRef(new Animated.Value(0)).current;
  const weekEntrance = useRef(new Animated.Value(0)).current;
  const modesEntrance = useRef(new Animated.Value(0)).current;
  const modeGroups = useMemo(
    () => [
      {
        key: 'impact',
        title: '快速提分',
        body: '先做反馈最快的模式，把今天的状态拉起来。',
        modes: trainingModes.filter(
          (mode) => mode.sessionKind !== 'study' && !isReviewModeId(mode.id),
        ),
      },
      {
        key: 'steady',
        title: '稳态积累',
        body: '用记忆包和官方词卡压缩文法、词汇与题型高频词，适合稳定补总量。',
        modes: trainingModes.filter((mode) => mode.sessionKind === 'study'),
      },
      {
        key: 'recovery',
        title: '薄弱点回收',
        body: '只处理已经暴露的问题，不和新内容混在一起。',
        modes: trainingModes.filter((mode) => isReviewModeId(mode.id)),
      },
    ],
    [trainingModes],
  );

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
      Animated.timing(coachEntrance, {
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
  }, [coachEntrance, heroEntrance, modesEntrance, planEntrance, weekEntrance]);

  return (
    <AppBackground>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.layout, isWide && styles.layoutWide]}>
          <View style={[styles.primaryColumn, isWide && styles.primaryColumnWide]}>
            <Animated.View style={createEntranceStyle(heroEntrance)}>
              <HeroCard
                metrics={metrics}
                dailyProgress={dailyProgress}
                dailyTarget={dailyTarget}
                insight={insight}
                recommendedModeTitle={recommendedMode?.title ?? null}
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

            <Animated.View style={createEntranceStyle(coachEntrance)}>
              <WeaknessCoachCard
                snapshot={weaknessSnapshot}
                recommendedMode={weaknessRecommendedMode}
                onOpenMode={onOpenMode}
                onStartMode={onStartMode}
              />
            </Animated.View>
          </View>

          <View style={[styles.secondaryColumn, isWide && styles.secondaryColumnWide]}>
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
              <View style={styles.sectionIntro}>
                <Text style={styles.sectionTitle}>训练模式总览</Text>
                <Text style={styles.sectionBody}>
                  不再把全部模式平铺在一层。先把冲分、积累、回收拆开，用户会更容易判断下一步该点哪里。
                </Text>
              </View>

              {modeGroups.map((group) => (
                <View key={group.key} style={styles.modeGroup}>
                  <View style={styles.modeGroupHeader}>
                    <Text style={styles.modeGroupTitle}>{group.title}</Text>
                    <Text style={styles.modeGroupBody}>{group.body}</Text>
                  </View>

                  {group.modes.map((mode) => (
                    <TrainingModeCard
                      key={mode.id}
                      mode={mode}
                      completed={todayCompletedModeIds.includes(mode.id)}
                      sessionCount={todaySessionCounts[mode.id] ?? 0}
                      backlogCount={
                        mode.id === 'review_wrong' || mode.id === 'vocab_review_wrong'
                          ? reviewBacklogCounts[mode.id]
                          : 0
                      }
                      onOpenMode={onOpenMode}
                      onStartMode={onStartMode}
                    />
                  ))}
                </View>
              ))}
            </Animated.View>
          </View>
        </View>
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 42,
  },
  layout: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    gap: 18,
  },
  layoutWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  primaryColumn: {
    gap: 18,
  },
  primaryColumnWide: {
    flex: 1.08,
  },
  secondaryColumn: {
    gap: 18,
  },
  secondaryColumnWide: {
    flex: 0.92,
  },
  section: {
    gap: 16,
  },
  sectionIntro: {
    gap: 6,
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
  modeGroup: {
    gap: 12,
    padding: 16,
    borderRadius: 24,
    backgroundColor: colors.backgroundCardMuted,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  modeGroupHeader: {
    gap: 4,
  },
  modeGroupTitle: {
    color: colors.inkStrong,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  modeGroupBody: {
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: fonts.body,
  },
});
