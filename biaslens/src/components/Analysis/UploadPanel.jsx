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
  const [youtubeUrl, setYoutubeUrl] = useState(""); // NEW: YT State
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

  const isTextFile = (file) => {
    return (
      textFileTypes.includes(file.type) ||
      file.name.endsWith(".txt") ||
      file.name.endsWith(".pdf") ||
      file.name.endsWith(".docx")
    );
  };

  const isAudioFile = (file) => {
    return (
      audioFileTypes.includes(file.type) ||
      file.name.endsWith(".mp3") ||
      file.name.endsWith(".wav") ||
      file.name.endsWith(".ogg") ||
      file.name.endsWith(".m4a")
    );
  };

  const isVideoFile = (file) => {
    return (
      videoFileTypes.includes(file.type) ||
      file.name.endsWith(".mp4") ||
      file.name.endsWith(".webm") ||
      file.name.endsWith(".mov") ||
      file.name.endsWith(".avi")
    );
  };

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
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  // Inside UploadPanel.jsx -> transcribeMedia function
  // Inside UploadPanel.jsx
  const transcribeMedia = async (file) => {
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
        // Determine type based on file properties
        const type = file.type.startsWith("video") ? "video" : "audio";
        onMediaTranscribe(file, data.transcript, type);
      }
    } catch (error) {
      console.error("Transcription Error:", error);
      setIsTranscribing(false);
    }
  };
  // Inside UploadPanel.jsx
  const handleYoutubeSubmit = async () => {
    if (!youtubeUrl.trim()) return;
    setIsTranscribing(true);

    try {
      const response = await fetch(`${API_URL}/api/youtube`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: youtubeUrl }),
      });

      if (!response.ok) throw new Error("YouTube transcription failed");
      const data = await response.json();

      setIsTranscribing(false);
      if (onMediaTranscribe) {
        // We pass an object that has a 'name' and a 'type'
        onMediaTranscribe(
          {
            name: `YouTube: ${youtubeUrl.split("v=")[1]?.slice(0, 5) || "Video"}`,
            type: "video/youtube", // AnalysisPage uses this to set the icon
          },
          data.transcript,
        );
      }
      setYoutubeUrl("");
    } catch (error) {
      console.error("YT Error:", error);
      setIsTranscribing(false);
    }
  };
  const handleFile = (file) => {
    if (isTextFile(file)) {
      onFileUpload(file);
      setShowTextInput(false);
      setMediaFile(null);
    } else if (isAudioFile(file) || isVideoFile(file)) {
      transcribeMedia(file);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleTextSubmit = () => {
    if (textValue.trim()) {
      onTextPaste(textValue);
    }
  };

  const clearUpload = () => {
    onFileUpload(null);
    onTextPaste("");
    setTextValue("");
    setMediaFile(null);
    setIsTranscribing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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

  const getFileTypeLabel = () => {
    if (mediaFile) {
      if (isVideoFile(mediaFile)) return "Video";
      if (isAudioFile(mediaFile)) return "Audio";
    }
    return "Document";
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-5 py-4 border-b border-dark-700">
        <h2 className="text-lg font-semibold text-white">Input</h2>
        <p className="text-sm text-gray-500 mt-1">
          Upload document, audio, video or YouTube link
        </p>
      </div>

      <div className="flex-1 p-5 overflow-y-auto space-y-4">
        {isTranscribing ? (
          /* Transcribing state (Your existing loader) */
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
            {/* NEW: YouTube Input Section */}
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

            {/* Drop zone (Your existing logic) */}
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
                accept=".txt,.pdf,.docx,audio/*,video/*"
                onChange={handleFileInput}
                className="hidden"
              />
              <Upload className="w-8 h-8 mx-auto mb-4 text-gray-400" />
              <p className="text-white font-medium mb-1">Upload File</p>
              <p className="text-xs text-gray-500">PDF, MP3, MP4, etc.</p>
            </div>

            {/* Text input toggle (Your existing logic) */}
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
          /* File preview (Your existing logic) */
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
