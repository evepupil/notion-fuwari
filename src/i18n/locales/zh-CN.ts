// 中文翻译
export const zhCN = {
	// 导航
	nav: {
		home: "首页",
		archive: "归档",
		about: "关于",
		friends: "友链",
		sponsors: "赞助",
	},

	// 通用
	common: {
		search: "搜索",
		tags: "标签",
		categories: "分类",
		toc: "目录",
		readMore: "阅读更多",
		backToTop: "返回顶部",
		prevPage: "上一页",
		nextPage: "下一页",
		pinnedPost: "置顶",
	},

	// 文章
	post: {
		publishedAt: "发布于",
		updatedAt: "更新于",
		readingTime: "阅读时长",
		minutes: "分钟",
		words: "字",
		views: "浏览",
		visitors: "访客",
	},

	// 归档
	archive: {
		title: "文章归档",
		allPosts: "全部文章",
		postsCount: "共 {count} 篇文章",
	},

	// 404
	notFound: {
		title: "页面走丢了",
		description: "您访问的页面不存在",
		backHome: "返回首页",
		goArchive: "文章归档",
	},

	// 统计
	stats: {
		views: "浏览",
		visitors: "访客",
		loading: "统计加载中...",
		error: "统计加载失败",
	},

	// 友链
	friends: {
		title: "友情链接",
		submit: "提交友链",
		siteName: "网站名称",
		siteUrl: "网站地址",
		description: "网站描述",
		avatar: "头像URL",
		submitting: "提交中...",
		success: "提交成功，等待审核",
		error: "提交失败",
	},

	// 评论
	comments: {
		title: "评论",
		placeholder: "说点什么...",
	},

	// 许可证
	license: {
		text: "本文采用 {license} 许可协议",
	},
};

export type TranslationKeys = typeof zhCN;
