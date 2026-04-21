export function log(level, message) {
  const now = new Date().toISOString().replace("T", " ").split(".")[0];
  const prefix = "[Netty/Autobypass] >";

  const colors = {
    reset: "\x1b[0m",

    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    white: "\x1b[37m",

    brightRed: "\x1b[91m",
    darkGreen: "\x1b[32;2m",
  };

  const levels = {
    INFO: { label: "[INFO]", color: colors.white },
    WARN: { label: "[WARN]", color: colors.yellow },
    ERROR: { label: "[ERROR]", color: colors.red },
    SUCCESS: { label: "[SUCCESS]", color: colors.green },

    PROXY: { label: "[PROXY]", color: colors.red },
    FLOODER: { label: "[FLOODER]", color: colors.yellow },
    FARM: { label: "[FARM]", color: colors.white },

    PROXY_SUCCESS: { label: "[PROXY_SUCCESS]", color: colors.darkGreen },
    PROXY_FAILED: { label: "[PROXY_FAILED]", color: colors.brightRed },
  };
  const levelInfo = levels[level] || { label: "[LOG]", color: colors.white };

  console.log(
    `${colors.white}[${now}] ${prefix} ${levelInfo.color}${levelInfo.label}${colors.reset} ${message}`,
  );
}
