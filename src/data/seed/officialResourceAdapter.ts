/**
 * 官方资源清单适配器
 * 联动目标：https://github.com/Chenjian612/jlpt-n2-my-trainer-resources
 */

export interface OfficialResourceItem {
  type: 'pdf' | 'mp3';
  section: 'vocabulary' | 'grammar' | 'reading' | 'listening';
  sourceUrl: string;
  label: string;
  githubPath: string; // 对应的 GitHub 仓库路径
}

const BASE_REPO_URL = 'https://github.com/Chenjian612/jlpt-n2-my-trainer-resources';

export const OFFICIAL_RESOURCES: OfficialResourceItem[] = [
  {
    type: 'pdf',
    section: 'vocabulary',
    sourceUrl: 'https://www.jlpt.jp/samples/sample2018/pdf/N2V.pdf',
    label: '2018 官方样题 (N2V)',
    githubPath: `${BASE_REPO_URL}/tree/main/files`,
  },
  {
    type: 'pdf',
    section: 'grammar',
    sourceUrl: 'https://www.jlpt.jp/samples/sample2018/pdf/N2G.pdf',
    label: '2018 官方样题 (N2G)',
    githubPath: `${BASE_REPO_URL}/tree/main/files`,
  },
  {
    type: 'pdf',
    section: 'reading',
    sourceUrl: 'https://www.jlpt.jp/samples/sample2018/pdf/N2R.pdf',
    label: '2018 官方样题 (N2R)',
    githubPath: `${BASE_REPO_URL}/tree/main/files`,
  },
  {
    type: 'mp3',
    section: 'listening',
    sourceUrl: 'https://www.jlpt.jp/samples/sample2018/audio/N2L.mp3',
    label: '2018 官方音频 (N2L)',
    githubPath: `${BASE_REPO_URL}/tree/main/files`,
  }
];

export const getResourceBySection = (section: OfficialResourceItem['section']) => 
  OFFICIAL_RESOURCES.filter(r => r.section === section);

export const getRepoUrl = () => BASE_REPO_URL;
