export const FILE_EXT = {
  javascript: 'js', typescript: 'ts', python: 'py', go: 'go',
  rust: 'rs', java: 'java', cpp: 'cpp', c: 'c', csharp: 'cs',
  html: 'html', css: 'css', json: 'json', sql: 'sql',
  markdown: 'md', yaml: 'yml', bash: 'sh', plaintext: 'txt',
};

const EXT_TO_LANG = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  py: 'python', go: 'go', rs: 'rust',
  java: 'java', cpp: 'cpp', cc: 'cpp', cxx: 'cpp',
  c: 'c', cs: 'csharp',
  html: 'html', htm: 'html', xml: 'html',
  css: 'css', scss: 'css', less: 'css',
  json: 'json', sql: 'sql',
  md: 'markdown', markdown: 'markdown',
  yml: 'yaml', yaml: 'yaml',
  sh: 'bash', bash: 'bash',
  txt: 'plaintext',
};

export const LANG_COLORS = {
  javascript: '#f7df1e', typescript: '#3178c6', python: '#3572a5',
  go: '#00add8', rust: '#ce422b', java: '#b07219', cpp: '#f34b7d',
  c: '#555577', csharp: '#178600', html: '#e34c26', css: '#563d7c',
  json: '#8bc34a', sql: '#e38c00', markdown: '#6080c0',
  yaml: '#cb171e', bash: '#4eaa25', plaintext: '#70708a',
};

export function getLang(filename) {
  const parts = filename.split('.');
  if (parts.length < 2) return 'plaintext';
  return EXT_TO_LANG[parts.pop().toLowerCase()] || 'plaintext';
}

export function getExt(language) {
  return FILE_EXT[language] || 'txt';
}

export function ensureExt(name, fallbackLang = 'javascript') {
  if (name.includes('.')) return name;
  return `${name}.${getExt(fallbackLang)}`;
}
