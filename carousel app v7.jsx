import { useState, useRef, useCallback, useEffect } from "react";

// ============================================================
// NANO BANANO CAROUSEL GENERATOR
// Full-stack Instagram carousel generator using Gemini 2.5 Flash
// ============================================================

// --- UTILITY: Convert file to base64 ---
const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// --- UTILITY: Download a single image ---
const downloadImage = (dataUrl, filename) => {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// --- UTILITY: Download all as ZIP using JSZip from CDN ---
const downloadAllAsZip = async (slides) => {
  const script = document.createElement("script");
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
  document.head.appendChild(script);
  await new Promise((r) => (script.onload = r));
  const zip = new window.JSZip();
  slides.forEach((s, i) => {
    const base64 = s.imageData.split(",")[1] || s.imageData;
    zip.file(`slide_${i + 1}.png`, base64, { base64: true });
  });
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  downloadImage(url, "carousel_nano_banano.zip");
  URL.revokeObjectURL(url);
};

// --- TEXT SANITIZER: Strips markdown, special chars, and formatting artifacts ---
const sanitizeText = (raw) => {
  return raw
    .replace(/\*\*|__/g, "")           // Remove bold markdown
    .replace(/\*|_/g, "")              // Remove italic markdown
    .replace(/^[-–—•]\s*/gm, "")       // Remove bullet dashes
    .replace(/^#{1,6}\s*/gm, "")       // Remove markdown headers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [link text](url) → link text
    .replace(/`/g, "")                 // Remove backticks
    .replace(/\n{3,}/g, "\n\n")        // Collapse excessive newlines
    .trim();
};

// --- REGEX EXTRACTOR: Pulls Texto: and Escena: fields if present ---
const extractFields = (block) => {
  const textoMatch = block.match(/(?:texto|text)\s*:\s*(.+?)(?=(?:escena|scene|contexto|context|estilo|style)\s*:|$)/is);
  const escenaMatch = block.match(/(?:escena|scene)\s*:\s*(.+?)(?=(?:texto|text|contexto|context|estilo|style)\s*:|$)/is);

  if (textoMatch) {
    // Structured format detected — extract only tagged fields
    return {
      displayText: sanitizeText(textoMatch[1].trim()),
      sceneOverride: escenaMatch ? sanitizeText(escenaMatch[1].trim()) : null,
    };
  }

  // No structured tags — treat the whole block as display text
  return {
    displayText: sanitizeText(block.trim()),
    sceneOverride: null,
  };
};

// --- SCRIPT PROCESSOR: Splits the script into narrative segments ---
const processScript = (rawScript, numSlides, keyword) => {
  // Split by double newlines, numbered lines, or "Slide" markers
  const lines = rawScript
    .split(/\n{2,}|(?=^(?:slide|diapositiva|\d+[\.\)\-])\s)/im)
    .map((l) => l.trim())
    .filter(Boolean);

  const segments = [];

  if (lines.length >= numSlides) {
    for (let i = 0; i < numSlides; i++) {
      segments.push(lines[i]);
    }
  } else {
    const words = sanitizeText(rawScript).split(/\s+/);
    const perSlide = Math.ceil(words.length / numSlides);
    for (let i = 0; i < numSlides; i++) {
      segments.push(words.slice(i * perSlide, (i + 1) * perSlide).join(" "));
    }
  }

  // Tag each segment with its narrative role + extract clean text
  return segments.map((rawBlock, i) => {
    const { displayText, sceneOverride } = extractFields(rawBlock);
    let role, placement, sceneHint;

    if (i === 0) {
      role = "HOOK";
      placement = "CENTER";
      sceneHint = "dramatic close-up of the expert looking directly at camera with intense lighting, bold energy";
    } else if (i === numSlides - 1) {
      role = "CTA";
      placement = "CENTER";
      sceneHint = "expert pointing at camera or gesturing invitingly, bright and clean background";
    } else if (i <= Math.floor(numSlides / 2)) {
      role = "PROBLEM";
      placement = "BOTTOM";
      sceneHint = "expert with serious/concerned expression, slightly moody atmospheric lighting";
    } else {
      role = "SOLUTION";
      placement = "TOP";
      sceneHint = "expert smiling confidently, bright uplifting lighting, professional setting";
    }

    // Use scene override from structured input if available
    if (sceneOverride) sceneHint = sceneOverride;

    // Append CTA keyword if missing on last slide
    let finalText = displayText;
    if (role === "CTA" && !finalText.includes(keyword)) {
      finalText = `${finalText}\n\nComenta "${keyword}"`;
    }

    return { index: i, role, text: finalText, placement, sceneHint };
  });
};

// --- STYLE PRESETS ---
const STYLES = {
  modern: {
    label: "Moderno Profesional",
    prompt: "Clean, modern professional marketing design. Soft gradient background, high-end corporate aesthetic, sleek minimalist composition with premium feel. Professional studio lighting.",
  },
  comic: {
    label: "Cómic Retro",
    prompt: "Retro comic book pop-art style with halftone dots, bold black outlines, saturated primary colors, speech bubbles aesthetic, vintage 60s comic book feel with Ben-Day dots.",
  },
  cinematic: {
    label: "Cinematográfico",
    prompt: "Cinematic movie poster style. Dramatic chiaroscuro lighting, film grain, anamorphic lens flare, deep shadows, epic blockbuster movie aesthetic, teal and orange color grading.",
  },
  neon: {
    label: "Neon Futurista",
    prompt: "Futuristic neon cyberpunk aesthetic. Glowing neon lights, dark background with vibrant pink/cyan/purple neon accents, holographic elements, tech-forward digital feel.",
  },
};

// ============================================================
// BUILD THE PROMPT FOR EACH SLIDE (NANO BANANO / GEMINI FLASH)
// ARCHITECTURE: Scene/style instructions are BACKGROUND context.
// The ONLY text to render is isolated inside RENDER_TEXT quotes.
// This prevents Nano Banano from "reading instructions aloud".
// ============================================================
const buildSlidePrompt = (segment, style, totalSlides) => {
  const stylePrompt = STYLES[style]?.prompt || STYLES.modern.prompt;

  // Sanitize the display text one final time for the API
  const cleanText = segment.text
    .replace(/[\r\n]+/g, " ")   // Flatten to single line for rendering
    .replace(/\s{2,}/g, " ")    // Collapse double spaces
    .trim();

  return `Generate a 1080x1080 square Instagram slide image.

[VISUAL COMPOSITION — DO NOT RENDER AS TEXT]
Scene: ${segment.sceneHint}
Style: ${stylePrompt}
The person in the image must look identical to the reference photo provided. Same face, hair, skin, features.

[TEXT RENDERING — THIS IS THE ONLY TEXT THAT GOES ON THE IMAGE]
RENDER_TEXT: "${cleanText}"
Place this text at the ${segment.placement} of the image.
Use bold, clean, high-contrast sans-serif typography with a subtle dark overlay behind it for legibility.

STRICT RULES:
- ONLY render the exact text inside the RENDER_TEXT quotes above.
- Do NOT render any words from the Visual Composition section onto the image.
- Do NOT render the words "RENDER_TEXT", "Scene", "Style", or any instruction labels.
- Do NOT add slide numbers, counters, pagination like "1/5" or "2/5", or any numbering.
- Text must be large enough to read on a phone screen.
- Letters must be perfectly formed and correctly spelled.
- The result must look like a premium Instagram marketing carousel slide.`;
};

// ============================================================
// API CALLER: Sends request to Gemini 2.5 Flash (Nano Banano)
// Uses the reference image for identity consistency per slide
// ============================================================
const generateSlide = async (apiKey, referenceImageBase64, segment, style, totalSlides, model) => {
  const prompt = buildSlidePrompt(segment, style, totalSlides);

  const requestBody = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: referenceImageBase64,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  };

  // Use the selected model for the API call
  const modelId = model || "gemini-2.5-flash-image";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API Error (${response.status}): ${err}`);
  }

  const data = await response.json();

  // Extract the generated image from response
  const candidates = data.candidates || [];
  for (const candidate of candidates) {
    const parts = candidate.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
  }

  throw new Error("No image returned from Nano Banano. The model may not have generated an image for this prompt.");
};

// ============================================================
// MAIN APPLICATION COMPONENT
// ============================================================
export default function NanoBananoCarousel() {
  const [apiKey, setApiKey] = useState("");
  const [expertPhoto, setExpertPhoto] = useState(null);
  const [expertPreview, setExpertPreview] = useState(null);
  const [keyword, setKeyword] = useState("");
  const [numSlides, setNumSlides] = useState(5);
  const [script, setScript] = useState("");
  const [style, setStyle] = useState("modern");
  const [model, setModel] = useState("gemini-2.5-flash-image");
  const [slides, setSlides] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [totalToGenerate, setTotalToGenerate] = useState(0);
  const [error, setError] = useState("");
  const [log, setLog] = useState([]);
  const fileInputRef = useRef(null);
  const cancelRef = useRef(false);

  const addLog = useCallback((msg) => {
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const handleCancel = () => {
    cancelRef.current = true;
    setGenerating(false);
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ⛔ Generación cancelada por el usuario.`]);
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setExpertPhoto(file);
      const url = URL.createObjectURL(file);
      setExpertPreview(url);
    }
  };

  const handleGenerate = async () => {
    setError("");
    setLog([]);
    setSlides([]);

    // Validation
    if (!apiKey.trim()) return setError("Ingresa tu API Key de Google AI Studio.");
    if (!expertPhoto) return setError("Sube la foto del experto.");
    if (!keyword.trim()) return setError("Ingresa la palabra clave del CTA.");
    if (!script.trim()) return setError("Pega el guion del carrusel.");

    setGenerating(true);
    setTotalToGenerate(numSlides);
    setCurrentSlide(0);
    cancelRef.current = false;

    try {
      addLog("Codificando imagen de referencia en Base64...");
      const base64Image = await fileToBase64(expertPhoto);

      addLog(`Procesando guion en ${numSlides} segmentos narrativos...`);
      const segments = processScript(script, numSlides, keyword);

      segments.forEach((seg, i) => {
        addLog(`  Slide ${i + 1}: [${seg.role}] "${seg.text.substring(0, 50)}..."`);
      });

      // Generate slides sequentially to avoid rate limits
      for (let i = 0; i < segments.length; i++) {
        // Check if user cancelled
        if (cancelRef.current) break;

        setCurrentSlide(i + 1);
        addLog(`Generando Slide ${i + 1}/${numSlides} (${segments[i].role})...`);

        try {
          const imageData = await generateSlide(apiKey, base64Image, segments[i], style, numSlides, model);
          if (cancelRef.current) break;
          setSlides((prev) => [
            ...prev,
            {
              index: i,
              role: segments[i].role,
              text: segments[i].text,
              imageData,
            },
          ]);
          addLog(`✓ Slide ${i + 1} generado exitosamente.`);
        } catch (err) {
          if (cancelRef.current) break;
          addLog(`✗ Error en Slide ${i + 1}: ${err.message}`);
          setSlides((prev) => [
            ...prev,
            { index: i, role: segments[i].role, text: segments[i].text, imageData: null, error: err.message },
          ]);
        }

        // Small delay between calls to respect rate limits
        if (i < segments.length - 1 && !cancelRef.current) {
          addLog("Esperando 2s antes de la siguiente llamada...");
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      if (!cancelRef.current) addLog("¡Generación completa!");
    } catch (err) {
      setError(err.message);
      addLog(`ERROR FATAL: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const completedSlides = slides.filter((s) => s.imageData);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(145deg, #0a0a0f 0%, #12121f 40%, #0d1117 100%)",
        color: "#e4e4e7",
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: "1px solid rgba(139, 92, 246, 0.2)",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "rgba(139, 92, 246, 0.03)",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            fontWeight: 800,
          }}
        >
          🍌
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>
            Nano Banano <span style={{ color: "#8b5cf6" }}>Carousel Generator</span>
          </h1>
          <p style={{ margin: 0, fontSize: 11, color: "#71717a", letterSpacing: "0.05em" }}>
            GEMINI 2.5 FLASH · IMAGE GENERATION · INSTAGRAM CAROUSELS
          </p>
        </div>
      </div>

      <div style={{ display: "flex", minHeight: "calc(100vh - 69px)" }}>
        {/* ============ LEFT PANEL: CONFIGURATION ============ */}
        <div
          style={{
            width: 380,
            minWidth: 380,
            borderRight: "1px solid rgba(139, 92, 246, 0.15)",
            padding: 20,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* API Key */}
          <FieldGroup label="API Key" sublabel="Google AI Studio">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIza..."
              style={inputStyle}
            />
          </FieldGroup>

          {/* Model Selector */}
          <FieldGroup label="Modelo" sublabel="Nano Banano version">
            <select value={model} onChange={(e) => setModel(e.target.value)} style={inputStyle}>
              <option value="gemini-2.5-flash-image">🍌 Nano Banana (gemini-2.5-flash-image)</option>
              <option value="gemini-3.1-flash-image-preview">🍌2 Nano Banana 2 (gemini-3.1-flash-image-preview)</option>
              <option value="gemini-3-pro-image-preview">🍌 Pro (gemini-3-pro-image-preview)</option>
            </select>
          </FieldGroup>

          {/* Expert Photo Upload */}
          <FieldGroup label="Foto del Experto" sublabel="Referencia de identidad para todos los slides">
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: "2px dashed rgba(139, 92, 246, 0.3)",
                borderRadius: 12,
                padding: expertPreview ? 0 : 24,
                textAlign: "center",
                cursor: "pointer",
                overflow: "hidden",
                transition: "border-color 0.2s",
                background: "rgba(139, 92, 246, 0.05)",
                position: "relative",
              }}
            >
              {expertPreview ? (
                <img
                  src={expertPreview}
                  alt="Expert"
                  style={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }}
                />
              ) : (
                <>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📸</div>
                  <div style={{ fontSize: 13, color: "#71717a" }}>Click para subir imagen</div>
                  <div style={{ fontSize: 11, color: "#52525b", marginTop: 4 }}>JPG, PNG • Max 10MB</div>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                style={{ display: "none" }}
              />
            </div>
          </FieldGroup>

          {/* Keyword + Number of slides row */}
          <div style={{ display: "flex", gap: 12 }}>
            <FieldGroup label="Palabra Clave" sublabel="Para el CTA final" style={{ flex: 1 }}>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Ej: GRATIS"
                style={inputStyle}
              />
            </FieldGroup>
            <FieldGroup label="Slides" sublabel="Cantidad" style={{ width: 90 }}>
              <select value={numSlides} onChange={(e) => setNumSlides(Number(e.target.value))} style={inputStyle}>
                {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </FieldGroup>
          </div>

          {/* Visual Style */}
          <FieldGroup label="Estilo Visual" sublabel="Estética base de los slides">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {Object.entries(STYLES).map(([key, { label }]) => (
                <button
                  key={key}
                  onClick={() => setStyle(key)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: style === key ? "2px solid #8b5cf6" : "1px solid rgba(255,255,255,0.08)",
                    background: style === key ? "rgba(139, 92, 246, 0.15)" : "rgba(255,255,255,0.03)",
                    color: style === key ? "#c4b5fd" : "#a1a1aa",
                    fontSize: 12,
                    fontWeight: style === key ? 600 : 400,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    textAlign: "left",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </FieldGroup>

          {/* Script */}
          <FieldGroup label="Guion del Carrusel" sublabel="El texto completo a distribuir en los slides">
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder={`Slide 1: ¿Sabías que el 90% de los negocios fracasan en el primer año?\n\nSlide 2: El problema es que nadie te enseña a vender...\n\nSlide 3: Con nuestro método probado vas a...\n\nSlide 4: Más de 500 alumnos ya lo lograron...\n\nSlide 5: Comenta GRATIS y te envío la guía completa`}
              rows={8}
              style={{ ...inputStyle, resize: "vertical", minHeight: 140, lineHeight: 1.5 }}
            />
          </FieldGroup>

          {/* Generate + Cancel Buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={generating ? handleCancel : handleGenerate}
              style={{
                flex: 1,
                padding: "14px 20px",
                borderRadius: 12,
                border: "none",
                background: generating
                  ? "rgba(139, 92, 246, 0.3)"
                  : "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: "0.02em",
                transition: "all 0.2s",
                boxShadow: generating ? "none" : "0 4px 20px rgba(139, 92, 246, 0.3)",
              }}
            >
              {generating ? `Generando Slide ${currentSlide}/${totalToGenerate}...` : "🍌 Generar Carrusel Maestro"}
            </button>
            {generating && (
              <button
                onClick={handleCancel}
                style={{
                  padding: "14px 16px",
                  borderRadius: 12,
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  background: "rgba(239, 68, 68, 0.15)",
                  color: "#f87171",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  whiteSpace: "nowrap",
                }}
              >
                ✕ Cancelar
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 12,
                color: "#fca5a5",
              }}
            >
              {error}
            </div>
          )}

          {/* Progress Log */}
          {log.length > 0 && (
            <FieldGroup label="Log de Generación">
              <div
                style={{
                  background: "rgba(0,0,0,0.4)",
                  borderRadius: 8,
                  padding: 12,
                  maxHeight: 180,
                  overflowY: "auto",
                  fontSize: 11,
                  fontFamily: "'SF Mono', 'Fira Code', monospace",
                  lineHeight: 1.7,
                  color: "#a1a1aa",
                }}
              >
                {log.map((l, i) => (
                  <div key={i} style={{ color: l.includes("✓") ? "#4ade80" : l.includes("✗") ? "#f87171" : "#a1a1aa" }}>
                    {l}
                  </div>
                ))}
              </div>
            </FieldGroup>
          )}
        </div>

        {/* ============ RIGHT PANEL: SLIDE VIEWER ============ */}
        <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
          {slides.length === 0 && !generating ? (
            <EmptyState />
          ) : (
            <>
              {/* Download All */}
              {completedSlides.length > 1 && (
                <div style={{ marginBottom: 20, display: "flex", justifyContent: "flex-end" }}>
                  <button onClick={() => downloadAllAsZip(completedSlides)} style={secondaryBtnStyle}>
                    📦 Descargar Todo (ZIP)
                  </button>
                </div>
              )}

              {/* Slides Grid — compact layout, 3 per row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                  gap: 12,
                }}
              >
                {slides.map((slide, i) => (
                  <SlideCard key={i} slide={slide} />
                ))}

                {/* Placeholder for slides being generated */}
                {generating &&
                  Array.from({ length: totalToGenerate - slides.length }).map((_, i) => (
                    <div
                      key={`placeholder-${i}`}
                      style={{
                        aspectRatio: "1",
                        borderRadius: 8,
                        border: "1px dashed rgba(139, 92, 246, 0.2)",
                        background: "rgba(139, 92, 246, 0.03)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          border: "2px solid rgba(139, 92, 246, 0.15)",
                          borderTopColor: "#8b5cf6",
                          borderRadius: "50%",
                          animation: "spin 1s linear infinite",
                        }}
                      />
                      <span style={{ fontSize: 10, color: "#52525b" }}>
                        S{slides.length + i + 1}
                      </span>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Spinner keyframes */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        input::placeholder, textarea::placeholder { color: #52525b; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.2); border-radius: 3px; }
      `}</style>
    </div>
  );
}

// ============ SUB-COMPONENTS ============

function FieldGroup({ label, sublabel, children, style: wrapperStyle }) {
  return (
    <div style={wrapperStyle}>
      <label style={{ display: "block", marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#d4d4d8" }}>{label}</span>
        {sublabel && <span style={{ fontSize: 11, color: "#52525b", marginLeft: 8 }}>{sublabel}</span>}
      </label>
      {children}
    </div>
  );
}

function SlideCard({ slide }) {
  return (
    <div
      style={{
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid rgba(139, 92, 246, 0.15)",
        background: "rgba(255,255,255,0.02)",
        animation: "fadeIn 0.4s ease",
      }}
    >
      {/* Slide header — compact */}
      <div
        style={{
          padding: "4px 8px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(139, 92, 246, 0.06)",
          borderBottom: "1px solid rgba(139, 92, 246, 0.1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: "1px 6px",
              borderRadius: 3,
              background:
                slide.role === "HOOK"
                  ? "rgba(234, 179, 8, 0.2)"
                  : slide.role === "CTA"
                  ? "rgba(34, 197, 94, 0.2)"
                  : slide.role === "PROBLEM"
                  ? "rgba(239, 68, 68, 0.2)"
                  : "rgba(59, 130, 246, 0.2)",
              color:
                slide.role === "HOOK"
                  ? "#fbbf24"
                  : slide.role === "CTA"
                  ? "#4ade80"
                  : slide.role === "PROBLEM"
                  ? "#f87171"
                  : "#60a5fa",
              letterSpacing: "0.06em",
            }}
          >
            {slide.role}
          </span>
          <span style={{ fontSize: 10, color: "#71717a" }}>S{slide.index + 1}</span>
        </div>
        {slide.imageData && (
          <button
            onClick={() => downloadImage(slide.imageData, `slide_${slide.index + 1}.png`)}
            style={{
              background: "none",
              border: "1px solid rgba(139, 92, 246, 0.3)",
              borderRadius: 4,
              padding: "2px 6px",
              fontSize: 9,
              color: "#8b5cf6",
              cursor: "pointer",
            }}
          >
            ↓
          </button>
        )}
      </div>

      {/* Slide content */}
      {slide.imageData ? (
        <img src={slide.imageData} alt={`Slide ${slide.index + 1}`} style={{ width: "100%", display: "block" }} />
      ) : slide.error ? (
        <div
          style={{
            aspectRatio: "1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 12,
            textAlign: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 20, marginBottom: 4 }}>⚠️</div>
            <div style={{ fontSize: 10, color: "#f87171", lineHeight: 1.4 }}>{slide.error}</div>
          </div>
        </div>
      ) : null}

      {/* Text preview — compact */}
      <div
        style={{
          padding: "4px 8px",
          fontSize: 9,
          color: "#71717a",
          borderTop: "1px solid rgba(255,255,255,0.04)",
          lineHeight: 1.3,
          maxHeight: 36,
          overflow: "hidden",
        }}
      >
        {slide.text?.substring(0, 80)}
        {slide.text?.length > 80 ? "..." : ""}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: 40,
        opacity: 0.6,
      }}
    >
      <div style={{ fontSize: 56, marginBottom: 16 }}>🍌</div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: "#d4d4d8" }}>
        Tu carrusel te espera
      </h2>
      <p style={{ fontSize: 13, color: "#71717a", maxWidth: 360, lineHeight: 1.6 }}>
        Configura los parámetros a la izquierda: sube la foto del experto, pega tu guion y presiona
        "Generar Carrusel Maestro" para que Nano Banano haga su magia.
      </p>
      <div
        style={{
          marginTop: 24,
          display: "flex",
          gap: 20,
          fontSize: 11,
          color: "#52525b",
        }}
      >
        <div>
          <div style={{ fontSize: 20, marginBottom: 4 }}>📸</div>
          Sube foto
        </div>
        <div style={{ color: "#3f3f46" }}>→</div>
        <div>
          <div style={{ fontSize: 20, marginBottom: 4 }}>📝</div>
          Pega guion
        </div>
        <div style={{ color: "#3f3f46" }}>→</div>
        <div>
          <div style={{ fontSize: 20, marginBottom: 4 }}>🎨</div>
          Genera slides
        </div>
      </div>
    </div>
  );
}

// ============ SHARED STYLES ============

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  color: "#e4e4e7",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.2s",
};

const secondaryBtnStyle = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "1px solid rgba(139, 92, 246, 0.3)",
  background: "rgba(139, 92, 246, 0.1)",
  color: "#c4b5fd",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
