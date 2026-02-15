import React, { useRef, useState, useEffect } from 'react';

type DrawingMode = 'fade' | 'keep';

const App: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });

  const settingsPanelRef = useRef<HTMLDivElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const laserRef = useRef<HTMLDivElement>(null);

  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const [isDrawing, setIsDrawing] = useState(false);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  useEffect(() => { transformRef.current = transform; }, [transform]);
  const [isPanning, setIsPanning] = useState(false);
  const [isLaserMode, setIsLaserMode] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const mainRecorderRef = useRef<MediaRecorder | null>(null);
  const mainChunksRef = useRef<Blob[]>([]);
  const micRecorderRef = useRef<MediaRecorder | null>(null);
  const micChunksRef = useRef<Blob[]>([]);
  const recCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recAnimFrameRef = useRef<number | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const micGainNodeRef = useRef<GainNode | null>(null);
  const gameGainNodeRef = useRef<GainNode | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [micVolume, setMicVolume] = useState(0);
  const [isMicTesting, setIsMicTesting] = useState(false);
  const micTestContextRef = useRef<AudioContext | null>(null);

  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ローカルストレージ設定読み込み
  const [selectedMicId, setSelectedMicId] = useState<string>(() => localStorage.getItem('lol_micId') || "");
  const [micGain, setMicGain] = useState<number>(() => { const s = localStorage.getItem('lol_micGain'); return s ? parseFloat(s) : 1.0; });
  const [gameGain, setGameGain] = useState<number>(() => { const s = localStorage.getItem('lol_gameGain'); return s ? parseFloat(s) : 1.0; });
  const [isStereoSplit, setIsStereoSplit] = useState<boolean>(() => localStorage.getItem('lol_isStereoSplit') === 'true');
  const [saveMicSeparately, setSaveMicSeparately] = useState<boolean>(() => localStorage.getItem('lol_saveMicSeparately') === 'true');
  const [strokeColor, setStrokeColor] = useState<string>(() => localStorage.getItem('lol_strokeColor') || "#FF0000");
  const [drawingMode, setDrawingMode] = useState<DrawingMode>(() => (localStorage.getItem('lol_drawingMode') as DrawingMode) || 'fade');
  const [lineWidth, setLineWidth] = useState<number>(() => { const s = localStorage.getItem('lol_lineWidth'); return s ? parseInt(s) : 4; });

  // 設定保存
  useEffect(() => { localStorage.setItem('lol_micId', selectedMicId); }, [selectedMicId]);
  useEffect(() => { localStorage.setItem('lol_micGain', micGain.toString()); }, [micGain]);
  useEffect(() => { localStorage.setItem('lol_gameGain', gameGain.toString()); }, [gameGain]);
  useEffect(() => { localStorage.setItem('lol_isStereoSplit', isStereoSplit.toString()); }, [isStereoSplit]);
  useEffect(() => { localStorage.setItem('lol_saveMicSeparately', saveMicSeparately.toString()); }, [saveMicSeparately]);
  useEffect(() => { localStorage.setItem('lol_strokeColor', strokeColor); }, [strokeColor]);
  useEffect(() => { localStorage.setItem('lol_drawingMode', drawingMode); }, [drawingMode]);
  useEffect(() => { localStorage.setItem('lol_lineWidth', lineWidth.toString()); }, [lineWidth]);

  // 初期化
  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => { });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices.filter(d => d.kind === 'audioinput');
        setAudioDevices(inputs);
      } catch (err) { console.error(err); }
    };
    getDevices();
  }, []);

  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = playbackRate; }, [playbackRate]);
  useEffect(() => { if (micGainNodeRef.current) micGainNodeRef.current.gain.value = micGain; }, [micGain]);
  useEffect(() => { if (gameGainNodeRef.current) gameGainNodeRef.current.gain.value = gameGain; }, [gameGain]);
  useEffect(() => {
    if (drawingMode === 'keep' && fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }
  }, [drawingMode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSettings) {
        if (
          settingsPanelRef.current &&
          !settingsPanelRef.current.contains(event.target as Node) &&
          settingsBtnRef.current &&
          !settingsBtnRef.current.contains(event.target as Node)
        ) {
          setShowSettings(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettings]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setVideoSrc(URL.createObjectURL(file));
      setTransform({ x: 0, y: 0, scale: 1 });
      setCurrentTime(0);
      setPlaybackRate(1);
    }
  };

  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
  };

  const toggleMinimap = () => {
    if (transform.scale > 1.1) { setTransform({ x: 0, y: 0, scale: 1 }); return; }
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      const targetScale = 3;
      const newX = width - (width * targetScale);
      const newY = height - (height * targetScale);
      setTransform({ scale: targetScale, x: newX, y: newY });
    }
  };

  const clampOffset = (offset: number, scale: number, dimension: number) => {
    if (scale <= 1) return 0;
    const maxOffset = 0;
    const minOffset = dimension * (1 - scale);
    return Math.max(minOffset, Math.min(offset, maxOffset));
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!videoSrc || !containerRef.current) return;
    e.preventDefault();
    const width = containerRef.current.offsetWidth;
    const height = containerRef.current.offsetHeight;
    const rect = containerRef.current.getBoundingClientRect();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;

    setTransform((prev) => {
      let newScale = prev.scale + delta;
      if (newScale < 1) newScale = 1; if (newScale > 8) newScale = 8;
      if (newScale === 1) return { x: 0, y: 0, scale: 1 };
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const contentX = (mouseX - prev.x) / prev.scale;
      const contentY = (mouseY - prev.y) / prev.scale;
      let newX = mouseX - (contentX * newScale);
      let newY = mouseY - (contentY * newScale);
      newX = clampOffset(newX, newScale, width);
      newY = clampOffset(newY, newScale, height);
      return { x: newX, y: newY, scale: newScale };
    });
  };

  // 録画機能 (Canvas ベース: 動画エリアのみ録画、ゲーム音のみ)
  const startRecording = async () => {
    try {
      const video = videoRef.current;
      if (!video || !video.src) { alert('先に動画ファイルを読み込んでください'); return; }

      // 1. マイク
      let micStream: MediaStream | null = null;
      try {
        const audioConstraints = {
          deviceId: selectedMicId ? { exact: selectedMicId } : undefined,
          echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2
        };
        micStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      } catch (err) { if (!window.confirm("マイクなしで録画しますか？")) return; }

      // 2. 録画用 Canvas を作成 (ビューポート表示を忠実に再現)
      const vpEl = viewportRef.current;
      if (!vpEl) { alert('ビューポートが見つかりません'); return; }
      const vpW = vpEl.clientWidth;
      const vpH = vpEl.clientHeight;

      // 高画質のため動画の元解像度を基準にスケールアップ
      const upscale = Math.max(1, video.videoWidth / vpW, video.videoHeight / vpH);
      const recCanvas = document.createElement('canvas');
      recCanvas.width = Math.round(vpW * upscale);
      recCanvas.height = Math.round(vpH * upscale);
      recCanvasRef.current = recCanvas;
      const recCtx = recCanvas.getContext('2d')!;
      recCtx.imageSmoothingEnabled = true;
      recCtx.imageSmoothingQuality = 'high';

      // ビューポート内での動画表示位置を計算 (CSS object-fit:contain + flexbox centering 相当)
      const videoAspect = video.videoWidth / video.videoHeight;
      const vpAspect = vpW / vpH;
      let fitW: number, fitH: number, fitX: number, fitY: number;
      if (videoAspect > vpAspect) {
        fitW = vpW; fitH = vpW / videoAspect;
      } else {
        fitH = vpH; fitW = vpH * videoAspect;
      }
      fitX = (vpW - fitW) / 2;
      fitY = (vpH - fitH) / 2;

      // 3. Canvas にビューポート表示を再現するループ (ズーム・パン・描画を反映)
      const drawLoop = () => {
        // シーク中は前回の描画を維持（デコード途中のフレーム描画を回避）
        if (video.seeking) {
          recAnimFrameRef.current = requestAnimationFrame(drawLoop);
          return;
        }

        const t = transformRef.current;
        recCtx.fillStyle = 'black';
        recCtx.fillRect(0, 0, recCanvas.width, recCanvas.height);

        recCtx.save();
        // upscale → CSS transform (translate + scale) を再現
        recCtx.scale(upscale, upscale);
        recCtx.translate(t.x, t.y);
        recCtx.scale(t.scale, t.scale);

        // 動画を描画 (ビューポート内の表示位置に配置)
        recCtx.drawImage(video, fitX, fitY, fitW, fitH);

        // 描画キャンバスを合成 (動画と同じ位置・サイズに重ねる)
        const drawCanvas = canvasRef.current;
        if (drawCanvas && drawCanvas.width > 0 && drawCanvas.height > 0) {
          recCtx.drawImage(drawCanvas, fitX, fitY, fitW, fitH);
        }

        recCtx.restore();
        recAnimFrameRef.current = requestAnimationFrame(drawLoop);
      };
      drawLoop();

      // 4. 映像ストリーム取得 (Canvas から)
      // 30fps 固定: 一時停止・シーク中も安定したフレーム供給を保証
      const canvasStream = recCanvas.captureStream(30);

      // 5. 音声のセットアップ (ゲーム音 = video 要素の音声のみ)
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;

      const dest = audioCtx.createMediaStreamDestination();
      dest.channelCount = 2;

      const merger = audioCtx.createChannelMerger(2);

      // ゲーム音声: video 要素から captureStream で取得
      const videoMediaStream = (video as any).captureStream ? (video as any).captureStream() : (video as any).mozCaptureStream();
      if (videoMediaStream && videoMediaStream.getAudioTracks().length > 0) {
        const gameSource = audioCtx.createMediaStreamSource(videoMediaStream);
        const gameGainNode = audioCtx.createGain();
        gameGainNode.gain.value = gameGain;
        gameSource.connect(gameGainNode);

        if (isStereoSplit) gameGainNode.connect(merger, 0, 0);
        else gameGainNode.connect(dest);

        gameGainNodeRef.current = gameGainNode;
      }

      // マイク音声
      if (micStream) {
        const micSource = audioCtx.createMediaStreamSource(micStream);
        const micGainNode = audioCtx.createGain();
        micGainNode.gain.value = micGain;
        micSource.connect(micGainNode);

        if (saveMicSeparately) {
          // 別保存
        } else {
          if (isStereoSplit) micGainNode.connect(merger, 0, 1);
          else micGainNode.connect(dest);
        }
        micGainNodeRef.current = micGainNode;
      }

      if (isStereoSplit) merger.connect(dest);

      // 6. 映像+音声を結合
      const tracks = [...canvasStream.getVideoTracks()];
      const mixedAudioTrack = dest.stream.getAudioTracks()[0];
      if (mixedAudioTrack) tracks.push(mixedAudioTrack);

      const combinedStream = new MediaStream(tracks);

      let mimeType = 'video/webm; codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm; codecs=vp8';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';

      // ★高画質: 16Mbps映像 + 320kbps音声
      const mainRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 16_000_000,
        audioBitsPerSecond: 320_000
      });
      mainChunksRef.current = [];
      mainRecorder.ondataavailable = (e) => { if (e.data.size > 0) mainChunksRef.current.push(e.data); };

      mainRecorder.onstop = () => {
        // 録画ループ停止
        if (recAnimFrameRef.current) { cancelAnimationFrame(recAnimFrameRef.current); recAnimFrameRef.current = null; }
        recCanvasRef.current = null;
        saveBlob(new Blob(mainChunksRef.current, { type: 'video/webm' }), 'Video_Game');
        combinedStream.getTracks().forEach(t => t.stop());
        micStream?.getTracks().forEach(t => t.stop());
        audioCtx.close();
        micGainNodeRef.current = null;
        gameGainNodeRef.current = null;
        setIsRecording(false);
      };

      if (saveMicSeparately && micStream) {
        const micRecorder = new MediaRecorder(micStream, { audioBitsPerSecond: 192_000 });
        micChunksRef.current = [];
        micRecorder.ondataavailable = (e) => { if (e.data.size > 0) micChunksRef.current.push(e.data); };
        micRecorder.onstop = () => {
          saveBlob(new Blob(micChunksRef.current, { type: 'audio/webm' }), 'Audio_Mic');
        };
        micRecorder.start();
        micRecorderRef.current = micRecorder;
      } else {
        micRecorderRef.current = null;
      }

      mainRecorder.start();
      mainRecorderRef.current = mainRecorder;
      setIsRecording(true);

    } catch (err: any) { alert(`Error: ${err.message}`); }
  };

  const saveBlob = (blob: Blob, prefix: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
    const ext = 'webm';
    a.download = `LoL_${prefix}_${timeStr}.${ext}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const stopRecording = () => {
    if (recAnimFrameRef.current) { cancelAnimationFrame(recAnimFrameRef.current); recAnimFrameRef.current = null; }
    if (mainRecorderRef.current?.state !== 'inactive') mainRecorderRef.current?.stop();
    if (micRecorderRef.current?.state !== 'inactive') micRecorderRef.current?.stop();
  };

  const handleTimeUpdate = () => { if (videoRef.current) setCurrentTime(videoRef.current.currentTime); };
  const handleLoadedMetadata = () => { if (videoRef.current) { setDuration(videoRef.current.duration); updateCanvasSize(); } };
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current && !videoRef.current.seeking) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const toggleMicTest = async () => {
    if (isMicTesting) {
      micTestContextRef.current?.close(); setIsMicTesting(false); setMicVolume(0);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: selectedMicId ? { exact: selectedMicId } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false }
        });
        const audioCtx = new AudioContext();
        micTestContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        setIsMicTesting(true);
        const update = () => {
          if (!micTestContextRef.current) return;
          analyser.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setMicVolume(avg);
          requestAnimationFrame(update);
        };
        update();
      } catch (e) { alert("マイクテスト不可"); }
    }
  };

  const clearCanvas = () => { const ctx = canvasRef.current?.getContext('2d'); ctx?.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height); };
  const getCanvasCoordinates = (e: React.MouseEvent) => {
    const canvas = canvasRef.current; if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDrawing = (e: React.MouseEvent) => {
    if (fadeTimeoutRef.current) { clearTimeout(fadeTimeoutRef.current); fadeTimeoutRef.current = null; }
    setIsDrawing(true);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) { const { x, y } = getCanvasCoordinates(e); ctx.beginPath(); ctx.moveTo(x, y); }
  };

  const draw = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      const { x, y } = getCanvasCoordinates(e);
      ctx.lineWidth = lineWidth / transform.scale;
      ctx.lineCap = 'round';
      ctx.strokeStyle = strokeColor;
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (drawingMode === 'fade') {
      fadeTimeoutRef.current = setTimeout(() => { clearCanvas(); fadeTimeoutRef.current = null; }, 3000);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;
      if (['INPUT', 'SELECT'].includes(document.activeElement?.tagName || '')) return;
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (video.paused) { video.play(); setIsPlaying(true); }
          else { video.pause(); setIsPlaying(false); }
          break;
        case 'KeyR': setTransform({ x: 0, y: 0, scale: 1 }); break;
        case 'KeyM': toggleMinimap(); break;
        case 'KeyC': {
          const ctx = canvasRef.current?.getContext('2d');
          if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          break;
        }
        case 'ArrowLeft':
          if (!video.seeking) video.currentTime = Math.max(0, video.currentTime - 5);
          break;
        case 'ArrowRight':
          if (!video.seeking) video.currentTime = Math.min(video.duration, video.currentTime + 5);
          break;
        case 'Period':
          if (!video.seeking) {
            video.pause(); setIsPlaying(false);
            video.currentTime = Math.min(video.duration, video.currentTime + 1 / 30);
          }
          break;
        case 'Comma':
          if (!video.seeking) {
            video.pause(); setIsPlaying(false);
            video.currentTime = Math.max(0, video.currentTime - 1 / 30);
          }
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [transform]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) { videoRef.current.play(); setIsPlaying(true); }
      else { videoRef.current.pause(); setIsPlaying(false); }
    }
  };

  const updateCanvasSize = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && transform.scale === 1) {
      const rect = video.getBoundingClientRect();
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        const ctx = canvas.getContext('2d');
        const savedData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
        canvas.width = rect.width;
        canvas.height = rect.height;
        if (savedData && ctx) ctx.putImageData(savedData, 0, 0);
      }
    }
  };
  useEffect(() => { window.addEventListener('resize', updateCanvasSize); return () => window.removeEventListener('resize', updateCanvasSize); }, []);

  const handleMouseDown = (e: React.MouseEvent) => { if (e.button === 2 || e.button === 1) { setIsPanning(true); return; } if (e.button === 0) startDrawing(e); };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isLaserMode && laserRef.current) {
      laserRef.current.style.top = `${e.clientY}px`;
      laserRef.current.style.left = `${e.clientX}px`;
    }
    if (isPanning && containerRef.current) {
      const w = containerRef.current.offsetWidth;
      const h = containerRef.current.offsetHeight;
      setTransform(prev => {
        let nextX = prev.x + e.movementX;
        let nextY = prev.y + e.movementY;
        nextX = clampOffset(nextX, prev.scale, w);
        nextY = clampOffset(nextY, prev.scale, h);
        return { ...prev, x: nextX, y: nextY };
      });
    } else {
      draw(e);
    }
  };

  const handleMouseUp = () => { setIsPanning(false); stopDrawing(); };

  const styles = {
    container: { display: 'flex', flexDirection: 'column' as const, height: '100vh', backgroundColor: '#1a1a1a', color: 'white', overflow: 'hidden' },
    toolbar: { padding: '10px 20px', backgroundColor: '#333', display: 'flex', flexDirection: 'column' as const, gap: '10px', zIndex: 100, borderBottom: '1px solid #444', flexShrink: 0 },
    controlsRow: { display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' as const, position: 'relative' as const },
    seekBarRow: { display: 'flex', alignItems: 'center', gap: '10px', width: '100%' },
    viewport: { flex: 1, position: 'relative' as const, backgroundColor: 'black', overflow: 'hidden', cursor: isLaserMode ? 'none' : (isPanning ? 'grabbing' : 'default') },
    zoomContent: {
      position: 'absolute' as const, top: 0, left: 0, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center',
      transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
      transformOrigin: '0 0', transition: isPanning ? 'none' : 'transform 0.1s linear'
    },
    video: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' as const, pointerEvents: 'none' as const },
    btn: { padding: '4px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: '#555', color: '#fff', fontSize: '12px' },
    activeBtn: { padding: '4px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: '#007bff', color: '#fff', fontSize: '12px' },
    recBtn: { padding: '4px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: isRecording ? '#dc3545' : '#28a745', color: '#fff', fontSize: '12px', fontWeight: 'bold' as const },
    settingsPanel: { position: 'absolute' as const, top: '40px', left: '0', backgroundColor: '#222', border: '1px solid #555', padding: '15px', borderRadius: '4px', zIndex: 101, display: 'flex', flexDirection: 'column' as const, gap: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.5)', minWidth: '300px' },
    colorSample: (c: string) => ({ width: '20px', height: '20px', backgroundColor: c, borderRadius: '50%', border: strokeColor === c ? '2px solid white' : 'none', cursor: 'pointer' }),
    volumeBarBg: { width: '100%', height: '10px', backgroundColor: '#444', borderRadius: '5px', overflow: 'hidden' },
    volumeBarFill: (vol: number) => ({ width: `${Math.min(vol / 2.55, 100)}%`, height: '100%', backgroundColor: vol > 200 ? '#ff4444' : '#44ff44', transition: 'width 0.1s' }),
    sliderContainer: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#eee' },
    slider: { flex: 1, cursor: 'pointer' },
    laser: {
      position: 'fixed' as const, top: 0, left: 0, width: '12px', height: '12px', backgroundColor: 'rgba(255, 0, 0, 0.8)',
      borderRadius: '50%', pointerEvents: 'none' as const, zIndex: 9999, transform: 'translate(-50%, -50%)', boxShadow: '0 0 8px 2px rgba(255, 0, 0, 0.8)',
      display: isLaserMode ? 'block' : 'none'
    }
  };
  const formatTime = (time: number) => { const m = Math.floor(time / 60); const s = Math.floor(time % 60); return `${m}:${s.toString().padStart(2, '0')}`; };

  return (
    <div style={styles.container}>
      <div ref={laserRef} style={styles.laser}></div>
      <div id="toolbar-main" style={styles.toolbar}>
        <div style={styles.controlsRow}>
          <button ref={settingsBtnRef} style={styles.btn} onClick={() => setShowSettings(!showSettings)}>⚙️ 設定</button>
          {showSettings && (
            <div ref={settingsPanelRef} style={styles.settingsPanel}>
              <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '5px', borderBottom: '1px solid #555', paddingBottom: '5px' }}>オーディオ設定</div>
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '12px', marginBottom: '4px' }}>マイク選択:</div>
                <select style={{ padding: '4px', width: '100%', backgroundColor: '#333', color: 'white', border: '1px solid #555', fontSize: '12px' }} value={selectedMicId} onChange={(e) => setSelectedMicId(e.target.value)}>
                  {audioDevices.length === 0 && <option value="">マイクなし</option>}
                  {audioDevices.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Mic ${device.deviceId.slice(0, 5)}`}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <div style={styles.sliderContainer}>
                  <span style={{ width: '60px' }}>マイク音量:</span>
                  <input type="range" min="0" max="2" step="0.1" style={styles.slider} value={micGain} onChange={(e) => setMicGain(parseFloat(e.target.value))} />
                  <span style={{ width: '35px', textAlign: 'right' }}>{Math.round(micGain * 100)}%</span>
                </div>
                <div style={styles.sliderContainer}>
                  <span style={{ width: '60px' }}>ゲーム音量:</span>
                  <input type="range" min="0" max="2" step="0.1" style={styles.slider} value={gameGain} onChange={(e) => setGameGain(parseFloat(e.target.value))} />
                  <span style={{ width: '35px', textAlign: 'right' }}>{Math.round(gameGain * 100)}%</span>
                </div>
                <div style={{ marginTop: '10px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input type="checkbox" checked={saveMicSeparately} onChange={(e) => { setSaveMicSeparately(e.target.checked); if (e.target.checked) setIsStereoSplit(false); }} />
                    <span>マイク音声を別ファイルで保存 (推奨)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', opacity: saveMicSeparately ? 0.5 : 1 }}>
                    <input type="checkbox" checked={isStereoSplit} disabled={saveMicSeparately} onChange={(e) => setIsStereoSplit(e.target.checked)} />
                    <span>音声を分離する (L:ゲーム / R:マイク)</span>
                  </label>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #555', paddingTop: '10px', marginBottom: '10px' }}>
                <div style={styles.sliderContainer}>
                  <span style={{ width: '60px' }}>ペンの太さ:</span>
                  <input type="range" min="1" max="20" step="1" style={styles.slider} value={lineWidth} onChange={(e) => setLineWidth(parseInt(e.target.value))} />
                  <span style={{ width: '35px', textAlign: 'right' }}>{lineWidth}px</span>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #555', paddingTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontSize: '12px' }}>マイクテスト (入力確認):</span>
                  <button onClick={toggleMicTest} style={{ padding: '2px 8px', fontSize: '10px', cursor: 'pointer' }}>{isMicTesting ? '停止' : '開始'}</button>
                </div>
                <div style={styles.volumeBarBg}><div style={styles.volumeBarFill(micVolume)}></div></div>
              </div>
            </div>
          )}
          <button style={styles.recBtn} onClick={isRecording ? stopRecording : startRecording}>{isRecording ? '■ 録画停止' : '● REC'}</button>
          <input type="file" accept="video/*" onChange={handleFileChange} style={{ fontSize: '12px', maxWidth: '150px' }} />
          <select style={{ fontSize: '12px', padding: '4px', backgroundColor: '#333', color: 'white', border: '1px solid #555' }} value={playbackRate.toString()} onChange={(e) => changePlaybackRate(parseFloat(e.target.value))}>
            <option value="0.25">x0.25</option>
            <option value="0.5">x0.5</option>
            <option value="1">x1.0</option>
            <option value="2">x2.0</option>
          </select>
          <button style={styles.btn} onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}>R</button>
          <button style={styles.btn} onClick={toggleMinimap}>M</button>
          <button style={isLaserMode ? styles.activeBtn : styles.btn} onClick={() => setIsLaserMode(!isLaserMode)}>Laser</button>
          <div style={{ width: '1px', height: '20px', backgroundColor: '#555' }}></div>
          {['#FF0000', '#00FF00', '#FFFF00', '#00FFFF', '#FFFFFF'].map(c => <div key={c} style={styles.colorSample(c)} onClick={() => setStrokeColor(c)} />)}
          <div style={{ width: '1px', height: '20px', backgroundColor: '#555' }}></div>
          <button style={drawingMode === 'fade' ? styles.activeBtn : styles.btn} onClick={() => setDrawingMode('fade')}>消える</button>
          <button style={drawingMode === 'keep' ? styles.activeBtn : styles.btn} onClick={() => setDrawingMode('keep')}>残る</button>
          <button style={{ ...styles.btn, backgroundColor: '#d9534f' }} onClick={clearCanvas}>Clear</button>
        </div>
        <div style={styles.seekBarRow}>
          <button style={styles.btn} onClick={togglePlay}>{isPlaying ? '⏸' : '▶'}</button>
          <span style={{ fontSize: '12px', minWidth: '40px' }}>{formatTime(currentTime)}</span>
          <input type="range" min="0" max={duration} step="0.1" value={currentTime} onChange={handleSeek} style={{ flex: 1, cursor: 'pointer' }} />
          <span style={{ fontSize: '12px', minWidth: '40px' }}>{formatTime(duration)}</span>
        </div>
      </div>
      <div ref={viewportRef} style={styles.viewport} onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onContextMenu={(e) => e.preventDefault()}>
        <div style={styles.zoomContent} ref={containerRef}>
          {videoSrc ? (
            <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <video ref={videoRef} src={videoSrc} style={styles.video} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} onEnded={() => setIsPlaying(false)} />
              <canvas ref={canvasRef} style={{ position: 'absolute', zIndex: 10 }} />
            </div>
          ) : <div style={{ color: '#666' }}>ファイルを選択してください</div>}
        </div>
        {/* ショートカットキー一覧 */}
        <div style={{
          position: 'absolute', top: '10px', right: '10px', zIndex: 50,
          backgroundColor: 'rgba(0, 0, 0, 0.55)', color: 'rgba(255, 255, 255, 0.85)',
          padding: '8px 12px', borderRadius: '6px', fontSize: '11px',
          fontFamily: 'monospace', lineHeight: '1.6', pointerEvents: 'none',
          backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '12px', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '3px' }}>⌨ Shortcuts</div>
          <div>Space &nbsp;&nbsp;: 再生 / 一時停止</div>
          <div>← / → &nbsp;: 5秒 戻る / 進む</div>
          <div>{`< / >`} &nbsp;&nbsp;: コマ送り</div>
          <div>R &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: ズームリセット</div>
          <div>M &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: ミニマップ</div>
          <div>C &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: 描画クリア</div>
        </div>
      </div>
    </div>
  );
};
export default App;