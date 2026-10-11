import React, { useCallback, useEffect, useRef, useState } from "react";
import { CONTACT, onCall, studio } from "./api.js";

// Describe a design → Arcade draws the pattern → Arcade makes it a real
// product → Videoselz puts it on a Shopify store and makes its videos.

const JOB_POLL_MS = 3000;
const VIDEO_POLL_MS = 8000;
// What the progress bar assumes; Arcade says generation takes 1-2 minutes.
const EXPECTED_MS = { pattern: 90_000, product: 60_000 };
const DEFAULT_MARKUP = 2.5;
const CODE_KEY = "arcade-videoselz-code";

const SWATCHES = ["#1F3A5F", "#3E7CB1", "#A7C7E7", "#F4EDE4", "#C9A227", "#D98E73", "#B5485D", "#6B8F71", "#2F2F2F", "#FFFFFF"];

const EXAMPLES = [
  "Small blue and white block-print florals on natural linen",
  "Hand-drawn lemons and leaves, Mediterranean summer, soft yellow and sage",
  "Bold 70s retro waves in terracotta, mustard and cream",
];

const VIDEO_LABEL = { loop: "Banner loop", story: "Story", narrated: "Lifestyle video" };

const money = (amount, currency = "USD") => {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
};

const readCode = () => {
  try {
    return sessionStorage.getItem(CODE_KEY) ?? "";
  } catch {
    return "";
  }
};

/** Polls an Arcade job until it ends; calls onDone(job) once. Returns progress 0-95. */
function useArcadeJob(job, onDone, onError) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!job) return undefined;
    let cancelled = false;
    let timer;
    const tick = async () => {
      setNow(Date.now());
      try {
        const res = await studio("job", { jobId: job.jobId });
        if (cancelled) return;
        if (res.job.status === "succeeded") return onDone(res.job);
        if (res.job.status === "failed") return onError(res.job.error || "Arcade couldn't finish this job");
      } catch (err) {
        if (!cancelled) return onError(err.message);
      }
      timer = setTimeout(tick, JOB_POLL_MS);
    };
    timer = setTimeout(tick, JOB_POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // onDone/onError are recreated each render; the job is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job]);
  if (!job) return null;
  return Math.min(95, Math.round(((now - job.startedAt) / EXPECTED_MS[job.kind]) * 100));
}

function Spinner({ small }) {
  return <span className={small ? "spinner spinner-small" : "spinner"} aria-hidden="true" />;
}

function Button({ children, loading, variant = "secondary", className = "", ...props }) {
  return (
    <button type="button" className={`btn btn-${variant} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading && <Spinner small />}
      <span>{children}</span>
    </button>
  );
}

function Alert({ tone = "critical", children, onDismiss }) {
  return (
    <div className={`alert alert-${tone}`} role={tone === "critical" ? "alert" : "status"}>
      <div>{children}</div>
      {onDismiss && (
        <button type="button" className="alert-close" onClick={onDismiss} aria-label="Dismiss">×</button>
      )}
    </div>
  );
}

function Progress({ value, label }) {
  if (value === null) return null;
  return (
    <div className="progress">
      <div className="progress-label">
        <Spinner small />
        <span>{label}</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Step({ number, title, done, children }) {
  return (
    <section className="card">
      <header className="step-head">
        <span className={done ? "step-num step-done" : "step-num"}>{done ? "✓" : number}</span>
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}

function VideoTile({ video }) {
  const story = video.variant === "story";
  return (
    <div className="video-tile">
      <div className="video-frame">
        {video.outputUrl ? (
          <video src={video.outputUrl} muted loop autoPlay playsInline className={story ? "video-story" : "video-wide"} />
        ) : video.status === "generating" ? (
          <Spinner />
        ) : null}
      </div>
      <p className="video-title">{story && video.concept ? video.concept : VIDEO_LABEL[video.variant] ?? video.variant}</p>
      <div className="video-meta">
        <span className={`badge badge-${video.status}`}>
          {video.status === "generating" ? "Generating" : video.status === "ready" ? "Ready" : "Failed"}
        </span>
        {video.outputUrl && (
          <a href={video.outputUrl} target="_blank" rel="noreferrer">Watch</a>
        )}
      </div>
    </div>
  );
}

function CallLog({ calls }) {
  if (calls.length === 0) return null;
  return (
    <details className="card calls">
      <summary>Behind the scenes · {calls.length} Arcade API {calls.length === 1 ? "call" : "calls"}</summary>
      <ol>
        {calls.map((c, i) => (
          <li key={i}>
            <code>{c.call}</code>
            <span className={c.status < 300 ? "ok" : "bad"}>{c.status}</span>
            <span className="muted">{c.ms} ms</span>
          </li>
        ))}
      </ol>
    </details>
  );
}

export default function App() {
  const [status, setStatus] = useState(null);
  const [down, setDown] = useState(null);
  const [code, setCode] = useState(readCode);
  // { message, step }: shown in the card of the step that failed.
  const [error, setErrorState] = useState(null);
  const setError = (message, step = "page") => setErrorState(message ? { message, step } : null);
  const [starting, setStarting] = useState(null);
  const [calls, setCalls] = useState([]);

  // 1. Design
  const [prompt, setPrompt] = useState("");
  const [colors, setColors] = useState([]);
  const [patternJob, setPatternJob] = useState(null);
  const [patterns, setPatterns] = useState([]);
  const [pattern, setPattern] = useState(null);
  const [instruction, setInstruction] = useState("");

  // 2. Product
  const [categories, setCategories] = useState(null);
  const [category, setCategory] = useState(null);
  const [choices, setChoices] = useState({});
  const [loadingCategory, setLoadingCategory] = useState(false);
  const [productJob, setProductJob] = useState(null);
  const [product, setProduct] = useState(null);

  // 3. Send to Videoselz
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(null);
  const [videos, setVideos] = useState([]);

  const videoTimer = useRef(null);

  useEffect(() => onCall((entry) => setCalls((list) => [...list, entry].slice(-30))), []);

  useEffect(() => {
    studio("status")
      .then((res) => {
        setStatus(res);
        return studio("categories");
      })
      .then((res) => setCategories(res.categories))
      .catch((err) => setDown(err.message));
  }, []);

  const saveCode = (value) => {
    setCode(value);
    try {
      sessionStorage.setItem(CODE_KEY, value);
    } catch {
      // Private mode: the code just isn't remembered.
    }
  };

  const patternProgress = useArcadeJob(
    patternJob,
    (job) => {
      setPatternJob(null);
      if (!job.pattern) return setError("Arcade finished but returned no pattern; try again.", "design");
      setPattern(job.pattern);
      setPatterns((list) => [job.pattern, ...list.filter((p) => p.patternId !== job.pattern.patternId)].slice(0, 6));
      setInstruction("");
    },
    (message) => {
      setPatternJob(null);
      setError(message, "design");
    },
  );

  const productProgress = useArcadeJob(
    productJob,
    (job) => {
      setProductJob(null);
      if (!job.product) return setError("Arcade finished but returned no product; try again.", "product");
      const p = job.product;
      setProduct(p);
      setTitle(p.title ?? "");
      const cost = Number(p.unitPrice?.amount);
      setPrice(Number.isFinite(cost) ? (Math.ceil(cost * DEFAULT_MARKUP) - 0.01).toFixed(2) : "");
      setSent(null);
      setVideos([]);
    },
    (message) => {
      setProductJob(null);
      setError(message, "product");
    },
  );

  const run = async (step, kind, fn) => {
    setError(null);
    setStarting(kind);
    try {
      await fn();
    } catch (err) {
      setError(err.message, step);
    } finally {
      setStarting(null);
    }
  };

  const generate = () =>
    run("design", "pattern", async () => {
      const res = await studio("createPattern", { prompt, colors }, code);
      setPatternJob({ ...res.job, kind: "pattern", startedAt: Date.now() });
    });

  const refine = () =>
    run("design", "pattern", async () => {
      const res = await studio("refinePattern", { patternId: pattern.patternId, instruction }, code);
      setPatternJob({ ...res.job, kind: "pattern", startedAt: Date.now() });
    });

  const loadCategory = useCallback(async (categoryId, nextChoices) => {
    setLoadingCategory(true);
    setErrorState(null);
    try {
      const res = await studio("category", { categoryId, selections: nextChoices });
      setCategory(res.category);
    } catch (err) {
      setErrorState({ message: err.message, step: "product" });
    } finally {
      setLoadingCategory(false);
    }
  }, []);

  const pickCategory = (categoryId) => {
    setChoices({});
    setProduct(null);
    loadCategory(categoryId, {});
  };

  const choose = (key, value) => {
    const next = { ...choices, [key]: value };
    setChoices(next);
    loadCategory(category.categoryId, next);
  };

  const makeProduct = () =>
    run("product", "product", async () => {
      const res = await studio("createProduct", { patternId: pattern.patternId, categoryId: category.categoryId, selections: category.selections }, code);
      setProductJob({ ...res.job, kind: "product", startedAt: Date.now() });
    });

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await studio("publish", { productId: product.productId, title, price }, code);
      setSent(res.published);
    } catch (err) {
      setError(err.message, "send");
    } finally {
      setSending(false);
    }
  };

  const startOver = () => {
    setPrompt("");
    setColors([]);
    setPattern(null);
    setPatterns([]);
    setCategory(null);
    setChoices({});
    setProduct(null);
    setSent(null);
    setVideos([]);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // After sending: the product's videos, until none is still generating.
  useEffect(() => {
    clearTimeout(videoTimer.current);
    if (!sent?.shopifyProductId) return undefined;
    const poll = async () => {
      let list = null;
      try {
        const res = await studio("videos", { productId: String(sent.shopifyProductId) });
        list = res.videos;
        setVideos(list);
      } catch {
        // The next poll tries again.
      }
      const finished = list?.length > 0 && !list.some((v) => v.status === "generating");
      if (!finished) videoTimer.current = setTimeout(poll, VIDEO_POLL_MS);
    };
    poll();
    return () => clearTimeout(videoTimer.current);
  }, [sent]);

  const toggleColor = (color) =>
    setColors((list) => (list.includes(color) ? list.filter((c) => c !== color) : [...list, color].slice(0, 10)));

  const cost = product?.unitPrice ? Number(product.unitPrice.amount) : null;
  const margin = cost && Number(price) > 0 ? Number(price) - cost : null;
  const preview = product?.images?.[0] ?? pattern?.imageUrl ?? null;
  const needsCode = status?.needsCode && !code.trim();
  const busy = !!patternJob || !!productJob || !!starting;

  const errorFor = (step) =>
    error?.step === step && <Alert onDismiss={() => setError(null)}>{error.message}</Alert>;

  const designStep = (
    <Step number={1} title="Describe your design" done={!!pattern}>
      <textarea
        className="input"
        rows={3}
        maxLength={1000}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={EXAMPLES[0]}
        disabled={!!patternJob}
        aria-label="Describe the pattern"
      />
      <div className="chips">
        {EXAMPLES.slice(1).map((example) => (
          <button key={example} type="button" className="chip" onClick={() => setPrompt(example)} disabled={!!patternJob}>
            {`Try: ${example.split(",")[0]}`}
          </button>
        ))}
      </div>
      <div>
        <p className="label">Colours (optional)</p>
        <div className="swatches">
          {SWATCHES.map((color) => (
            <button
              key={color}
              type="button"
              className={colors.includes(color) ? "swatch swatch-on" : "swatch"}
              style={{ background: color }}
              onClick={() => toggleColor(color)}
              aria-label={color}
              aria-pressed={colors.includes(color)}
            />
          ))}
        </div>
      </div>
      <div className="row">
        <Button
          variant="primary"
          onClick={generate}
          loading={starting === "pattern" || (!!patternJob && !pattern)}
          disabled={!prompt.trim() || busy || needsCode}
        >
          {pattern ? "Generate a new pattern" : "Generate pattern"}
        </Button>
        {needsCode && <span className="muted">Enter the access code above first.</span>}
      </div>
      <Progress value={patternProgress} label="Arcade is drawing your pattern. This takes about a minute." />
      {errorFor("design")}

      {pattern && (
        <>
          <hr />
          <div className="tweak">
            <label className="grow">
              <span className="label">Tweak it</span>
              <input
                className="input"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="e.g. make the flowers larger and the background warmer"
                disabled={!!patternJob}
              />
            </label>
            <Button onClick={refine} loading={starting === "pattern" && !!pattern} disabled={!instruction.trim() || busy}>
              Apply
            </Button>
          </div>
          {patterns.length > 1 && (
            <div className="versions">
              {patterns.map((p) => (
                <button
                  key={p.patternId}
                  type="button"
                  className={p.patternId === pattern.patternId ? "version version-on" : "version"}
                  onClick={() => setPattern(p)}
                >
                  <img src={p.thumbnailUrl ?? p.imageUrl} alt="Pattern version" />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </Step>
  );

  const productStep = (
    <Step number={2} title="Choose the product" done={!!product}>
      {!pattern ? (
        <p className="muted">Generate a pattern first.</p>
      ) : !categories ? (
        <Spinner />
      ) : (
        <>
          <div className="tiles">
            {categories.map((c) => (
              <button
                key={c.categoryId}
                type="button"
                className={category?.categoryId === c.categoryId ? "tile tile-on" : "tile"}
                onClick={() => pickCategory(c.categoryId)}
              >
                <div className="tile-img">{c.imageUrl && <img src={c.imageUrl} alt="" />}</div>
                <strong>{c.name}</strong>
                {c.group && <span className="muted">{c.group}</span>}
              </button>
            ))}
          </div>
          {category && (
            <>
              <div className="options">
                {category.options.map((option) => (
                  <label key={option.key}>
                    <span className="label">{option.label}</span>
                    <select
                      className="input"
                      value={category.selections[option.key]}
                      onChange={(e) => choose(option.key, e.target.value)}
                      disabled={loadingCategory || !!productJob}
                    >
                      {option.values
                        .filter((v) => v.available || v.value === category.selections[option.key])
                        .map((v) => (
                          <option key={v.value} value={v.value}>{v.label}</option>
                        ))}
                    </select>
                  </label>
                ))}
              </div>
              {!category.canManufacture && (
                <Alert tone="warning">This combination can't be made. Change one of the options.</Alert>
              )}
              <div className="row row-end">
                <Button
                  variant="primary"
                  onClick={makeProduct}
                  disabled={!category.canManufacture || loadingCategory || busy}
                  loading={starting === "product" || !!productJob}
                >
                  {`Create ${category.name}`}
                </Button>
              </div>
              <Progress value={productProgress} label="Arcade is building your product and its photos." />
            </>
          )}
          {errorFor("product")}
        </>
      )}
    </Step>
  );

  const doneSummary = pattern && product && (
    <section className="card summary">
      <img src={pattern.thumbnailUrl ?? pattern.imageUrl} alt="" />
      <div className="grow">
        <strong>{`✓ Pattern  ·  ✓ ${category?.name ?? "Product"}`}</strong>
        <p className="muted truncate">{product.selectionLabel || prompt}</p>
      </div>
      {!sent && (
        <button type="button" className="link" onClick={() => setProduct(null)}>Change</button>
      )}
    </section>
  );

  const sendStep = product && (
    <Step number={3} title="Sell it with videos" done={!!sent}>
      {product.images.length > 1 && (
        <div className="thumbs">
          {product.images.slice(0, 5).map((url) => (
            <img key={url} src={url} alt="" />
          ))}
        </div>
      )}
      <label>
        <span className="label">Product title</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!!sent} />
      </label>
      <div className="options">
        <label>
          <span className="label">Your price</span>
          <input className="input" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} disabled={!!sent} />
        </label>
        <div>
          <span className="label">Made by Arcade</span>
          <p>{cost !== null ? `${money(cost, product.unitPrice.currency)} per unit` : "Price shown at checkout"}</p>
          {margin !== null && (
            <p className={margin > 0 ? "good" : "bad"}>{`${money(margin, product.unitPrice.currency)} profit per sale`}</p>
          )}
        </div>
      </div>
      {errorFor("send")}
      {!sent ? (
        <div className="row">
          <Button variant="primary" className="btn-large" onClick={send} loading={sending} disabled={needsCode}>
            Send to Videoselz
          </Button>
          <span className="muted">Videoselz adds it to a Shopify store and makes 3 story videos and a banner loop.</span>
        </div>
      ) : (
        <>
          <Alert tone="success">
            {sent.mock ? (
              "Preview: nothing was published."
            ) : (
              <>
                <strong>{sent.title}</strong> is on the Videoselz demo store. Videoselz is making 3 story videos and a
                banner loop; they appear below and on the product page when they're ready.
              </>
            )}
          </Alert>
          {videos.length > 0 ? (
            <div className="videos">
              {[...videos]
                .sort((a, b) => (b.variant === "loop") - (a.variant === "loop"))
                .map((v) => (
                  <VideoTile key={v.id} video={v} />
                ))}
            </div>
          ) : (
            !sent.mock && (
              <div className="progress-label">
                <Spinner small />
                <span>Starting the videos…</span>
              </div>
            )
          )}
          <div className="row">
            <Button onClick={startOver}>Design another</Button>
          </div>
        </>
      )}
    </Step>
  );

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Arcade × Videoselz</p>
          <h1>Design a product. Get its videos.</h1>
          <p className="lead">
            Describe a design and <a href="https://www.arcade.ai" target="_blank" rel="noreferrer">Arcade</a> makes it a real,
            made-to-order product. Videoselz puts it on a Shopify store and makes its story videos and a banner loop.
          </p>
        </div>
        {status?.needsCode && (
          <label className="code">
            <span className="label">Access code</span>
            <input
              className="input"
              type="password"
              value={code}
              onChange={(e) => saveCode(e.target.value)}
              placeholder="From the Videoselz team"
              autoComplete="off"
            />
          </label>
        )}
      </header>

      {down && (
        <Alert>{down}</Alert>
      )}
      {status?.mock && <Alert tone="info">Preview mode: Arcade isn't connected on the Videoselz side, so this shows sample data.</Alert>}
      {errorFor("page")}

      <main className="layout">
        <div className="stack">
          {product ? doneSummary : (
            <>
              {designStep}
              {productStep}
            </>
          )}
          {sendStep}
          <CallLog calls={calls} />
        </div>
        <aside className="card preview">
          <h3>{product ? product.title : pattern ? "Your pattern" : "Preview"}</h3>
          <div className="preview-img">
            {preview ? <img src={preview} alt={product?.title ?? "Pattern"} /> : patternJob ? <Spinner /> : <p className="muted">Your design appears here.</p>}
          </div>
          {product?.selectionLabel && <p className="muted">{product.selectionLabel}</p>}
        </aside>
      </main>

      <footer className="footer">
        Built for the Arcade hackathon with the <a href="https://docs.arcade.ai" target="_blank" rel="noreferrer">Arcade API</a> and{" "}
        Videoselz. Questions: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </footer>
    </div>
  );
}
