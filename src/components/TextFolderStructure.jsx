import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import JSZip from 'jszip';
import { 
  FiCopy, 
  FiDownload, 
  FiAlertCircle,
  FiUpload,
  FiMaximize2,
  FiX,
  FiMinimize2
} from 'react-icons/fi';

const TextFolderStructure = ({ 
  structure, 
  error, 
  onStructureUpdate,
  isLoading,
  setIsLoading,
  maxHeight = '35vh'
}) => {
  const [currentError, setCurrentError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isFullMode, setIsFullMode] = useState(false);
  const MAX_FILE_SIZE_MB = 50;

  const getSafeFilename = (name) => {
    if (!name) return 'folder-structure.txt';
    const cleanName = name
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    return cleanName ? `${cleanName}-structure.txt` : 'folder-structure.txt';
  };

  const copyToClipboard = () => {
    if (!structure) return;
    
    const textToCopy = renderStructure(structure).join('\n');
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
    
    const textContent = renderStructure(structure).join('\n');
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
    
    setIsLoading(true);
    setCurrentError(null);
    onStructureUpdate(null, null);
    
    try {
      const item = e.dataTransfer.items[0];
      if (!item) throw new Error('No files were dropped');

      if (item.webkitGetAsEntry?.().isDirectory) {
        const structure = await readDirectoryStructure(item.webkitGetAsEntry());
        onStructureUpdate(structure, null);
        return;
      }

      if (item.kind === 'file') {
        const file = item.getAsFile();
        
        if (/\.zip$/i.test(file.name)) {
          const structure = await extractZipStructure(file);
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

  const renderStructure = (node, prefix = '', isLast = true, isRoot = true) => {
    if (isRoot) {
      const rootLine = `${node.name}/`;
      const childLines = node.children.flatMap((child, i) => 
        renderStructure(child, '    ', i === node.children.length - 1, false)
      );
      return [rootLine, ...childLines];
    }

    const connector = isLast ? '└── ' : '├── ';
    const line = `${prefix}${connector}${node.name}${node.type === 'directory' ? '/' : ''}`;

    if (node.type !== 'directory' || !node.children || node.children.length === 0) {
      return [line];
    }

    const childPrefix = prefix + (isLast ? '    ' : '│   ');
    const childLines = node.children.flatMap((child, i) => 
      renderStructure(child, childPrefix, i === node.children.length - 1, false)
    );

    return [line, ...childLines];
  };

  const countItems = useCallback((node) => {
    if (!node.children) return 1;
    return 1 + node.children.reduce((sum, child) => sum + countItems(child), 0);
  }, []);

  const displayError = error || currentError;
  const itemCount = structure ? countItems(structure) : 0;

  // Konten utama yang akan digunakan di normal mode dan full mode
  const renderContent = (isFullScreen = false) => (
    <div className={`space-y-4 ${isFullScreen ? 'h-full' : ''}`}>
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-700">
          Folder Structure: <span className="text-rose-600">{structure.name}</span>
        </h3>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsFullMode(!isFullScreen)}
            className={`flex items-center text-sm px-3 py-1.5 rounded-md transition-colors ${
              isFullScreen 
                ? 'bg-gray-100 hover:bg-gray-200' 
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {isFullScreen ? (
              <FiMinimize2 title='Exit Full Screen' size={14} />
            ) : (
              <FiMaximize2 title='Full Screen' size={14} />
            )}
            {isFullScreen ? '' : ''}
          </button>
          <button 
            onClick={copyToClipboard}
            className="flex items-center text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            title="Copy to clipboard"
          >
            <FiCopy className="mr-1.5" size={14} />
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button 
            onClick={downloadAsTextFile}
            className="flex items-center text-sm px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-md transition-colors"
            title="Download as TXT"
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
          <pre className="whitespace-pre">
            {renderStructure(structure).join('\n')}
          </pre>
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