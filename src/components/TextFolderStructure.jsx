import React, { useState, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import JSZip from 'jszip';
import { 
  FiCopy, 
  FiDownload, 
  FiAlertCircle,
  FiUpload,
  FiMaximize2,
  FiMinimize2,
  FiChevronUp,
  FiEye,
  FiEyeOff
} from 'react-icons/fi';

const TextFolderStructure = ({ 
  structure, 
  error, 
  onStructureUpdate,
  maxHeight = '35vh'
}) => {
  const [currentError, setCurrentError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isFullMode, setIsFullMode] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  
  const [isProcessingLocal, setIsProcessingLocal] = useState(false);
  
  const fullscreenRef = useRef(null);
  const fileInputRef = useRef(null);
  const MAX_FILE_SIZE_MB = 1000;

  const getAllFolderPaths = useCallback((node) => {
    if (node.type !== 'directory') return [];
    let paths = [node.path];
    if (node.children) {
      node.children.forEach(child => {
        paths = [...paths, ...getAllFolderPaths(child)];
      });
    }
    return paths;
  }, []);

  useEffect(() => {
    if (structure) {
      const allPaths = getAllFolderPaths(structure);
      setExpandedFolders(new Set(allPaths));
    } else {
      setExpandedFolders(new Set());
    }
  }, [structure, getAllFolderPaths]);

  useEffect(() => {
    const container = fullscreenRef.current;
    if (!container || !isFullMode) return;

    const handleScroll = () => {
      setShowScrollToTop(container.scrollTop > 300);
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [isFullMode]);

  const getSafeFilename = (name) => {
    if (!name) return 'folder-structure.txt';
    const cleanName = name
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    return cleanName ? `${cleanName}-structure.txt` : 'folder-structure.txt';
  };

  const areAllFoldersExpanded = useCallback(() => {
    if (!structure) return false;
    const allPaths = getAllFolderPaths(structure);
    return allPaths.length > 0 && allPaths.every(path => expandedFolders.has(path));
  }, [structure, expandedFolders, getAllFolderPaths]);

  const toggleExpandAll = () => {
    if (!structure) return;
    if (areAllFoldersExpanded()) {
      setExpandedFolders(new Set());
    } else {
      const allPaths = getAllFolderPaths(structure);
      setExpandedFolders(new Set(allPaths));
    }
  };

  const toggleFolder = (path, e) => {
    e.stopPropagation();
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const generateTextStructure = (node, prefix = '', isLast = true, isRoot = true) => {
    const isExpanded = expandedFolders.has(node.path);

    if (isRoot) {
      const rootLine = `${node.name}/`;
      const childLines = isExpanded && node.children ? node.children.flatMap((child, i) => 
        generateTextStructure(child, '', i === node.children.length - 1, false)
      ) : [];
      return [rootLine, ...childLines];
    }

    const connector = isLast ? '└── ' : '├── ';
    const line = `${prefix}${connector}${node.name}${node.type === 'directory' ? '/' : ''}`;

    if (node.type !== 'directory' || !node.children || node.children.length === 0 || !isExpanded) {
      return [line];
    }

    const childPrefix = prefix + (isLast ? '    ' : '│   ');
    const childLines = node.children.flatMap((child, i) => 
      generateTextStructure(child, childPrefix, i === node.children.length - 1, false)
    );

    return [line, ...childLines];
  };

  const renderInteractiveStructure = (node, prefix = '', isLast = true, isRoot = true) => {
    const isExpanded = expandedFolders.has(node.path);

    if (isRoot) {
      return (
        <div key={node.path || 'root'} className="leading-relaxed">
          <div 
            onClick={(e) => toggleFolder(node.path, e)}
            className="cursor-pointer hover:bg-gray-200/60 select-none inline-flex items-center rounded px-1 text-black font-bold"
          >
            {node.name}/
          </div>
          {isExpanded && node.children && (
            <div className="mt-0.5">
              {node.children.map((child, i) => 
                renderInteractiveStructure(child, '', i === node.children.length - 1, false)
              )}
            </div>
          )}
        </div>
      );
    }

    const connector = isLast ? '└── ' : '├── ';
    const isDir = node.type === 'directory';

    return (
      <div key={node.path} className="leading-relaxed whitespace-nowrap">
        <div 
          onClick={isDir ? (e) => toggleFolder(node.path, e) : undefined}
          className={`inline-flex items-center rounded px-1 transition-colors ${
            isDir 
              ? 'cursor-pointer hover:bg-gray-200/60 select-none text-black font-semibold' 
              : 'hover:bg-gray-100/50 font-normal'
          }`}
          style={!isDir ? { color: '#333333' } : undefined}
        >
          <span className="text-gray-400 font-normal select-none tracking-wider opacity-85">{prefix}{connector}</span>
          <span>{node.name}{isDir ? '/' : ''}</span>
        </div>
        {isDir && isExpanded && node.children && (
          <div className="mt-0.5">
            {node.children.map((child, i) => {
              const childPrefix = prefix + (isLast ? '    ' : '│   ');
              return renderInteractiveStructure(child, childPrefix, i === node.children.length - 1, false);
            })}
          </div>
        )}
      </div>
    );
  };

  const copyToClipboard = () => {
    if (!structure) return;
    
    const textToCopy = generateTextStructure(structure).join('\n');
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        setCurrentError('Failed to copy to clipboard');
      });
  };

  const downloadAsTextFile = () => {
    if (!structure) return;
    
    const textContent = generateTextStructure(structure).join('\n');
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getSafeFilename(structure.name);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
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

  const buildStructureFromFiles = (files) => {
    if (!files.length) return null;
    
    const firstPath = files[0].webkitRelativePath;
    const rootName = firstPath ? firstPath.split('/')[0] : 'Root';
    
    const root = {
      name: rootName,
      type: 'directory',
      path: rootName,
      children: []
    };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const pathStr = file.webkitRelativePath || file.name;
      const parts = pathStr.split('/');
      let current = root;

      const startIndex = parts.length > 1 ? 1 : 0;

      for (let j = startIndex; j < parts.length; j++) {
        const part = parts[j];
        const isLast = j === parts.length - 1;
        const path = parts.slice(0, j + 1).join('/');

        let existing = current.children.find(c => c.name === part);

        if (isLast) {
          if (!existing) {
            current.children.push({
              name: part,
              type: 'file',
              path: path,
              fileObject: file
            });
          }
        } else {
          if (!existing) {
            existing = {
              name: part,
              type: 'directory',
              path: path,
              children: []
            };
            current.children.push(existing);
          }
          current = existing;
        }
      }
    }

    const sortStructure = (node) => {
      node.children?.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'directory' ? -1 : 1;
      });
      node.children?.forEach(sortStructure);
    };
    
    sortStructure(root);
    return root;
  };

  const handleFileInput = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (typeof onStructureUpdate !== 'function') {
      console.error('onStructureUpdate is not a function');
      return;
    }

    setIsProcessingLocal(true);
    setCurrentError(null);

    setTimeout(async () => {
      try {
        if (files.length === 1 && /\.zip$/i.test(files[0].name)) {
          const structure = await extractZipStructure(files[0]);
          const allPaths = getAllFolderPaths(structure);
          setExpandedFolders(new Set(allPaths));
          onStructureUpdate(structure, null);
        } else {
          const structure = buildStructureFromFiles(files);
          if (!structure) throw new Error('Selected folder is empty or invalid.');
          const allPaths = getAllFolderPaths(structure);
          setExpandedFolders(new Set(allPaths));
          onStructureUpdate(structure, null);
        }
      } catch (err) {
        console.error('File reading failed:', err);
        setCurrentError(err.message);
        onStructureUpdate(null, err.message);
      } finally {
        setIsProcessingLocal(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }, 50);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (typeof onStructureUpdate !== 'function') {
      console.error('onStructureUpdate is not a function');
      return;
    }

    setIsProcessingLocal(true);
    setCurrentError(null);
    
    try {
      const item = e.dataTransfer.items[0];
      if (!item) throw new Error('No files were dropped');

      const entry = item.webkitGetAsEntry?.();

      if (entry?.isDirectory) {
        const structure = await readDirectoryStructure(entry);
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
      setIsProcessingLocal(false);
    }
  };

  const countItems = useCallback((node) => {
    if (!node.children) return 1;
    return 1 + node.children.reduce((sum, child) => sum + countItems(child), 0);
  }, []);

  const displayError = error || currentError;
  const itemCount = structure ? countItems(structure) : 0;

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
            {isFullScreen ? <FiMinimize2 title='Exit Full Screen' size={14} /> : <FiMaximize2 title='Full Screen' size={14} />}
          </button>
          <button 
            onClick={toggleExpandAll}
            className="flex items-center text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            {areAllFoldersExpanded() ? <FiEyeOff className="mr-1.5" size={14} /> : <FiEye className="mr-1.5" size={14} />}
            {areAllFoldersExpanded() ? 'Collapse All' : 'Expand All'}
          </button>
          <button 
            onClick={copyToClipboard}
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
          className={`p-5 overflow-x-auto overflow-y-auto font-mono text-sm bg-gray-50/60 selection:bg-rose-100 ${
            isFullScreen ? 'flex-1' : ''
          }`}
          style={{ 
            maxHeight: isFullScreen ? 'none' : (typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight)
          }}
        >
          <div className="text-left align-middle select-text">
            {renderInteractiveStructure(structure)}
          </div>
        </div>
        <div className="bg-gray-50 px-4 py-2 text-xs text-gray-500 border-t border-gray-200 flex justify-between">
          <span>{itemCount} items</span>
          <span>{new Date().toLocaleString()}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 group relative">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInput}
        className="hidden"
        webkitdirectory="true"
        directory="true"
        multiple
      />
      
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center mb-6 transition-colors ${
          isProcessingLocal 
            ? 'border-rose-400 bg-gray-50/60' 
            : displayError
              ? 'border-red-400 bg-red-50' 
              : 'border-gray-300 bg-gray-50/60 hover:border-rose-400 cursor-pointer'
        }`}
      >
        <div className="flex flex-col items-center justify-center space-y-3 pointer-events-none">
          {isProcessingLocal ? (
            <>
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500"></div>
              <p className="text-rose-600 font-medium">Processing files...</p>
            </>
          ) : (
            <>
              <FiUpload className={`w-10 h-10 transition-colors ${
                displayError ? 'text-red-400' : 'text-gray-400 group-hover:text-rose-400'
              }`} />
              <div>
                <p className="text-lg font-medium text-gray-700">
                  Click to browse folder or Drag & Drop
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

      {structure && !isProcessingLocal && (
        <>
          <div className={isFullMode ? 'hidden' : ''}>
            {renderContent(false)}
          </div>
          {isFullMode && (
            <div 
              ref={fullscreenRef}
              className="fixed inset-0 bg-white z-50 p-6 overflow-auto"
            >
              <div className="max-w-6xl mx-auto min-h-full">
                {renderContent(true)}
              </div>
            </div>
          )}
        </>
      )}

      {isFullMode && showScrollToTop && (
        <button
          onClick={() => fullscreenRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 p-3 bg-rose-600 text-white rounded-full shadow-lg hover:bg-rose-700 transition-colors z-[9999]"
          aria-label="Scroll to top"
        >
          <FiChevronUp size={20} />
        </button>
      )}
    </div>
  );
};

TextFolderStructure.propTypes = {
  structure: PropTypes.shape({
    name: PropTypes.string,
    type: PropTypes.string,
    path: PropTypes.string,
    children: PropTypes.array,
    fileMap: PropTypes.instanceOf(Map)
  }),
  error: PropTypes.string,
  onStructureUpdate: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
  setIsLoading: PropTypes.func.isRequired,
  maxHeight: PropTypes.oneOfType([
    PropTypes.string, 
    PropTypes.number  
  ]),
};

TextFolderStructure.defaultProps = {
  maxHeight: '35vh'
};

export default TextFolderStructure;