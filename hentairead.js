/** @type {import('./_venera_.js')} */
class HentaiRead extends ComicSource {
  name = "HentaiRead"

  key = "hentairead"

  version = "1.0.0"

  minAppVersion = "1.4.0"

  url = "https://cdn.jsdelivr.net/gh/wnzmb/venera-configs-wujiajun@v1.3.0/hentairead.js"

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

  parseComics(doc) {
    const result = []
    const seen = {}
    for (const a of doc.querySelectorAll("a[href*='/hentai/']")) {
      const href = a.attributes["href"] || ""
      if (!href.match(/\/hentai\/[^/]+\/?$/)) continue
      if (seen[href]) continue
      const img = a.querySelector("img")
      if (!img) continue
      const cover = img.attributes["data-src"] || img.attributes["src"] || ""
      if (!cover) continue
      seen[href] = true
      const titleEl = a.querySelector("h1,h2,h3,h4,.title")
      const title = titleEl ? titleEl.text.trim() : (img.attributes["alt"] || "").trim()
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
