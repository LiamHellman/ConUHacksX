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
        return <Video className="w-6 h-6 text-purple-400" />;
      if (isAudioFile(mediaFile))
        return <Music className="w-6 h-6 text-purple-400" />;
    }
    return <FileText className="w-6 h-6 text-purple-400" />;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-5 py-4 border-b border-dark-700">
        <h2 className="text-lg font-semibold text-white">Input</h2>
        <p className="text-sm text-gray-500 mt-1">
          Upload document, audio, video or YouTube link
        </p>
      </div>

      <div className="upload-content flex-1 p-5 overflow-y-auto space-y-4">
        {isTranscribing ? (
          <div className="bg-dark-800 border border-purple-500/30 rounded-xl p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-4">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              </div>
              <h3 className="text-white font-medium mb-2">
                Transcribing Media
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                Extracting text from {mediaFile?.name}
              </p>
              <div className="w-full bg-dark-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-purple-500 h-full rounded-full animate-pulse"
                  style={{ width: "60%" }}
                />
              </div>
            </div>
          </div>
        ) : !uploadedFile && !pastedText ? (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase">
                Analyze YouTube
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="https://youtube.com/..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-dark-800 border border-dark-600 focus:border-red-500 rounded-lg text-sm text-white outline-none transition-all"
                  />
                </div>
                <button
                  onClick={handleYoutubeSubmit}
                  disabled={!youtubeUrl.trim()}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-dark-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Load
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4 my-2">
              <div className="flex-1 h-px bg-dark-600" />
              <span className="text-[10px] text-gray-600 uppercase">OR</span>
              <div className="flex-1 h-px bg-dark-600" />
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? "border-purple-500 bg-purple-500/10"
                  : "border-dark-500 hover:border-purple-500/50"
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
              <Upload className="w-8 h-8 mx-auto mb-4 text-gray-400" />
              <p className="text-white font-medium mb-1">Upload File</p>
              <p className="text-xs text-gray-500">
                PDF, MP3, MP4, etc. (multi-select supported)
              </p>
            </div>

            {!showTextInput ? (
              <button
                onClick={() => setShowTextInput(true)}
                className="w-full flex items-center justify-center gap-2 py-4 border border-dark-500 hover:border-purple-500/50 rounded-xl text-gray-400 hover:text-purple-400 transition-all"
              >
                <ClipboardPaste className="w-5 h-5" />
                <span>Paste text directly</span>
              </button>
            ) : (
              <div className="space-y-4">
                <textarea
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  placeholder="Paste text..."
                  className="w-full h-48 px-4 py-3 bg-dark-800 border border-dark-600 focus:border-purple-500 rounded-xl text-white resize-none outline-none"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowTextInput(false)}
                    className="flex-1 py-2 border border-dark-500 rounded-lg text-gray-400"
                  >
                    Cancel
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
          </>
        ) : (
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                {getFileIcon()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">
                  {uploadedFile
                    ? uploadedFile.name
                    : mediaFile
                    ? mediaFile.name
                    : "Pasted Text"}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {uploadedFile
                    ? `${(uploadedFile.size / 1024).toFixed(1)} KB`
                    : mediaFile
                    ? "Media Transcribed"
                    : "Text Input"}
                </p>
              </div>
              <button
                onClick={clearUpload}
                className="p-2 text-gray-400 hover:text-white"
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

