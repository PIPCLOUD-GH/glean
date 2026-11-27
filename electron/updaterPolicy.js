const RELEASES_BASE_URL = "https://github.com/pipcloudlab/glean/releases";
// 自建源固定地址：/latest/ 目录托管 latest.yml 与安装包（发版时同步镜像）。
const SELFHOSTED_LATEST_BASE_URL = "https://download.glean.pipcloud.cn/latest";
const MANUAL_DOWNLOAD_NOTICE =
  "Windows 和 macOS 暂不支持客户端内自动安装。点击“立即更新”后将打开浏览器，请下载与当前系统和芯片匹配的安装包并手动安装。";

function isManualDownloadPlatform(platform = process.platform) {
  return platform === "darwin" || platform === "win32";
}

function normalizeStableVersion(version) {
  const normalized = String(version || "").trim().replace(/^v/i, "");
  return /^\d+\.\d+\.\d+(?:\+[^-\s]+)?$/.test(normalized) ? normalized : "";
}

/**
 * 按更新通道生成 electron-updater 的 feed 配置（setFeedURL 入参）。
 * @param {"github"|"selfhosted"} channel 更新通道；github 用官方 GitHub Release，selfhosted 用自建 generic 源
 * @returns {object} provider 配置对象
 */
function buildDesktopFeed(channel) {
  if (channel === "selfhosted") {
    return { provider: "generic", url: `${SELFHOSTED_LATEST_BASE_URL}/` };
  }
  // 仓库已迁移到 pipcloudlab；app-update.yml 里旧的 owner=pipcloud 会 404，这里固定纠正。
  return { provider: "github", owner: "pipcloudlab", repo: "glean", releaseType: "release" };
}

/**
 * 生成手动下载页/安装包直链（Windows/macOS 走浏览器手动下载）。
 * @param {string} version 检测到的新版本号
 * @param {"github"|"selfhosted"} channel 更新通道
 * @param {string} platform 平台（默认当前进程）
 * @param {string} arch 芯片架构（默认当前进程）
 * @returns {string} 打开浏览器的 URL
 */
function buildReleaseDownloadUrl(version, channel = "github", platform = process.platform, arch = process.arch) {
  if (channel === "selfhosted") {
    const normalized = normalizeStableVersion(version);
    if (!normalized) return `${SELFHOSTED_LATEST_BASE_URL}/`;
    if (platform === "darwin") return `${SELFHOSTED_LATEST_BASE_URL}/Glean-${normalized}-${arch}.dmg`;
    return `${SELFHOSTED_LATEST_BASE_URL}/Glean-${normalized}-setup.exe`;
  }
  // GitHub 通道固定指向 latest 页：git tag 采用补零格式（如 v01.00.01），
  // 按版本号拼 tag/vX.Y.Z 会 404，而发现更新后 latest 页必然存在。
  return `${RELEASES_BASE_URL}/latest`;
}

// 网络层错误特征：DNS/连接/超时/证书等，用于判断“更新源不可达”并给出网络提示。
const NETWORK_ERROR_PATTERN =
  /ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|EHOSTUNREACH|ENETUNREACH|socket hang up|getaddrinfo|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_(RESET|REFUSED|TIMED_OUT|ABORTED|FAILED|CLOSED)|ERR_ADDRESS_UNREACHABLE|ERR_NETWORK_CHANGED|ERR_TIMED_OUT|ERR_NAME_(NOT_RESOLVED|UNRESOLVED)|ERR_CERT|ERR_SSL|net::ERR_/i;

/**
 * 判断更新检查错误是否属于网络不可达。
 * @param {unknown} error 捕获到的错误对象或消息
 * @returns {boolean} 是否网络类错误
 */
function isUpdateNetworkError(error) {
  const message = error?.message || String(error || "");
  return NETWORK_ERROR_PATTERN.test(message);
}

/**
 * 主通道与备用通道都检查失败时拼装用户可读的错误信息（更新通道切换要点 d）。
 * @param {unknown} firstError 主通道错误
 * @param {unknown} secondError 备用通道错误
 * @returns {string} 明确的网络/双源不可用提示
 */
function buildChannelFallbackError(firstError, secondError) {
  const first = firstError?.message || String(firstError || "");
  const second = secondError?.message || String(secondError || "");
  if (isUpdateNetworkError(firstError) && isUpdateNetworkError(secondError)) {
    return `GitHub 与自建源均无法访问，请检查网络或代理设置后重试。${second}`;
  }
  return `两个更新源均不可用：${second}（另一通道：${first}）`;
}

function withManualDownloadNotice(releaseNotes) {
  const notes = String(releaseNotes || "").trim();
  if (!notes) return MANUAL_DOWNLOAD_NOTICE;
  if (notes.includes(MANUAL_DOWNLOAD_NOTICE)) return notes;
  return `${MANUAL_DOWNLOAD_NOTICE}\n\n${notes}`;
}

module.exports = {
  MANUAL_DOWNLOAD_NOTICE,
  RELEASES_BASE_URL,
  SELFHOSTED_LATEST_BASE_URL,
  buildDesktopFeed,
  buildReleaseDownloadUrl,
  isManualDownloadPlatform,
  isUpdateNetworkError,
  buildChannelFallbackError,
  normalizeStableVersion,
  withManualDownloadNotice,
};
