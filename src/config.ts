import type {
    ExpressiveCodeConfig,
	GitHubEditConfig,
	ImageFallbackConfig,
	LicenseConfig,
	NavBarConfig,
	ProfileConfig,
	SiteConfig,
	UmamiConfig,
	AnalyticsConfig,
} from "./types/config";
import { LinkPreset } from "./types/config";

export const siteConfig: SiteConfig = {
	title: "花渐畔",
	subtitle: "技术探索与思维进化",
	description:
		"分享Serverless架构、AI应用开发、认知科学、科学学习方法与前后端技术实践的个人博客，专注于云原生、无服务器计算和智能应用开发，探索技术如何赋能学习与创新",

	keywords: [],
	lang: "zh_CN", // 'en', 'zh_CN', 'zh_TW', 'ja', 'ko', 'es', 'th'
	themeColor: {
		hue: 205, // 浅蓝色配色方案
		fixed: true, // Hide the theme color picker for visitors
		forceDarkMode: false, // 允许切换浅色/暗色模式
	},
	banner: {
		enable: false,
		src: "/background/back.jpg", // Relative to the /src directory. Relative to the /public directory if it starts with '/'

		position: "center", // Equivalent to object-position, only supports 'top', 'center', 'bottom'. 'center' by default
		credit: {
			enable: true, // Display the credit text of the banner image
			text: "Pixiv @chokei", // Credit text to be displayed

			url: "https://www.pixiv.net/artworks/122782209", // (Optional) URL link to the original artwork or artist's page
		},
	},
	background: {
		enable: false, // Enable background image
		src: "https://eopfapi.2b2x.cn/pic?img=ua", // Background image URL (supports HTTPS)
		position: "center", // Background position: 'top', 'center', 'bottom'
		size: "cover", // Background size: 'cover', 'contain', 'auto'
		repeat: "no-repeat", // Background repeat: 'no-repeat', 'repeat', 'repeat-x', 'repeat-y'
		attachment: "fixed", // Background attachment: 'fixed', 'scroll', 'local'
		opacity: 0.5, // Background opacity (0-1)
	},
	waveBackground: {
		enable: false, // 启用 Three.js 点阵海潮背景（与 chaosBackground 二选一）
		gridSize: 50, // 网格密度 (点阵的行列数，建议 30-60)
		waveHeight: 15, // 波浪高度
		waveSpeed: 0.001, // 波浪速度 (0.0001-0.01)
		mouseInfluence: 20, // 鼠标影响范围
		mouseStrength: 30, // 鼠标影响强度
		particleSize: 2, // 粒子大小
		spacing: 15, // 点之间的间距
		opacity: 0.3, // 整体透明度 (0-1)
	},
	chaosBackground: {
		enable: false, // 禁用混沌背景特效，保持简洁配色
		particleCount: 30, // 粒子数量（建议 10-30）
		trailLength: 400, // 轨迹长度（建议 100-300）
		opacity: 0.6, // 整体透明度 (0-1)
	},
	toc: {
		enable: true, // Display the table of contents on the right side of the post
		depth: 2, // Maximum heading depth to show in the table, from 1 to 3
	},
	favicon: [
		// Leave this array empty to use the default favicon
		{
			src: "https://blogoss.678910.best/rin/rin-images/a52f77ee17dcb7c05ac9fd5c5c7d2fa88663475d.png", // Path of the favicon, relative to the /public directory
			//   theme: 'light',              // (Optional) Either 'light' or 'dark', set only if you have different favicons for light and dark mode
			//   sizes: '32x32',              // (Optional) Size of the favicon, set only if you have favicons of different sizes
		},
	],
};

export const navBarConfig: NavBarConfig = {
	links: [
		LinkPreset.Home,
		LinkPreset.Archive,
		{
			name: "图书",
			url: "/books/",
			external: false,
		},
		LinkPreset.About,
		{
			name: "统计",
			url: "https://cloud.umami.is/share/5H4KmYOEzPrCPML2", // Internal links should not include the base path, as it is automatically added
			external: true, // Show an external link icon and will open in a new tab
		},
	],
};

export const profileConfig: ProfileConfig = {
	avatars: [
		// 多个头像，每次刷新随机显示一个
		"https://blogoss.678910.best/rin/rin-images/a52f77ee17dcb7c05ac9fd5c5c7d2fa88663475d.png",
		// "/profile/avatar/69108294_p13.jpg",
		// "/profile/avatar/69108294_p7.jpg",
		// "/profile/avatar/98308336_p5.png",
	],
	name: "花渐畔",
	bio: "Believe You Self.",
	links: [
		{
			name: "GitHub",
			icon: "fa6-brands:github",
			url: "https://github.com/huajianpan",
		},
	],
};

export const licenseConfig: LicenseConfig = {
	enable: true,
	name: "CC BY-NC-SA 4.0",
	url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

export const imageFallbackConfig: ImageFallbackConfig = {
	enable: true,
	originalDomain: "eo-r2.2x.nz",
	fallbackDomain: "pub-d433ca7edaa74994b3d7c40a7fd7d9ac.r2.dev",
};

export const umamiConfig: UmamiConfig = {
	enable: true,
	baseUrl: "https://cloud.umami.is",
	shareId: "5H4KmYOEzPrCPML2", // ⚠️ 请替换为你自己的 Share ID，不要用原作者的
	timezone: "Asia/Shanghai",
};

export const expressiveCodeConfig: ExpressiveCodeConfig = {
	theme: "github-dark",
};

export const gitHubEditConfig: GitHubEditConfig = {
	enable: true,
	baseUrl: "https://github.com/huajianpan/notion-fuwari/blob/master/src/content/posts",
};


export const statsConfig = {
	viewsText: "浏览",
	visitsText: "访客",
	loadingText: "统计加载中...",
	unavailableText: "统计不可用。请检查是否屏蔽了Umami域名，如AdGuard和AdBlock等插件",
	getStatsText: (pageViews: number, visits: number) => `${statsConfig.viewsText} ${pageViews} · ${statsConfig.visitsText} ${visits}`,
};

// 分析和广告配置
// 如果不需要某项服务，可以删除对应配置或设置 enable: false
export const analyticsConfig: AnalyticsConfig = {
	// Umami 云端分析（原作者的配置，建议删除或替换）
	umamiCloud: {
		enable: true,
		websiteId: "84ff2cd6-164b-4d14-8f8c-4133ee719fee",
	},
	// 百度统计（原作者的配置，建议删除或替换）
	baidu: {
		enable: false,
		id: "b219eaad631b87d273cfe72148b2138b",
	},
	// Microsoft Clarity（原作者的配置，建议删除或替换）
	clarity: {
		enable: false,
		projectId: "t8f0gmcwtx",
	},
	// Google AdSense（原作者的广告ID，建议删除或替换）
	googleAdsense: {
		enable: false,
		publisherId: "ca-pub-1683686345039700",
	},
	// Google Analytics（原作者的配置，建议删除或替换）
	googleAnalytics: {
		enable: false,
		measurementId: "G-D9ZRKT7G85",
	},
	// Cloudflare Web Analytics（原作者的配置，建议删除或替换）
	cloudflare: {
		enable: false,
		token: "15fe148e91b34f10a15652e1a74ab26c",
	},
};

// AI 聊天配置
export const aiChatConfig = {
	enable: true, // 设置为 true 启用 AI 聊天功能
	// API 端点 - 使用 Cloudflare Pages Functions
	apiEndpoint: "/api/ai-search",
	// 可选：自定义欢迎消息
	welcomeMessage: "你好！我是 AI 助手，可以帮你检索博客内容。有什么问题吗？",
};
