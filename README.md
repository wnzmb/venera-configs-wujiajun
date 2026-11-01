# venera-configs-wujiajun

给 [Venera](https://github.com/venera-app/venera) 用的漫画源。前 5 个指向**自建 Cloudflare Worker 反代**，
后 3 个是**直连站**（不需要 Worker，图片走公共 CDN，墙内可达）。

> 2026-11-01 复测：**3hentai / imhentai 各有一个可直连的替代域名**，不需要 Worker（见文末「直连替代域」）；
> hentai2read / simply-hentai 仍不可用。

## 用法

Venera → 设置 → 漫画源 → 添加源仓库，填：

```
https://cdn.jsdelivr.net/gh/wnzmb/venera-configs-wujiajun@v1.7.1/index.json
```

> jsDelivr 对 `@main` 有缓存（最长 12 小时），所以用**版本 tag**。更新时会打新 tag。
> `raw.githubusercontent.com` 在国内被 DNS 污染，不要用。
> 如果 jsDelivr 也不通：`https://gh-proxy.com/https://raw.githubusercontent.com/wnzmb/venera-configs-wujiajun/main/index.json`

## 源列表

| 源 | 版本 | 类型 | 说明 |
|---|---|---|---|
| nhentai | 1.1.2 | 反代 | `/api/v2/*`；图片 `/i/…`、缩略图 `/t/…` |
| E-Hentai | 1.2.2 | 反代 | API `/api-host/api.php`；图片 `/hath/…`、静态 `/ehgt/…` |
| Hitomi | 1.1.4 | 反代 | CDN 走 `/cdn-proxy/<host>/…` |
| Hentaifox | 1.0.0 | 反代 | 详情页含全部页图，页号可推导 |
| HentaiRead | 1.2.0 | 反代 | 搜索走站点 `quick_search` AJAX（**GET**）；详情页含全部页图 |
| 漫蛙 | 1.0.4 | 直连 | manwarp 系列；图床 `mmwwccffiimmgg4.cc`；真实封面在 `data-original` |
| 3Hentai | 1.0.1 | 直连 | `3hentai.to`；详情页含全部页缩略图，去掉文件名里的 `t` 即全尺寸 |
| IMHentai | 1.0.0 | 直连 | `imhentai.to`；同上，图片在 `supercdn.site/galleries/<mid>/` |

## 登录（前 5 个反代源，一次性）

Venera 的 `Network.post` 传不了二进制 body，源里的自动登录会 401。正确姿势是**网页登录**：

源详情 → **登录** → 弹出的就是 Worker 密码页 → 输密码提交。

| 源 | 密码 |
|---|---|
| nhentai | `nhentai363924@+0` |
| E-Hentai | `ehentai363924@+0` |
| Hitomi | `hitomi363924@+0` |
| Hentaifox | `hentaifox363924@+0` |
| HentaiRead | `hentairead363924@+0` |

（密码没写进仓库，公开仓库不暴露。要改就看各文件的 `gatePassword` 设置项默认值。）

## 实现要点 / 踩过的坑

1. **UA**：`cf_clearance` 绑定 UA，抓取必须用 WebView 的真实 UA，否则 CF 403。
2. **密码门**：`/__auth` 只能 POST，而 Venera 的 POST body 传不进去 → 只能网页登录。
3. **图片也要 Cookie**：Worker 的 `/vd/`、`/cdn-proxy/` 也走密码门，图片请求不带 Cookie 就是 401。
4. **POST body 不会被 Worker 丢**（2026-11-01 已修）：实测 Worker 会把 body 原样转发；之前的 400 是
   hentairead 的 Worker 漏转发 `Content-Type`（WordPress 靠它填 `$_POST`）＋密码门 `formData()` 不认没有
   `Content-Type` 的 body。cf-proxy 已修（`9752a07`）。Venera 自己的 `Network.post` 传不了二进制 body 是
   另一回事，纯 urlencoded 表单现在可以走 POST。
5. **漫蛙的坑**：封面真实地址在 `data-original`（列表）/ `data-r-src`（阅读页），`src` 全是内置占位图；
   相对路径要按**图床域名**解析，站点域 `/static/...` 是 404。
6. **3hentai / imhentai 的通用套路**：详情页把**全部页**的缩略图都渲染在 HTML 里（3hentai 最多试到 251 页也没截断），
   文件名形如 `<page>t.webp`，把 `t` 去掉就是全尺寸图；图片域名要**从缩略图 URL 里取**，不能写死
   （3hentai 有 `3-hentai.xyz` 和 `cdn.3-hentai.xyz` 两种，imhentai 是 `supercdn.site`）。
   两站图片都不校验 Referer。imhentai 的搜索**每页都要带 `q`**，否则第 2 页起会退化成首页列表。
7. **`key` 不能以数字开头**：Venera 解析完源后会执行 `ComicSource.sources.$key = this['temp']`，
   key 写成 `3hentai` 就变成 `ComicSource.sources.3hentai`，QuickJS 直接报
   `SyntaxError: invalid number literal at <eval>:1:1`（添加源时就会失败）。所以 3Hentai 源的 key 是 **`threehentai`**。

## 不可用的站

| 站点 | 原因 |
|---|---|
| hentai2read | 直连 TLS 正常但返回 403 `Cf-Mitigated: challenge`；Worker 出口是机房 IP 过不了。替代域 `hentai2read.to` 是停放的广告跳转（`click-v4.plarclck.com`）。唯一可能：手机 WebView 过一次挑战拿 `cf_clearance`，再用同 IP + 同 UA 的 HTTP 请求复用 |
| simply-hentai | 主域 301 → `www.simply-hentai.com`（源站 IP `198.27.x` 直连超时），Worker 端是 CF 挑战；未找到可用替代域 |

## 直连替代域（2026-11-01 实测，不需要 Worker）

验证方式：`curl --noproxy '*'` + DoH 取真实 IP + `--resolve`。同一时刻的对照：`https://www.google.com/` 直连 **000 超时**、
走 `http://127.0.0.1:20808` 代理 **302 成功**，且本机无 TUN 适配器 —— 确认测试流量没有经过代理。

| 站点 | 替代域名 | 实测 | 图片 |
|---|---|---|---|
| 3hentai | `https://3hentai.to` | 首页 200（28KB）；`/d/599242/` **200（87KB）**；`/search?q=test` 200（58KB） | `3-hentai.xyz`：TLS 正常，`/3553190/cover.webp` **200（39KB）**，不带 Referer 也行 |
| imhentai | `https://imhentai.to` | 首页 200（37KB）；`/g/694344/` **200（53KB）**；`/search?q=test` 200（75KB） | `supercdn.site`：`/galleries/4288638/1t.webp` **200（18KB）** |

说明：

- 两个替代域都**直连可达**，图片域也直连；不需要 Worker、不需要密码门。
- `3hentai.to` 的 ID 空间和 `3hentai.net` 不同，但路径形状一样（`/d/<id>/`）；`imhentai.to` 详情页是 `/g/<id>/`。
- `3hentai.net` 本身的间歇性 502 已确认不是 Worker 代码问题：连打 10 次 **5 次 200 / 5 次 502**（CF geo-DNS 对 CF 出口返回 `127.x`，1016 Origin DNS error）。
