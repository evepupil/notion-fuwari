import { zhCN, type TranslationKeys } from "./locales/zh-CN";
import { en } from "./locales/en";
import { siteConfig } from "@/config";

// 支持的语言列表
export const locales = ["zh-CN", "en"] as const;
export type Locale = (typeof locales)[number];

// 默认语言
export const defaultLocale: Locale = "zh-CN";

// 翻译数据
const translations: Record<Locale, TranslationKeys> = {
	"zh-CN": zhCN,
	en: en,
};

// 获取当前语言（从配置读取）
export function getCurrentLocale(): Locale {
	const configLang = siteConfig.lang.replace("_", "-");
	if (locales.includes(configLang as Locale)) {
		return configLang as Locale;
	}
	return defaultLocale;
}

// 获取翻译文本
export function t(
	key: string,
	locale?: Locale,
	params?: Record<string, string | number>
): string {
	const currentLocale = locale || getCurrentLocale();
	const keys = key.split(".");

	let value: unknown = translations[currentLocale];

	for (const k of keys) {
		if (value && typeof value === "object" && k in value) {
			value = (value as Record<string, unknown>)[k];
		} else {
			// 找不到翻译，返回 key
			console.warn(`Translation not found: ${key} for locale ${currentLocale}`);
			return key;
		}
	}

	if (typeof value !== "string") {
		return key;
	}

	// 替换参数 {param}
	if (params) {
		return value.replace(/\{(\w+)\}/g, (_, paramKey) => {
			return String(params[paramKey] ?? `{${paramKey}}`);
		});
	}

	return value;
}

// 获取指定语言的完整翻译对象
export function getTranslations(locale?: Locale): TranslationKeys {
	return translations[locale || getCurrentLocale()];
}

// 语言显示名称
export const localeNames: Record<Locale, string> = {
	"zh-CN": "简体中文",
	en: "English",
};

// 检查语言是否有效
export function isValidLocale(locale: string): locale is Locale {
	return locales.includes(locale as Locale);
}

// 从 URL 路径获取语言
export function getLocaleFromPath(path: string): Locale | null {
	// 匹配 /posts/en/... 或 /posts/zh-CN/...
	const match = path.match(/\/posts\/([a-z]{2}(?:-[A-Z]{2})?)\//);
	if (match && isValidLocale(match[1])) {
		return match[1] as Locale;
	}
	return null;
}

// 生成多语言路径
export function localePath(path: string, locale: Locale): string {
	if (locale === defaultLocale) {
		return path;
	}
	// 将 /posts/slug 转换为 /posts/en/slug
	if (path.startsWith("/posts/")) {
		return path.replace("/posts/", `/posts/${locale}/`);
	}
	return path;
}
