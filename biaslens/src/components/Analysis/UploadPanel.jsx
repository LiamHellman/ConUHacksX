import { useState, useRef } from "react";
import {
  Upload,
  FileText,
  X,
  ClipboardPaste,
  Video,
  Music,
  Loader2,
  Youtube,
  Link as LinkIcon,
} from "lucide-react";

// Helper to detect dev vs prod environment
const API_URL = import.meta.env.PROD
  ? "https://factify-api.onrender.com"
  : "http://localhost:5174";

export default function UploadPanel({
  onFileUpload,
  onTextPaste,
  onMediaTranscribe, // We reuse this for YouTube transcripts
  uploadedFile,
  pastedText,
}) {
  const [isDragging, setIsDragging] = useState(false);

  // UI States
  const [mode, setMode] = useState("select"); // 'select' | 'text' | 'youtube'
  const [textValue, setTextValue] = useState(pastedText || "");
  const [youtubeUrl, setYoutubeUrl] = useState("");

  // Processing States
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [mediaFile, setMediaFile] = useState(null); // Used for visual feedback

  const fileInputRef = useRef(null);

  // File type checks
  const isTextFile = (file) =>
    ["text/plain", "application/pdf"].includes(file.type) ||
    /\.(txt|pdf|docx)$/i.test(file.name);
  const isAudioFile = (file) =>
    file.type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a)$/i.test(file.name);
  const isVideoFile = (file) =>
    file.type.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(file.name);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
  };

  const handleFile = (file) => {
    if (isTextFile(file)) {
      onFileUpload(file);
      resetUI();
    } else if (isAudioFile(file) || isVideoFile(file)) {
      transcribeFile(file);
    }
  };

  // 1. Handle File Upload (Existing Logic)
  const transcribeFile = async (file) => {
    setIsTranscribing(true);
    setStatusMessage(`Extracting text from ${file.name}...`);
    setMediaFile(file);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      onMediaTranscribe(
        file,
        data.transcript,
        file.type.startsWith("video") ? "video" : "audio",
      );
    } catch (error) {
      console.error(error);
      alert("Transcription failed. Please try again.");
    } finally {
      setIsTranscribing(false);
      setMediaFile(null);
    }
  };

  // 2. Handle YouTube URL (New Logic)
  const handleYoutubeSubmit = async () => {
    if (!youtubeUrl.trim()) return;

    setIsTranscribing(true);
    setStatusMessage("Downloading & Transcribing YouTube Video...");

    // Create a fake "file" object just for the UI history
    const fakeFile = { name: youtubeUrl, type: "video/youtube" };
    setMediaFile(fakeFile);

    try {
      const res = await fetch(`${API_URL}/api/youtube`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: youtubeUrl }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "YouTube transcription failed");
      }

      const data = await res.json();
      onMediaTranscribe(fakeFile, data.transcript, "youtube");
      setYoutubeUrl("");
      setMode("select");
    } catch (error) {
      console.error(error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsTranscribing(false);
      setMediaFile(null);
    }
  };

  const handleTextSubmit = () => {
    if (textValue.trim()) {
      onTextPaste(textValue);
      setMode("select");
    }
  };

  const resetUI = () => {
    setMode("select");
    setMediaFile(null);
    setIsTranscribing(false);
    setTextValue("");
    setYoutubeUrl("");
  };

  const clearUpload = () => {
    onFileUpload(null);
    onTextPaste("");
    resetUI();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- Render Helpers ---
  const getFileIcon = () => {
    if (mediaFile?.type === "video/youtube")
      return <Youtube className="w-6 h-6 text-red-500" />;
    if (mediaFile && isVideoFile(mediaFile))
      return <Video className="w-6 h-6 text-purple-400" />;
    if (mediaFile && isAudioFile(mediaFile))
      return <Music className="w-6 h-6 text-purple-400" />;
    return <FileText className="w-6 h-6 text-purple-400" />;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-5 py-4 border-b border-dark-700">
        <h2 className="text-lg font-semibold text-white">Input</h2>
        <p className="text-sm text-gray-500 mt-1">Upload file or paste URL</p>
      </div>

      <div className="flex-1 p-5 overflow-y-auto space-y-4">
        {/* LOADING STATE */}
        {isTranscribing ? (
          <div className="bg-dark-800 border border-purple-500/30 rounded-xl p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-4 mx-auto">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
            </div>
            <h3 className="text-white font-medium mb-2">Processing...</h3>
            <p className="text-sm text-gray-400 mb-4">{statusMessage}</p>
            <div className="w-full bg-dark-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-purple-500 h-full animate-pulse"
                style={{ width: "60%" }}
              />
            </div>
          </div>
        ) : !uploadedFile && !pastedText ? (
          <>
            {/* MAIN SELECTION SCREEN */}
            {mode === "select" && (
              <>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    isDragging
                      ? "border-purple-500 bg-purple-500/10"
                      : "border-dark-500 hover:border-purple-500/50"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.pdf,.docx,audio/*,video/*"
                    onChange={(e) =>
                      e.target.files.length > 0 && handleFile(e.target.files[0])
                    }
                    className="hidden"
                  />
                  <Upload className="w-8 h-8 mx-auto mb-4 text-gray-400" />
                  <p className="text-white font-medium mb-1">Upload File</p>
                  <p className="text-xs text-gray-600">Audio, Video, PDF</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setMode("text")}
                    className="flex flex-col items-center justify-center gap-2 py-4 border border-dark-500 rounded-xl text-gray-400 hover:text-purple-400 hover:border-purple-500/50 transition-all"
                  >
                    <ClipboardPaste className="w-5 h-5" />
                    <span className="text-sm">Paste Text</span>
                  </button>
                  <button
                    onClick={() => setMode("youtube")}
                    className="flex flex-col items-center justify-center gap-2 py-4 border border-dark-500 rounded-xl text-gray-400 hover:text-red-400 hover:border-red-500/50 transition-all"
                  >
                    <Youtube className="w-5 h-5" />
                    <span className="text-sm">YouTube URL</span>
                  </button>
                </div>
              </>
            )}

            {/* PASTE TEXT MODE */}
            {mode === "text" && (
              <div className="space-y-4">
                <textarea
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  placeholder="Paste text to analyze..."
                  className="w-full h-48 px-4 py-3 bg-dark-800 border border-dark-600 focus:border-purple-500 rounded-xl text-white resize-none outline-none"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setMode("select")}
                    className="flex-1 py-2 border border-dark-500 rounded-lg text-gray-400"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleTextSubmit}
                    className="flex-1 py-2 bg-purple-600 rounded-lg text-white"
                  >
                    Use Text
                  </button>
                </div>
              </div>
            )}

            {/* YOUTUBE MODE */}
            {mode === "youtube" && (
              <div className="space-y-4">
                <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3 text-red-400">
                    <Youtube className="w-5 h-5" />
                    <span className="font-medium text-white">YouTube Link</span>
                  </div>
                  <input
                    type="text"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white focus:border-red-500 outline-none"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setMode("select")}
                    className="flex-1 py-2 border border-dark-500 rounded-lg text-gray-400"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleYoutubeSubmit}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white font-medium"
                  >
                    Transcribe
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* FILE SELECTED STATE */
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-5 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
              {getFileIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white truncate">
                {uploadedFile?.name || mediaFile?.name || "Pasted Text"}
              </p>
              <p className="text-sm text-gray-500 mt-1">Ready for analysis</p>
            </div>
            <button
              onClick={clearUpload}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
