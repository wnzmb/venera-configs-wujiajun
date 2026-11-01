# venera-configs-wujiajun

给 [Venera](https://github.com/venera-app/venera) 用的漫画源。前 5 个指向**自建 Cloudflare Worker 反代**，
最后一个是直连站（图片走公共 CDN，墙内可达）。

## 用法

Venera → 设置 → 漫画源 → 添加源仓库，填：

```
https://cdn.jsdelivr.net/gh/wnzmb/venera-configs-wujiajun@v1.6.4/index.json
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
4. **POST body 会被 Worker 丢掉**：任何 POST 接口都会失败，尽量找 GET 变体（hentairead 的搜索就是这么救回来的）。
5. **漫蛙的坑**：封面真实地址在 `data-original`（列表）/ `data-r-src`（阅读页），`src` 全是内置占位图；
   相对路径要按**图床域名**解析，站点域 `/static/...` 是 404。

## 不可用的站

| 站点 | 原因 |
|---|---|
| imhentai / hentai2read / simplyhentai | 上游 Cloudflare 挑战（`Just a moment...`），Worker 出口是机房 IP，纯 HTTP 过不了 |
| 3hentai | 首页可达，详情页 Worker 回 502「上游没响应」，等恢复再补 |
