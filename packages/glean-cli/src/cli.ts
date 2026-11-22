#!/usr/bin/env node
/**
 * glean-cli — Glean 命令行工具
 *
 * 用法：
 *   glean notes list              列出笔记
 *   glean notes get <id>          查看笔记
 *   glean notes create            创建笔记
 *   glean notebooks list          列出笔记本
 *   glean attachments upload      上传附件
 *   glean attachments list        查询附件
 *   glean attachments attach      把附件插入 Markdown 笔记
 *   glean search <query>          搜索笔记
 *   glean tasks list              列出任务
 *   glean tags list               列出标签
 *   glean ai ask <question>       知识库问答
 *   glean ai process              AI 文本处理
 *   glean config                  配置连接信息
 *
 * 环境变量：
 *   GLEAN_URL       Glean 后端地址（默认 http://localhost:3001）
 *   GLEAN_USERNAME  登录用户名（默认 admin）
 *   GLEAN_PASSWORD  登录密码（默认 admin123）
 */

import { Command } from "commander";
import chalk from "chalk";
import { GleanClient } from "./sdk-client.js";
import { AttachmentClient } from "./attachment-client.js";
import { registerNotesCommands } from "./commands/notes.js";
import { registerNotebooksCommands } from "./commands/notebooks.js";
import { registerSearchCommand } from "./commands/search.js";
import { registerTasksCommands } from "./commands/tasks.js";
import { registerTagsCommands } from "./commands/tags.js";
import { registerAICommands } from "./commands/ai.js";
import { registerAttachmentCommands } from "./commands/attachments.js";
import { registerConfigCommand } from "./commands/config.js";

function getConfig() {
  return {
    baseUrl: process.env.GLEAN_URL || "http://localhost:3001",
    username: process.env.GLEAN_USERNAME || "admin",
    password: process.env.GLEAN_PASSWORD || "admin123",
  };
}

// ===== 读取配置 =====
export function getClient(): GleanClient {
  return new GleanClient(getConfig());
}

export function getAttachmentClient(): AttachmentClient {
  return new AttachmentClient(getConfig());
}

// ===== 主程序 =====
const program = new Command();

program
  .name("glean")
  .description(chalk.bold("Glean 命令行工具") + " — 从终端管理你的笔记")
  .version("1.0.0");

registerNotesCommands(program);
registerNotebooksCommands(program);
registerAttachmentCommands(program);
registerSearchCommand(program);
registerTasksCommands(program);
registerTagsCommands(program);
registerAICommands(program);
registerConfigCommand(program);

program.parse();
