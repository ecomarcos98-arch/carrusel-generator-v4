import { useState, useRef, useCallback } from "react";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const IMAGE_MODEL = "gemini-2.5-flash-preview-04-17";

// ─── Formats ─────────────────────────────────────────────────────────

const FORMATS = [
  {
    id: "versus",
    name: "⚔️ Versus",
    desc: "Dos paneles con contraste (arriba/abajo)",
    fields: [
      { key: "topScene", label: "Panel de arriba (escena)", placeholder: "Ej: hombre frustrado viendo TV con noticias negativas, ambiente oscuro" },
      { key: "topText", label: "Texto panel arriba", placeholder: "Ej: Hay malas noticias por todas partes." },
      { key: "bottomScene", label: "Panel de abajo (escena)", placeholder: "Ej: el mismo hombre tranquilo leyendo un libro, luz natural" },
      { key: "bottomText", label: "Texto panel abajo", placeholder: "Ej: Yo elijo lo que consumo." },
    ],
    buildPrompt: (f, expert) => {
      const expertNote = expert ? "The same person from the reference photo must appear in BOTH panels, preserving their exact facial features." : "The same character must appear in both panels.";
      return {
        scene: `Create a square image divided into two horizontal panels (top and bottom), each taking exactly half the image. TOP PANEL: ${f.topScene || "negative scene"}. Dark, tense atmosphere with cold colors. BOTTOM PANEL: ${f.bottomScene || "positive scene"}. Bright, positive atmosphere with warm colors. ${expertNote} There should be a clear thin dividing line between panels. Photorealistic, cinematic lighting. Do NOT include any text, words, or letters in the image.`,
        text: f.topText && f.bottomText ? `${f.topText}\n---SPLIT---\n${f.bottomText}` : f.topText || f.bottomText || "",
        layout: "versus",
      };
    },
  },
  {
    id: "before_after",
    name: "🔄 Antes y Después",
    desc: "Transformación con contraste",
    fields: [
      { key: "beforeScene", label: "ANTES (escena)", placeholder: "Ej: equipo de ventas desmotivado, oficina desordenada, gráficos bajando" },
      { key: "beforeText", label: "Texto ANTES", placeholder: "Ej: Antes: sin proceso de ventas" },
      { key: "afterScene", label: "DESPUÉS (escena)", placeholder: "Ej: equipo celebrando, oficina moderna, gráficos subiendo" },
      { key: "afterText", label: "Texto DESPUÉS", placeholder: "Ej: Después: equipo que factura x3" },
    ],
    buildPrompt: (f, expert) => {
      const expertNote = expert ? "The same person from the reference photo must appear in BOTH panels." : "The same character appears in both.";
      return {
        scene: `Create a square image divided into two horizontal panels (top and bottom). TOP PANEL labeled "ANTES": ${f.beforeScene || "negative before state"}. Desaturated, gloomy atmosphere. BOTTOM PANEL labeled "DESPUÉS": ${f.afterScene || "positive after state"}. Vibrant, successful atmosphere. ${expertNote} Clear dividing line between panels. Photorealistic, cinematic. Do NOT include any text or words in the image.`,
        text: f.beforeText && f.afterText ? `${f.beforeText}\n---SPLIT---\n${f.afterText}` : f.beforeText || f.afterText || "",
        layout: "versus",
      };
    },
  },
  {
    id: "meme",
    name: "😂 Meme",
    desc: "Formato meme con texto arriba/abajo",
    fields: [
      { key: "scene", label: "Escena / Reacción", placeholder: "Ej: el experto con cara de sorpresa mirando su celular" },
      { key: "topText", label: "Texto arriba", placeholder: 'Ej: Cuando tu mejor vendedor te dice "me voy"' },
      { key: "bottomText", label: "Texto abajo", placeholder: "Ej: Y te das cuenta que no tenés proceso de retención" },
    ],
    buildPrompt: (f, expert) => {
      const expertNote = expert ? "The main character must look exactly like the person in the reference photo." : "";
      return {
        scene: `Create a square image showing: ${f.scene || "expressive person reacting"}. ${expertNote} The character should have a very expressive face and clear body language that conveys emotion. Photorealistic or slightly stylized, meme-worthy composition. Cinematic lighting. Leave clear space at the top and bottom of the image for text overlay. Do NOT include any text or words in the image.`,
        text: f.topText && f.bottomText ? `${f.topText}\n---MEME---\n${f.bottomText}` : f.topText || f.bottomText || "",
        layout: "meme",
      };
    },
  },
  {
    id: "quote",
    name: "💬 Cita / Quote",
    desc: "Frase destacada sobre fondo visual",
    fields: [
      { key: "scene", label: "Fondo / Ambiente", placeholder: "Ej: el experto de pie mirando por un ventanal hacia la ciudad de noche" },
      { key: "quote", label: "La frase / cita", placeholder: 'Ej: "El líder que no entrena a su equipo, entrena a su competencia."' },
      { key: "attribution", label: "Atribución (opcional)", placeholder: "Ej: — César Jorquera" },
    ],
    buildPrompt: (f, expert) => {
      const expertNote = expert ? "The person from the reference photo should appear in the scene, preserving their facial features." : "";
      return {
        scene: `Create a square image: ${f.scene || "inspirational atmospheric background"}. ${expertNote} Dark, moody, cinematic atmosphere with dramatic lighting. The composition should have a clear area (preferably center or lower third) where text can be overlaid readably. Photorealistic. Do NOT include any text, words, quotes, or letters in the image.`,
        text: f.quote ? (f.attribution ? `${f.quote}\n${f.attribution}` : f.quote) : "",
        layout: "quote",
      };
    },
  },
  {
    id: "simple",
    name: "🎬 Escena Simple",
    desc: "Un panel con el experto en acción",
    fields: [
      { key: "scene", label: "Descripción de la escena", placeholder: "Ej: el experto hablando con confianza frente a un equipo de ventas en una sala de reuniones moderna" },
      { key: "title", label: "Título", placeholder: "Ej: Los 3 errores que matan tus ventas" },
      { key: "body", label: "Texto secundario (opcional)", placeholder: "Ej: Y cómo solucionarlos hoy mismo" },
    ],
    buildPrompt: (f, expert) => {
      const expertNote = expert ? "The main character must look exactly like the person in the reference photo, preserving exact facial features and likeness." : "";
      return {
        scene: `Create a square image: ${f.scene || "professional in a modern office"}. ${expertNote} Photorealistic, cinematic lighting, dark moody atmosphere. The lower portion of the image should be slightly darker to allow text overlay. Do NOT include any text, words, or letters in the image.`,
        text: f.title ? (f.body ? `${f.title}\n${f.body}` : f.title) : "",
        layout: "simple",
      };
    },
  },
];

// ─── API ─────────────────────────────────────────────────────────────

async function geminiImage(prompt, refBase64, refMime) {
  const parts = [];
  if (refBase64) parts.push({ inlineData: { mimeType: refMime || "image/jpeg", data: refBase64 } });
  parts.push({ text: prompt });
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ["IMAGE","TEXT"], imageMimeType: "image/png" } }) }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const ip = (data.candidates?.[0]?.content?.parts||[]).find(p=>p.inlineData);
  if (!ip) throw new Error("No image generated");
  return ip.inlineData.data;
}

function fileToBase64(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });
}

// ─── Canvas Text Rendering ──────────────────────────────────────────

function loadImg(src) { return new Promise((res,rej) => { const i = new Image(); i.crossOrigin="anonymous"; i.onload=()=>res(i); i.onerror=rej; i.src=src; }); }

function wrap(ctx, text, maxW) {
  const words = text.split(" "), lines = []; let cur = "";
  for (const w of words) { const t = cur ? cur+" "+w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}

async function renderSlide(canvas, bgB64, textContent, layout, slideIdx, total, keyword) {
  const ctx = canvas.getContext("2d");
  const W = 1080, H = 1080;
  canvas.width = W; canvas.height = H;

  // Background
  if (bgB64) {
    try {
      const img = await loadImg("data:image/png;base64," + bgB64);
      const sc = Math.max(W/img.width, H/img.height);
      ctx.drawImage(img, (W-img.width*sc)/2, (H-img.height*sc)/2, img.width*sc, img.height*sc);
    } catch { ctx.fillStyle="#0a0a0a"; ctx.fillRect(0,0,W,H); }
  } else { ctx.fillStyle="#0a0a0a"; ctx.fillRect(0,0,W,H); }

  if (!textContent) return canvas.toDataURL("image/png");

  const pad = 50;
  const maxW = W - pad*2 - 20;

  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  if (layout === "versus" && textContent.includes("---SPLIT---")) {
    // ─── VERSUS / BEFORE-AFTER ───
    const [topTxt, bottomTxt] = textContent.split("---SPLIT---").map(s=>s.trim());

    // Top text - white on dark pill
    if (topTxt) {
      ctx.font = "bold 36px 'Segoe UI', sans-serif";
      const tLines = wrap(ctx, topTxt, maxW - 40);
      const tH = tLines.length * 48;
      const tY = H * 0.25 - tH/2;

      // Background pill
      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.beginPath(); ctx.roundRect(pad, tY - 16, W - pad*2, tH + 32, 12); ctx.fill();
      ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 10;

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      tLines.forEach((l,i) => ctx.fillText(l, W/2, tY + 26 + i*48));
    }

    // Bottom text
    if (bottomTxt) {
      ctx.font = "bold 36px 'Segoe UI', sans-serif";
      const bLines = wrap(ctx, bottomTxt, maxW - 40);
      const bH = bLines.length * 48;
      const bY = H * 0.75 - bH/2;

      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.beginPath(); ctx.roundRect(pad, bY - 16, W - pad*2, bH + 32, 12); ctx.fill();
      ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 10;

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      bLines.forEach((l,i) => ctx.fillText(l, W/2, bY + 26 + i*48));
    }

  } else if (layout === "meme" && textContent.includes("---MEME---")) {
    // ─── MEME ───
    const [topTxt, bottomTxt] = textContent.split("---MEME---").map(s=>s.trim());

    ctx.textAlign = "center";
    ctx.font = "bold 40px 'Segoe UI', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 4;

    if (topTxt) {
      const tLines = wrap(ctx, topTxt.toUpperCase(), maxW);
      tLines.forEach((l,i) => {
        const y = 60 + i * 50;
        ctx.strokeText(l, W/2, y);
        ctx.fillText(l, W/2, y);
      });
    }
    if (bottomTxt) {
      const bLines = wrap(ctx, bottomTxt.toUpperCase(), maxW);
      const startY = H - 30 - (bLines.length - 1) * 50;
      bLines.forEach((l,i) => {
        const y = startY + i * 50;
        ctx.strokeText(l, W/2, y);
        ctx.fillText(l, W/2, y);
      });
    }

  } else if (layout === "quote") {
    // ─── QUOTE ───
    const lines = textContent.split("\n").filter(Boolean);
    const quote = lines[0] || "";
    const attr = lines[1] || "";

    // Dark overlay for readability
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
    const grd = ctx.createLinearGradient(0, H*0.3, 0, H);
    grd.addColorStop(0, "rgba(0,0,0,0.0)");
    grd.addColorStop(0.3, "rgba(0,0,0,0.6)");
    grd.addColorStop(1, "rgba(0,0,0,0.8)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, H*0.3, W, H*0.7);
    ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 10;

    // Quote mark
    ctx.fillStyle = "#d4a853";
    ctx.font = "bold 120px Georgia, serif";
    ctx.textAlign = "left";
    ctx.fillText("\u201C", pad, H * 0.52);

    // Quote text
    ctx.font = "italic 38px Georgia, serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    const qLines = wrap(ctx, quote, maxW - 30);
    qLines.forEach((l,i) => ctx.fillText(l, pad + 20, H * 0.56 + i * 52));

    // Attribution
    if (attr) {
      ctx.font = "bold 26px 'Segoe UI', sans-serif";
      ctx.fillStyle = "#d4a853";
      ctx.fillText(attr, pad + 20, H * 0.56 + qLines.length * 52 + 20);
    }

  } else {
    // ─── SIMPLE / DEFAULT ───
    const lines = textContent.split("\n").filter(Boolean);
    const title = lines[0] || "";
    const body = lines.slice(1).join(" ");

    // Gradient overlay at bottom
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
    const grd = ctx.createLinearGradient(0, H*0.45, 0, H);
    grd.addColorStop(0, "rgba(0,0,0,0.0)");
    grd.addColorStop(0.25, "rgba(0,0,0,0.65)");
    grd.addColorStop(1, "rgba(0,0,0,0.88)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, H*0.45, W, H*0.55);
    ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 10;

    // Accent line
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#d4a853";
    ctx.fillRect(pad, H*0.68, 50, 3);
    ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 10;

    // Title
    ctx.textAlign = "left";
    ctx.font = "bold 46px 'Segoe UI', sans-serif";
    ctx.fillStyle = "#ffffff";
    const tLines = wrap(ctx, title, maxW);
    let y = H * 0.71;
    tLines.forEach((l,i) => { ctx.fillText(l, pad + 4, y + i*56); });
    y += tLines.length * 56 + 10;

    // Body
    if (body) {
      ctx.font = "30px 'Segoe UI', sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      const bLines = wrap(ctx, body, maxW);
      bLines.forEach((l,i) => ctx.fillText(l, pad + 4, y + i*42));
      y += bLines.length * 42 + 10;
    }

    // CTA keyword
    const isLast = slideIdx === total - 1;
    if (isLast && keyword) {
      y += 8;
      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
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

  // Reset
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

  // Slide counter
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "bold 18px 'Segoe UI', sans-serif";
  ctx.fillText(`${slideIdx+1}/${total}`, W-24, 28);

  return canvas.toDataURL("image/png");
}

// ─── ZIP ─────────────────────────────────────────────────────────────
function createZip(files){const L=[],C=[];let o=0;for(const f of files){const n=new TextEncoder().encode(f.name),d=f.data,l=new Uint8Array(30+n.length+d.length),v=new DataView(l.buffer);v.setUint32(0,0x04034b50,1);v.setUint16(4,20,1);v.setUint16(6,0,1);v.setUint16(8,0,1);v.setUint16(10,0,1);v.setUint16(12,0,1);v.setUint32(14,0,1);v.setUint32(18,d.length,1);v.setUint32(22,d.length,1);v.setUint16(26,n.length,1);v.setUint16(28,0,1);l.set(n,30);l.set(d,30+n.length);L.push(l);const c=new Uint8Array(46+n.length),w=new DataView(c.buffer);w.setUint32(0,0x02014b50,1);w.setUint16(4,20,1);w.setUint16(6,20,1);w.setUint16(8,0,1);w.setUint16(10,0,1);w.setUint16(12,0,1);w.setUint16(14,0,1);w.setUint32(16,0,1);w.setUint32(20,d.length,1);w.setUint32(24,d.length,1);w.setUint16(28,n.length,1);w.setUint16(30,0,1);w.setUint16(32,0,1);w.setUint16(34,0,1);w.setUint16(36,0,1);w.setUint32(38,0,1);w.setUint32(42,o,1);c.set(n,46);C.push(c);o+=l.length;}const s=C.reduce((a,c)=>a+c.length,0),e=new Uint8Array(22),ev=new DataView(e.buffer);ev.setUint32(0,0x06054b50,1);ev.setUint16(4,0,1);ev.setUint16(6,0,1);ev.setUint16(8,files.length,1);ev.setUint16(10,files.length,1);ev.setUint32(12,s,1);ev.setUint32(16,o,1);ev.setUint16(20,0,1);const z=new Uint8Array(o+s+22);let p=0;for(const l of L){z.set(l,p);p+=l.length;}for(const c of C){z.set(c,p);p+=c.length;}z.set(e,p);return z;}
function b64u8(b){const n=atob(b),a=new Uint8Array(n.length);for(let i=0;i<n.length;i++)a[i]=n.charCodeAt(i);return a;}

// ─── Styles ──────────────────────────────────────────────────────────
const lbl={display:"block",marginBottom:6,fontSize:12,color:"#a89870",textTransform:"uppercase",letterSpacing:1.5};
const inp={width:"100%",padding:"10px 12px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(212,168,83,0.2)",borderRadius:8,color:"#e8e0d0",fontSize:14,fontFamily:"inherit",outline:"none",boxSizing:"border-box"};

// ─── App ─────────────────────────────────────────────────────────────
export default function App() {
  const [slides, setSlides] = useState([{ formatId: "simple", fields: {} }]);
  const [keyword, setKeyword] = useState("");
  const [expertPhoto, setExpertPhoto] = useState(null);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [images, setImages] = useState([]);
  const [idx, setIdx] = useState(0);
  const [generating, setGenerating] = useState(false);
  const canvasRef = useRef(null);
  const fileRef = useRef(null);

  const addSlide = () => setSlides([...slides, { formatId: "simple", fields: {} }]);
  const removeSlide = (i) => { if (slides.length > 1) setSlides(slides.filter((_,j)=>j!==i)); };
  const updateSlide = (i, key, val) => {
    const s = [...slides];
    if (key === "formatId") s[i] = { formatId: val, fields: {} };
    else { s[i] = { ...s[i], fields: { ...s[i].fields, [key]: val } }; }
    setSlides(s);
  };

  const generate = useCallback(async () => {
    if (slides.length < 1) return;
    setGenerating(true); setImages([]); setIdx(0);
    setTotal(slides.length); setProgress(0);
    const canvas = canvasRef.current || document.createElement("canvas");
    canvasRef.current = canvas;
    const results = [];

    try {
      for (let i = 0; i < slides.length; i++) {
        setStatus(`Generando slide ${i+1} de ${slides.length}...`);
        setProgress(i);
        const s = slides[i];
        const fmt = FORMATS.find(f=>f.id===s.formatId);
        const built = fmt.buildPrompt(s.fields, !!expertPhoto);
        let bgB64 = null;
        try {
          bgB64 = await geminiImage(built.scene, expertPhoto?.base64||null, expertPhoto?.mimeType||null);
        } catch(e) { console.warn(`Slide ${i+1} image failed:`, e); }
        const dataUrl = await renderSlide(canvas, bgB64, built.text, built.layout, i, slides.length, keyword);
        results.push({ dataUrl, bgB64, layout: built.layout, failed: !bgB64 });
        setImages([...results]);
      }
      setProgress(slides.length);
      const fails = results.filter(r=>r.failed).length;
      setStatus(fails ? `Listo — ${fails} sin imagen (fondo oscuro)` : "¡Carrusel listo!");
    } catch(e) { setStatus(`Error: ${e.message}`); }
    finally { setGenerating(false); }
  }, [slides, keyword, expertPhoto]);

  const retrySlide = useCallback(async (si) => {
    setGenerating(true); setStatus(`Reintentando slide ${si+1}...`);
    const canvas = canvasRef.current || document.createElement("canvas");
    const s = slides[si];
    const fmt = FORMATS.find(f=>f.id===s.formatId);
    const built = fmt.buildPrompt(s.fields, !!expertPhoto);
    try {
      const bgB64 = await geminiImage(built.scene, expertPhoto?.base64||null, expertPhoto?.mimeType||null);
      const dataUrl = await renderSlide(canvas, bgB64, built.text, built.layout, si, slides.length, keyword);
      const u = [...images]; u[si] = { dataUrl, bgB64, layout: built.layout, failed: false }; setImages(u);
      setStatus("¡Slide regenerado!");
    } catch(e) { setStatus(`Error: ${e.message}`); }
    finally { setGenerating(false); }
  }, [slides, keyword, expertPhoto, images]);

  const downloadZip = useCallback(() => {
    const f = images.map((img,i)=>({ name:`slide_${String(i+1).padStart(2,"0")}.png`, data:b64u8(img.dataUrl.split(",")[1]) }));
    const z = createZip(f);
    const u = URL.createObjectURL(new Blob([z],{type:"application/zip"}));
    const a = document.createElement("a"); a.href=u; a.download=`carrusel_${Date.now()}.zip`; a.click(); URL.revokeObjectURL(u);
  }, [images]);

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(160deg, #080808 0%, #0d0d15 40%, #0a0812 100%)", color:"#e8e0d0", fontFamily:"'Segoe UI', system-ui, sans-serif" }}>
      <header style={{ padding:"24px 36px 20px", borderBottom:"1px solid rgba(212,168,83,0.15)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:40, height:40, background:"linear-gradient(135deg, #d4a853, #8a6d2b)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:"bold", color:"#0a0a0a" }}>C</div>
          <div>
            <h1 style={{ margin:0, fontSize:20, fontWeight:700, color:"#d4a853", letterSpacing:1 }}>CAROUSEL STUDIO</h1>
            <p style={{ margin:0, fontSize:11, color:"#8a7a5a", letterSpacing:3, textTransform:"uppercase" }}>Generador de carruseles con IA</p>
          </div>
        </div>
      </header>

      <div style={{ display:"flex", minHeight:"calc(100vh - 84px)" }}>
        {/* LEFT */}
        <div style={{ width:460, padding:"24px", borderRight:"1px solid rgba(212,168,83,0.1)", overflowY:"auto", flexShrink:0 }}>

          {/* Expert */}
          <label style={lbl}>Foto del experto <span style={{ textTransform:"none", letterSpacing:0, color:"#5a5040" }}>(opcional)</span></label>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:18, padding:12, background:"rgba(255,255,255,0.02)", border:"1px dashed rgba(212,168,83,0.2)", borderRadius:10 }}>
            {expertPhoto ? (
              <>
                <div style={{ width:52, height:52, borderRadius:"50%", overflow:"hidden", border:"2px solid rgba(212,168,83,0.4)", flexShrink:0 }}>
                  <img src={expertPhoto.preview} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ margin:0, fontSize:13, color:"#c9b99a" }}>Foto cargada</p>
                </div>
                <button onClick={()=>{setExpertPhoto(null);if(fileRef.current)fileRef.current.value="";}} style={{ padding:"4px 10px", background:"rgba(255,80,80,0.1)", border:"1px solid rgba(255,80,80,0.3)", borderRadius:6, color:"#ff6b6b", fontSize:11, cursor:"pointer" }}>✕</button>
              </>
            ) : (
              <div onClick={()=>fileRef.current?.click()} style={{ flex:1, textAlign:"center", cursor:"pointer", padding:"6px 0" }}>
                <span style={{ fontSize:24, opacity:0.5 }}>📷</span>
                <p style={{ margin:"4px 0 0", fontSize:13, color:"#8a7a5a" }}>Click para subir foto</p>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={async(e)=>{const f=e.target.files?.[0];if(!f)return;setExpertPhoto({base64:await fileToBase64(f),mimeType:f.type,preview:URL.createObjectURL(f)});}} style={{ display:"none" }} />
          </div>

          {/* Keyword */}
          <div style={{ marginBottom:18 }}>
            <label style={lbl}>Palabra clave CTA <span style={{ textTransform:"none", letterSpacing:0, color:"#5a5040" }}>(opcional — aparece en el último slide)</span></label>
            <input value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="Ej: CLASE" style={inp} />
          </div>

          {/* Slides */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <label style={{ ...lbl, margin:0 }}>Slides ({slides.length})</label>
            <button onClick={addSlide} style={{ padding:"6px 14px", background:"rgba(212,168,83,0.12)", border:"1px solid rgba(212,168,83,0.3)", borderRadius:6, color:"#d4a853", fontSize:13, cursor:"pointer", fontWeight:600 }}>+ Agregar slide</button>
          </div>

          {slides.map((slide, si) => {
            const fmt = FORMATS.find(f=>f.id===slide.formatId);
            return (
              <div key={si} style={{ marginBottom:14, padding:16, background:"rgba(255,255,255,0.02)", border:"1px solid rgba(212,168,83,0.12)", borderRadius:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:"#d4a853" }}>Slide {si+1}</span>
                  {slides.length > 1 && (
                    <button onClick={()=>removeSlide(si)} style={{ padding:"2px 8px", background:"none", border:"1px solid rgba(255,80,80,0.25)", borderRadius:4, color:"#ff6b6b", fontSize:11, cursor:"pointer" }}>✕</button>
                  )}
                </div>

                {/* Format selector */}
                <div style={{ display:"flex", gap:4, marginBottom:12, flexWrap:"wrap" }}>
                  {FORMATS.map(f => (
                    <button key={f.id} onClick={()=>updateSlide(si,"formatId",f.id)} style={{
                      padding:"6px 10px", fontSize:12,
                      background: slide.formatId===f.id ? "rgba(212,168,83,0.18)" : "rgba(255,255,255,0.03)",
                      border: slide.formatId===f.id ? "1px solid rgba(212,168,83,0.5)" : "1px solid rgba(255,255,255,0.06)",
                      borderRadius:6, cursor:"pointer", color:"#e8e0d0", fontFamily:"inherit",
                      fontWeight: slide.formatId===f.id ? 600 : 400,
                    }}>{f.name}</button>
                  ))}
                </div>

                {/* Dynamic fields */}
                {fmt.fields.map(field => (
                  <div key={field.key} style={{ marginBottom:8 }}>
                    <label style={{ display:"block", fontSize:11, color:"#8a7a5a", marginBottom:4 }}>{field.label}</label>
                    {field.key.includes("Scene") || field.key === "scene" ? (
                      <textarea
                        value={slide.fields[field.key]||""}
                        onChange={e=>updateSlide(si, field.key, e.target.value)}
                        placeholder={field.placeholder}
                        rows={2}
                        style={{ ...inp, fontSize:13, resize:"vertical", lineHeight:1.5 }}
                      />
                    ) : (
                      <input
                        value={slide.fields[field.key]||""}
                        onChange={e=>updateSlide(si, field.key, e.target.value)}
                        placeholder={field.placeholder}
                        style={{ ...inp, fontSize:13 }}
                      />
                    )}
                  </div>
                ))}
              </div>
            );
          })}

          {/* Generate */}
          <button onClick={generate} disabled={generating || slides.length < 1} style={{
            width:"100%", marginTop:8, padding:"16px",
            background: generating ? "rgba(212,168,83,0.2)" : "linear-gradient(135deg, #d4a853, #a88230)",
            border:"none", borderRadius:10, color: generating ? "#a89870" : "#0a0a0a",
            fontSize:16, fontWeight:700, cursor: generating ? "not-allowed" : "pointer",
            letterSpacing:1, textTransform:"uppercase",
          }}>{generating ? "Generando..." : `Generar ${slides.length} Slides`}</button>

          {generating && (
            <div style={{ marginTop:16 }}>
              <div style={{ height:4, background:"rgba(255,255,255,0.06)", borderRadius:2, overflow:"hidden" }}>
                <div style={{ height:"100%", background:"linear-gradient(90deg, #d4a853, #e8c468)", width: total?`${(progress/total)*100}%`:"0%", transition:"width 0.5s", borderRadius:2 }} />
              </div>
              <p style={{ marginTop:8, fontSize:12, color:"#8a7a5a" }}>{status}</p>
            </div>
          )}
          {!generating && status && <p style={{ marginTop:12, fontSize:12, color: status.includes("Error")?"#e85555":status.includes("sin")?"#e8a849":"#6abf6a" }}>{status}</p>}
        </div>

        {/* RIGHT */}
        <div style={{ flex:1, padding:"24px 36px", display:"flex", flexDirection:"column", alignItems:"center" }}>
          {images.length===0 && !generating && (
            <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"#4a4535", textAlign:"center", maxWidth:400 }}>
              <div style={{ fontSize:52, marginBottom:14, opacity:0.3 }}>🎨</div>
              <p style={{ fontSize:17, margin:0 }}>Tu carrusel aparecerá aquí</p>
              <p style={{ fontSize:13, marginTop:8, color:"#3a3525", lineHeight:1.5 }}>Agregá slides, elegí el formato de cada uno y hacé click en Generar</p>
            </div>
          )}

          {images.length > 0 && (
            <>
              <div style={{ width:"100%", maxWidth:500, aspectRatio:"1", borderRadius:12, overflow:"hidden", boxShadow:"0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(212,168,83,0.1)" }}>
                <img src={images[idx]?.dataUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
              </div>

              <div style={{ display:"flex", alignItems:"center", gap:14, marginTop:18 }}>
                <button onClick={()=>setIdx(Math.max(0,idx-1))} disabled={idx===0} style={{ padding:"6px 14px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(212,168,83,0.2)", borderRadius:6, color:"#d4a853", cursor:idx===0?"not-allowed":"pointer", fontSize:16, opacity:idx===0?0.3:1 }}>←</button>
                <span style={{ fontSize:13, color:"#8a7a5a", minWidth:70, textAlign:"center" }}>{idx+1} / {images.length}</span>
                <button onClick={()=>setIdx(Math.min(images.length-1,idx+1))} disabled={idx===images.length-1} style={{ padding:"6px 14px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(212,168,83,0.2)", borderRadius:6, color:"#d4a853", cursor:idx===images.length-1?"not-allowed":"pointer", fontSize:16, opacity:idx===images.length-1?0.3:1 }}>→</button>
              </div>

              <div style={{ display:"flex", gap:6, marginTop:14, flexWrap:"wrap", justifyContent:"center" }}>
                {images.map((img,i) => (
                  <button key={i} onClick={()=>setIdx(i)} style={{ width:54, height:54, padding:0, border:idx===i?"2px solid #d4a853":img.failed?"2px solid rgba(232,168,73,0.3)":"2px solid rgba(255,255,255,0.08)", borderRadius:6, overflow:"hidden", cursor:"pointer", opacity:idx===i?1:0.55, background:"none" }}>
                    <img src={img.dataUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
                  </button>
                ))}
              </div>

              <div style={{ display:"flex", gap:10, marginTop:20, flexWrap:"wrap", justifyContent:"center" }}>
                <button onClick={downloadZip} style={{ padding:"12px 28px", background:"linear-gradient(135deg, #d4a853, #a88230)", border:"none", borderRadius:8, color:"#0a0a0a", fontSize:14, fontWeight:700, cursor:"pointer" }}>⬇ Descargar ZIP</button>
                <button onClick={()=>retrySlide(idx)} disabled={generating} style={{ padding:"12px 20px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(212,168,83,0.3)", borderRadius:8, color:"#d4a853", fontSize:14, cursor:"pointer" }}>🔄 Regenerar slide {idx+1}</button>
              </div>
            </>
          )}
        </div>
      </div>
      <canvas ref={canvasRef} style={{ display:"none" }} />
    </div>
  );
}
