// 客户端国际化脚本
// 用于在页面加载后根据用户语言偏好更新界面文本

import { t, locales } from "../i18n/index.ts";

// 检测并更新页面元素的文本
export function updatePageTranslations() {
	// 获取当前语言偏好
	const getCurrentLocale = () => {
		if (typeof localStorage !== 'undefined') {
			const preferredLocale = localStorage.getItem('preferred-locale');
			if (preferredLocale && locales.includes(preferredLocale)) {
				return preferredLocale;
			}
		}
		return 'zh-CN'; // 默认语言
	};

	const currentLocale = getCurrentLocale();

	// 更新导航栏文本
	const navLinks = document.querySelectorAll('[data-i18n-key]');
	navLinks.forEach((element) => {
		const key = (element as HTMLElement).dataset.i18nKey;
		if (key) {
			const translation = t(key, currentLocale);
			// 更新文本内容
			if (element.children.length === 0) {
				// 纯文本节点
				element.textContent = translation;
			} else {
				// 复杂元素，找第一个文本节点
				const textNode = Array.from(element.childNodes).find(
					node => node.nodeType === Node.TEXT_NODE
				);
				if (textNode) {
					textNode.textContent = translation;
				}
			}
		}
	});

	// 更新 PostMeta 组件的文本
	const metaElements = document.querySelectorAll('[data-i18n-meta]');
	metaElements.forEach((element) => {
		const type = (element as HTMLElement).dataset.i18nMeta;
		if (type === 'noTags') {
			element.textContent = t('common.noTags', currentLocale);
		}
	});

	// 更新 Footer 文本
	const footerLicensed = document.querySelector('[data-i18n-footer="licensed"]');
	if (footerLicensed) {
		footerLicensed.textContent = t('footer.licensed', currentLocale);
	}

	const footerLicense = document.querySelector('[data-i18n-footer="license"]');
	if (footerLicense) {
		footerLicense.textContent = t('footer.license', currentLocale);
	}

	const footerRss = document.querySelector('[data-i18n-footer="rss"]');
	if (footerRss) {
		footerRss.textContent = t('footer.rss', currentLocale);
	}

	const footerSitemap = document.querySelector('[data-i18n-footer="sitemap"]');
	if (footerSitemap) {
		footerSitemap.textContent = t('footer.sitemap', currentLocale);
	}

	const footerPoweredBy = document.querySelector('[data-i18n-footer="poweredBy"]');
	if (footerPoweredBy) {
		footerPoweredBy.textContent = t('footer.poweredBy', currentLocale);
	}

	const footerAnd = document.querySelector('[data-i18n-footer="and"]');
	if (footerAnd) {
		footerAnd.textContent = t('footer.and', currentLocale);
	}

	const footerPowered = document.querySelector('[data-i18n-footer="powered"]');
	if (footerPowered) {
		footerPowered.textContent = t('footer.powered', currentLocale);
	}

	const footerCodeOpenSource = document.querySelector('[data-i18n-footer="codeOpenSource"]');
	if (footerCodeOpenSource) {
		footerCodeOpenSource.textContent = t('footer.codeOpenSource', currentLocale);
	}

	const footerIsOpenSource = document.querySelector('[data-i18n-footer="isOpenSource"]');
	if (footerIsOpenSource) {
		footerIsOpenSource.textContent = t('footer.isOpenSource', currentLocale);
	}

	// 更新 Pagination 文本
	const paginationPrev = document.querySelector('[data-i18n-pagination="prev"]');
	if (paginationPrev) {
		paginationPrev.textContent = t('common.prevPage', currentLocale);
	}

	const paginationNext = document.querySelector('[data-i18n-pagination="next"]');
	if (paginationNext) {
		paginationNext.textContent = t('common.nextPage', currentLocale);
	}

	// 更新 BackToTop 文本
	const backToTop = document.querySelector('[data-i18n="backToTop"]');
	if (backToTop) {
		backToTop.textContent = t('common.backToTop', currentLocale);
	}

	// 更新 ArchivePanel 文本
	const archiveTitle = document.querySelector('[data-i18n-archive="title"]');
	if (archiveTitle) {
		archiveTitle.textContent = t('archive.title', currentLocale);
	}

	const archiveAllPosts = document.querySelector('[data-i18n-archive="allPosts"]');
	if (archiveAllPosts) {
		archiveAllPosts.textContent = t('archive.allPosts', currentLocale);
	}

	const archiveTags = document.querySelector('[data-i18n-archive="tags"]');
	if (archiveTags) {
		archiveTags.textContent = t('archive.tags', currentLocale);
	}

	// 更新 Widget 文本
	const widgetMore = document.querySelectorAll('[data-i18n-widget="more"]');
	widgetMore.forEach((element) => {
		element.textContent = t('common.more', currentLocale);
	});

	const widgetTags = document.querySelectorAll('[data-i18n-widget="tags"]');
	widgetTags.forEach((element) => {
		element.textContent = t('common.tags', currentLocale);
	});

	const widgetToc = document.querySelectorAll('[data-i18n-widget="toc"]');
	widgetToc.forEach((element) => {
		element.textContent = t('common.toc', currentLocale);
	});

	// 更新页面标题
	const pageTitleElement = document.querySelector('[data-i18n-page="title"]');
	if (pageTitleElement) {
		const key = pageTitleElement.getAttribute('data-i18n-page-key');
		if (key) {
			pageTitleElement.textContent = t(key, currentLocale);
		}
	}
}

// 页面加载完成后执行
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', updatePageTranslations);
} else {
	updatePageTranslations();
}

// 处理 Astro 的页面切换事件
document.addEventListener('astro:after-swap', updatePageTranslations);
