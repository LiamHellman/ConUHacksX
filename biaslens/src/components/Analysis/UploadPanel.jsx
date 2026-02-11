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
} from "lucide-react";

const API_URL = import.meta.env.PROD
  ? "https://factify-api.onrender.com"
  : "http://localhost:5174";

export default function UploadPanel({
  // NEW (preferred): multi-file callback
  onFilesUpload,
  // Back-compat: single-file callback
  onFileUpload,
  onTextPaste,
  uploadedFile,
  pastedText,
  onMediaTranscribe,
  onHistoryUpdate,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textValue, setTextValue] = useState(pastedText || "");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const fileInputRef = useRef(null);

  const textFileTypes = [
    "text/plain",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  const audioFileTypes = [
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/ogg",
    "audio/m4a",
    "audio/webm",
  ];

  const videoFileTypes = [
    "video/mp4",
    "video/webm",
    "video/ogg",
    "video/quicktime",
    "video/x-msvideo",
  ];

  const isTextFile = (file) =>
    textFileTypes.includes(file.type) ||
    file.name.endsWith(".txt") ||
    file.name.endsWith(".pdf") ||
    file.name.endsWith(".docx");

  const isAudioFile = (file) =>
    audioFileTypes.includes(file.type) ||
    file.name.endsWith(".mp3") ||
    file.name.endsWith(".wav") ||
    file.name.endsWith(".ogg") ||
    file.name.endsWith(".m4a");

  const isVideoFile = (file) =>
    videoFileTypes.includes(file.type) ||
    file.name.endsWith(".mp4") ||
    file.name.endsWith(".webm") ||
    file.name.endsWith(".mov") ||
    file.name.endsWith(".avi");

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const enqueueTextFiles = (textFiles) => {
    if (textFiles.length === 0) return;

    // Preferred: parent handles array in one go
    if (typeof onFilesUpload === "function") {
      onFilesUpload(textFiles);
      return;
    }

    // Back-compat: call single-file handler for each
    if (typeof onFileUpload === "function") {
      textFiles.forEach((f) => onFileUpload(f));
    }
  };

  const handleFiles = (files) => {
    const textFiles = [];
    const batchId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;

    for (const file of files) {
      if (isTextFile(file)) {
        textFiles.push(file);
      } else if (isAudioFile(file) || isVideoFile(file)) {
        transcribeMedia(file, batchId);
      }
    }

    enqueueTextFiles(textFiles);

    setShowTextInput(false);
    setMediaFile(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) handleFiles(files);
  };

  const transcribeMedia = async (file, batchId) => {
    setIsTranscribing(true);
    setMediaFile(file);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      setIsTranscribing(false);

      if (onMediaTranscribe) {
        const type = file.type.startsWith("video") ? "video" : "audio";
        onMediaTranscribe(file, data.transcript, type, batchId);
      }
    } catch (error) {
      console.error("Transcription Error:", error);
      setIsTranscribing(false);
    }
  };

  const handleYoutubeSubmit = async () => {
    if (!youtubeUrl.trim()) return;
    const batchId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setIsTranscribing(true);
    setMediaFile({ name: `YouTube Video`, type: "video/youtube" });

    try {
      const response = await fetch(`${API_URL}/api/youtube`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: youtubeUrl }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "YouTube transcription failed");
      }

      const data = await response.json();

      if (onMediaTranscribe) {
        onMediaTranscribe(
          { name: `YouTube: ${youtubeUrl.split("v=")[1]?.slice(0, 8) || "Video"}`, type: "video/youtube" },
          data.transcript,
          "youtube",
          batchId
        );
      }
      setYoutubeUrl("");
    } catch (error) {
      console.error("YT Error:", error);
      alert("Failed to get YouTube transcript: " + error.message);
    } finally {
      setIsTranscribing(false);
      setMediaFile(null);
    }
  };

  const handleFileInput = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) handleFiles(files);

    // allow selecting the same file again later
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleTextSubmit = () => {
    if (textValue.trim()) {
      onTextPaste(textValue);
      setTextValue("");
    }
  };

  const clearUpload = () => {
    // With multi-doc, clearing is basically a UI reset; parent stores docs already.
    if (typeof onFileUpload === "function") onFileUpload(null);
    onTextPaste("");
    setTextValue("");
    setMediaFile(null);
    setIsTranscribing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const getFileIcon = () => {
    if (mediaFile) {
      if (isVideoFile(mediaFile))
        return <Video className="w-6 h-6 text-accent" />;
      if (isAudioFile(mediaFile))
        return <Music className="w-6 h-6 text-accent" />;
    }
    return <FileText className="w-6 h-6 text-accent" />;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-5 py-4 border-b border-rule">
        <h2 className="text-lg font-semibold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>Input</h2>
        <p className="text-sm text-text-muted mt-1">
          Upload document or paste text
        </p>
      </div>

      <div className="upload-content flex-1 p-5 overflow-y-auto space-y-4">
        {isTranscribing ? (
          <div className="bg-white border border-rule p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 flex items-center justify-center mb-4">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
              </div>
              <h3 className="text-text-primary font-medium mb-2">
                Transcribing Media
              </h3>
              <p className="text-sm text-text-muted mb-4">
                Extracting text from {mediaFile?.name}
              </p>
              <div className="w-full bg-cream-darker h-2 overflow-hidden">
                <div
                  className="bg-accent h-full animate-pulse"
                  style={{ width: "60%" }}
                />
              </div>
            </div>
          </div>
        ) : !uploadedFile && !pastedText ? (
          <>
            {/* Upload File Area */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border border-dashed p-6 text-center cursor-pointer transition-all ${
                isDragging
                  ? "border-accent bg-accent/5"
                  : "border-rule hover:border-accent/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.pdf,.docx,audio/*,video/*"
                onChange={handleFileInput}
                className="hidden"
              />
              <Upload className="w-6 h-6 mx-auto mb-3 text-text-muted" />
              <p className="text-text-primary font-medium text-sm">Upload File</p>
            </div>

            {/* OR Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-rule" />
              <span className="text-[10px] text-text-faint uppercase">OR</span>
              <div className="flex-1 h-px bg-rule" />
            </div>

            {/* Paste Text Area */}
            <textarea
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleTextSubmit();
                }
              }}
              onBlur={() => {
                if (textValue.trim()) handleTextSubmit();
              }}
              placeholder="Paste text..."
              className="w-full h-32 px-4 py-3 bg-white border border-rule focus:border-accent text-text-body text-sm resize-none outline-none"
            />
          </>
        ) : (
          <div className="bg-white border border-rule p-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
                {getFileIcon()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text-primary truncate">
                  {uploadedFile
                    ? uploadedFile.name
                    : mediaFile
                    ? mediaFile.name
                    : "Pasted Text"}
                </p>
                <p className="text-sm text-text-muted mt-1">
                  {uploadedFile
                    ? `${(uploadedFile.size / 1024).toFixed(1)} KB`
                    : mediaFile
                    ? "Media Transcribed"
                    : "Text Input"}
                </p>
              </div>
              <button
                onClick={clearUpload}
                className="p-2 text-text-muted hover:text-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

