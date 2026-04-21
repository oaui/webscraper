import {
  formatLocales,
  getTimeZoneByIp,
  randnum,
  readFile,
  getChromePath,
} from "../util/Helpers.js";
import { log } from "../util/Util.js";
function getProxy(config, proxyArray) {
  try {
    const proxies = proxyArray
      .map((line) => {
        if (line.includes(":")) {
          const size = line.split(":").length;
          /**
           * Can either be host:port which would equal size 2
           * or
           * host:port:username:password which would equal size 4
           */
          if (size == 2) {
            const [host, port] = line.split(":");
            return { host: host.trim(), port: parseInt(port.trim()) };
          } else if (size == 4) {
            const [host, port, username, password] = line.split(":");
            return {
              host: host.trim(),
              port: parseInt(port.trim()),
              username: username.trim(),
              password: password.trim(),
            };
          } else {
            log("ERROR", `Invalid proxy format: ${line}`);
            return null;
          }
        }
        return null;
      })
      .filter((proxy) => proxy !== null);

    if (proxies.length > 0) {
      log(
        "INFO",
        `Loaded ${proxies.length} proxies from '${config.proxyFile}'`,
      );
    } else {
      log("WARN", `No valid proxies found in '${config.proxyFile}'`);
    }

    return proxies;
  } catch (error) {
    log("WARN", `Proxy file '${config.proxyFile}' not found or invalid`);
    return [];
  }
}
export async function setupProxy(config) {
  /**
   * Proxies
   */
  const proxiesArr = readFile(config.proxyFile);

  let proxies = [];

  proxies = getProxy(
    config,
    proxiesArr,
  ); /** Returns Array of proxy objects Format: arr : obj: host: 0.0.0.0, port: 80 */

  return proxies;
}
