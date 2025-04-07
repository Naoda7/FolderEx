import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import JSZip from 'jszip';
import { 
  FiCopy, 
  FiFolder, 
  FiFile, 
  FiChevronRight, 
  FiChevronDown,
  FiUpload,
  FiAlertCircle,
  FiMaximize2,
  FiMinimize2,
  FiFileText,
  FiImage,
  FiCode,
  FiMusic,
  FiVideo,
  FiFileMinus,
  FiDownload,
  FiX,
  FiEye,
  FiEyeOff
} from 'react-icons/fi';

const PreviewFile = ({ file, onClose }) => {
  const [content, setContent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const getFileType = (filename) => {
    if (!filename) return 'other';
    const ext = filename.split('.').pop().toLowerCase();
    const textFiles = ['txt', 'md', 'json', 'csv', 'log', 'html', 'css'];
    const imageFiles = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'];
    const codeFiles = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'php'];
    const mediaFiles = ['mp3', 'wav', 'ogg'];
    const videoFiles = ['mp4', 'webm', 'mov'];

    if (textFiles.includes(ext)) return 'text';
    if (imageFiles.includes(ext)) return 'image';
    if (codeFiles.includes(ext)) return 'code';
    if (mediaFiles.includes(ext)) return 'audio';
    if (videoFiles.includes(ext)) return 'video';
    return 'other';
  };

  const getFileIcon = (type) => {
    switch (type) {
      case 'text': return <FiFileText className="mr-2" />;
      case 'image': return <FiImage className="mr-2" />;
      case 'code': return <FiCode className="mr-2" />;
      case 'audio': return <FiMusic className="mr-2" />;
      case 'video': return <FiVideo className="mr-2" />;
      default: return <FiFileMinus className="mr-2" />;
    }
  };

  useEffect(() => {
    if (!file) return;

    const fileType = getFileType(file.name);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      setIsLoading(false);
      
      if (fileType === 'image') {
        setContent(
          <div className="flex justify-center">
            <img 
              src={e.target.result} 
              alt={file.name} 
              className="max-h-64 max-w-full object-contain"
            />
          </div>
        );
      } else if (fileType === 'text' || fileType === 'code') {
        setContent(
          <pre className="bg-gray-100 p-4 rounded-md overflow-auto max-h-64">
            {e.target.result}
          </pre>
        );
      } else {
        setContent(
          <div className="text-center py-8 text-gray-500">
            <p>Preview not available for this file type</p>
            <p className="text-sm mt-2">Download the file to view full content</p>
          </div>
        );
      }
    };
    
    reader.onerror = () => {
      setIsLoading(false);
      setError('Failed to read file');
    };

    if (fileType === 'image') {
      reader.readAsDataURL(file);
    } else if (fileType === 'text' || fileType === 'code') {
      reader.readAsText(file);
    } else {
      setIsLoading(false);
      setContent(
        <div className="text-center py-8 text-gray-500">
          <p>Preview not available for this file type</p>
          <p className="text-sm mt-2">Download the file to view full content</p>
        </div>
      );
    }

    return () => {
      reader.abort();
    };
  }, [file]);

  if (!file) return null;

  const fileType = getFileType(file.name);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center border-b p-4">
          <div className="flex items-center">
            {getFileIcon(fileType)}
            <h3 className="font-medium truncate max-w-xs">{file.name}</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <FiX />
          </button>
        </div>
        
        <div className="p-4 overflow-auto flex-1">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border-l-4 border-red-400 text-red-700 p-4 rounded">
              <p>{error}</p>
            </div>
          ) : (
            content
          )}
        </div>
        
        <div className="border-t p-4 flex justify-end">
          <a
            href={URL.createObjectURL(file)}
            download={file.name}
            className="px-4 py-2 bg-rose-600 text-white rounded hover:bg-rose-700 transition-colors"
          >
            Download File
          </a>
        </div>
      </div>
    </div>
  );
};

const FolderStructure = ({ 
  structure, 
  error, 
  expandedFolders,
  setExpandedFolders,
  isLoading,
  setIsLoading,
  onStructureUpdate,
  maxHeight = '35vh'
}) => {
  const [copied, setCopied] = useState(false);
  const [currentError, setCurrentError] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [isFullMode, setIsFullMode] = useState(false);
  const MAX_FILE_SIZE_MB = 50;

  const areAllFoldersExpanded = useCallback(() => {
    if (!structure) return false;
    const allPaths = getAllFolderPaths(structure);
    return allPaths.length > 0 && allPaths.every(path => expandedFolders.has(path));
  }, [structure, expandedFolders]);

  const countItems = useCallback((node) => {
    if (!node.children) return 1;
    return 1 + node.children.reduce((sum, child) => sum + countItems(child), 0);
  }, []);

  const itemCount = structure ? countItems(structure) : 0;

  const getFileIconComponent = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    
    const iconMap = {
      txt: <FiFileText className="text-blue-500" />,
      pdf: <FiFileText className="text-red-500" />,
      doc: <FiFileText className="text-blue-600" />,
      docx: <FiFileText className="text-blue-600" />,
      md: <FiFileText className="text-gray-600" />,
      csv: <FiFileText className="text-green-600" />,
      xls: <FiFileText className="text-green-600" />,
      xlsx: <FiFileText className="text-green-600" />,
      jpg: <FiImage className="text-yellow-500" />,
      jpeg: <FiImage className="text-yellow-500" />,
      png: <FiImage className="text-blue-400" />,
      gif: <FiImage className="text-purple-400" />,
      svg: <FiImage className="text-orange-400" />,
      webp: <FiImage className="text-green-400" />,
      js: <FiCode className="text-yellow-400" />,
      jsx: <FiCode className="text-blue-300" />,
      ts: <FiCode className="text-blue-500" />,
      html: <FiCode className="text-orange-500" />,
      css: <FiCode className="text-blue-400" />,
      json: <FiCode className="text-gray-500" />,
      py: <FiCode className="text-blue-400" />,
      java: <FiCode className="text-red-400" />,
      mp3: <FiMusic className="text-purple-500" />,
      wav: <FiMusic className="text-blue-400" />,
      mp4: <FiVideo className="text-red-400" />,
      mov: <FiVideo className="text-blue-500" />,
      zip: <FiFile className="text-yellow-600" />,
      rar: <FiFile className="text-red-500" />,
      '7z': <FiFile className="text-green-500" />,
      default: <FiFile className="text-gray-400" />
    };

    return iconMap[extension] || iconMap.default;
  };

  const downloadAsTextFile = useCallback(() => {
    if (!structure) return;

    const renderStructureWithIcons = (node, prefix = '', isLast = true, isRoot = true) => {
      const isExpanded = expandedFolders.has(node.path);
      
      if (isRoot) {
        const rootLine = `📁 ${node.name}/`;
        const childLines = isExpanded ? node.children.flatMap((child, i) => 
          renderStructureWithIcons(child, '    ', i === node.children.length - 1, false)
        ) : [];
        return [rootLine, ...childLines];
      }

      const connector = isLast ? '└── ' : '├── ';
      const icon = node.type === 'directory' ? (isExpanded ? '📂' : '📁') : '📄';
      const line = `${prefix}${connector}${icon} ${node.name}${node.type === 'directory' ? '/' : ''}`;

      if (node.type !== 'directory' || !node.children || node.children.length === 0 || !isExpanded) {
        return [line];
      }

      const childPrefix = prefix + (isLast ? '    ' : '│   ');
      const childLines = node.children.flatMap((child, i) => 
        renderStructureWithIcons(child, childPrefix, i === node.children.length - 1, false)
      );

      return [line, ...childLines];
    };

    const structureWithIcons = renderStructureWithIcons(structure);
    const textContent = structureWithIcons.join('\n');
    
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `folder-structure-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [structure, expandedFolders]);

  const copyVisualStructure = useCallback(() => {
    if (!structure) return;

    const renderStructureWithIcons = (node, prefix = '', isLast = true, isRoot = true) => {
      const isExpanded = expandedFolders.has(node.path);
      
      if (isRoot) {
        const rootLine = `📁 ${node.name}/`;
        const childLines = isExpanded ? node.children.flatMap((child, i) => 
          renderStructureWithIcons(child, '    ', i === node.children.length - 1, false)
        ) : [];
        return [rootLine, ...childLines];
      }

      const connector = isLast ? '└── ' : '├── ';
      const icon = node.type === 'directory' ? (isExpanded ? '📂' : '📁') : '📄';
      const line = `${prefix}${connector}${icon} ${node.name}${node.type === 'directory' ? '/' : ''}`;

      if (node.type !== 'directory' || !node.children || node.children.length === 0 || !isExpanded) {
        return [line];
      }

      const childPrefix = prefix + (isLast ? '    ' : '│   ');
      const childLines = node.children.flatMap((child, i) => 
        renderStructureWithIcons(child, childPrefix, i === node.children.length - 1, false)
      );

      return [line, ...childLines];
    };

    const structureWithIcons = renderStructureWithIcons(structure);
    navigator.clipboard.writeText(structureWithIcons.join('\n'))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy:', err);
      });
  }, [structure, expandedFolders]);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const extractZipStructure = async (file) => {
    try {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        throw new Error(`File exceeds ${MAX_FILE_SIZE_MB}MB limit`);
      }

      const zip = new JSZip();
      const content = await zip.loadAsync(file);
      const root = {
        name: file.name.replace(/\.zip$/i, ''),
        type: 'directory',
        path: '',
        children: [],
        fileMap: new Map()
      };

      Object.keys(content.files).forEach(relativePath => {
        const zipEntry = content.files[relativePath];
        const parts = relativePath.split('/').filter(part => part.length > 0);
        let current = root;

        parts.forEach((part, i) => {
          const isDirectory = zipEntry.dir || i < parts.length - 1;
          const existing = current.children.find(child => child.name === part);

          if (isDirectory) {
            if (!existing) {
              const newDir = {
                name: part,
                type: 'directory',
                path: `${current.path}/${part}`,
                children: []
              };
              current.children.push(newDir);
              current = newDir;
            } else {
              current = existing;
            }
          } else if (!existing) {
            const fileNode = {
              name: part,
              type: 'file',
              path: `${current.path}/${part}`,
              zipEntry: zipEntry
            };
            current.children.push(fileNode);
            root.fileMap.set(fileNode.path, zipEntry);
          }
        });
      });

      const sortStructure = (node) => {
        node.children?.sort((a, b) => {
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === 'directory' ? -1 : 1;
        });
        node.children?.forEach(sortStructure);
      };
      sortStructure(root);

      return root;
    } catch (err) {
      throw new Error(`Failed to process ZIP: ${err.message}`);
    }
  };

  const readDirectoryStructure = async (entry, currentPath = '') => {
    const reader = entry.createReader();
    const path = currentPath ? `${currentPath}/${entry.name}` : entry.name;
    const dirStructure = {
      name: entry.name,
      type: 'directory',
      path,
      children: []
    };

    const entries = await new Promise((resolve) => {
      reader.readEntries(resolve, () => resolve([]));
    });

    for (const item of entries) {
      if (item.isDirectory) {
        const subDir = await readDirectoryStructure(item, path);
        dirStructure.children.push(subDir);
      } else {
        dirStructure.children.push({
          name: item.name,
          type: 'file',
          path: `${path}/${item.name}`,
          fileEntry: item
        });
      }
    }

    dirStructure.children.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'directory' ? -1 : 1;
    });

    return dirStructure;
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (typeof onStructureUpdate !== 'function') {
      console.error('onStructureUpdate is not a function');
      return;
    }

    setIsLoading(true);
    setCurrentError(null);
    
    try {
      const item = e.dataTransfer.items[0];
      if (!item) throw new Error('No files were dropped');

      if (item.webkitGetAsEntry?.().isDirectory) {
        const structure = await readDirectoryStructure(item.webkitGetAsEntry());
        const allPaths = getAllFolderPaths(structure);
        setExpandedFolders(new Set(allPaths));
        onStructureUpdate(structure, null);
        return;
      }

      if (item.kind === 'file') {
        const file = item.getAsFile();
        
        if (/\.zip$/i.test(file.name)) {
          const structure = await extractZipStructure(file);
          const allPaths = getAllFolderPaths(structure);
          setExpandedFolders(new Set(allPaths));
          onStructureUpdate(structure, null);
          return;
        }

        throw new Error('Only folders and ZIP files are supported');
      }

      throw new Error('Unsupported item type');
    } catch (err) {
      console.error('Drop processing failed:', err);
      setCurrentError(err.message);
      onStructureUpdate(null, err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFolder = (path) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      newSet.has(path) ? newSet.delete(path) : newSet.add(path);
      return newSet;
    });
  };

  const toggleExpandAll = () => {
    if (!structure) return;
    
    if (areAllFoldersExpanded()) {
      setExpandedFolders(new Set());
    } else {
      const allPaths = getAllFolderPaths(structure);
      setExpandedFolders(new Set(allPaths));
    }
  };

  const handleFileClick = async (node) => {
    if (node.type !== 'file') return;
    
    try {
      setIsLoading(true);
      
      if (node.zipEntry && structure.fileMap) {
        const zipEntry = structure.fileMap.get(node.path);
        if (zipEntry) {
          const ext = node.name.split('.').pop().toLowerCase();
          const mimeTypes = {
            'txt': 'text/plain',
            'md': 'text/markdown',
            'json': 'application/json',
            'js': 'application/javascript',
            'jsx': 'application/javascript',
            'ts': 'application/typescript',
            'html': 'text/html',
            'css': 'text/css',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'svg': 'image/svg+xml'
          };

          const mimeType = mimeTypes[ext] || 'application/octet-stream';
          const content = await zipEntry.async('blob');
          const file = new File([content], node.name, { type: mimeType });
          setPreviewFile(file);
          return;
        }
      } 
      else if (node.fileEntry) {
        const file = await new Promise((resolve, reject) => {
          node.fileEntry.file(resolve, reject);
        });
        
        if (file.size > 5 * 1024 * 1024) {
          throw new Error('File too large for preview (max 5MB)');
        }
        
        setPreviewFile(file);
        return;
      }
      
      throw new Error('File source not recognized');
    } catch (err) {
      console.error('Failed to load file:', err);
      setPreviewFile(null);
    } finally {
      setIsLoading(false);
    }
  };

  const renderStructure = (node, level = 0, isLast = true, parentPrefixes = []) => {
    const isFolder = node.type === 'directory';
    const isExpanded = isFolder && expandedFolders.has(node.path);
    const hasChildren = isFolder && node.children?.length > 0;
    const isRoot = level === 0;

    if (isRoot) {
      return (
        <div key={node.path} className="font-mono text-sm">
          <div 
            className={`flex items-center ${hasChildren ? 'cursor-pointer hover:bg-gray-100' : ''} p-1 rounded`}
            onClick={() => hasChildren && toggleFolder(node.path)}
          >
            {hasChildren ? (
              isExpanded ? (
                <FiChevronDown className="mr-1.5 text-gray-500 flex-shrink-0" />
              ) : (
                <FiChevronRight className="mr-1.5 text-gray-500 flex-shrink-0" />
              )
            ) : (
              <span className="w-5 mr-1"></span>
            )}
            <FiFolder className="mr-1.5 text-rose-600 flex-shrink-0" />
            <span className="font-medium truncate">{node.name}/</span>
          </div>
          {hasChildren && isExpanded && (
            <div className="ml-6">
              {node.children.map((child, index) =>
                renderStructure(
                  child,
                  level + 1,
                  index === node.children.length - 1,
                  []
                )
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <div key={node.path} className="flex flex-col">
        <div className="flex items-center">
          <div className="flex">
            {parentPrefixes.map((showLine, i) => (
              <div 
                key={i} 
                className={`w-4 ${showLine ? 'border-l-2 border-gray-300' : ''} h-6`}
              />
            ))}
          </div>
          
          <div className={`w-4 flex justify-center ${isLast ? '' : 'border-l-2 border-gray-300'}`}>
            <div className={`w-4 h-4 border-b-2 border-gray-300 ${isLast ? 'border-l-2 rounded-bl' : ''}`}/>
          </div>

          <div 
            className={`flex items-center ${
              isFolder && hasChildren ? 'cursor-pointer hover:bg-gray-100' : 'cursor-pointer'
            } p-1 rounded`}
            onClick={() => isFolder && hasChildren ? toggleFolder(node.path) : handleFileClick(node)}
          >
            {isFolder && hasChildren ? (
              isExpanded ? (
                <FiChevronDown className="mr-1.5 text-gray-500 flex-shrink-0" />
              ) : (
                <FiChevronRight className="mr-1.5 text-gray-500 flex-shrink-0" />
              )
            ) : (
              null
            )}
            {isFolder ? (
              <FiFolder className="mr-1.5 text-rose-600 flex-shrink-0" />
            ) : (
              <span className="mr-1.5 flex-shrink-0">
                {getFileIconComponent(node.name)}
              </span>
            )}
            <span className={`${isFolder ? 'font-medium' : ''} truncate`}>
              {node.name}
              {isFolder ? '/' : ''}
            </span>
          </div>
        </div>

        {isFolder && isExpanded && hasChildren && (
          <div className="ml-8">
            {node.children.map((child, index) =>
              renderStructure(
                child,
                level + 1,
                index === node.children.length - 1,
                [...parentPrefixes, !isLast]
              )
            )}
          </div>
        )}
      </div>
    );
  };

  const renderContent = (isFullScreen = false) => (
    <div className={`space-y-4 ${isFullScreen ? 'h-full' : ''}`}>
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-700">
          Folder Structure: <span className="text-rose-600">{structure.name}</span>
        </h3>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsFullMode(!isFullScreen)}
            className="flex items-center text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            {isFullScreen ? (
              <FiMinimize2 title='Exit Full Screen' size={14} />
            ) : (
              <FiMaximize2 title='Full Screen' size={14} />
            )}
          </button>
          <button 
            onClick={toggleExpandAll}
            className="flex items-center text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            {areAllFoldersExpanded() ? (
              <FiEyeOff className="mr-1.5" size={14} />
            ) : (
              <FiEye className="mr-1.5" size={14} />
            )}
            {areAllFoldersExpanded() ? 'Collapse All' : 'Expand All'}
          </button>
          <button 
            onClick={copyVisualStructure}
            className="flex items-center text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            <FiCopy className="mr-1.5" size={14} />
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button 
            onClick={downloadAsTextFile}
            className="flex items-center text-sm px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-md transition-colors"
          >
            <FiDownload className="mr-1.5" size={14} />
            Download
          </button>
        </div>
      </div>
      
      <div className={`bg-gray-50/60 rounded-lg border border-gray-100 overflow-hidden ${
        isFullScreen ? 'flex-1 flex flex-col' : ''
      }`}>
        <div 
          className={`p-4 overflow-x-auto overflow-y-auto font-mono text-sm bg-gray-50/60 ${
            isFullScreen ? 'flex-1' : ''
          }`}
          style={{ 
            maxHeight: isFullScreen ? 'none' : (typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight)
          }}
        >
          {renderStructure(structure)}
        </div>
        <div className="bg-gray-50 px-4 py-2 text-xs text-gray-500 border-t border-gray-200 flex justify-between">
          <span>{itemCount} items</span>
          <span>{new Date().toLocaleString()}</span>
        </div>
      </div>
    </div>
  );

  const displayError = error || currentError;

  return (
    <div className="p-4 md:p-6 group">
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center mb-6 transition-colors ${
          isLoading 
            ? 'border-rose-400 bg-gray-50/60' 
            : displayError 
              ? 'border-red-400 bg-red-50' 
              : 'border-gray-300 bg-gray-50/60 hover:border-rose-400 cursor-pointer'
        }`}
      >
        <div className="flex flex-col items-center justify-center space-y-3">
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500"></div>
              <p className="text-rose-600 font-medium">Processing files...</p>
            </>
          ) : (
            <>
              <FiUpload className={`w-10 h-10 transition-colors ${
                displayError 
                  ? 'text-red-400' 
                  : 'text-gray-400 group-hover:text-rose-400'
              }`} />
              <div>
                <p className="text-lg font-medium text-gray-700">
                  Drag and drop a folder or ZIP file
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Supported formats: folder, .zip (max {MAX_FILE_SIZE_MB}MB)
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  The files you upload are not saved
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {displayError && (
        <div className="bg-red-50 border-l-4 border-red-400 text-red-700 p-4 rounded mb-6 flex items-start">
          <FiAlertCircle className="flex-shrink-0 mr-2 mt-0.5" />
          <div>
            <p className="font-medium">Error:</p>
            <p>{displayError}</p>
          </div>
        </div>
      )}

      {structure && !isLoading && (
        <>
          {/* Normal Mode */}
          <div className={isFullMode ? 'hidden' : ''}>
            {renderContent(false)}
          </div>

          {/* Full Screen Mode */}
          {isFullMode && (
            <div className="fixed inset-0 bg-white z-50 p-6 overflow-auto">
              <div className="max-w-6xl mx-auto h-full flex flex-col">
                {renderContent(true)}
              </div>
            </div>
          )}
        </>
      )}

      {previewFile && (
        <PreviewFile 
          file={previewFile}
          onClose={() => {
            setPreviewFile(null);
            setIsLoading(false);
          }}
        />
      )}
    </div>
  );
};

function getAllFolderPaths(node) {
  if (node.type !== 'directory') return [];
  let paths = [node.path];
  if (node.children) {
    node.children.forEach(child => {
      paths = [...paths, ...getAllFolderPaths(child)];
    });
  }
  return paths;
}

FolderStructure.propTypes = {
  structure: PropTypes.shape({
    name: PropTypes.string,
    type: PropTypes.string,
    path: PropTypes.string,
    children: PropTypes.array,
    fileMap: PropTypes.instanceOf(Map)
  }),
  error: PropTypes.string,
  expandedFolders: PropTypes.instanceOf(Set).isRequired,
  setExpandedFolders: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
  setIsLoading: PropTypes.func.isRequired,
  onStructureUpdate: PropTypes.func.isRequired,
  maxHeight: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number
  ])
};

FolderStructure.defaultProps = {
  maxHeight: '35vh'
};

export default FolderStructure;