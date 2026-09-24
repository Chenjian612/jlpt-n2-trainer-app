import type { ListeningCase } from '../../domain/models/trainingContent';

type ListeningGuidance = Pick<
  ListeningCase,
  'title' | 'scene' | 'task' | 'note' | 'listenChecklist'
>;

// 新题在 listening_cases.json 中直接保存中文导学与译文；这里只保留五道旧官方示例的译文。
export const LISTENING_GUIDANCE_ZH: Partial<Record<string, ListeningGuidance>> = {};

export const LISTENING_DIALOGUE_TRANSLATIONS_ZH: Record<string, string[]> = {
  'official-m1q2': [
    '出差的准备看起来很辛苦啊。要我帮忙吗？',
    '太帮忙了！我这边还没弄完。能把那个放进那边的箱子里吗？要寄到那边去。',
    '哪个？是这个商品目录吗？',
    '不是。那个我想在飞机上看，先单独放着。旁边不是有公司介绍吗？那个和那边的伴手礼茶叶麻烦你了。',
    '好的。',
    '对了，这些名片我想多带一些，这个也放进去。',
    '好，好。',
  ],
  'official-m2q2': [
    '老师，下周六的聚会，您能参加吗？',
    '嗯，这个嘛……我本来很想参加，但有一件实在推不掉的事情。',
    '啊，对了。您下周要出差，所以课程停一次吧。',
    '不，出差周五就回来了。其实那天是我以前学生的婚礼。',
    '原来如此，那有点遗憾。',
    '嗯，不好意思。',
  ],
  'official-m3q1': [
    '大家使用过网上购物吗？以前有人说买东西一定要到店里亲眼确认，最近这些人也开始使用这种方式。',
    '对十几岁到八十几岁的人调查后，大家给出了“忙得没时间去买”“可以边喝茶边慢慢挑选”等意见。',
    '还有人说“一边养孩子一边工作，网上购物已经是日常生活不可缺少的一部分”。',
  ],
  'official-m4q1': ['咦，佐藤今天是休息吗？'],
  'official-m5q1': [
    '爸爸，你又抽烟了吗？差不多该戒烟了吧。',
    '为什么？',
    '我希望爸爸能长寿。',
    '有调查说过了六十岁，即使戒烟寿命也不会改变。戒烟还会变胖，所以现在反而更健康。',
    '爸爸或许没事，但妈妈和我每天都在被迫吸爸爸的二手烟吧？电视说那对健康更不好。',
    '是啊，也会给家人造成伤害。',
    '这样啊……那责任重大。好吧，我试试看。',
    '那就拜托了。',
  ],
};
