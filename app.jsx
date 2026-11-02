/* =========================================================
   app.jsx — تطبيق React (يشتغل عن طريق Babel من الـ CDN)
   ========================================================= */
const { useState, useMemo, useEffect, useRef, useContext, createContext } = React;
const { store, categories, keep, norm } = window.CATALOG;

const fmt = (n) => Number(n).toLocaleString("en-US");
const SUGGESTIONS = ["بيرفيوم", "سيروم", "صن بلوك", "شامبو", "العكر الفاسي", "هيالورونيك", "كولاجين", "رول اون"];
const SORTS = [
  { id: "default", label: "ترتيب القائمة" },
  { id: "asc", label: "الأقل سعراً" },
  { id: "desc", label: "الأعلى سعراً" },
];

/* ---------- بناء قاعدة البيانات مرة واحدة (مع مفاتيح وبحث جاهز) ---------- */
const DB = categories.map((cat) => ({
  ...cat,
  sections: cat.sections.map((sec, si) => ({
    ...sec,
    key: `${cat.id}-${si}`,
    products: sec.products.map((p, pi) => ({
      ...p,
      key: `${cat.id}-${si}-${pi}`,
      variants: p.variants.map((v, vi) => ({ ...v, id: `${cat.id}-${si}-${pi}-${vi}` })),
      hay: norm(
        [cat.name, sec.title, sec.sub, p.name, p.sub, ...p.variants.map((v) => `${v.size} ${v.tag} ${v.price}`)].join(" ")
      ),
    })),
  })),
}));
const countVariants = (list) => list.reduce((s, p) => s + p.variants.length, 0);
const catTotal = (cat) => cat.sections.reduce((s, sec) => s + countVariants(sec.products), 0);
const GRAND_TOTAL = DB.reduce((s, c) => s + catTotal(c), 0);

const Ctx = createContext(null);

/* ---------- أدوات صغيرة ---------- */
function useLocal(key, init) {
  const [v, setV] = useState(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : init;
    } catch (e) {
      return init;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch (e) {}
  }, [key, v]);
  return [v, setV];
}

function Hl({ text, tokens }) {
  if (!text) return null;
  if (!tokens.length) return text;
  const n = keep(text);
  if (n.length !== text.length) return text;
  const mark = new Array(text.length).fill(false);
  tokens.forEach((t) => {
    if (!t) return;
    let i = n.indexOf(t);
    while (i !== -1) {
      for (let k = i; k < i + t.length; k++) mark[k] = true;
      i = n.indexOf(t, i + t.length);
    }
  });
  const out = [];
  let buf = "";
  let cur = false;
  for (let i = 0; i < text.length; i++) {
    if (mark[i] !== cur && buf) {
      out.push(cur ? <mark key={i}>{buf}</mark> : buf);
      buf = "";
    }
    cur = mark[i];
    buf += text[i];
  }
  if (buf) out.push(cur ? <mark key="end">{buf}</mark> : buf);
  return <>{out}</>;
}

const nLabel = (p) => {
  const ns = p.variants.map((v) => v.n).filter((n) => n !== null && n !== undefined);
  if (!ns.length) return null;
  if (ns.length === 1) return `م ${ns[0]}`;
  const nums = ns.filter((n) => typeof n === "number");
  if (nums.length === ns.length) {
    const lo = Math.min(...nums), hi = Math.max(...nums);
    return lo === hi ? `م ${lo}` : `م ${lo}–${hi}`;
  }
  return `م ${ns[0]}`;
};

const themeStyle = (t) => ({ "--a": t.a, "--b": t.b, "--soft": t.soft });

function Logo({ size = 56, gid = "lg" }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6e3a1" />
          <stop offset="1" stopColor="#b98a2e" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="#fff" stroke={`url(#${gid})`} strokeWidth="3" />
      <path d="M32 11c14 9 16 27 0 41C16 38 18 20 32 11z" fill={`url(#${gid})`} />
      <path d="M32 20v28M32 30l7-6M32 37l-7-6" stroke="#4a1d5c" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/* ---------- زر الإضافة / العداد ---------- */
function Stepper({ variant, product }) {
  const { qtyOf, add, dec } = useContext(Ctx);
  const q = qtyOf(variant.id);
  if (!q)
    return (
      <button className="add" onClick={() => add(variant, product)} aria-label={`أضف ${product.name} إلى القائمة`}>
        +
      </button>
    );
  return (
    <div className="step">
      <button onClick={() => dec(variant.id)} aria-label="تقليل الكمية">−</button>
      <b>{q}</b>
      <button onClick={() => add(variant, product)} aria-label="زيادة الكمية">+</button>
    </div>
  );
}

/* ---------- كارت منتج ---------- */
function ProductCard({ p, i, catName }) {
  const { tokens } = useContext(Ctx);
  const num = nLabel(p);
  return (
    <article className="pcard" style={{ "--i": i % 12 }}>
      {catName && <span className="catbadge">{catName}</span>}
      <h4>
        {num && <span className="num">{num}</span>}
        <Hl text={p.name} tokens={tokens} />
      </h4>
      {p.sub && (
        <p className="sub">
          <Hl text={p.sub} tokens={tokens} />
        </p>
      )}
      <ul className="variants">
        {p.variants.map((v) => (
          <li key={v.id}>
            <span className={"size" + (v.size ? "" : " none")}>
              {v.size ? <Hl text={v.size} tokens={tokens} /> : "—"}
              {v.tag && <span className="tag">{v.tag}</span>}
            </span>
            <span className="leader" />
            <span className="price">
              {fmt(v.price)}
              <small>{store.currency}</small>
            </span>
            <Stepper variant={v} product={p} />
          </li>
        ))}
      </ul>
    </article>
  );
}

/* ---------- جدول (شبه القوائم المطبوعة) ---------- */
function SecTable({ sec }) {
  const { tokens } = useContext(Ctx);
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>م</th>
            <th>اسم المنتج</th>
            <th>الحجم</th>
            <th>السعر</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sec.products.flatMap((p) =>
            p.variants.map((v) => (
              <tr key={v.id}>
                <td className="m">{v.n ?? "·"}</td>
                <td className="nm">
                  <b><Hl text={p.name} tokens={tokens} /></b>
                  {p.sub && <small><Hl text={p.sub} tokens={tokens} /></small>}
                </td>
                <td>
                  {v.size || "—"}
                  {v.tag && <span className="tag">{v.tag}</span>}
                </td>
                <td className="pr">{fmt(v.price)} {store.currency}</td>
                <td className="ac"><Stepper variant={v} product={p} /></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- مجموعة بخصم ---------- */
function Bundle({ sec }) {
  const { addMany } = useContext(Ctx);
  const items = sec.products.map((p) => ({ p, v: p.variants[0] }));
  const total = items.reduce((s, x) => s + x.v.price, 0);
  const after = Math.round(total * (1 - (sec.discount || 0) / 100));
  return (
    <div className="bundle">
      <div className="bundle-ribbon">
        <span className="gift">🎁 احصل على خصم عند طلب المجموعة كاملة</span>
        <span className="off">خصم {sec.discount}%</span>
      </div>
      <ul>
        {items.map(({ p, v }) => (
          <li key={v.id}>
            <div className="bn">
              <b>{p.name}</b>
              {p.sub && <small>{p.sub}</small>}
            </div>
            <span className="bs">{v.size}</span>
            <span className="price">{fmt(v.price)}<small>{store.currency}</small></span>
            <Stepper variant={v} product={p} />
          </li>
        ))}
      </ul>
      <div className="bundle-foot">
        <div className="tot">
          <s>{fmt(total)} {store.currency}</s>
          <b>≈ {fmt(after)} {store.currency}</b>
          <small>الإجمالي بعد خصم {sec.discount}% (تقريبي)</small>
        </div>
        <button className="btn" onClick={() => addMany(items)}>＋ أضف المجموعة كاملة</button>
      </div>
      {sec.offers && (
        <div className="offers">
          {sec.offers.map((o, i) => (
            <div className="offer" key={i}>
              <span>🔥</span>
              <p><b>عرض المجموعة:</b> {o.text}</p>
              <div className="o-price">
                <b>{fmt(o.price)} {store.currency}</b>
                <s>بدلاً من {fmt(o.was)} {store.currency}</s>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- قسم ---------- */
function SectionBlock({ sec, searching }) {
  const { mode } = useContext(Ctx);
  const isBundle = sec.type === "bundle" && !searching;
  return (
    <section className="sec" id={`sec-${sec.key}`}>
      <div className="sec-head">
        <h3>{sec.title}</h3>
        {sec.sub && <span className="sub">{sec.sub}</span>}
        <em className="count">{countVariants(sec.products)} صنف</em>
      </div>
      {isBundle ? (
        <Bundle sec={sec} />
      ) : mode === "table" ? (
        <SecTable sec={sec} />
      ) : (
        <div className="grid">
          {sec.products.map((p, i) => (
            <ProductCard key={p.key} p={p} i={i} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------- سلة / قائمتي ---------- */
function Drawer({ basket, setQty, remove, clear, onClose, notify, customer, setCustomer }) {
  const [err, setErr] = useState(false);
  const nameRef = useRef(null);
  const nameOk = customer.trim().length > 1;
  const needName = () => {
    setErr(true);
    notify("اكتب اسمك الأول عشان نبعت الطلب");
    nameRef.current && nameRef.current.focus();
  };
  const total = basket.reduce((s, i) => s + i.price * i.qty, 0);
  const text = () => {
    const lines = basket.map(
      (i) => `• ${i.name}${i.size ? ` (${i.size})` : ""} × ${i.qty} = ${fmt(i.price * i.qty)} ${store.currency}`
    );
    return `الاسم: ${customer.trim()}\n\n${store.brand}\n${store.pharmacy}\n\n${lines.join("\n")}\n\nالإجمالي: ${fmt(total)} ${store.currency}`;
  };
  const copy = async () => {
    if (!nameOk) return needName();
    try {
      await navigator.clipboard.writeText(text());
      notify("تم نسخ القائمة ✓");
    } catch (e) {
      notify("تعذّر النسخ");
    }
  };
  const wa = () => {
    if (!nameOk) return needName();
    const base = store.whatsapp ? `https://wa.me/${store.whatsapp}` : "https://wa.me/";
    window.open(`${base}?text=${encodeURIComponent(text())}`, "_blank", "noopener");
  };
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="قائمتي">
        <header>
          <h3>🛍️ قائمتي</h3>
          <button onClick={onClose} aria-label="إغلاق">×</button>
        </header>
        <div className="body">
          {basket.length === 0 && <p className="none">القائمة فاضية.<br />اضغط (+) على أي منتج لإضافته.</p>}
          {basket.map((i) => (
            <div className="row" key={i.id}>
              <div className="t">
                <b>{i.name}</b>
                <small>{i.size || "—"}</small>
              </div>
              <div className="step">
                <button onClick={() => setQty(i.id, i.qty - 1)} aria-label="تقليل">−</button>
                <b>{i.qty}</b>
                <button onClick={() => setQty(i.id, i.qty + 1)} aria-label="زيادة">+</button>
              </div>
              <span className="p">{fmt(i.price * i.qty)}</span>
              <button onClick={() => remove(i.id)} aria-label="حذف" style={{ color: "#c0392b", fontSize: "1.2rem" }}>🗑</button>
            </div>
          ))}
        </div>
        {basket.length > 0 && (
          <div className="foot">
            <label className={"namebox" + (err && !nameOk ? " bad" : "")}>
              <span>الاسم <b>*</b></span>
              <input
                ref={nameRef}
                type="text"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="اكتب اسمك (مطلوب)"
                autoComplete="name"
                required
              />
              {err && !nameOk && <em>الاسم مطلوب قبل إرسال الطلب</em>}
            </label>
            <div className="sum"><span>الإجمالي</span><span>{fmt(total)} {store.currency}</span></div>
            <div className="acts">
              <button className="btn wa" onClick={wa}>إرسال عبر واتساب</button>
              <button className="btn ghost" onClick={copy}>نسخ القائمة</button>
              <button className="btn ghost" onClick={clear}>تفريغ</button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

/* =========================================================
   التطبيق الرئيسي
   ========================================================= */
function App() {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState("all");
  const [sort, setSort] = useState("default");
  const [mode, setMode] = useLocal("catalog.mode", "cards");
  const [basket, setBasket] = useLocal("catalog.basket", []);
  const [customer, setCustomer] = useLocal("catalog.customer", "");
  const [drawer, setDrawer] = useState(false);
  const [toast, setToast] = useState("");
  const [stack, setStack] = useState(120);
  const [activeSec, setActiveSec] = useState(null);
  const [showTop, setShowTop] = useState(false);
  const tbRef = useRef(null);
  const inputRef = useRef(null);
  const toastT = useRef(0);

  const tokens = useMemo(() => norm(query).split(" ").filter(Boolean), [query]);
  const searching = tokens.length > 0;

  /* ----- قياس ارتفاع الشريط الثابت ----- */
  useEffect(() => {
    const el = tbRef.current;
    if (!el) return;
    const set = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      document.documentElement.style.setProperty("--stack", h + "px");
      setStack(h);
    };
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ----- اختصار "/" للبحث + زر الرجوع لأعلى ----- */
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (e.key === "/" && tag !== "input" && tag !== "textarea") {
        e.preventDefault();
        inputRef.current && inputRef.current.focus();
      }
      if (e.key === "Escape") {
        setDrawer(false);
        if (document.activeElement === inputRef.current) setQuery("");
      }
    };
    const onScroll = () => setShowTop(window.scrollY > 700);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
  }, [drawer]);

  const notify = (msg) => {
    setToast(msg);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(""), 1800);
  };

  /* ----- القائمة (السلة) ----- */
  const qtyMap = useMemo(() => {
    const m = {};
    basket.forEach((i) => (m[i.id] = i.qty));
    return m;
  }, [basket]);
  const count = basket.reduce((s, i) => s + i.qty, 0);

  const addItem = (list, variant, p) => {
    const i = list.findIndex((x) => x.id === variant.id);
    if (i >= 0) return list.map((x, k) => (k === i ? { ...x, qty: x.qty + 1 } : x));
    return [...list, { id: variant.id, name: p.name, size: variant.size, price: variant.price, qty: 1 }];
  };
  const ctx = {
    tokens,
    mode,
    qtyOf: (id) => qtyMap[id] || 0,
    add: (variant, p) => setBasket((b) => addItem(b, variant, p)),
    addMany: (items) => {
      setBasket((b) => items.reduce((acc, { v, p }) => (acc.some((x) => x.id === v.id) ? acc : addItem(acc, v, p)), b));
      notify("تمت إضافة المجموعة ✓");
    },
    dec: (id) => setBasket((b) => b.flatMap((x) => (x.id === id ? (x.qty > 1 ? [{ ...x, qty: x.qty - 1 }] : []) : [x]))),
  };
  const setQty = (id, q) => setBasket((b) => b.flatMap((x) => (x.id === id ? (q > 0 ? [{ ...x, qty: q }] : []) : [x])));
  const remove = (id) => setBasket((b) => b.filter((x) => x.id !== id));

  /* ----- الفلترة والترتيب ----- */
  const catCounts = useMemo(() => {
    const m = { all: 0 };
    DB.forEach((cat) => {
      let c = 0;
      cat.sections.forEach((s) =>
        s.products.forEach((p) => {
          if (!tokens.length || tokens.every((t) => p.hay.includes(t))) c += p.variants.length;
        })
      );
      m[cat.id] = c;
      m.all += c;
    });
    return m;
  }, [tokens]);

  const view = useMemo(() => {
    const out = [];
    DB.forEach((cat) => {
      if (activeCat !== "all" && cat.id !== activeCat) return;
      const secs = [];
      cat.sections.forEach((sec) => {
        let prods = sec.products;
        if (tokens.length) prods = prods.filter((p) => tokens.every((t) => p.hay.includes(t)));
        if (!prods.length) return;
        const keepOrder = sec.type === "bundle" && !tokens.length;
        if (sort !== "default" && !keepOrder) {
          const lo = (p) => Math.min(...p.variants.map((v) => v.price));
          const hi = (p) => Math.max(...p.variants.map((v) => v.price));
          prods = [...prods].sort((x, y) => (sort === "asc" ? lo(x) - lo(y) : hi(y) - hi(x)));
        }
        secs.push({ ...sec, products: prods });
      });
      if (secs.length) out.push({ ...cat, sections: secs });
    });
    return out;
  }, [activeCat, tokens, sort]);

  /* ----- متابعة القسم الظاهر (scroll-spy) ----- */
  useEffect(() => {
    if (activeCat === "all") {
      setActiveSec(null);
      return;
    }
    const els = Array.from(document.querySelectorAll(".sec[id]"));
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActiveSec(e.target.id.replace("sec-", ""))),
      { rootMargin: `-${stack + 30}px 0px -65% 0px` }
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [view, activeCat, stack]);

  const scrollToContent = () =>
    requestAnimationFrame(() => {
      const el = document.getElementById("content");
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - stack - 14, behavior: "smooth" });
    });
  const pickCat = (id) => {
    setActiveCat(id);
    scrollToContent();
  };
  const jumpSec = (key) => {
    const el = document.getElementById("sec-" + key);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const single = activeCat !== "all" ? view[0] : null;
  const activeTheme = single ? single.theme : categories[0].theme;
  const headline = searching
    ? `${catCounts[activeCat]} نتيجة لـ «${query.trim()}»`
    : single
    ? single.name
    : `كل المنتجات (${GRAND_TOTAL} صنف)`;

  return (
    <Ctx.Provider value={ctx}>
      <div id="top">
        {/* ================= HERO ================= */}
        <section className="hero">
          <div className="hero-bg" aria-hidden="true"><span /><span /><span /></div>
          <div className="wrap hero-inner">
            <div className="brand-line" style={{ justifyContent: "center" }}>
              <Logo size={58} gid="lgh" />
              <div style={{ textAlign: "start" }}>
                <small>مؤسسة</small>
                <strong>أسرار الجمال الطبيعي</strong>
              </div>
            </div>
            <div className="eyebrow">{store.pharmacy}</div>
            <h1>قائمة الأسعار</h1>
            <p className="lead">كل لاينات المنتجات في مكان واحد — ابحث بالاسم أو القسم أو الحجم وستصل لأي صنف في ثواني.</p>
            <div className="stats">
              <div className="stat"><b>{GRAND_TOTAL}</b>صنف</div>
              <div className="stat"><b>{DB.length}</b>لاينات</div>
              <div className="stat"><b>{DB.reduce((s, c) => s + c.sections.length, 0)}</b>قسم</div>
            </div>
          </div>
        </section>

        {/* ================= TILES ================= */}
        <div className="wrap tiles-wrap">
          <div className="tiles">
            {DB.map((cat) => (
              <button key={cat.id} className="tile" style={themeStyle(cat.theme)} onClick={() => pickCat(cat.id)}>
                <span className="emo">{cat.emoji}</span>
                <strong>{cat.name}</strong>
                <span className="n">{catTotal(cat)} صنف</span>
              </button>
            ))}
          </div>
        </div>

        {/* ================= TOOLBAR ================= */}
        <header className="toolbar" ref={tbRef} style={themeStyle(activeTheme)}>
          <div className="wrap tb-row">
            <a className="tb-brand" href="#top"><Logo size={36} gid="lgt" /><span>أسرار الجمال</span></a>
            <label className="search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث: بيرفيوم، سيروم، 50 مل…"
                aria-label="بحث في المنتجات"
              />
              {query ? (
                <button className="clear" onClick={() => setQuery("")} aria-label="مسح البحث">×</button>
              ) : (
                <kbd>/</kbd>
              )}
            </label>
            <button className="basket-btn" onClick={() => setDrawer(true)} aria-label="فتح قائمتي">
              🛍️<span className="lbl">قائمتي</span>
              {count > 0 && <span className="badge" key={count}>{count}</span>}
            </button>
          </div>

          <nav className="wrap chips" aria-label="الأقسام">
            <button
              className={"chip" + (activeCat === "all" ? " active" : "")}
              style={themeStyle({ a: "#5b2170", b: "#a2418f", soft: "#f5e9f8" })}
              onClick={() => pickCat("all")}
            >
              ✨ الكل <span className="c">{catCounts.all}</span>
            </button>
            {DB.map((cat) => (
              <button
                key={cat.id}
                className={"chip" + (activeCat === cat.id ? " active" : "") + (searching && !catCounts[cat.id] ? " dim" : "")}
                style={themeStyle(cat.theme)}
                onClick={() => pickCat(cat.id)}
              >
                {cat.emoji} {cat.name.replace("لاين ", "")} <span className="c">{catCounts[cat.id]}</span>
              </button>
            ))}
          </nav>

          {single && single.sections.length > 1 && (
            <nav className="wrap chips subnav" aria-label="أقسام اللاين">
              {single.sections.map((s) => (
                <button key={s.key} className={"chip" + (activeSec === s.key ? " active" : "")} onClick={() => jumpSec(s.key)}>
                  {s.title}
                </button>
              ))}
            </nav>
          )}
        </header>

        {/* ================= CONTENT ================= */}
        <main className="wrap" id="content">
          <div className="controls" style={themeStyle(activeTheme)} aria-live="polite">
            <h2>{headline}</h2>
            <div className="right">
              <select className="select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="ترتيب">
                {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <div className="seg" role="group" aria-label="طريقة العرض">
                <button className={mode === "cards" ? "on" : ""} onClick={() => setMode("cards")}>▦ كروت</button>
                <button className={mode === "table" ? "on" : ""} onClick={() => setMode("table")}>☰ جدول</button>
              </div>
            </div>
          </div>

          {view.length === 0 && (
            <div className="empty">
              <div className="big">🔍</div>
              <h3>مفيش نتائج لـ «{query}»</h3>
              <p>جرّب كلمة أبسط أو اكتب جزء من الاسم.</p>
              {activeCat !== "all" && (
                <p style={{ marginTop: 10 }}>
                  <button className="chip" onClick={() => setActiveCat("all")}>ابحث في كل الأقسام</button>
                </p>
              )}
              <div className="sugg">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="chip" onClick={() => setQuery(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {view.map((cat) => (
            <div className="cat" key={cat.id} style={themeStyle(cat.theme)}>
              <div className="cat-banner">
                <span className="emo">{cat.emoji}</span>
                <div>
                  <h2>{cat.name}</h2>
                  <p>{cat.tagline}</p>
                </div>
                <div className="total">
                  <b>{cat.sections.reduce((s, sec) => s + countVariants(sec.products), 0)}</b>
                  {searching ? "نتيجة" : "صنف"}
                </div>
              </div>
              {cat.sections.map((sec) => (
                <SectionBlock key={sec.key} sec={sec} searching={searching} />
              ))}
            </div>
          ))}
        </main>

        {/* ================= FOOTER ================= */}
        <footer className="site">
          <div className="wrap">
            <span className="logo"><Logo size={52} gid="lgf" /></span>
            <strong>{store.brand}</strong>
            <p>{store.pharmacy}</p>
            <p className="mgr">{store.manager}{store.managerRole ? ` — ${store.managerRole}` : ""}</p>
          </div>
        </footer>

        {showTop && (
          <button className="to-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="الرجوع لأعلى">↑</button>
        )}
        {drawer && (
          <Drawer
            basket={basket}
            setQty={setQty}
            remove={remove}
            clear={() => setBasket([])}
            onClose={() => setDrawer(false)}
            notify={notify}
            customer={customer}
            setCustomer={setCustomer}
          />
        )}
        {toast && <div className="toast" role="status">{toast}</div>}
      </div>
    </Ctx.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);