import React, { useState, useEffect, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import toast from 'react-hot-toast';

export default function PosterStudioModal({ song, token, apiBaseUrl, onClose, onSaveSuccess }) {
  // Mode & Aspect Ratio
  const [aspectRatio, setAspectRatio] = useState('9:16'); // '9:16' (Story/Status) or '1:1' (Square/Feed)
  
  // AI Generated fields & edits (load from pre-saved poster_meta if available)
  const [lyricTamil, setLyricTamil] = useState(song?.poster_meta?.lyric_tamil || '');
  const [lyricTanglish, setLyricTanglish] = useState(song?.poster_meta?.lyric_tanglish || '');
  const [movieHint, setMovieHint] = useState(song?.poster_meta?.movie_hint || '');
  const [artworkPrompt, setArtworkPrompt] = useState(song?.poster_meta?.artwork_prompt || '');
  const [backgroundImageBase64, setBackgroundImageBase64] = useState(song?.poster_meta?.backgroundImageBase64 || null);
  
  // Customization & Style controls
  const [activeLyricLanguage, setActiveLyricLanguage] = useState(song?.poster_meta?.activeLyricLanguage || 'tamil');
  const [overlayStyle, setOverlayStyle] = useState(song?.poster_meta?.overlayStyle || 'warm');
  const [darknessOpacity, setDarknessOpacity] = useState(song?.poster_meta?.darknessOpacity ?? 0.45);
  const [showQrCode, setShowQrCode] = useState(song?.poster_meta?.showQrCode ?? true);
  const [showHint, setShowHint] = useState(song?.poster_meta?.showHint ?? true);
  const [showWebsiteBadge, setShowWebsiteBadge] = useState(song?.poster_meta?.showWebsiteBadge ?? true);
  const [fontSizeRatio, setFontSizeRatio] = useState(song?.poster_meta?.fontSizeRatio ?? 1);

  // Loading states
  const [isGeneratingCue, setIsGeneratingCue] = useState(false);
  const [isGeneratingArt, setIsGeneratingArt] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSavedPoster, setHasSavedPoster] = useState(!!song?.poster_meta?.savedAt);

  // Hidden/Offscreen Canvas reference for rendering & export
  const canvasRef = useRef(null);
  const qrCanvasRef = useRef(null);

  const WEBSITE_URL = 'https://music.uforiansports.com';

  // 1. Initial AI Cue Generation (only auto-fetch if no saved meta exists)
  const generateCue = async (force = false) => {
    if (!song) return;
    if (!force && (song?.poster_meta?.lyric_tamil || song?.poster_meta?.artwork_prompt)) {
      // Already has saved meta
      return;
    }

    setIsGeneratingCue(true);
    try {
      const res = await fetch(`${apiBaseUrl}/admin/generate-poster-cue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: song.title,
          movie: song.movie,
          director: song.director,
          lyrics: song.plain_lyrics || song.synced_lyrics_tamil || song.synced_lyrics_tanglish || ''
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate poster cue');

      setLyricTamil(data.lyric_tamil || '');
      setLyricTanglish(data.lyric_tanglish || '');
      setMovieHint(data.movie_hint || '');
      setArtworkPrompt(data.artwork_prompt || '');

      toast.success('Generated lyrics cue & movie hint!');

      // Automatically generate artwork if no background exists
      if (!backgroundImageBase64 && data.artwork_prompt) {
        generateArtwork(data.artwork_prompt);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Error generating cue');
    } finally {
      setIsGeneratingCue(false);
    }
  };

  // 2. AI Artwork Generation
  const generateArtwork = async (promptToUse) => {
    const prompt = promptToUse || artworkPrompt;
    if (!prompt) {
      toast.error('Artwork prompt is required');
      return;
    }
    setIsGeneratingArt(true);
    try {
      const res = await fetch(`${apiBaseUrl}/admin/generate-poster-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate artwork');

      setBackgroundImageBase64(`data:${data.mimeType || 'image/png'};base64,${data.imageBase64}`);
      toast.success('AI Poster Artwork Generated!');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Error generating artwork');
    } finally {
      setIsGeneratingArt(false);
    }
  };

  // Run on mount
  useEffect(() => {
    if (song?.poster_meta?.savedAt && !backgroundImageBase64 && song?.id) {
      setIsGeneratingArt(true);
      fetch(`${apiBaseUrl}/admin/generate-poster-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'get_saved', songId: song.id })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.imageBase64) {
          setBackgroundImageBase64(data.imageBase64);
        }
      })
      .catch(err => console.warn('Could not load saved poster image:', err))
      .finally(() => setIsGeneratingArt(false));
    } else {
      generateCue(false);
    }
  }, [song?.id]);

  // 3. Canvas Rendering Engine
  useEffect(() => {
    renderCanvas();
  }, [
    aspectRatio,
    lyricTamil,
    lyricTanglish,
    movieHint,
    activeLyricLanguage,
    backgroundImageBase64,
    darknessOpacity,
    overlayStyle,
    showQrCode,
    showHint,
    showWebsiteBadge,
    fontSizeRatio
  ]);

  const renderCanvas = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Dimensions
    const width = 1080;
    const height = aspectRatio === '9:16' ? 1920 : 1080;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // 1. Draw Base Background (Gradient fallback or AI Image)
    if (backgroundImageBase64) {
      try {
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = (err) => reject(err);
          img.src = backgroundImageBase64;
          if (img.complete) resolve();
        });

        // Cover fill aspect ratio
        const scale = Math.max(width / img.width, height / img.height);
        const x = (width - img.width * scale) / 2;
        const y = (height - img.height * scale) / 2;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      } catch (e) {
        console.warn('Could not draw image, falling back to gradient', e);
        drawGradientFallback(ctx, width, height, overlayStyle);
      }
    } else {
      drawGradientFallback(ctx, width, height, overlayStyle);
    }

    // 2. Cinematic Vignette & Dark Overlay for Text Readability
    ctx.fillStyle = `rgba(0, 0, 0, ${darknessOpacity})`;
    ctx.fillRect(0, 0, width, height);

    // Top and Bottom gradient shadows for contrast
    const gradTop = ctx.createLinearGradient(0, 0, 0, height * 0.25);
    gradTop.addColorStop(0, 'rgba(0,0,0,0.85)');
    gradTop.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradTop;
    ctx.fillRect(0, 0, width, height * 0.25);

    const gradBottom = ctx.createLinearGradient(0, height * 0.65, 0, height);
    gradBottom.addColorStop(0, 'rgba(0,0,0,0)');
    gradBottom.addColorStop(1, 'rgba(0,0,0,0.92)');
    ctx.fillStyle = gradBottom;
    ctx.fillRect(0, height * 0.65, width, height * 0.35);

    // 3. Top Header: App Branding & Badge
    ctx.save();
    ctx.textAlign = 'center';
    
    // Header Tag
    ctx.fillStyle = '#f59e0b'; // Amber-500
    ctx.font = '600 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
    const topMargin = aspectRatio === '9:16' ? 140 : 100;
    ctx.fillText('ILAIYARAAJA  •  SONG OF THE DAY', width / 2, topMargin);

    // Song Title
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${Math.round(52 * fontSizeRatio)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';
    const titleY = topMargin + 70;
    ctx.fillText(song?.title || 'Song of the Day', width / 2, titleY);

    // Subtle divider
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 80, titleY + 30);
    ctx.lineTo(width / 2 + 80, titleY + 30);
    ctx.stroke();

    // 4. Center: Evocative Lyric Quote
    const lyricText = activeLyricLanguage === 'tamil' ? lyricTamil : (lyricTanglish || lyricTamil);
    if (lyricText) {
      const lyricFontSize = Math.round((aspectRatio === '9:16' ? 44 : 36) * fontSizeRatio);
      
      // Decorative quotation mark
      ctx.fillStyle = 'rgba(245, 158, 11, 0.6)';
      ctx.font = `700 ${lyricFontSize * 2}px serif`;
      const quoteCenterY = aspectRatio === '9:16' ? height * 0.44 : height * 0.40;
      ctx.fillText('“', width / 2, quoteCenterY - 40);

      // Render lyric lines
      ctx.fillStyle = '#fef3c7'; // warm creamy amber
      ctx.font = `italic 600 ${lyricFontSize}px -apple-system, BlinkMacSystemFont, "Mukta Malar", "Anek Tamil", Roboto, serif`;
      
      const lines = wrapText(ctx, lyricText, width - 200);
      const lineHeight = lyricFontSize * 1.5;
      const startY = quoteCenterY - ((lines.length - 1) * lineHeight) / 2;

      lines.forEach((line, i) => {
        ctx.fillText(line, width / 2, startY + i * lineHeight);
      });
    }

    // 5. Lower Middle: Movie Riddle / Hint (Strictly NO movie title!)
    if (showHint && movieHint) {
      const hintY = aspectRatio === '9:16' ? height * 0.68 : height * 0.64;
      
      // Rounded translucent pill for hint
      const hintFontSize = Math.round(26 * fontSizeRatio);
      ctx.font = `500 ${hintFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      
      const hintLines = wrapText(ctx, `💡 Movie Riddle: "${movieHint}"`, width - 240);
      const pillPaddingY = 24;
      const pillHeight = (hintLines.length * hintFontSize * 1.4) + pillPaddingY * 2;
      const pillY = hintY - pillPaddingY;

      // Draw background pill
      ctx.fillStyle = 'rgba(17, 24, 39, 0.75)';
      drawRoundedRect(ctx, 80, pillY, width - 160, pillHeight, 24);
      ctx.fill();
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Text inside pill
      ctx.fillStyle = '#e2e8f0';
      hintLines.forEach((hline, idx) => {
        ctx.fillText(hline, width / 2, hintY + 10 + (idx * hintFontSize * 1.4));
      });
    }

    // 6. Bottom Bar: Highly-Accurate QR Code + Website Call to Action
    const bottomBaseY = height - (aspectRatio === '9:16' ? 140 : 100);

    // Draw High-Accuracy QR Code directly from QRCodeCanvas
    if (showQrCode) {
      try {
        const qrCanvas = qrCanvasRef.current;
        if (qrCanvas) {
          // Large, super-crisp QR dimensions for easy scanning on any smartphone
          const qrSize = aspectRatio === '9:16' ? 160 : 130;
          const qrX = width / 2 - qrSize / 2;
          const qrY = bottomBaseY - qrSize - 45;
          const quietZone = 14;

          // Crisp White Card background with Quiet Zone padding
          ctx.fillStyle = '#ffffff';
          drawRoundedRect(ctx, qrX - quietZone, qrY - quietZone, qrSize + (quietZone * 2), qrSize + (quietZone * 2), 16);
          ctx.fill();

          // Subtle shadow border
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Draw the high-res 400x400 QR canvas cleanly scaled down
          ctx.imageSmoothingEnabled = false; // Pixel-perfect crispness for QR matrix
          ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
          ctx.imageSmoothingEnabled = true;
        }
      } catch (err) {
        console.warn('QR render error on canvas:', err);
      }
    }

    // Website Link & Call to Action
    if (showWebsiteBadge) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
      ctx.fillText('LISTEN & SING KARAOKE ON', width / 2, bottomBaseY - 10);

      ctx.fillStyle = '#38bdf8'; // Sky blue
      ctx.font = '800 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
      ctx.fillText('music.uforiansports.com', width / 2, bottomBaseY + 32);
    }

    ctx.restore();
  };

  const drawGradientFallback = (ctx, w, h, style) => {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    if (style === 'noir') {
      grad.addColorStop(0, '#09090b');
      grad.addColorStop(0.5, '#18181b');
      grad.addColorStop(1, '#050505');
    } else if (style === 'royal') {
      grad.addColorStop(0, '#1e1b4b');
      grad.addColorStop(0.5, '#312e81');
      grad.addColorStop(1, '#0f172a');
    } else if (style === 'cassette') {
      grad.addColorStop(0, '#431407');
      grad.addColorStop(0.5, '#78350f');
      grad.addColorStop(1, '#1c1917');
    } else {
      // Warm Dusk
      grad.addColorStop(0, '#2e1065');
      grad.addColorStop(0.5, '#450a0a');
      grad.addColorStop(1, '#18181b');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  };

  const drawRoundedRect = (ctx, x, y, width, height, radius) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };

  const wrapText = (ctx, text, maxWidth) => {
    if (!text) return [];
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(currentLine + " " + word).width;
      if (width < maxWidth) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  // Convert canvas to Blob
  const getCanvasBlob = () => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) return resolve(null);
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  };

  // 4. Save Poster Metadata & Image to Database System
  const handleSavePoster = async () => {
    setIsSaving(true);
    try {
      const poster_meta = {
        savedAt: new Date().toISOString(),
        aspectRatio,
        lyric_tamil: lyricTamil,
        lyric_tanglish: lyricTanglish,
        movie_hint: movieHint,
        artwork_prompt: artworkPrompt,
        backgroundImageBase64,
        activeLyricLanguage,
        overlayStyle,
        darknessOpacity,
        showQrCode,
        showHint,
        showWebsiteBadge,
        fontSizeRatio
      };

      const res = await fetch(`${apiBaseUrl}/admin/songs/${song.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ poster_meta })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save poster');

      setHasSavedPoster(true);
      song.poster_meta = poster_meta;
      if (onSaveSuccess) onSaveSuccess(song.id, poster_meta);
      toast.success('💾 Poster saved to database for this song!');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Error saving poster');
    } finally {
      setIsSaving(false);
    }
  };

  // 5. Share to WhatsApp Status & Direct Posting
  const handleShareToWhatsApp = async () => {
    setIsSharing(true);
    const caption = `🎶 *Song of the Day*: ${song.title}\n\n"${activeLyricLanguage === 'tamil' ? lyricTamil : lyricTanglish}"\n\n💡 *Movie Riddle*: ${movieHint}\n\n👉 Listen & Sing Karaoke on Raja365:\n${WEBSITE_URL}`;

    try {
      const blob = await getCanvasBlob();
      const file = blob ? new File([blob], `${song.title.replace(/\s+/g, '_')}_poster.png`, { type: 'image/png' }) : null;

      // 1. Mobile Browsers / Web Share API (Directly posts image to WhatsApp / Instagram Status)
      if (navigator.share && file && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Song of the Day - ${song.title}`,
          text: caption
        });
        toast.success('Shared successfully!');
      } else {
        // 2. Desktop WhatsApp Web / Mobile Fallback
        // Automatically copy the image to clipboard so admin can just hit Cmd+V / Ctrl+V in WhatsApp chat
        let imageCopied = false;
        if (blob && navigator.clipboard && navigator.clipboard.write) {
          try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            imageCopied = true;
          } catch (clipErr) {
            console.warn('Clipboard write failed', clipErr);
          }
        }

        // Always trigger HD image download so it is immediately accessible in Downloads
        handleDownloadPoster();

        if (imageCopied) {
          toast.success('📋 Poster image copied to clipboard & downloaded! Paste (Cmd+V) in WhatsApp.', { duration: 5000 });
        } else {
          toast.success('⬇️ Poster image downloaded! Attach in WhatsApp.', { duration: 5000 });
        }

        // Open WhatsApp web with message pre-filled
        const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(caption)}`;
        window.open(waUrl, '_blank');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(err);
        toast.error('Sharing failed: ' + err.message);
      }
    } finally {
      setIsSharing(false);
    }
  };

  // 6. Download Poster Image
  const handleDownloadPoster = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `raja365_${song?.title?.toLowerCase().replace(/[^a-z0-9]/g, '_')}_poster.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast.success('Downloaded HD Poster!');
  };

  // 7. Copy Caption Only
  const handleCopyCaption = () => {
    const caption = `🎶 Song of the Day: ${song.title}\n\n"${activeLyricLanguage === 'tamil' ? lyricTamil : lyricTanglish}"\n\n💡 Movie Riddle: ${movieHint}\n\n👉 Listen & Sing Karaoke: ${WEBSITE_URL}`;
    navigator.clipboard.writeText(caption);
    toast.success('Share text copied to clipboard!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[96vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎨</span>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Minimalist Poster Studio
                {hasSavedPoster && (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                    ✓ Saved to System
                  </span>
                )}
                <span className="text-xs font-normal text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  AI + Dynamic Canvas
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                {song.title} • {song.year || 'Classic'} • Preemptively save & share anytime
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white text-2xl px-2 transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Studio Body: Split View (Controls on Left, Live Preview on Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-y-auto">
          
          {/* LEFT: Controls & AI Prompts (7 cols) */}
          <div className="lg:col-span-7 p-6 space-y-5 border-b lg:border-b-0 lg:border-r border-neutral-800 overflow-y-auto">
            
            {/* Aspect Ratio & Format */}
            <div className="flex items-center justify-between bg-neutral-800/60 p-3 rounded-xl border border-neutral-700/50">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Format & Size</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAspectRatio('9:16')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${aspectRatio === '9:16' ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
                >
                  📱 Story / Status (9:16)
                </button>
                <button
                  type="button"
                  onClick={() => setAspectRatio('1:1')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${aspectRatio === '1:1' ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
                >
                  🖼️ Square Post (1:1)
                </button>
              </div>
            </div>

            {/* AI Lyric Cue & Movie Riddle Section */}
            <div className="space-y-3 bg-black/40 p-4 rounded-xl border border-neutral-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <span>✨ Lyric Cue & Movie Riddle</span>
                </label>
                <button
                  type="button"
                  onClick={() => generateCue(true)}
                  disabled={isGeneratingCue}
                  className="text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-3 py-1 rounded-lg font-medium transition flex items-center gap-1.5"
                >
                  {isGeneratingCue ? 'Re-analyzing...' : '🔄 Re-generate AI Cue'}
                </button>
              </div>

              {/* Language Switch */}
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveLyricLanguage('tamil')}
                  className={`px-2.5 py-1 rounded font-medium transition ${activeLyricLanguage === 'tamil' ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400'}`}
                >
                  Tamil Script
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLyricLanguage('tanglish')}
                  className={`px-2.5 py-1 rounded font-medium transition ${activeLyricLanguage === 'tanglish' ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400'}`}
                >
                  Tanglish Phonetic
                </button>
              </div>

              {/* Lyric inputs */}
              {activeLyricLanguage === 'tamil' ? (
                <div>
                  <textarea
                    rows={2}
                    value={lyricTamil}
                    onChange={(e) => setLyricTamil(e.target.value)}
                    placeholder="Tamil lyric quote..."
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-sm focus:border-amber-500 outline-none"
                  />
                </div>
              ) : (
                <div>
                  <textarea
                    rows={2}
                    value={lyricTanglish}
                    onChange={(e) => setLyricTanglish(e.target.value)}
                    placeholder="Tanglish lyric quote..."
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-sm focus:border-amber-500 outline-none"
                  />
                </div>
              )}

              {/* Movie Riddle (Strictly NO movie title) */}
              <div>
                <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                  🎬 Movie Riddle (Movie name concealed):
                </label>
                <input
                  type="text"
                  value={movieHint}
                  onChange={(e) => setMovieHint(e.target.value)}
                  placeholder="e.g. A reluctant 'yes' marks the beginning of a silent symphony..."
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-sm focus:border-amber-500 outline-none"
                />
              </div>
            </div>

            {/* AI Vector Illustration Generator */}
            <div className="space-y-3 bg-black/40 p-4 rounded-xl border border-neutral-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                  <span>🎨 Gemini AI Vector Artwork</span>
                </label>
                <button
                  type="button"
                  onClick={() => generateArtwork(artworkPrompt)}
                  disabled={isGeneratingArt || !artworkPrompt}
                  className="text-xs bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isGeneratingArt ? 'Generating Art...' : '🖌️ Generate AI Artwork'}
                </button>
              </div>

              <textarea
                rows={2}
                value={artworkPrompt}
                onChange={(e) => setArtworkPrompt(e.target.value)}
                placeholder="Vector illustration prompt for Gemini image model..."
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs focus:border-purple-500 outline-none"
              />

              {backgroundImageBase64 && (
                <div className="flex items-center justify-between text-xs text-neutral-400 pt-1">
                  <span className="text-green-400">✓ AI Artwork active</span>
                  <button
                    type="button"
                    onClick={() => setBackgroundImageBase64(null)}
                    className="text-red-400 hover:underline"
                  >
                    Remove & Use Gradient
                  </button>
                </div>
              )}
            </div>

            {/* Visual Adjustments & Toggles */}
            <div className="space-y-3 bg-neutral-800/40 p-4 rounded-xl border border-neutral-700/50">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 block mb-2">
                Layout & Overlay Controls
              </span>

              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* Fallback Theme */}
                <div>
                  <label className="text-neutral-400 block mb-1">Color Palette</label>
                  <select
                    value={overlayStyle}
                    onChange={(e) => setOverlayStyle(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white"
                  >
                    <option value="warm">Warm Dusk (Classic)</option>
                    <option value="royal">Royal Twilight (Indigo)</option>
                    <option value="cassette">Vintage Cassette (Sepia)</option>
                    <option value="noir">Monochrome Noir</option>
                  </select>
                </div>

                {/* Contrast Darkness */}
                <div>
                  <label className="text-neutral-400 block mb-1">Overlay Darkness ({Math.round(darknessOpacity * 100)}%)</label>
                  <input
                    type="range"
                    min="0.1"
                    max="0.85"
                    step="0.05"
                    value={darknessOpacity}
                    onChange={(e) => setDarknessOpacity(parseFloat(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap gap-4 pt-2 text-xs text-neutral-300">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showHint}
                    onChange={(e) => setShowHint(e.target.checked)}
                    className="accent-amber-500 rounded"
                  />
                  <span>Show Movie Riddle</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showQrCode}
                    onChange={(e) => setShowQrCode(e.target.checked)}
                    className="accent-amber-500 rounded"
                  />
                  <span>Show Scannable QR</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showWebsiteBadge}
                    onChange={(e) => setShowWebsiteBadge(e.target.checked)}
                    className="accent-amber-500 rounded"
                  />
                  <span>Show App URL</span>
                </label>
              </div>
            </div>

          </div>

          {/* RIGHT: Live Poster Preview & Actions (5 cols) */}
          <div className="lg:col-span-5 p-6 flex flex-col items-center justify-between bg-black/60">
            
            {/* Live Preview Container */}
            <div className="w-full flex-1 flex flex-col items-center justify-center p-2">
              <div
                className={`relative shadow-2xl rounded-2xl overflow-hidden border border-neutral-700 transition-all flex items-center justify-center bg-neutral-950 ${
                  aspectRatio === '9:16' ? 'w-[270px] h-[480px]' : 'w-[320px] h-[320px]'
                }`}
              >
                {/* The Direct Live Canvas */}
                <canvas
                  ref={canvasRef}
                  className="w-full h-full object-contain"
                  style={{ width: '100%', height: '100%' }}
                />

                {(isGeneratingCue || isGeneratingArt) && (
                  <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-2 z-10">
                    <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs font-semibold">
                      {isGeneratingArt ? 'Generating Vector Art...' : 'Analyzing Song...'}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-neutral-500 mt-2">
                Live 1080p preview • Accurate 400px QR Matrix
              </p>
            </div>

            {/* Action Buttons */}
            <div className="w-full space-y-2.5 pt-4 border-t border-neutral-800">
              
              {/* Save to System Button */}
              <button
                type="button"
                onClick={handleSavePoster}
                disabled={isSaving}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-4 rounded-xl shadow transition flex items-center justify-center gap-2 text-sm"
              >
                <span>💾</span>
                <span>{isSaving ? 'Saving to Database...' : hasSavedPoster ? 'Update Saved Poster in System' : 'Save Poster to System'}</span>
              </button>

              {/* WhatsApp Share Button */}
              <button
                type="button"
                onClick={handleShareToWhatsApp}
                disabled={isSharing}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition flex items-center justify-center gap-2"
              >
                <span className="text-lg">💬</span>
                <span>{isSharing ? 'Preparing...' : 'Share to WhatsApp Status / Chat'}</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                {/* Download Button */}
                <button
                  type="button"
                  onClick={handleDownloadPoster}
                  className="bg-neutral-800 hover:bg-neutral-700 text-white font-medium py-2 px-3 rounded-lg text-xs transition flex items-center justify-center gap-1.5 border border-neutral-700"
                >
                  <span>⬇️</span> Download HD PNG
                </button>

                {/* Copy Caption */}
                <button
                  type="button"
                  onClick={handleCopyCaption}
                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium py-2 px-3 rounded-lg text-xs transition flex items-center justify-center gap-1.5 border border-neutral-700"
                >
                  <span>📋</span> Copy Caption
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Hidden QRCodeCanvas source for super-sharp, pixel-perfect 400x400 QR Matrix generation */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', visibility: 'hidden' }}>
        <QRCodeCanvas
          ref={qrCanvasRef}
          value={WEBSITE_URL}
          size={400}
          bgColor="#ffffff"
          fgColor="#000000"
          level="H"
          marginSize={4}
        />
      </div>
    </div>
  );
}
