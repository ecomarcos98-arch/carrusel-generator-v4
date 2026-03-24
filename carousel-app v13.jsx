import { useState, useRef, useCallback } from "react";

const IMAGE_MODEL = "gemini-3.1-flash-image-preview";
const DEFAULT_API_KEY = "";

const IMAGE_STYLES = [
  {
    id: "gta",
    name: "🎮 GTA",
    prompt: "Grand Theft Auto V loading screen art style, saturated colors, stylized realism, sharp outlines, dramatic poses, urban gritty atmosphere, GTA game aesthetic",
    expertPrompt: "in GTA V loading screen art style with sharp outlines and saturated colors, preserving exact facial features and likeness of this person",
  },
  {
    id: "comic",
    name: "💥 Comic Book",
    prompt: "comic book art style, bold ink outlines, halftone dots, dramatic shading, vibrant panel colors, action comic aesthetic",
    expertPrompt: "as a comic book character with bold ink outlines and halftone shading, preserving facial features and likeness of this person",
  },
  {
    id: "before_after",
    name: "🔄 Antes/Después",
    prompt: "image divided in two horizontal panels (top and bottom). Top panel has desaturated cold tones, gloomy atmosphere. Bottom panel has vibrant warm tones, successful positive atmosphere. Clear thin dividing line between panels. Photorealistic, cinematic lighting",
    expertPrompt: "The same person from the reference photo must appear in BOTH panels preserving their exact facial features. Top panel shows them in a negative situation, bottom panel shows them thriving",
  },
  {
    id: "caricature",
    name: "🎨 Caricatura",
    prompt: "caricature illustration style, exaggerated proportions and facial features, humorous, expressive, colorful, editorial cartoon aesthetic with bold lines",
    expertPrompt: "as a caricature with exaggerated but recognizable facial features of this person, humorous proportions, bold colorful illustration",
  },
  {
    id: "libre",
    name: "🖼️ Libre",
    prompt: "",
    expertPrompt: "",
    isLibre: true,
  },
];

// ─── API ─────────────────────────────────────────────────────────────

async function geminiImage(prompt, refImages, apiKey) {
  if (!apiKey) throw new Error("Ingresá tu API Key de Gemini");
  const parts = [];
  // Add reference images (expert photo, libre style ref, etc.)
  if (refImages && refImages.length > 0) {
    for (const ref of refImages) {
      if (ref.base64) {
        parts.push({ inlineData: { mimeType: ref.mimeType || "image/jpeg", data: ref.base64 } });
      }
    }
  }
  parts.push({ text: prompt });
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"], imageMimeType: "image/png" },
      }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const ip = (data.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData);
  if (!ip) throw new Error("No image generated");
  return ip.inlineData.data;
}

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function parseSlides(raw) {
  const blocks = raw.split("---").map((b) => b.trim()).filter(Boolean);
  return blocks.map((block) => {
    const escenaMatch = block.match(/ESCENA:\s*([\s\S]*?)(?=TEXTO:|$)/i);
    const textoMatch = block.match(/TEXTO:\s*([\s\S]*)/i);
    return {
      scene: escenaMatch ? escenaMatch[1].trim() : block,
      text: textoMatch ? textoMatch[1].trim() : "",
    };
  });
}

// ─── Canvas ──────────────────────────────────────────────────────────

function loadImg(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

function wrap(ctx, text, maxW) {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (ctx.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

async function renderSlide(canvas, bgB64, textContent, slideIdx, totalSlides, keyword, styleId) {
  const ctx = canvas.getContext("2d");
  const W = 1080, H = 1080;
  canvas.width = W;
  canvas.height = H;

  // Background
  if (bgB64) {
    try {
      const img = await loadImg("data:image/png;base64," + bgB64);
      const sc = Math.max(W / img.width, H / img.height);
      ctx.drawImage(img, (W - img.width * sc) / 2, (H - img.height * sc) / 2, img.width * sc, img.height * sc);
    } catch {
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, W, H);
    }
  } else {
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, W, H);
  }

  if (!textContent) return canvas.toDataURL("image/png");

  const pad = 50;
  const maxW = W - pad * 2 - 20;
  const isLast = slideIdx === totalSlides - 1;

  // For before/after style, handle split text
  if (styleId === "before_after" && textContent.includes("\n")) {
    const parts = textContent.split("\n").filter(Boolean);
    const topTxt = parts[0] || "";
    const bottomTxt = parts.slice(1).join(" ");

    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Top text pill
    if (topTxt) {
      ctx.font = "bold 36px 'Segoe UI', sans-serif";
      const tLines = wrap(ctx, topTxt, maxW - 40);
      const tH = tLines.length * 48;
      const tY = H * 0.25 - tH / 2;
      ctx.shadowColor = "transparent";
      ctx.fillStyle = "rgba(0,0,0,0.72)";
      ctx.beginPath(); ctx.roundRect(pad, tY - 14, W - pad * 2, tH + 28, 12); ctx.fill();
      ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 10;
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      tLines.forEach((l, i) => ctx.fillText(l, W / 2, tY + 24 + i * 48));
    }

    // Bottom text pill
    if (bottomTxt) {
      ctx.font = "bold 36px 'Segoe UI', sans-serif";
      const bLines = wrap(ctx, bottomTxt, maxW - 40);
      const bH = bLines.length * 48;
      const bY = H * 0.75 - bH / 2;
      ctx.shadowColor = "transparent";
      ctx.fillStyle = "rgba(0,0,0,0.72)";
      ctx.beginPath(); ctx.roundRect(pad, bY - 14, W - pad * 2, bH + 28, 12); ctx.fill();
      ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 10;
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      bLines.forEach((l, i) => ctx.fillText(l, W / 2, bY + 24 + i * 48));
    }
  } else {
    // Standard text overlay
    const lines = textContent.split("\n").filter(Boolean);
    const title = lines[0] || "";
    const body = lines.slice(1).join(" ");

    // Gradient at bottom
    ctx.shadowColor = "transparent";
    const grd = ctx.createLinearGradient(0, H * 0.45, 0, H);
    grd.addColorStop(0, "rgba(0,0,0,0.0)");
    grd.addColorStop(0.25, "rgba(0,0,0,0.65)");
    grd.addColorStop(1, "rgba(0,0,0,0.88)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, H * 0.45, W, H * 0.55);

    // Accent
    ctx.fillStyle = "#d4a853";
    ctx.fillRect(pad, H * 0.68, 50, 3);

    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Title
    ctx.textAlign = "left";
    ctx.font = "bold 46px 'Segoe UI', sans-serif";
    ctx.fillStyle = "#ffffff";
    const tLines = wrap(ctx, title, maxW);
    let y = H * 0.71;
    tLines.forEach((l, i) => ctx.fillText(l, pad + 4, y + i * 56));
    y += tLines.length * 56 + 10;

    // Body
    if (body) {
      ctx.font = "30px 'Segoe UI', sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      const bLines = wrap(ctx, body, maxW);
      bLines.forEach((l, i) => ctx.fillText(l, pad + 4, y + i * 42));
      y += bLines.length * 42 + 10;
    }

    // CTA
    if (isLast && keyword) {
      y += 8;
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.font = "bold 36px 'Segoe UI', sans-serif";
      const kw = keyword.toUpperCase();
      const kwW = ctx.measureText(kw).width + 50;
      ctx.fillStyle = "#d4a853";
      ctx.beginPath(); ctx.roundRect(pad + 4, y, kwW, 52, 8); ctx.fill();
      ctx.fillStyle = "#0a0a0a";
      ctx.fillText(kw, pad + 29, y + 38);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "20px 'Segoe UI', sans-serif";
      ctx.fillText("↑ Comenta esta palabra", pad + 4, y + 78);
    }
  }

  // Reset shadow
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Counter
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "bold 18px 'Segoe UI', sans-serif";
  ctx.fillText(`${slideIdx + 1}/${totalSlides}`, W - 24, 28);

  return canvas.toDataURL("image/png");
}

// ─── ZIP ─────────────────────────────────────────────────────────────

function createZip(files) {
  const L = [], C = []; let o = 0;
  for (const f of files) {
    const n = new TextEncoder().encode(f.name), d = f.data;
    const l = new Uint8Array(30 + n.length + d.length), v = new DataView(l.buffer);
    v.setUint32(0,0x04034b50,1);v.setUint16(4,20,1);v.setUint16(6,0,1);v.setUint16(8,0,1);
    v.setUint16(10,0,1);v.setUint16(12,0,1);v.setUint32(14,0,1);v.setUint32(18,d.length,1);
    v.setUint32(22,d.length,1);v.setUint16(26,n.length,1);v.setUint16(28,0,1);
    l.set(n,30);l.set(d,30+n.length);L.push(l);
    const c = new Uint8Array(46+n.length), w = new DataView(c.buffer);
    w.setUint32(0,0x02014b50,1);w.setUint16(4,20,1);w.setUint16(6,20,1);w.setUint16(8,0,1);
    w.setUint16(10,0,1);w.setUint16(12,0,1);w.setUint16(14,0,1);w.setUint32(16,0,1);
    w.setUint32(20,d.length,1);w.setUint32(24,d.length,1);w.setUint16(28,n.length,1);
    w.setUint16(30,0,1);w.setUint16(32,0,1);w.setUint16(34,0,1);w.setUint16(36,0,1);
    w.setUint32(38,0,1);w.setUint32(42,o,1);c.set(n,46);C.push(c);o+=l.length;
  }
  const s=C.reduce((a,c)=>a+c.length,0),e=new Uint8Array(22),ev=new DataView(e.buffer);
  ev.setUint32(0,0x06054b50,1);ev.setUint16(4,0,1);ev.setUint16(6,0,1);
  ev.setUint16(8,files.length,1);ev.setUint16(10,files.length,1);ev.setUint32(12,s,1);
  ev.setUint32(16,o,1);ev.setUint16(20,0,1);
  const z=new Uint8Array(o+s+22);let p=0;
  for(const l of L){z.set(l,p);p+=l.length;}
  for(const c of C){z.set(c,p);p+=c.length;}
  z.set(e,p);return z;
}

function b64u8(b) { const n=atob(b),a=new Uint8Array(n.length);for(let i=0;i<n.length;i++)a[i]=n.charCodeAt(i);return a; }

// ─── Styles ──────────────────────────────────────────────────────────

const lbl = { display:"block", marginBottom:8, fontSize:13, color:"#a89870", textTransform:"uppercase", letterSpacing:2 };
const inp = { width:"100%", padding:"12px 14px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(212,168,83,0.2)", borderRadius:8, color:"#e8e0d0", fontSize:15, fontFamily:"inherit", outline:"none", boxSizing:"border-box" };

// ─── App ─────────────────────────────────────────────────────────────

export default function App() {
  const [apiKey, setApiKey] = useState(DEFAULT_API_KEY);
  const [showKey, setShowKey] = useState(false);
  const [slideText, setSlideText] = useState("");
  const [keyword, setKeyword] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("gta");
  const [expertPhoto, setExpertPhoto] = useState(null);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [images, setImages] = useState([]);
  const [idx, setIdx] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [libreRef, setLibreRef] = useState(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  const libreFileRef = useRef(null);

  const style = IMAGE_STYLES.find((s) => s.id === selectedStyle);
  const parsed = parseSlides(slideText);
  const count = parsed.length;

  const handleUpload = useCallback(async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setExpertPhoto({ base64: await fileToBase64(f), mimeType: f.type, preview: URL.createObjectURL(f) });
  }, []);

  const buildImagePrompt = useCallback((sceneDesc, styleObj, hasExpert) => {
    if (styleObj.isLibre) {
      // Libre mode: use the reference style image
      const base = `Generate an image based on this scene: "${sceneDesc}". Match the visual style of the reference image exactly (color palette, illustration technique, composition style).`;
      const expertPart = hasExpert ? " The main character must look exactly like the person in the expert reference photo, preserving facial features." : "";
      return `${base}${expertPart} Square format 1:1. Do NOT include any text, words, letters, numbers, or captions in the image.`;
    }
    if (hasExpert) {
      return `Generate an image based on this scene: "${sceneDesc}". The main character must look exactly like the person in the reference photo — ${styleObj.expertPrompt}. Place them naturally in the scene. ${styleObj.prompt}. Square format 1:1. Do NOT include any text, words, letters, numbers, or captions in the image.`;
    }
    return `Generate an image: "${sceneDesc}". ${styleObj.prompt}. Include a professional-looking person as the main subject if the scene implies one. Square format 1:1. Do NOT include any text, words, letters, numbers, or captions in the image.`;
  }, []);

  const generate = useCallback(async () => {
    if (count < 2) return;
    setGenerating(true); setImages([]); setIdx(0);
    setTotalSteps(count); setProgress(0);
    const canvas = canvasRef.current || document.createElement("canvas");
    canvasRef.current = canvas;
    const results = [];

    try {
      for (let i = 0; i < parsed.length; i++) {
        const { scene, text } = parsed[i];
        setStatus(`Generando imagen ${i + 1} de ${count}...`);
        setProgress(i);

        let bgB64 = null;
        const scenePrompt = scene || "professional sales leader in a modern office";
        try {
          const prompt = buildImagePrompt(scenePrompt, style, !!expertPhoto);
          const refImages = [];
          if (expertPhoto) refImages.push({ base64: expertPhoto.base64, mimeType: expertPhoto.mimeType });
          if (style.isLibre && libreRef) refImages.push({ base64: libreRef.base64, mimeType: libreRef.mimeType });
          bgB64 = await geminiImage(prompt, refImages, apiKey);
        } catch (err) {
          console.warn(`Slide ${i + 1} image failed:`, err);
        }

        const dataUrl = await renderSlide(canvas, bgB64, text, i, count, keyword, selectedStyle);
        results.push({ dataUrl, bgB64, failed: !bgB64 });
        setImages([...results]);
      }
      setProgress(count);
      const fails = results.filter((r) => r.failed).length;
      setStatus(fails ? `Listo — ${fails} imagen${fails > 1 ? "es" : ""} sin generar` : "¡Carrusel listo!");
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  }, [parsed, count, keyword, style, selectedStyle, expertPhoto, buildImagePrompt, apiKey, libreRef]);

  const retrySlide = useCallback(async (si) => {
    if (!parsed[si]) return;
    setGenerating(true);
    setStatus(`Reintentando slide ${si + 1}...`);
    const canvas = canvasRef.current || document.createElement("canvas");
    const { scene, text } = parsed[si];

    try {
      const prompt = buildImagePrompt(scene || "professional in office", style, !!expertPhoto);
      const prompt = buildImagePrompt(scene || "professional in office", style, !!expertPhoto);
      const refImages = [];
      if (expertPhoto) refImages.push({ base64: expertPhoto.base64, mimeType: expertPhoto.mimeType });
      if (style.isLibre && libreRef) refImages.push({ base64: libreRef.base64, mimeType: libreRef.mimeType });
      const bgB64 = await geminiImage(prompt, refImages, apiKey);
      const dataUrl = await renderSlide(canvas, bgB64, text, si, count, keyword, selectedStyle);
      const u = [...images];
      u[si] = { dataUrl, bgB64, failed: false };
      setImages(u);
      setStatus("¡Slide regenerado!");
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  }, [parsed, count, keyword, style, selectedStyle, expertPhoto, images, buildImagePrompt, apiKey, libreRef]);

  const downloadZip = useCallback(() => {
    const f = images.map((img, i) => ({
      name: `slide_${String(i + 1).padStart(2, "0")}.png`,
      data: b64u8(img.dataUrl.split(",")[1]),
    }));
    const z = createZip(f);
    const u = URL.createObjectURL(new Blob([z], { type: "application/zip" }));
    const a = document.createElement("a");
    a.href = u;
    a.download = `carrusel_${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(u);
  }, [images]);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #080808 0%, #0d0d15 40%, #0a0812 100%)", color: "#e8e0d0", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* Header */}
      <header style={{ padding: "28px 40px 22px", borderBottom: "1px solid rgba(212,168,83,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 42, height: 42, background: "linear-gradient(135deg, #d4a853, #8a6d2b)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: "bold", color: "#0a0a0a" }}>C</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#d4a853", letterSpacing: 1 }}>CAROUSEL STUDIO</h1>
            <p style={{ margin: 0, fontSize: 12, color: "#8a7a5a", letterSpacing: 3, textTransform: "uppercase" }}>Generador de carruseles con IA</p>
          </div>
        </div>
      </header>

      <div style={{ display: "flex", minHeight: "calc(100vh - 92px)" }}>
        {/* LEFT */}
        <div style={{ width: 440, padding: "28px", borderRight: "1px solid rgba(212,168,83,0.1)", overflowY: "auto", flexShrink: 0 }}>

          {/* API Key */}
          <label style={lbl}>🔑 API Key — Gemini</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Pegá tu API Key de Google AI Studio"
              style={{ ...inp, fontSize: 13, flex: 1 }}
            />
            <button
              onClick={() => setShowKey(!showKey)}
              style={{ padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,168,83,0.2)", borderRadius: 8, color: "#8a7a5a", fontSize: 13, cursor: "pointer", flexShrink: 0 }}
            >{showKey ? "🙈" : "👁"}</button>
          </div>
          <p style={{ margin: "0 0 20px", fontSize: 11, color: "#5a5040", lineHeight: 1.5 }}>
            Obtenela gratis en <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" style={{ color: "#d4a853", textDecoration: "none" }}>aistudio.google.com</a> → Get API Key
          </p>

          {/* Expert */}
          <label style={lbl}>Foto del experto <span style={{ fontSize: 11, color: "#6a5f48", textTransform: "none", letterSpacing: 0 }}>(opcional)</span></label>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, padding: 14, background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(212,168,83,0.25)", borderRadius: 10 }}>
            {expertPhoto ? (
              <>
                <div style={{ width: 60, height: 60, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(212,168,83,0.4)", flexShrink: 0 }}>
                  <img src={expertPhoto.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, color: "#c9b99a" }}>Foto cargada</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6a5f48" }}>Aparecerá como personaje en cada slide</p>
                </div>
                <button onClick={() => { setExpertPhoto(null); if (fileRef.current) fileRef.current.value = ""; }} style={{ padding: "6px 12px", background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.3)", borderRadius: 6, color: "#ff6b6b", fontSize: 12, cursor: "pointer" }}>✕</button>
              </>
            ) : (
              <div onClick={() => fileRef.current?.click()} style={{ flex: 1, textAlign: "center", cursor: "pointer", padding: "8px 0" }}>
                <div style={{ fontSize: 28, marginBottom: 4, opacity: 0.5 }}>📷</div>
                <p style={{ margin: 0, fontSize: 14, color: "#8a7a5a" }}>Click para subir foto</p>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "#5a5040" }}>El experto será el personaje principal</p>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUpload} style={{ display: "none" }} />
          </div>

          {/* Slides */}
          <label style={lbl}>Contenido de los slides</label>
          <div style={{ marginBottom: 8, padding: "10px 14px", background: "rgba(212,168,83,0.04)", border: "1px solid rgba(212,168,83,0.12)", borderRadius: 8, fontSize: 12, color: "#8a7a5a", lineHeight: 1.6 }}>
            <strong style={{ color: "#a89870" }}>Formato por slide:</strong><br />
            <span style={{ color: "#d4a853" }}>ESCENA:</span> qué se ve en la imagen (prompt para la IA)<br />
            <span style={{ color: "#d4a853" }}>TEXTO:</span> texto exacto que va encima<br />
            Separá slides con <strong style={{ color: "#a89870" }}>---</strong>
          </div>
          <textarea
            value={slideText}
            onChange={(e) => setSlideText(e.target.value)}
            placeholder={`ESCENA: el experto frustrado mirando gráficos que bajan en una pantalla
TEXTO: ¿Tu equipo no cierra ventas?
El problema no son ellos...
---
ESCENA: el experto señalando una pizarra con estadísticas
TEXTO: El 67% de los vendedores renuncia por mal liderazgo
No es el sueldo. Es cómo los tratan.
---
ESCENA: el experto con brazos cruzados mirando a cámara, seguro
TEXTO: ¿Querés la solución completa?`}
            rows={14}
            style={{ ...inp, padding: "14px 16px", resize: "vertical", lineHeight: 1.7, fontSize: 14 }}
          />

          <div style={{ marginTop: 8, fontSize: 13, color: count >= 2 ? "#6abf6a" : count === 0 ? "#6a5f48" : "#e85555", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: count >= 2 ? "#6abf6a" : count === 0 ? "#4a4535" : "#e85555" }} />
            {count === 0 ? "Escribí el contenido" : `${count} slide${count !== 1 ? "s" : ""} detectado${count !== 1 ? "s" : ""}${count < 2 ? " — mínimo 2" : ""}`}
          </div>

          {/* Keyword */}
          <div style={{ marginTop: 18 }}>
            <label style={lbl}>Palabra clave CTA <span style={{ fontSize: 11, color: "#6a5f48", textTransform: "none", letterSpacing: 0 }}>(opcional)</span></label>
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Ej: CLASE" style={inp} />
          </div>

          {/* Style */}
          <label style={{ ...lbl, marginTop: 22, marginBottom: 10 }}>Estilo visual</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {IMAGE_STYLES.map((s) => (
              <div key={s.id} style={{ position: "relative" }}>
                <button onClick={() => { setSelectedStyle(s.id); if (s.id !== "libre") { setLibreRef(null); if (libreFileRef.current) libreFileRef.current.value = ""; } }} style={{
                  width: "100%", padding: "14px 10px",
                  background: selectedStyle === s.id ? "rgba(212,168,83,0.15)" : "rgba(255,255,255,0.03)",
                  border: selectedStyle === s.id ? "2px solid rgba(212,168,83,0.5)" : "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10, cursor: "pointer", color: "#e8e0d0", fontSize: 14, fontFamily: "inherit",
                  transition: "all 0.2s", fontWeight: selectedStyle === s.id ? 600 : 400,
                }}>
                  {s.name}
                </button>
                {s.id === "before_after" && (
                  <span
                    onMouseEnter={() => setTooltipVisible(true)}
                    onMouseLeave={() => setTooltipVisible(false)}
                    style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "rgba(212,168,83,0.3)", border: "1px solid rgba(212,168,83,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#d4a853", cursor: "help", fontWeight: 700 }}
                  >?
                    {tooltipVisible && (
                      <div style={{ position: "absolute", bottom: 28, right: -10, width: 280, padding: "14px 16px", background: "#1a1a2e", border: "1px solid rgba(212,168,83,0.3)", borderRadius: 10, fontSize: 12, color: "#c9b99a", lineHeight: 1.6, zIndex: 100, boxShadow: "0 8px 30px rgba(0,0,0,0.5)", textAlign: "left", fontWeight: 400 }}>
                        <strong style={{ color: "#d4a853", display: "block", marginBottom: 6 }}>Formato Antes/Después</strong>
                        En <strong style={{ color: "#e8e0d0" }}>ESCENA:</strong> describí ambos paneles:<br/>
                        <span style={{ color: "#8a7a5a" }}>"Arriba: equipo desmotivado, oficina oscura. Abajo: equipo celebrando, oficina moderna"</span><br/><br/>
                        En <strong style={{ color: "#e8e0d0" }}>TEXTO:</strong> la primera línea va en el panel de arriba y el resto en el de abajo:<br/>
                        <span style={{ color: "#8a7a5a" }}>Sin proceso de ventas<br/>Con proceso: equipo que factura x3</span><br/><br/>
                        💡 <strong>Tip:</strong> Usá contrastes fuertes (oscuro vs claro, fracaso vs éxito) para mayor impacto.
                      </div>
                    )}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Libre: style reference upload */}
          {selectedStyle === "libre" && (
            <div style={{ marginTop: 12, padding: 14, background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(212,168,83,0.25)", borderRadius: 10 }}>
              {libreRef ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 8, overflow: "hidden", border: "2px solid rgba(212,168,83,0.3)", flexShrink: 0 }}>
                    <img src={libreRef.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 13, color: "#c9b99a" }}>Imagen de referencia cargada</p>
                    <p style={{ margin: "3px 0 0", fontSize: 11, color: "#6a5f48" }}>La IA copiará este estilo visual</p>
                  </div>
                  <button onClick={() => { setLibreRef(null); if (libreFileRef.current) libreFileRef.current.value = ""; }} style={{ padding: "4px 10px", background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.3)", borderRadius: 6, color: "#ff6b6b", fontSize: 11, cursor: "pointer" }}>✕</button>
                </div>
              ) : (
                <div onClick={() => libreFileRef.current?.click()} style={{ textAlign: "center", cursor: "pointer", padding: "4px 0" }}>
                  <span style={{ fontSize: 24, opacity: 0.5 }}>🖼️</span>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "#8a7a5a" }}>Subí una imagen de ejemplo</p>
                  <p style={{ margin: "3px 0 0", fontSize: 11, color: "#5a5040" }}>La IA replicará el estilo visual de esta imagen</p>
                </div>
              )}
              <input ref={libreFileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={async (e) => {
                const f = e.target.files?.[0]; if (!f) return;
                setLibreRef({ base64: await fileToBase64(f), mimeType: f.type, preview: URL.createObjectURL(f) });
              }} style={{ display: "none" }} />
            </div>
          )}

          {expertPhoto && (
            <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(212,168,83,0.06)", border: "1px solid rgba(212,168,83,0.15)", borderRadius: 8, fontSize: 12, color: "#a89870" }}>
              💡 El experto se integrará en estilo <strong style={{ color: "#d4a853" }}>{style.name}</strong>
            </div>
          )}

          {/* Generate */}
          <button onClick={generate} disabled={generating || count < 2 || !apiKey.trim()} style={{
            width: "100%", marginTop: 22, padding: "16px",
            background: generating ? "rgba(212,168,83,0.2)" : "linear-gradient(135deg, #d4a853, #a88230)",
            border: "none", borderRadius: 10, color: generating ? "#a89870" : "#0a0a0a",
            fontSize: 16, fontWeight: 700, cursor: generating ? "not-allowed" : "pointer",
            letterSpacing: 1, textTransform: "uppercase", transition: "all 0.3s",
          }}>
            {generating ? "Generando..." : `Generar ${count} Slides`}
          </button>

          {generating && (
            <div style={{ marginTop: 18 }}>
              <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", background: "linear-gradient(90deg, #d4a853, #e8c468)", width: totalSteps ? `${(progress / totalSteps) * 100}%` : "0%", transition: "width 0.5s ease", borderRadius: 2 }} />
              </div>
              <p style={{ marginTop: 10, fontSize: 13, color: "#8a7a5a" }}>{status}</p>
            </div>
          )}
          {!generating && status && (
            <p style={{ marginTop: 14, fontSize: 13, color: status.startsWith("Error") ? "#e85555" : status.includes("sin") ? "#e8a849" : "#6abf6a" }}>{status}</p>
          )}
        </div>

        {/* RIGHT */}
        <div style={{ flex: 1, padding: "28px 40px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          {images.length === 0 && !generating && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#4a4535", textAlign: "center", maxWidth: 420 }}>
              <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.3 }}>🎨</div>
              <p style={{ fontSize: 18, margin: 0 }}>Tu carrusel aparecerá aquí</p>
              <p style={{ fontSize: 14, marginTop: 10, color: "#3a3525", lineHeight: 1.6 }}>
                Usá <strong style={{ color: "#8a7a5a" }}>ESCENA:</strong> para el prompt visual y <strong style={{ color: "#8a7a5a" }}>TEXTO:</strong> para lo que va encima. Separá con <strong style={{ color: "#8a7a5a" }}>---</strong>
              </p>
            </div>
          )}

          {images.length > 0 && (
            <>
              <div style={{ width: "100%", maxWidth: 520, aspectRatio: "1", borderRadius: 12, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(212,168,83,0.1)" }}>
                <img src={images[idx]?.dataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 20 }}>
                <button onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0} style={{ padding: "8px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(212,168,83,0.2)", borderRadius: 6, color: "#d4a853", cursor: idx === 0 ? "not-allowed" : "pointer", fontSize: 18, opacity: idx === 0 ? 0.3 : 1 }}>←</button>
                <span style={{ fontSize: 14, color: "#8a7a5a", minWidth: 80, textAlign: "center" }}>{idx + 1} / {images.length}</span>
                <button onClick={() => setIdx(Math.min(images.length - 1, idx + 1))} disabled={idx === images.length - 1} style={{ padding: "8px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(212,168,83,0.2)", borderRadius: 6, color: "#d4a853", cursor: idx === images.length - 1 ? "not-allowed" : "pointer", fontSize: 18, opacity: idx === images.length - 1 ? 0.3 : 1 }}>→</button>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap", justifyContent: "center" }}>
                {images.map((img, i) => (
                  <button key={i} onClick={() => setIdx(i)} style={{
                    width: 60, height: 60, padding: 0,
                    border: idx === i ? "2px solid #d4a853" : img.failed ? "2px solid rgba(232,168,73,0.3)" : "2px solid rgba(255,255,255,0.08)",
                    borderRadius: 8, overflow: "hidden", cursor: "pointer",
                    opacity: idx === i ? 1 : 0.6, transition: "all 0.2s", background: "none",
                  }}>
                    <img src={img.dataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap", justifyContent: "center" }}>
                <button onClick={downloadZip} style={{ padding: "14px 32px", background: "linear-gradient(135deg, #d4a853, #a88230)", border: "none", borderRadius: 8, color: "#0a0a0a", fontSize: 15, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5 }}>⬇ Descargar ZIP</button>
                <button onClick={() => retrySlide(idx)} disabled={generating} style={{ padding: "14px 24px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(212,168,83,0.3)", borderRadius: 8, color: "#d4a853", fontSize: 15, cursor: "pointer" }}>🔄 Regenerar slide {idx + 1}</button>
              </div>
            </>
          )}
        </div>
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}
