#!/usr/bin/env node

/**
 * Notion 博客同步脚本
 * 功能：
 * 1. 从 Notion 数据库获取已发布文章
 * 2. 转换为 Markdown 格式
 * 3. 下载文章中的图片到本地
 * 4. 替换图片链接为本地路径
 * 5. 保存到 Fuwari content 目录
 */

import dotenv from 'dotenv';
import { Client } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
// 在 Vercel 等 CI/CD 环境中，环境变量已经自动注入，无需 dotenv
// 在本地开发时，从 .env.local 加载
if (!process.env.VERCEL && !process.env.CI) {
  dotenv.config({ path: '.env.local' });
  dotenv.config();
}

// 同步模式（从命令行参数获取）
// --mode=overwrite : 完全同步，只覆盖带 Notion 标记的文章，并删除本地已带 Notion 标记但 Notion 中不存在的文章（默认）
// --mode=new-only  : 仅新增，不覆盖已存在的文章，不删除旧文章
// --mode=append    : 纯增量，添加新文章并更新已带 Notion 标记的文章，不删除旧文章
const args = process.argv.slice(2);
const modeArg = args.find(arg => arg.startsWith('--mode='));
const SYNC_MODE = modeArg ? modeArg.split('=')[1] : 'overwrite';

// 验证同步模式
const VALID_MODES = ['overwrite', 'new-only', 'append'];
if (!VALID_MODES.includes(SYNC_MODE)) {
  console.error(`❌ 错误: 无效的同步模式 "${SYNC_MODE}"`);
  console.error(`可用模式: ${VALID_MODES.join(', ')}`);
  process.exit(1);
}

// 配置
const CONFIG = {
  notionToken: process.env.NOTION_TOKEN,
  notionDatabaseId: process.env.NOTION_DATABASE_ID,
  contentDir: path.join(process.cwd(), 'src/content/posts'),
  assetsDir: path.join(process.cwd(), 'src/content/assets/images'),
  postsStatus: 'Published', // Notion 中的状态字段值
  syncMode: SYNC_MODE, // 同步模式
};

// 验证环境变量
if (!CONFIG.notionToken || !CONFIG.notionDatabaseId) {
  console.error('❌ 错误: 缺少必要的环境变量');
  console.error('请确保 .env.local 文件包含:');
  console.error('  NOTION_TOKEN=your_token');
  console.error('  NOTION_DATABASE_ID=your_database_id');
  process.exit(1);
}

// 初始化 Notion 客户端
const notion = new Client({ auth: CONFIG.notionToken });
const n2m = new NotionToMarkdown({ notionClient: notion });

/**
 * 确保目录存在
 */
function ensureDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 创建目录: ${dir}`);
  }
}

/**
 * 读取 Markdown frontmatter 内容
 */
function extractFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? match[1] : '';
}

/**
 * 判断本地文章是否由 Notion 管理
 */
function getPostManagementType(filepath) {
  if (!fs.existsSync(filepath)) {
    return 'missing';
  }

  const content = fs.readFileSync(filepath, 'utf-8');
  const frontmatter = extractFrontmatter(content);

  if (/^\s*notionSync:\s*true\s*$/m.test(frontmatter)) {
    return 'notion';
  }

  return 'manual';
}

/**
 * 获取 Notion 文章基础信息
 */
function getPostMetadata(page) {
  const properties = page.properties;
  const title = properties.Title?.title[0]?.plain_text || 'Untitled';
  const slug = generateSlug(title);
  const coverImage = properties['Featured Image']?.files[0]?.file.url;
  const publishedDate = properties['Published Date']?.date?.start || new Date().toISOString();
  const tags = properties.Tags?.multi_select?.map(tag => tag.name) || [];
  const category = properties.Category?.select?.name;

  return {
    title,
    slug,
    coverImage,
    publishedDate,
    tags,
    category,
  };
}

/**
 * 生成文件名安全的 slug
 */
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'untitled';
}

/**
 * 下载图片到本地
 */
function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const request = protocol.get(url, (response) => {
      // 处理重定向
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        console.log(`  ↪️  重定向到: ${redirectUrl}`);
        downloadImage(redirectUrl, filepath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`下载失败: HTTP ${response.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(filepath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve(filepath);
      });

      fileStream.on('error', (err) => {
        fs.unlinkSync(filepath);
        reject(err);
      });
    });

    request.on('error', reject);
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('下载超时'));
    });
  });
}

/**
 * 从 URL 获取文件扩展名
 */
function getImageExtension(url) {
  const match = url.match(/\.(jpg|jpeg|png|gif|webp|svg|avif)(\?|$)/i);
  return match ? match[1].toLowerCase() : 'jpg';
}

/**
 * 生成唯一的图片文件名
 */
function generateImageFilename(url, postSlug, index) {
  const ext = getImageExtension(url);
  return `image-${index + 1}.${ext}`;
}

/**
 * 确保文章图片目录存在
 */
function ensurePostImageDirectory(postSlug) {
  const postImageDir = path.join(CONFIG.assetsDir, postSlug);
  ensureDirectory(postImageDir);
  return postImageDir;
}

/**
 * 处理 Markdown 中的图片链接
 */
async function processImages(markdown, postSlug) {
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const images = [];
  let match;

  // 收集所有图片链接
  while ((match = imageRegex.exec(markdown)) !== null) {
    const [fullMatch, alt, url] = match;

    // 跳过已经是本地路径的图片
    if (url.startsWith('./') || url.startsWith('../') || url.startsWith('/')) {
      continue;
    }

    images.push({ fullMatch, alt, url });
  }

  if (images.length === 0) {
    return markdown;
  }

  console.log(`  🖼️  发现 ${images.length} 张图片需要下载`);

  // 确保文章的图片目录存在
  const postImageDir = ensurePostImageDirectory(postSlug);

  // 下载图片并替换链接
  let updatedMarkdown = markdown;
  for (let i = 0; i < images.length; i++) {
    const { fullMatch, alt, url } = images[i];
    try {
      const filename = generateImageFilename(url, postSlug, i);
      const filepath = path.join(postImageDir, filename);

      console.log(`  ⬇️  下载: ${postSlug}/${filename}`);
      await downloadImage(url, filepath);

      // 替换为相对路径
      const relativePath = `../assets/images/${postSlug}/${filename}`;
      const newImageTag = `![${alt}](${relativePath})`;
      updatedMarkdown = updatedMarkdown.replace(fullMatch, newImageTag);

      console.log(`  ✅ 已保存: ${postSlug}/${filename}`);
    } catch (error) {
      console.warn(`  ⚠️  下载失败: ${url}`);
      console.warn(`     ${error.message}`);
      // 保留原始链接
    }
  }

  return updatedMarkdown;
}

/**
 * 从 Notion 获取文章
 */
async function fetchPublishedPosts() {
  console.log('📥 从 Notion 获取已发布文章...');

  const response = await notion.databases.query({
    database_id: CONFIG.notionDatabaseId,
    filter: {
      property: 'Status',
      status: {
        equals: CONFIG.postsStatus,
      },
    },
    sorts: [
      {
        property: 'Published Date',
        direction: 'descending',
      },
    ],
  });

  console.log(`✅ 找到 ${response.results.length} 篇已发布文章`);
  return response.results;
}

/**
 * 处理单篇文章
 */
async function processPost(page) {
  const { title, slug, coverImage, publishedDate, tags, category } = getPostMetadata(page);

  console.log(`\n📝 处理文章: ${title}`);
  console.log(`   Slug: ${slug}`);

  // 转换为 Markdown
  const mdBlocks = await n2m.pageToMarkdown(page.id);
  const { parent: content } = n2m.toMarkdownString(mdBlocks);

  // 处理图片
  const processedContent = await processImages(content, slug);

  // 处理封面图
  let localCoverImage = '';
  if (coverImage) {
    try {
      // 确保文章的图片目录存在
      const postImageDir = ensurePostImageDirectory(slug);
      const coverFilename = `cover.${getImageExtension(coverImage)}`;
      const coverPath = path.join(postImageDir, coverFilename);
      console.log(`  🖼️  下载封面图: ${slug}/${coverFilename}`);
      await downloadImage(coverImage, coverPath);
      localCoverImage = `../assets/images/${slug}/${coverFilename}`;
      console.log(`  ✅ 封面图已保存`);
    } catch (error) {
      console.warn(`  ⚠️  封面图下载失败: ${error.message}`);
    }
  }

  // 获取描述（从内容的第一段提取）
  const paragraphs = (processedContent || '')
    .split('\n')
    .filter(line => line.trim().length > 0 && !line.startsWith('#') && !line.startsWith('!'));
  const firstParagraph = paragraphs[0] || '';
  const description = firstParagraph.slice(0, 160) + (firstParagraph.length > 160 ? '...' : '');

  // 生成 frontmatter
  const categoryLine = category ? `category: '${category}'\n` : '';
  const frontmatter = `---
title: '${title.replace(/'/g, "''")}'
published: ${publishedDate}
description: '${description.replace(/'/g, "''")}'
image: '${localCoverImage}'
tags: [${tags.map(tag => `"${tag}"`).join(', ')}]
draft: false
lang: 'zh-CN'
translationKey: '${slug}'
notionSync: true
notionPageId: '${page.id}'
${categoryLine}---

`;

  // 完整的 Markdown 内容
  const fullContent = frontmatter + processedContent;

  // 保存文件
  const filename = `${slug}.md`;
  const filepath = path.join(CONFIG.contentDir, filename);
  const managementType = getPostManagementType(filepath);

  // 检查文件是否已存在
  if (managementType !== 'missing') {
    if (managementType === 'manual') {
      console.log(`  🛡️  跳过（本地手写文章，未带 Notion 标记）`);
      return {
        title,
        slug,
        filename,
        tags,
        skipped: true,
        skipReason: 'manual-protected',
      };
    }

    if (CONFIG.syncMode === 'new-only') {
      // new-only 模式：跳过已存在的文件
      console.log(`  ⏭️  跳过（已存在）: ${filename}`);
      return {
        title,
        slug,
        filename,
        tags,
        skipped: true,
        skipReason: 'existing',
      };
    } else if (CONFIG.syncMode === 'overwrite') {
      // overwrite 模式：覆盖已存在的文件
      console.log(`  🔄 覆盖已存在的 Notion 文章`);
    } else if (CONFIG.syncMode === 'append') {
      // append 模式：更新已存在的文件
      console.log(`  ♻️  更新已存在的 Notion 文章`);
    }
  }

  fs.writeFileSync(filepath, fullContent, 'utf-8');

  console.log(`  💾 已保存: ${filename}`);

  return {
    title,
    slug,
    filename,
    tags,
  };
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 Notion 博客同步脚本\n');

  // 显示同步模式
  const modeDescriptions = {
    'overwrite': '完全同步（只覆盖/删除带 Notion 标记的文章）',
    'new-only': '仅新增（不覆盖已存在文章，不删除旧文章）',
    'append': '纯增量（添加新文章并更新带 Notion 标记的文章，不删除旧文章）'
  };
  const modeText = modeDescriptions[CONFIG.syncMode] || CONFIG.syncMode;
  console.log(`同步模式: ${modeText}`);

  console.log('\n配置信息:');
  console.log(`  Notion Database ID: ${CONFIG.notionDatabaseId}`);
  console.log(`  文章目录: ${CONFIG.contentDir}`);
  console.log(`  图片目录: ${CONFIG.assetsDir}\n`);

  // 确保目录存在
  ensureDirectory(CONFIG.contentDir);
  ensureDirectory(CONFIG.assetsDir);

  try {
    // 获取文章列表
    const posts = await fetchPublishedPosts();

    if (posts.length === 0) {
      console.log('\n📭 没有找到已发布的文章');
      return;
    }

    // 处理每篇文章
    const results = [];
    for (const post of posts) {
      try {
        const result = await processPost(post);
        results.push(result);
      } catch (error) {
        console.error(`❌ 处理文章失败:`, error.message);
      }
    }

    // overwrite 模式：清理本地多余的 Notion 管理文章
    let deletedCount = 0;
    if (CONFIG.syncMode === 'overwrite') {
      console.log('\n🗑️  清理本地多余的 Notion 管理文章...');

      // 获取 Notion 中所有文章的 slug 列表
      const notionSlugs = posts.map(post => getPostMetadata(post).slug);

      // 获取本地所有 .md 文件
      const localFiles = fs.readdirSync(CONFIG.contentDir).filter(file => file.endsWith('.md'));

      // 找出本地存在但 Notion 中不存在的 Notion 管理文章
      for (const file of localFiles) {
        const slug = file.replace('.md', '');
        const filepath = path.join(CONFIG.contentDir, file);
        const managementType = getPostManagementType(filepath);

        if (managementType !== 'notion') {
          continue;
        }

        if (!notionSlugs.includes(slug)) {
          try {
            fs.unlinkSync(filepath);
            deletedCount++;
            console.log(`  🗑️  已删除: ${file}`);
          } catch (error) {
            console.error(`  ❌ 删除失败: ${file} - ${error.message}`);
          }
        }
      }

      if (deletedCount === 0) {
        console.log('  ✅ 没有需要清理的 Notion 管理文章');
      } else {
        console.log(`  ✅ 已清理 ${deletedCount} 篇多余的 Notion 管理文章`);
      }
    }

    // 输出统计信息
    console.log('\n' + '='.repeat(60));
    console.log('✅ 同步完成!');
    console.log(`\n📊 统计信息:`);
    console.log(`  - 成功同步: ${results.length} 篇文章`);
    console.log(`  - 失败: ${posts.length - results.length} 篇`);

    const protectedCount = results.filter(r => r.skipReason === 'manual-protected').length;
    const existingSkippedCount = results.filter(r => r.skipReason === 'existing').length;
    const newCount = results.filter(r => !r.skipped).length;

    // 根据模式显示不同的统计信息
    if (CONFIG.syncMode === 'overwrite') {
      console.log(`  - 覆盖/更新: ${newCount} 篇`);
      if (protectedCount > 0) {
        console.log(`  - 保护跳过（手写文章）: ${protectedCount} 篇`);
      }
      if (deletedCount > 0) {
        console.log(`  - 已删除: ${deletedCount} 篇`);
      }
    } else if (CONFIG.syncMode === 'new-only') {
      if (existingSkippedCount > 0) {
        console.log(`  - 跳过（已存在）: ${existingSkippedCount} 篇`);
      }
      if (protectedCount > 0) {
        console.log(`  - 保护跳过（手写文章）: ${protectedCount} 篇`);
      }
      if (newCount > 0) {
        console.log(`  - 新增: ${newCount} 篇`);
      }
    } else if (CONFIG.syncMode === 'append') {
      console.log(`  - 新增/更新: ${newCount} 篇`);
      if (existingSkippedCount > 0) {
        console.log(`  - 跳过（已存在）: ${existingSkippedCount} 篇`);
      }
      if (protectedCount > 0) {
        console.log(`  - 保护跳过（手写文章）: ${protectedCount} 篇`);
      }
    }

    if (results.length > 0) {
      console.log('\n📝 已同步文章:');
      results.forEach(({ title, filename, skipped, skipReason }) => {
        const prefix = skipped
          ? skipReason === 'manual-protected'
            ? '  🛡️ '
            : '  ⏭️ '
          : '  • ';
        console.log(`${prefix}${title} (${filename})`);
      });
    }

    console.log('\n💡 下一步:');
    console.log('  1. 运行 pnpm dev 预览博客');
    console.log('  2. 检查文章内容和图片是否正确');
    console.log('  3. 运行 pnpm build 构建生产版本');

    console.log('\n💡 同步模式说明:');
    console.log('  - overwrite（默认）: pnpm sync-notion');
    console.log('    只覆盖带 Notion 标记的文章，并删除本地多余的 Notion 管理文章');
    console.log('  - new-only: pnpm sync-notion -- --mode=new-only');
    console.log('    仅新增，不覆盖已存在的文章，不删除旧文章');
    console.log('  - append: pnpm sync-notion -- --mode=append');
    console.log('    纯增量，添加新文章并更新带 Notion 标记的文章，不删除旧文章\n');

  } catch (error) {
    console.error('\n❌ 同步失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行脚本
main();
