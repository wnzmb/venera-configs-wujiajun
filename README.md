# venera-configs-wujiajun

给 [Venera](https://github.com/venera-app/venera) 用的漫画源，**全部指向自建的 Cloudflare Worker 反代**，
墙内直连可用。

## 用法

Venera → 设置 → 漫画源 → 添加源仓库，填：

```
https://cdn.jsdelivr.net/gh/wnzmb/venera-configs-wujiajun@v1.1.3/index.json
```

> `raw.githubusercontent.com` 在国内被 DNS 污染，**不要用 raw 地址**。
> 如果 jsDelivr 也不通，用 `https://gh-proxy.com/https://raw.githubusercontent.com/wnzmb/venera-configs-wujiajun/main/index.json`

## 包含的源

| 源 | 反代域名 | 说明 |
|---|---|---|
| nhentai | `nhentai.wujiajun.ccwu.cc` | 走 `/api/v2/*` 接口；图片走 `/i/…`、缩略图 `/t/…` |
| E-Hentai | `ehentai.wujiajun.ccwu.cc` | API 走 `/api-host/api.php`；图片 `/hath/…`、静态 `/ehgt/…` |
| Hitomi | `hitomi.wujiajun.ccwu.cc` | CDN 走 `/cdn-proxy/<host>/…` |

### 填密码（一次性）

仓库是公开的，所以**密码不写在文件里**。三个源各自在：

Venera → 漫画源 → 点进对应源 → 设置 → **Worker 访问密码** 填一次。

| 源 | 密码 |
|---|---|
| nhentai | `nhentai363924@+0` |
| E-Hentai | `ehentai363924@+0` |
| Hitomi | `hitomi363924@+0` |

填完会 `POST /__auth` 拿 gate cookie，之后自动带上（图片请求也带）。

## 这些文件和上游的差别

只改了「地址」和「登录」，逻辑一行没动：

1. `baseUrl` / `apiBaseUrl` / `imageServer` / `thumbServer` / CDN 前缀 → 自建 Worker
2. 新增 `gatePassword` + `ensureGate()`：首次请求前先 `POST /__auth` 拿 gate cookie
3. 图片 / 缩略图请求额外带上 `Cookie`（Worker 的图片路径也走密码门，不带就是 401）
4. `url`（自更新地址）指向本仓库

上游来源：

- nhentai.js / ehentai.js / hitomi.js 来自 [venera-app/venera-configs](https://github.com/venera-app/venera-configs)
- 规范见 [doc/comic_source.md](https://github.com/venera-app/venera/blob/main/doc/comic_source.md)

## 已验证

2026-11-01 用密码门 cookie 实测：

- `nhentai`: `/api/v2/search?query=…` 200 JSON；`/i/galleries/…`、`/t/galleries/…` 200 图片
- `ehentai`: `POST /api-host/api.php`（`gdata`）200，返回的 `thumb` 已改写成
  `https://ehentai.wujiajun.ccwu.cc/ehgt/…`
- `hitomi`: `/cdn-proxy/ltn.gold-usergeneratedcontent.net/galleries/<id>.js` 200

## 后续

cf-proxy 里还有 `hentaifox` / `hentai2read` / `imhentai` / `simplyhentai` / `3hentai` / `hentairead`
的 Worker。要加就照 [comic_source.md](https://github.com/venera-app/venera/blob/main/doc/comic_source.md)
的规范写新文件，再在 `index.json` 里登记一条。
