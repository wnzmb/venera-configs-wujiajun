/** @type {import('./_venera_.js')} */
class HentaiRead extends ComicSource {
  name = "HentaiRead"

  key = "hentairead"

  version = "1.1.0"

  minAppVersion = "1.4.0"

  url = "https://cdn.jsdelivr.net/gh/wnzmb/venera-configs-wujiajun@v1.3.1/hentairead.js"

  baseUrl = "https://hentairead.wujiajun.ccwu.cc"

  gateCookie = ""

  async syncCookie() {
    try {
      const cookies = await Network.getCookies(this.baseUrl)
      for (const c of cookies || []) {
        if (c && c.name && c.name.endsWith("_gate") && c.value) {
          this.gateCookie = c.name + "=" + c.value
          return
        }
      }
    } catch (e) {}
  }

  imgHeaders() {
    return this.gateCookie ? { "Cookie": this.gateCookie } : {}
  }

  // Worker 密码门：网页登录（POST body 在 Venera 里传不进去）
  account = {
    loginWithWebview: {
      url: "https://hentairead.wujiajun.ccwu.cc/__auth",
      checkStatus: (url, title) => !url.includes("__auth"),
      onLoginSuccess: async () => {
        await this.syncCookie()
      },
    },
  }

  // 这个站的列表是前端渲染的：HTML 里只有 /hentai/<slug>/ 链接，
  // 没有标题也没有封面。所以标题从 slug 还原，封面留空（Venera 会显示占位）。
  // 详情页是完整服务端渲染的，标题/封面/页图都能正常拿。
  parseComics(doc) {
    const result = []
    const seen = {}
    for (const a of doc.querySelectorAll("a[href*='/hentai/']")) {
      const href = a.attributes["href"] || ""
      const m = href.match(/\/hentai\/([^/?#]+)\/?$/)
      if (!m) continue
      const cls = a.attributes["class"] || ""
      if (cls.includes("menu-item")) continue
      if (seen[href]) continue
      seen[href] = true
      const img = a.querySelector("img")
      const cover = img ? (img.attributes["data-src"] || img.attributes["src"] || "") : ""
      const title = m[1]
        .split("-")
        .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
        .join(" ")
      result.push(new Comic({
        id: href,
        title: title,
        cover: cover,
        tags: [],
      }))
    }
    return result
  }

  explore = [
    {
      title: this.name,
      type: "multiPartPage",
      load: async () => {
        await this.syncCookie()
        const res = await Network.get(this.baseUrl + "/", {})
        if (res.status !== 200) throw `Invalid status code: ${res.status}`
        const doc = new HtmlDocument(res.body)
        return [{ title: "最新更新", comics: this.parseComics(doc), viewMore: null }]
      },
    },
  ]

  search = {
    load: async (keyword, options, page) => {
      await this.syncCookie()
      const url = `${this.baseUrl}/?s=${encodeURIComponent(keyword)}&paged=${page}`
      const res = await Network.get(url, {})
      if (res.status !== 200) throw `Invalid status code: ${res.status}`
      const doc = new HtmlDocument(res.body)
      return {
        comics: this.parseComics(doc),
        maxPage: null,
      }
    },
    enableTagsSuggestions: false,
  }

  comic = {
    onThumbnailLoad: (url) => {
      return { url: url, headers: this.imgHeaders() }
    },
    onImageLoad: (url, comicId, epId) => {
      return { url: url, headers: this.imgHeaders() }
    },

    loadInfo: async (id) => {
      await this.syncCookie()
      let url = id
      if (!url.startsWith("http")) url = this.baseUrl + url
      const res = await Network.get(url, {})
      if (res.status !== 200) throw `Invalid status code: ${res.status}`
      const doc = new HtmlDocument(res.body)

      const h1 = doc.querySelector("h1")
      const title = h1 ? h1.text.trim() : ""

      let cover = ""
      for (const img of doc.querySelectorAll("img")) {
        const src = img.attributes["src"] || img.attributes["data-src"] || ""
        if (src.includes("/cv/cover/")) {
          cover = src
          break
        }
      }

      const tags = {}
      const tagList = []
      for (const a of doc.querySelectorAll("a[href*='/genre/']")) {
        const t = a.text.trim()
        if (t) tagList.push(t)
      }
      if (tagList.length) tags["类型"] = tagList

      return new ComicDetails({
        title: title,
        cover: cover,
        tags: tags,
        chapters: { "全一话": "chapter" },
        recommend: [],
      })
    },

    loadEp: async (comicId, epId) => {
      await this.syncCookie()
      let url = comicId
      if (!url.startsWith("http")) url = this.baseUrl + url
      const res = await Network.get(url, {})
      if (res.status !== 200) throw `Invalid status code: ${res.status}`
      const doc = new HtmlDocument(res.body)

      // 详情页里每个页面都有一张预览图：<img alt="Page N" src=".../cv/preview/.../hr_000N.jpg">
      const images = []
      for (const img of doc.querySelectorAll("img")) {
        const alt = img.attributes["alt"] || ""
        if (!/^Page\s+\d+/i.test(alt)) continue
        const src = img.attributes["src"] || img.attributes["data-src"] || ""
        if (src.includes("/cv/preview/")) images.push(src)
      }
      if (!images.length) throw "no images found"
      return { images }
    },

    enableTagsTranslate: false,
  }
}
