/** @type {import('./_venera_.js')} */
class Hentaifox extends ComicSource {
  name = "Hentaifox"

  key = "hentaifox"

  version = "1.0.0"

  minAppVersion = "1.4.0"

  url = "https://cdn.jsdelivr.net/gh/wnzmb/venera-configs-wujiajun@v1.2.0/hentaifox.js"

  baseUrl = "https://hentaifox.wujiajun.ccwu.cc"

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

  // Worker 密码门：用网页登录（Venera 的 POST body 传不了二进制，自动登录会 401）
  account = {
    loginWithWebview: {
      url: "https://hentaifox.wujiajun.ccwu.cc/__auth",
      checkStatus: (url, title) => !url.includes("__auth"),
      onLoginSuccess: async () => {
        await this.syncCookie()
      },
    },
  }

  parseComics(doc) {
    const result = []
    for (const item of doc.querySelectorAll(".thumb")) {
      const titleLink = item.querySelector("h2.g_title a")
      const anyLink = item.querySelector("a[href*='/gallery/']")
      const link = titleLink || anyLink
      if (!link) continue
      const img = item.querySelector("img")
      const cover = img ? (img.attributes["data-src"] || img.attributes["src"] || "") : ""
      result.push(new Comic({
        id: link.attributes["href"],
        title: titleLink ? titleLink.text.trim() : (img ? (img.attributes["alt"] || "") : ""),
        cover: cover,
        tags: [],
      }))
    }
    return result
  }

  maxPageOf(doc) {
    try {
      const links = doc.querySelectorAll(".pagination a")
      let max = 1
      for (const a of links) {
        const n = parseInt((a.text || "").trim())
        if (!isNaN(n) && n > max) max = n
      }
      return max
    } catch (e) {
      return 1
    }
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
        return [{ title: "最新发布", comics: this.parseComics(doc), viewMore: null }]
      },
    },
  ]

  search = {
    load: async (keyword, options, page) => {
      await this.syncCookie()
      const url = `${this.baseUrl}/?s=${encodeURIComponent(keyword)}&page=${page}`
      const res = await Network.get(url, {})
      if (res.status !== 200) throw `Invalid status code: ${res.status}`
      const doc = new HtmlDocument(res.body)
      return {
        comics: this.parseComics(doc),
        maxPage: this.maxPageOf(doc),
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

      const title = doc.querySelector("h1") ? doc.querySelector("h1").text.trim() : ""
      const coverEl = doc.querySelector(".cover img")
      const cover = coverEl ? (coverEl.attributes["data-src"] || coverEl.attributes["src"] || "") : ""

      const tags = {}
      const tagList = []
      for (const a of doc.querySelectorAll("a.tag_btn")) {
        tagList.push(a.text.trim())
      }
      if (tagList.length) tags["标签"] = tagList

      const m = url.match(/\/gallery\/(\d+)/)
      const chapters = {}
      if (m) chapters["全一话"] = `/g/${m[1]}/`

      const recommend = []
      for (const item of doc.querySelectorAll(".related_galleries .thumb, .related .thumb")) {
        const link = item.querySelector("a[href*='/gallery/']")
        const img = item.querySelector("img")
        if (!link) continue
        recommend.push(new Comic({
          id: link.attributes["href"],
          title: img ? (img.attributes["alt"] || "") : "",
          cover: img ? (img.attributes["data-src"] || img.attributes["src"] || "") : "",
          tags: [],
        }))
      }

      return new ComicDetails({
        title: title,
        cover: cover,
        tags: tags,
        chapters: chapters,
        recommend: recommend,
      })
    },

    loadEp: async (comicId, epId) => {
      await this.syncCookie()
      const firstUrl = `${this.baseUrl}${epId}1/`
      const res = await Network.get(firstUrl, {})
      if (res.status !== 200) throw `Invalid status code: ${res.status}`
      const doc = new HtmlDocument(res.body)

      let total = 1
      try {
        const el = doc.querySelector(".total_pages")
        if (el) {
          const n = parseInt(el.text.trim())
          if (!isNaN(n) && n > 0) total = n
        }
      } catch (e) {}

      const img = doc.querySelector("#gimg")
      const first = img ? (img.attributes["data-src"] || img.attributes["src"] || "") : ""
      if (!first) throw "no image found"

      const m = first.match(/^(.*\/)(\d+)\.([a-zA-Z0-9]+)$/)
      const images = []
      if (m) {
        for (let i = 1; i <= total; i++) images.push(`${m[1]}${i}.${m[3]}`)
      } else {
        images.push(first)
      }
      return { images }
    },

    enableTagsTranslate: false,
  }
}
