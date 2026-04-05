import { defineCollection, z } from "astro:content";

const postsCollection = defineCollection({
	schema: z.object({
		title: z.string(),
		published: z.date(),
		updated: z.date().optional(),
		draft: z.boolean().optional().default(false),
		description: z.string().optional().default(""),
		image: z.string().optional().default(""),
		tags: z.array(z.string()).optional().default([]),
		lang: z
			.preprocess((value) => {
				if (typeof value !== "string") return value;
				if (value === "" || value === "zh_CN") return "zh-CN";
				return value;
			}, z.enum(["zh-CN", "en"]))
			.optional()
			.default("zh-CN"),
		translationKey: z.string().optional().default(""),
		pinned: z.boolean().optional().default(false),
		notionSync: z.boolean().optional().default(false),
		notionPageId: z.string().optional().default(""),

		/* For internal use */
		prevTitle: z.string().default(""),
		prevSlug: z.string().default(""),
		nextTitle: z.string().default(""),
		nextSlug: z.string().default(""),
	}),
});

const specCollection = defineCollection({
	schema: z.object({
		title: z.string().optional(),
		published: z.date().optional(),
		updated: z.date().optional(),
		draft: z.boolean().optional().default(false),
	}),
});

const assetsCollection = defineCollection({
	type: 'data',
	schema: z.object({
		title: z.string().optional(),
		description: z.string().optional(),
	}),
});

// 图书 collection - 包含 _meta.md 和章节文件
const booksCollection = defineCollection({
	schema: z.object({
		title: z.string(),
		draft: z.boolean().optional().default(false),

		// 图书元信息字段（仅 _meta.md 使用）
		author: z.string().optional(),
		translator: z.string().optional(),
		published: z.date().optional(),
		updated: z.date().optional(),
		description: z.string().optional().default(""),
		image: z.string().optional().default(""),
		tags: z.array(z.string()).optional().default([]),
		status: z.enum(['ongoing', 'completed', 'paused']).optional().default('ongoing'),
	}),
});

export const collections = {
	posts: postsCollection,
	spec: specCollection,
	assets: assetsCollection,
	books: booksCollection,
};
