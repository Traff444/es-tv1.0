const levelOrder = { debug: 0, info: 1, warn: 2, error: 3 } as const;

type Level = keyof typeof levelOrder;

const currentLevel: Level = process.env.NODE_ENV === 'production' ? 'error' : 'debug';

function shouldLog(level: Level) {
  return levelOrder[level] >= levelOrder[currentLevel];
}

const logger = {
  debug: (...args: unknown[]) => {
    if (shouldLog('debug')) console.debug(...args);
  },
  info: (...args: unknown[]) => {
    if (shouldLog('info')) console.info(...args);
  },
  warn: (...args: unknown[]) => {
    if (shouldLog('warn')) console.warn(...args);
  },
  error: (...args: unknown[]) => {
    if (shouldLog('error')) console.error(...args);
  }
};

export default logger;
