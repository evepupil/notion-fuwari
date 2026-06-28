---
title: 'Cloudflare Worker Reverse Proxy: Why Some Sites Work and Others Return 403 Immediately'
published: 2026-04-05
description: 'When using Cloudflare Worker as a reverse proxy, one site may work perfectly while another returns 403 on the first request. In most cases the issue is not Worker itself, but the target site’s WAF, Host/SNI expectations, Access policy, hotlink protection, or origin restrictions.'
image: ''
tags: ["Cloudflare", "serverless", "Troubleshooting"]
draft: false
lang: 'en'
translationKey: 'cloudflare-worker-反代网站为什么有的网站能用有的网站一上来就是403'
category: 'Technology'
---

### Introduction

After writing my Cloudflare Worker reverse proxy tutorial, one question kept coming up:

**Why does the exact same Worker proxy code work for some websites, while other sites return 403 immediately?**

At first it feels random.

- Same Worker code
- Same `fetch()` forwarding logic
- Some sites work fine
- Some sites fail on the homepage

If you have not set up the basic proxy version yet, read this first: [Cloudflare Worker Reverse Proxy Tutorial](/posts/en/cloudflare-worker-reverse-proxy-website-tutorial/).

I went back to Cloudflare’s official documentation and the answer is actually pretty clear:

> **Cloudflare Worker is not a universal transparent proxy.**
>
> Whether a target site can be proxied depends on whether that site accepts this kind of request shape.

Many 403 responses are not caused by bad Worker code. The target site simply does not accept the way the request arrives.

---

### The short answer

**When some sites work through a Worker proxy and others return 403 immediately, the real reason is usually not Worker capability, but differences in the target site’s security policy.**

The most common causes are:

1. The target site has WAF, bot protection, or challenge rules enabled.
2. The target site requires strict `Host / SNI` matching, and your request does not match.
3. The 403 is returned by the origin itself, not by Cloudflare.
4. The target site is behind Cloudflare Access and your request is not authenticated.
5. You are proxying images or static assets and hit hotlink protection.

So this problem is usually not “Cloudflare is being weird again”.

A more accurate way to think about it is this:

**A request sent by Worker is not always treated like a normal direct browser request by the destination site.**

---

### 1. First identify who returned the 403

This is the most important first step. Many people see a 403 and immediately assume Worker is broken.

Cloudflare’s official 403 documentation makes a useful distinction:

- A **plain 403 without Cloudflare branding** usually means the **origin server** returned it.
- A **Cloudflare-branded 403 page** usually points to Cloudflare-side checks such as **WAF, Security Level, Browser Integrity Check, DDoS protection, or certain 1xxx errors**.
- Another less obvious case is **`Host` and `SNI` mismatch**, which can also lead to a 403.

So before changing code, answer this first:

**Was the request rejected by Cloudflare, or by the origin?**

If you are proxying your own site, also verify that your origin firewall has not blocked Cloudflare IP ranges. That mistake is more common than people think.

---

### 2. Why Worker requests are easier for target sites to identify

This is the part many people miss.

Cloudflare’s documentation says subrequests made by Workers include the `CF-Worker` header. That means Worker subrequests are **not fully invisible**.

A target site, upstream WAF, another Cloudflare zone, or even a load balancer can identify that this is not a plain browser-direct request.

That is why you may see this pattern:

- Direct browser access to the target site works
- The same request through Worker returns 403

That does not mean Worker is broken. It usually means the site’s security policy identifies this traffic pattern and blocks it.

If the target already has rules around:

- WAF
- Bot protection
- Challenge pages
- Browser Integrity Check
- IP / Header / Referer validation

then Worker subrequests are much more likely to trigger them.

---

### 3. The 5 most common reasons

### 1. The target site has WAF, bot protection, or challenge rules

This is the most common category.

Cloudflare’s 403 documentation itself includes cases related to:

- WAF Custom Rules / Managed Rules
- Security Level
- DDoS Protection
- Browser Integrity Check

Browser Integrity Check in particular is meant to identify suspicious request patterns based on request headers. If the target site is strict, a Worker subrequest can be treated more like automated traffic than like a normal browser session.

That is why some sites behave like this:

- Normal browser access works
- A Worker-forwarded request returns 403

A browser can solve challenges, store cookies, and continue the flow. A plain `fetch()` request cannot do all of that for you.

---

### 2. `Host / SNI` mismatch

This is another very common cause.

Many upstream services only accept requests for their own official hostname.

For example, they expect:

- `Host: api.example.com`
- TLS SNI to also be `api.example.com`

If your setup looks like this:

- Users visit your domain
- Worker forwards the request to someone else’s site
- The upstream receives a `Host / SNI` combination it does not expect

then a 403 is a perfectly normal outcome.

Cloudflare’s documentation also notes that:

- overriding the `Host` header affects SNI behavior
- some origin-side scenarios require `Host` and SNI to be consistent
- `Host` and `SNI` mismatch can directly lead to failure

In plain terms:

**many sites are not blocking “proxying” in general, they are blocking requests that arrive under the wrong hostname identity.**

---

### 3. The 403 is from the origin, not from Cloudflare

This is also very common in practice.

Cloudflare’s documentation states that if a 403 page **does not include Cloudflare branding**, the response usually comes from the origin itself.

Typical reasons include:

- origin permissions
- `mod_security`
- IP deny rules
- path or directory restrictions
- origin-side WAF or anti-bot rules

The usual pattern is:

- Worker logs do not show anything unusual
- the request clearly reached the upstream
- the upstream simply refused to serve it

Once you confirm the response is not Cloudflare-branded, stop endlessly rewriting Worker code and inspect origin logs instead.

If your issue looks different, like this:

- direct local requests work
- a Worker request to a raw IP returns 403 almost instantly
- the response comes back in just a few milliseconds

then that is probably another case entirely. I covered that here: [Fix 403 When Cloudflare Worker Proxies a Raw Server IP](/posts/en/cloudflare-worker-fix-403-when-proxying-server-ip/).

---

### 4. The target site is behind Cloudflare Access

If you are proxying an admin panel, private API, or internal service, this is a very realistic cause.

Cloudflare Access documentation explicitly notes that CORS preflight `OPTIONS` requests can return 403 when the protected application expects authentication.

The reason is not a bug. It is how the browser model works:

- preflight `OPTIONS` requests do not send cookies the same way as authenticated page requests
- Access cannot see valid auth information
- Cloudflare rejects the request

That leads to a confusing pattern:

- the main request logic seems fine
- the frontend breaks as soon as it sends a cross-origin request
- the first failing request in DevTools is a 403

At that point the issue is not “Worker cannot reverse proxy this target”.

It is:

**you are proxying a protected target without handling Access and CORS correctly.**

---

### 5. You are proxying images or static assets and hit hotlink protection

This also happens more often than people realize.

Cloudflare’s Hotlink Protection docs are straightforward: if the request’s `Referer` is not the expected site and is not empty, access to images may be denied.

That creates a pattern like:

- opening the image URL directly works
- fetching the same image through Worker returns 403
- it looks like a proxy failure in the browser console

But the real issue is not proxying. It is the target site’s anti-hotlink policy.

This is especially common for:

- image hosts
- asset mirrors
- CDN image domains
- static resource services with external-link protection

---

### 4. A practical debugging order

When Worker proxying returns 403, this is the order I recommend:

### Step 1: Check who returned the 403

- If it is a Cloudflare-style page, inspect Cloudflare-side rules first
- If it is not Cloudflare-branded, inspect origin logs and origin permissions first

### Step 2: Verify whether the upstream requires strict hostname identity

Check:

- whether the service only accepts its own hostname
- whether `Host` is correct
- whether TLS SNI matches

### Step 3: Check whether the target has a security layer blocking you

Focus on:

- WAF
- bot protection
- Browser Integrity Check
- rate limits
- Access
- hotlink protection

### Step 4: Do not rely on Security Analytics alone

Cloudflare documentation notes that Worker subrequests are not shown in Security Analytics by default.

So if you only stare at that panel, you may conclude:

“Strange, the request never even reached the target.”

That conclusion is often wrong.

Look at:

- Worker logs
- origin logs
- security events on the destination side

---

### 5. A temporary debug Worker

This is not the final production pattern. It is only for debugging whether the upstream is the one returning 403.

```js
export default {
  async fetch(request) {
    const upstreamUrl = new URL(request.url);
    upstreamUrl.hostname = "origin.example.com";
    upstreamUrl.protocol = "https:";

    const upstreamRequest = new Request(upstreamUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: "manual",
    });

    const upstreamResponse = await fetch(upstreamRequest);

    const headers = new Headers(upstreamResponse.headers);
    headers.set("x-debug-upstream-status", String(upstreamResponse.status));
    headers.set(
      "x-debug-upstream-server",
      upstreamResponse.headers.get("server") ?? "unknown"
    );

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers,
    });
  },
};
```

The point of this snippet is not to bypass restrictions. It is to confirm:

- who actually returned the 403
- whether the request really reached the target
- whether the upstream headers reveal anything useful

If direct browser access works, but the Worker-forwarded request returns 403 and still includes obvious upstream server traits, then the conclusion is usually clear:

**the problem is not Worker itself, the target site simply does not accept this request pattern.**

---

### 6. When to keep debugging, and when to stop

### Worth debugging further

- You are proxying your own site
- You control the target WAF / Access / origin permissions
- You can inspect origin logs
- You can change hostname, auth, and upstream configuration

In these cases, most 403 issues are fixable.

### Probably not worth forcing

- You are proxying a third-party site
- The site clearly has challenge pages or bot protection
- The site validates `Host / SNI / Referer / Access` strictly
- You have no visibility into the target’s configuration or logs

In that case, the 403 is usually not a bug. It is simply the site’s access policy doing its job.

Put bluntly:

**Cloudflare Worker is an edge script runtime, not a universal access pass.**

---

### Summary

So why can some sites be proxied by Worker while others return 403 immediately?

Because different sites define “valid access” in completely different ways.

Some sites are permissive enough that a Worker proxy works without friction. Others strictly inspect:

- whether the request looks like a normal browser session
- whether `Host / SNI` is correct
- whether authentication is present
- whether `Referer` is acceptable
- whether WAF / bot / Access rules were triggered

If any of those checks fail, they return 403.

So next time you run into this, do not start with:

**“Can Cloudflare Worker proxy this site?”**

Start with:

**“Does this site accept this kind of request at all?”**

---

### References

- [Cloudflare Docs: Error 403](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/4xx-client-error/error-403/)
- [Cloudflare Docs: Cloudflare HTTP headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/)
- [Cloudflare Docs: Browser Integrity Check](https://developers.cloudflare.com/waf/tools/browser-integrity-check/)
- [Cloudflare Docs: Security Analytics](https://developers.cloudflare.com/waf/analytics/security-analytics/)
- [Cloudflare Docs: Origin Rules settings](https://developers.cloudflare.com/rules/origin-rules/features/)
- [Cloudflare Docs: Access CORS](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/cors/)
- [Cloudflare Docs: Hotlink Protection](https://developers.cloudflare.com/waf/tools/scrape-shield/hotlink-protection/)
