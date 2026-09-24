import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { PersonalizedTutorExplanation } from '../../domain/models/personalizedTutor';
import { fonts, radii } from '../../theme/tokens';

type PersonalizedTutorPanelProps = {
  mode: 'reading' | 'listening';
  explanation: PersonalizedTutorExplanation | null;
  loading: boolean;
  error: string | null;
  transferSelectedChoice: number | null;
  transferChecked: boolean;
  onGenerate: (forceRefresh?: boolean) => void;
  onSelectTransferChoice: (choice: number) => void;
  onCheckTransfer: () => void;
};

export function PersonalizedTutorPanel({
  mode,
  explanation,
  loading,
  error,
  transferSelectedChoice,
  transferChecked,
  onGenerate,
  onSelectTransferChoice,
  onCheckTransfer,
}: PersonalizedTutorPanelProps) {
  const isReading = mode === 'reading';
  const testIdPrefix = `${mode}-ai-tutor`;
  const title = isReading ? 'AI 读解辅导' : 'AI 听力辅导';

  if (!explanation) {
    return (
      <View style={styles.entryBlock}>
        <Text style={styles.entryTitle}>{title}</Text>
        <Text style={styles.entryBody}>
          根据本次误选、{isReading ? '原文证据' : '听力依据'}和历史薄弱点生成三步判断路径，并用一道证据微题立即验证。
        </Text>
        <Pressable
          testID={testIdPrefix}
          style={[styles.primaryButton, loading && styles.disabledButton]}
          onPress={() => onGenerate()}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>生成智能辅导</Text>
          )}
        </Pressable>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  }

  return (
    <View testID={`${testIdPrefix}-result`} style={styles.tutorBlock}>
      <View style={styles.titleRow}>
        <Text style={styles.blockTitle}>{title}</Text>
        <Text style={styles.badge}>智能辅导</Text>
      </View>

      <View style={styles.evidenceRow}>
        <View style={styles.evidenceItem}>
          <Text style={styles.evidenceLabel}>本次误选</Text>
          <Text style={styles.evidenceValue} numberOfLines={2}>
            {explanation.personalizationEvidence.selectedChoice}
          </Text>
        </View>
        <View style={styles.evidenceItem}>
          <Text style={styles.evidenceLabel}>累计错误</Text>
          <Text style={styles.evidenceValue}>
            {explanation.personalizationEvidence.wrongCount} 次
          </Text>
        </View>
        <View style={styles.evidenceItem}>
          <Text style={styles.evidenceLabel}>同类错题</Text>
          <Text style={styles.evidenceValue}>
            {explanation.personalizationEvidence.recentSimilarWrongCount} 题
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{isReading ? '你的误判类型' : '你的漏听类型'}</Text>
        <Text style={styles.sectionTitle}>
          {explanation.personalizationEvidence.weaknessType}
        </Text>
        <Text style={styles.sectionBody}>{explanation.diagnosisSummary}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>为什么会选它</Text>
        <Text style={styles.sectionBody}>{explanation.whyYouChoseIt}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>下次照着走的三步判断</Text>
        {explanation.reasoningSteps.map((step, index) => (
          <View key={`${index}-${step}`} style={styles.stepRow}>
            <Text style={styles.stepNumber}>{index + 1}</Text>
            <Text style={styles.stepBody}>{step}</Text>
          </View>
        ))}
      </View>

      <View style={styles.comparison}>
        <Text style={styles.sectionLabel}>关键区别</Text>
        <Text style={styles.comparisonTerms}>
          {explanation.confusionComparison.correctPoint} /{' '}
          {explanation.confusionComparison.confusedPoint}
        </Text>
        <Text style={styles.sectionBody}>
          {explanation.confusionComparison.decisiveDifference}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>针对你的{isReading ? '复盘' : '复听'}动作</Text>
        {explanation.reviewPlan.map((plan) => (
          <View key={`${plan.timing}-${plan.action}`} style={styles.planRow}>
            <Text style={styles.planTiming}>
              {plan.timing === 'now' ? '现在' : plan.timing === 'tomorrow' ? '明天' : '三天后'}
            </Text>
            <Text style={styles.stepBody}>{plan.action}</Text>
          </View>
        ))}
      </View>

      <View style={styles.transferBlock}>
        <Text style={styles.transferEyebrow}>立即验证</Text>
        <Text style={styles.transferTitle}>{explanation.transferQuestion.prompt}</Text>
        <View style={styles.transferChoiceList}>
          {explanation.transferQuestion.choices.map((choice, index) => {
            const selected = transferSelectedChoice === index;
            const correct = explanation.transferQuestion.answer === index;
            return (
              <Pressable
                key={`${index}-${choice}`}
                testID={`${mode}-tutor-transfer-choice-${index}`}
                disabled={transferChecked}
                onPress={() => onSelectTransferChoice(index)}
                style={[
                  styles.transferChoice,
                  selected && styles.transferChoiceSelected,
                  transferChecked && correct && styles.transferChoiceCorrect,
                  transferChecked && selected && !correct && styles.transferChoiceWrong,
                ]}
              >
                <Text style={styles.transferChoiceText}>{index + 1}. {choice}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          testID={`${mode}-tutor-transfer-submit`}
          onPress={onCheckTransfer}
          disabled={transferSelectedChoice === null || transferChecked}
          style={[
            styles.primaryButton,
            (transferSelectedChoice === null || transferChecked) && styles.disabledButton,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {transferChecked ? '已完成即时验证' : '提交验证'}
          </Text>
        </Pressable>
        {transferChecked ? (
          <View
            style={
              transferSelectedChoice === explanation.transferQuestion.answer
                ? styles.transferResultSuccess
                : styles.transferResultWarning
            }
          >
            <Text style={styles.transferResultTitle}>
              {transferSelectedChoice === explanation.transferQuestion.answer
                ? '验证通过：你已经能重新抓住决定答案的证据。'
                : '还未通过：按三步判断路径再走一遍。'}
            </Text>
            <Text style={styles.sectionBody}>{explanation.transferQuestion.explanation}</Text>
          </View>
        ) : null}
      </View>

      <Pressable
        style={styles.refreshButton}
        onPress={() => onGenerate(true)}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#0F766E" />
        ) : (
          <Text style={styles.refreshButtonText}>根据当前记录重新生成</Text>
        )}
      </Pressable>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  entryBlock: { borderRadius: radii.md, backgroundColor: '#F0FDFA', padding: 16, gap: 10, borderWidth: 1, borderColor: '#99F6E4' },
  entryTitle: { color: '#115E59', fontSize: 16, fontWeight: '800', fontFamily: fonts.title },
  entryBody: { color: '#134E4A', fontSize: 14, lineHeight: 21, fontFamily: fonts.body },
  tutorBlock: { borderRadius: radii.md, backgroundColor: '#F0FDFA', padding: 16, gap: 14, borderWidth: 1, borderColor: '#99F6E4' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  blockTitle: { color: '#115E59', fontSize: 16, fontWeight: '800', fontFamily: fonts.title },
  badge: { color: '#115E59', backgroundColor: '#CCFBF1', borderRadius: radii.pill, paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '800', fontFamily: fonts.body },
  evidenceRow: { flexDirection: 'row', gap: 8 },
  evidenceItem: { flex: 1, minWidth: 0, gap: 4, paddingVertical: 10, paddingHorizontal: 10, backgroundColor: '#FFFFFF', borderRadius: radii.sm, borderWidth: 1, borderColor: '#CCFBF1' },
  evidenceLabel: { color: '#0F766E', fontSize: 11, fontWeight: '700', fontFamily: fonts.body },
  evidenceValue: { color: '#134E4A', fontSize: 13, fontWeight: '800', fontFamily: fonts.body },
  section: { gap: 8 },
  sectionLabel: { color: '#0F766E', fontSize: 12, fontWeight: '800', fontFamily: fonts.body },
  sectionTitle: { color: '#134E4A', fontSize: 17, fontWeight: '800', fontFamily: fonts.title },
  sectionBody: { color: '#134E4A', fontSize: 14, lineHeight: 21, fontFamily: fonts.body },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepNumber: { width: 24, height: 24, borderRadius: 12, textAlign: 'center', lineHeight: 24, color: '#FFFFFF', backgroundColor: '#0F766E', fontSize: 12, fontWeight: '800', fontFamily: fonts.body },
  stepBody: { flex: 1, color: '#134E4A', fontSize: 14, lineHeight: 21, fontFamily: fonts.body },
  comparison: { gap: 7, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#99F6E4' },
  comparisonTerms: { color: '#115E59', fontSize: 15, fontWeight: '800', fontFamily: fonts.title },
  planRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  planTiming: { width: 52, color: '#115E59', fontSize: 12, fontWeight: '800', fontFamily: fonts.body },
  transferBlock: { gap: 10, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#99F6E4' },
  transferEyebrow: { color: '#0F766E', fontSize: 12, fontWeight: '800', fontFamily: fonts.body },
  transferTitle: { color: '#134E4A', fontSize: 16, lineHeight: 24, fontWeight: '800', fontFamily: fonts.title },
  transferChoiceList: { gap: 8 },
  transferChoice: { borderRadius: radii.sm, borderWidth: 1, borderColor: '#99F6E4', backgroundColor: '#FFFFFF', paddingHorizontal: 13, paddingVertical: 12 },
  transferChoiceSelected: { borderColor: '#0F766E', backgroundColor: '#CCFBF1' },
  transferChoiceCorrect: { borderColor: '#16A34A', backgroundColor: '#DCFCE7' },
  transferChoiceWrong: { borderColor: '#DC2626', backgroundColor: '#FEE2E2' },
  transferChoiceText: { color: '#134E4A', fontSize: 14, lineHeight: 20, fontFamily: fonts.body },
  primaryButton: { borderRadius: radii.sm, backgroundColor: '#0F766E', paddingVertical: 13, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', fontFamily: fonts.body },
  disabledButton: { opacity: 0.5 },
  transferResultSuccess: { gap: 6, borderRadius: radii.sm, backgroundColor: '#DCFCE7', padding: 12 },
  transferResultWarning: { gap: 6, borderRadius: radii.sm, backgroundColor: '#FEF2F2', padding: 12 },
  transferResultTitle: { color: '#134E4A', fontSize: 14, fontWeight: '800', fontFamily: fonts.body },
  refreshButton: { borderRadius: radii.sm, borderWidth: 1, borderColor: '#5EEAD4', backgroundColor: '#FFFFFF', paddingVertical: 12, alignItems: 'center' },
  refreshButtonText: { color: '#0F766E', fontSize: 14, fontWeight: '800', fontFamily: fonts.body },
  errorText: { color: '#991B1B', fontSize: 13, lineHeight: 20, fontFamily: fonts.body },
});
