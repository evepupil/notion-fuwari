import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const DEFAULT_BATCH_SIZE = 500;
const publicDir = path.resolve(process.cwd(), "public");
const astroConfigPath = path.resolve(process.cwd(), "astro.config.mjs");

function parseArgs(argv) {
	const args = {
		dryRun: false,
		sitemap: "",
		key: process.env.INDEXNOW_KEY || "",
		endpoint: INDEXNOW_ENDPOINT,
		batchSize: DEFAULT_BATCH_SIZE,
	};

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];

		if (arg === "--dry-run") {
			args.dryRun = true;
			continue;
		}

		if (arg === "--sitemap" && argv[i + 1]) {
			args.sitemap = argv[i + 1];
			i += 1;
			continue;
		}

		if (arg === "--key" && argv[i + 1]) {
			args.key = argv[i + 1];
			i += 1;
			continue;
		}

		if (arg === "--endpoint" && argv[i + 1]) {
			args.endpoint = argv[i + 1];
			i += 1;
			continue;
		}

		if (arg === "--batch-size" && argv[i + 1]) {
			const value = Number.parseInt(argv[i + 1], 10);
			if (Number.isFinite(value) && value > 0) {
				args.batchSize = value;
			}
			i += 1;
		}
	}

	return args;
}

async function getSiteUrl() {
	const astroConfig = await readFile(astroConfigPath, "utf8");
	const match = astroConfig.match(/site:\s*["']([^"']+)["']/);
	if (!match?.[1]) {
		throw new Error("没有在 astro.config.mjs 里找到 site 配置");
	}

	return match[1].replace(/\/+$/, "");
}

async function detectKeyFromPublic() {
	const entries = await readdir(publicDir, { withFileTypes: true });
	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.endsWith(".txt")) {
			continue;
		}

		const filePath = path.join(publicDir, entry.name);
		const content = (await readFile(filePath, "utf8")).trim();
		const basename = path.basename(entry.name, ".txt");

		if (content && content === basename) {
			return basename;
		}
	}

	throw new Error("没有在 public/ 根目录找到内容与文件名一致的 IndexNow key 文件");
}

function extractLocs(xml) {
	return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((match) => match[1].trim());
}

async function fetchText(url) {
	const response = await fetch(url, {
		headers: {
			"user-agent": "fuwari-indexnow-script/1.0",
			"accept": "application/xml,text/xml,text/plain,*/*",
		},
	});

	if (!response.ok) {
		throw new Error(`请求失败 ${response.status} ${response.statusText}: ${url}`);
	}

	return response.text();
}

async function verifyKeyLocation(siteUrl, key) {
	const keyLocation = `${siteUrl}/${key}.txt`;
	const content = (await fetchText(keyLocation)).trim();

	if (content !== key) {
		throw new Error(`key 文件内容不匹配: ${keyLocation}`);
	}

	return keyLocation;
}

async function collectUrlsFromSitemap(sitemapUrl, expectedHost, seenSitemaps = new Set()) {
	if (seenSitemaps.has(sitemapUrl)) {
		return [];
	}

	seenSitemaps.add(sitemapUrl);

	const xml = await fetchText(sitemapUrl);
	const locs = extractLocs(xml);
	const isIndex = xml.includes("<sitemapindex");

	if (isIndex) {
		const all = await Promise.all(
			locs.map((loc) => collectUrlsFromSitemap(loc, expectedHost, seenSitemaps)),
		);
		return all.flat();
	}

	return locs.filter((loc) => {
		try {
			return new URL(loc).host === expectedHost;
		} catch {
			return false;
		}
	});
}

function chunk(array, size) {
	const result = [];
	for (let i = 0; i < array.length; i += size) {
		result.push(array.slice(i, i + size));
	}
	return result;
}

async function submitBatch({ endpoint, host, key, keyLocation, urlList, index, total }) {
	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			"content-type": "application/json; charset=utf-8",
			"user-agent": "fuwari-indexnow-script/1.0",
		},
		body: JSON.stringify({
			host,
			key,
			keyLocation,
			urlList,
		}),
	});

	const body = await response.text();
	if (!response.ok) {
		throw new Error(`第 ${index}/${total} 批提交失败: ${response.status} ${response.statusText}\n${body}`);
	}

	console.log(`第 ${index}/${total} 批提交成功，URL 数量: ${urlList.length}`);
	if (body.trim()) {
		console.log(body.trim());
	}
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const siteUrl = await getSiteUrl();
	const sitemapUrl = args.sitemap || `${siteUrl}/sitemap-index.xml`;
	const key = args.key || (await detectKeyFromPublic());
	const host = new URL(siteUrl).host;

	console.log(`站点: ${siteUrl}`);
	console.log(`站点地图: ${sitemapUrl}`);
	console.log(`IndexNow endpoint: ${args.endpoint}`);

	const keyLocation = await verifyKeyLocation(siteUrl, key);
	console.log(`Key 校验通过: ${keyLocation}`);

	const urls = [...new Set(await collectUrlsFromSitemap(sitemapUrl, host))];

	if (urls.length === 0) {
		throw new Error("站点地图里没有解析到可提交的 URL");
	}

	console.log(`共解析到 ${urls.length} 个 URL`);

	if (args.dryRun) {
		console.log("Dry run 模式，不会发起 IndexNow 提交。前 10 个 URL：");
		for (const url of urls.slice(0, 10)) {
			console.log(url);
		}
		return;
	}

	const batches = chunk(urls, args.batchSize);
	for (const [batchIndex, batch] of batches.entries()) {
		await submitBatch({
			endpoint: args.endpoint,
			host,
			key,
			keyLocation,
			urlList: batch,
			index: batchIndex + 1,
			total: batches.length,
		});
	}

	console.log("全部提交完成");
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
