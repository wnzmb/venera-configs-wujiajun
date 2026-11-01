/** @type {import('./_venera_.js')} */
class Manwa extends ComicSource {
  name = "漫蛙"

  key = "manwa"

  version = "1.0.0"

  minAppVersion = "1.4.0"

  url = "https://cdn.jsdelivr.net/gh/wnzmb/venera-configs-wujiajun@v1.6.0/manwa.js"

  settings = {
    domain: {
      title: "域名（连不上就换一个）",
      type: "select",
      options: [
        { value: "manwarp.cc" },
        { value: "manwarv.cc" },
        { value: "manwart.cc" },
        { value: "manwaro.cc" },
      ],
      default: "manwarp.cc",
    },
  }

  get baseUrl() {
    return "https://" + this.loadSetting("domain")
  }

  // 列表卡片：li > .manga-list-2-cover > a[href=/book/<id>] > img
  //          + .manga-list-2-title > a （标题）
  parseComics(doc) {
    const result = []
    const seen = {}
    for (const a of doc.querySelectorAll("a[href^='/book/']")) {
      const href = a.attributes["href"] || ""
      if (!/^\/book\/\d+$/.test(href)) continue
      const img = a.querySelector("img")
      if (!img || seen[href]) continue
      seen[href] = true
      const titleAttr = a.attributes["title"] || ""
      result.push(new Comic({
        id: href,
        title: titleAttr.trim() || href,
        cover: img.attributes["src"] || img.attributes["data-src"] || "",
        tags: [],
      }))
    }
    return result
  }

  explore = [
    {
      title: this.name,
      type: "multiPageComicList",
      load: async (page) => {
        const url = page <= 1 ? `${this.baseUrl}/booklist` : `${this.baseUrl}/booklist/${page}`
        const res = await Network.get(url, {})
        if (res.status !== 200) throw `Invalid status code: ${res.status}`
        const doc = new HtmlDocument(res.body)
        return { comics: this.parseComics(doc), maxPage: null }
      },
    },
  ]

  search = {
    load: async (keyword, options, page) => {
      const url = `${this.baseUrl}/search?keyword=${encodeURIComponent(keyword)}&page=${page}`
      const res = await Network.get(url, {})
      if (res.status !== 200) throw `Invalid status code: ${res.status}`
      const doc = new HtmlDocument(res.body)
      return { comics: this.parseComics(doc), maxPage: null }
    },
    enableTagsSuggestions: false,
  }

  comic = {
    loadInfo: async (id) => {
      let url = id.startsWith("http") ? id : this.baseUrl + id
      const res = await Network.get(url, {})
      if (res.status !== 200) throw `Invalid status code: ${res.status}`
      const doc = new HtmlDocument(res.body)

      const h1 = doc.querySelector("h1")
      const title = h1 ? h1.text.trim() : ""

      let cover = ""
      for (const img of doc.querySelectorAll("img")) {
        const src = img.attributes["src"] || img.attributes["data-src"] || ""
        if (src.includes("/cover/")) {
          cover = src
          break
        }
      }

      const tags = {}
      const tagList = []
      for (const a of doc.querySelectorAll("a[href*='/booklist/']")) {
        const t = a.text.trim()
        if (t && t.length < 20) tagList.push(t)
      }
      if (tagList.length) tags["分类"] = tagList.slice(0, 8)

      // 章节：/chapter/<id>
      const chapters = {}
      for (const a of doc.querySelectorAll("a[href^='/chapter/']")) {
        const href = a.attributes["href"] || ""
        const m = href.match(/^\/chapter\/(\d+)$/)
        if (!m) continue
        const name = a.text.trim() || m[1]
        if (chapters[name]) continue
        chapters[name] = href
      }

      return new ComicDetails({
        title: title,
        cover: cover,
        tags: tags,
        chapters: chapters,
        recommend: [],
      })
    },

    loadEp: async (comicId, epId) => {
      const url = epId.startsWith("http") ? epId : this.baseUrl + epId
      const res = await Network.get(url, {})
      if (res.status !== 200) throw `Invalid status code: ${res.status}`
      const doc = new HtmlDocument(res.body)

      const images = []
      const push = (u) => {
        if (!u) return
        if (u.startsWith("//")) u = "https:" + u
        if (!u.startsWith("http")) return
        if (u.includes("/static/images/")) return
        if (!images.includes(u)) images.push(u)
      }

      // 正文图片：.content-img / .img-content 里面，lazy 加载用 data-src / data-original
      for (const el of doc.querySelectorAll(".content-img, .content-img img, .img-content img")) {
        if (el.attributes) {
          push(el.attributes["data-original"])
          push(el.attributes["data-src"])
          push(el.attributes["data-url"])
          push(el.attributes["src"])
        }
      }
      if (!images.length) {
        for (const img of doc.querySelectorAll("img")) {
          push(img.attributes["data-src"] || img.attributes["data-original"] || img.attributes["src"])
        }
      }
      if (!images.length) throw "no images found"
      return { images }
    },

    enableTagsTranslate: false,
  }
}
