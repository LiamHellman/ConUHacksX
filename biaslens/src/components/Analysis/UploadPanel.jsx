import { useState, useRef } from 'react';
import { Upload, FileText, X, ClipboardPaste } from 'lucide-react';

export default function UploadPanel({ onFileUpload, onTextPaste, uploadedFile, pastedText }) {
  const [isDragging, setIsDragging] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textValue, setTextValue] = useState(pastedText || '');
  const fileInputRef = useRef(null);

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

  const handleFile = (file) => {
    const validTypes = [
      'text/plain',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (validTypes.includes(file.type) || file.name.endsWith('.txt') || file.name.endsWith('.pdf') || file.name.endsWith('.docx')) {
      onFileUpload(file);
      setShowTextInput(false);
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
    onTextPaste('');
    setTextValue('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-5 py-4 border-b border-dark-700">
        <h2 className="text-lg font-semibold text-white">Input</h2>
        <p className="text-sm text-gray-500 mt-1">Upload or paste your document</p>
      </div>

      <div className="flex-1 p-5 overflow-y-auto">
        {!uploadedFile && !pastedText ? (
          <>
            {/* Drop zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                transition-all duration-300 group
                ${isDragging 
                  ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20' 
                  : 'border-dark-500 hover:border-purple-500/50 hover:bg-dark-700/50'
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.pdf,.docx"
                onChange={handleFileInput}
                className="hidden"
              />
              
              <div className={`
                w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center
                transition-all duration-300
                ${isDragging 
                  ? 'bg-purple-500/20 text-purple-400' 
                  : 'bg-dark-700 text-gray-400 group-hover:bg-purple-500/10 group-hover:text-purple-400'
                }
              `}>
                <Upload className="w-8 h-8" />
              </div>
              
              <p className="text-white font-medium mb-2">
                {isDragging ? 'Drop your file here' : 'Drag & drop your file'}
              </p>
              <p className="text-sm text-gray-500">
                Supports .txt, .pdf, .docx
              </p>

              {isDragging && (
                <div className="absolute inset-0 rounded-xl bg-purple-500/5 pointer-events-none" />
              )}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-dark-600" />
              <span className="text-sm text-gray-500">or</span>
              <div className="flex-1 h-px bg-dark-600" />
            </div>

            {/* Text input toggle */}
            {!showTextInput ? (
              <button
                onClick={() => setShowTextInput(true)}
                className="w-full flex items-center justify-center gap-2 py-4 border border-dark-500 hover:border-purple-500/50 rounded-xl text-gray-400 hover:text-purple-400 transition-all duration-300"
              >
                <ClipboardPaste className="w-5 h-5" />
                <span>Paste text directly</span>
              </button>
            ) : (
              <div className="space-y-4">
                <textarea
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  placeholder="Paste your text here..."
                  className="w-full h-48 px-4 py-3 bg-dark-800 border border-dark-600 focus:border-purple-500 rounded-xl text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowTextInput(false)}
                    className="flex-1 py-3 border border-dark-500 hover:border-dark-400 rounded-lg text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleTextSubmit}
                    disabled={!textValue.trim()}
                    className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-dark-600 disabled:text-gray-500 rounded-lg text-white font-medium transition-colors"
                  >
                    Use Text
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* File preview */
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-6 h-6 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">
                  {uploadedFile ? uploadedFile.name : 'Pasted Text'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {uploadedFile 
                    ? `${(uploadedFile.size / 1024).toFixed(1)} KB`
                    : `${pastedText.length} characters`
                  }
                </p>
              </div>
              <button
                onClick={clearUpload}
                className="p-2 hover:bg-dark-700 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {pastedText && (
              <div className="mt-4 pt-4 border-t border-dark-600">
                <p className="text-sm text-gray-400 line-clamp-4">
                  {pastedText}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
