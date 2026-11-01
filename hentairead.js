/** @type {import('./_venera_.js')} */
class HentaiRead extends ComicSource {
  name = "HentaiRead"

  key = "hentairead"

  version = "1.2.0"

  minAppVersion = "1.4.0"

  url = "https://cdn.jsdelivr.net/gh/wnzmb/venera-configs-wujiajun@v1.4.0/hentairead.js"

  baseUrl = "https://hentairead.wujiajun.ccwu.cc"

  // 站点自己的快搜接口（从 header.min.js 里逆出来的）
  // 注意：必须用 GET —— Worker 会把 POST 的 body 吃掉，POST 会得到 400
  ajaxUrl = "https://hentairead.wujiajun.ccwu.cc/wp-admin/admin-ajax.php"

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

  account = {
    loginWithWebview: {
      url: "https://hentairead.wujiajun.ccwu.cc/__auth",
      checkStatus: (url, title) => !url.includes("__auth"),
      onLoginSuccess: async () => {
        await this.syncCookie()
      },
    },
  }

  // 卡片：div.manga-item > a[href*=/hentai/] + img(alt=标题, src=封面)
  parseCards(doc) {
    const result = []
    const seen = {}
    for (const item of doc.querySelectorAll(".manga-item")) {
      const a = item.querySelector("a[href*='/hentai/']")
      const img = item.querySelector("img")
      if (!a || !img) continue
      const href = a.attributes["href"]
      if (!href || seen[href]) continue
      seen[href] = true
      result.push(new Comic({
        id: href,
        title: (img.attributes["alt"] || "").trim(),
        cover: img.attributes["src"] || "",
        tags: [],
      }))
    }
    return result
  }

  // 老版本兜底：列表页若没有卡片容器，就从链接 slug 还原标题
  parseFallback(doc) {
    const result = []
    const seen = {}
    for (const a of doc.querySelectorAll("a[href*='/hentai/']")) {
      const href = a.attributes["href"] || ""
      const m = href.match(/\/hentai\/([^/?#]+)\/?$/)
      if (!m || seen[href]) continue
      const cls = a.attributes["class"] || ""
      if (cls.includes("menu-item")) continue
      seen[href] = true
      const img = a.querySelector("img")
      result.push(new Comic({
        id: href,
        title: m[1].split("-").map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w)).join(" "),
        cover: img ? (img.attributes["src"] || "") : "",
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
        let comics = this.parseCards(doc)
        if (!comics.length) comics = this.parseFallback(doc)
        return [{ title: "最新更新", comics: comics, viewMore: null }]
      },
    },
  ]

  search = {
    load: async (keyword, options, page) => {
      await this.syncCookie()
      const url = `${this.ajaxUrl}?action=quick_search&keyword=${encodeURIComponent(keyword)}`
      const res = await Network.get(url, { "X-Requested-With": "XMLHttpRequest" })
      if (res.status !== 200) throw `Invalid status code: ${res.status}`
      const json = JSON.parse(res.body)
      const html = (json && json.data && json.data.searchMangaResults) || ""
      const doc = new HtmlDocument(html)
      return {
        comics: this.parseCards(doc),
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
        const src = img.attributes["src"] || ""
        if (src.includes("/cv/cover/") && !src.includes("Favicon")) {
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
        const src = img.attributes["src"] || ""
        if (src.includes("/cv/preview/")) images.push(src)
      }
      if (!images.length) throw "no images found"
      return { images }
    },

    enableTagsTranslate: false,
  }
}
