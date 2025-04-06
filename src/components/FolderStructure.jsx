import React, { useState, useEffect, useCallback } from 'react';
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
  FiMinimize2
} from 'react-icons/fi';

const FolderStructure = ({ 
  structure, 
  error, 
  onStructureUpdate,
  defaultExpanded = true,
  maxHeight = '35vh'
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [copied, setCopied] = useState(false);
  const MAX_FILE_SIZE_MB = 50;

  const getAllFolderPaths = useCallback((node) => {
    if (node.type !== 'directory') return [];
    let paths = [node.path];
    node.children?.forEach(child => {
      paths = [...paths, ...getAllFolderPaths(child)];
    });
    return paths;
  }, []);

  useEffect(() => {
    if (structure) {
      const allPaths = getAllFolderPaths(structure);
      setExpandedFolders(new Set(defaultExpanded ? allPaths : []));
    }
  }, [structure, defaultExpanded, getAllFolderPaths]);

  const areAllFoldersExpanded = useCallback(() => {
    if (!structure) return false;
    const allPaths = getAllFolderPaths(structure);
    return allPaths.length > 0 && allPaths.every(path => expandedFolders.has(path));
  }, [structure, expandedFolders, getAllFolderPaths]);

  const countItems = useCallback((node) => {
    if (!node.children) return 1;
    return 1 + node.children.reduce((sum, child) => sum + countItems(child), 0);
  }, []);

  const itemCount = structure ? countItems(structure) : 0;

  const copyVisualStructure = useCallback(() => {
    if (!structure) return;

    const renderStructureWithIcons = (node, prefix = '', isLast = true, isRoot = true) => {
      if (isRoot) {
        const rootLine = `📁 ${node.name}/`;
        const childLines = node.children.flatMap((child, i) => 
          renderStructureWithIcons(child, '    ', i === node.children.length - 1, false)
        );
        return [rootLine, ...childLines];
      }

      const connector = isLast ? '└── ' : '├── ';
      const icon = node.type === 'directory' ? '📂' : '📄';
      const line = `${prefix}${connector}${icon} ${node.name}${node.type === 'directory' ? '/' : ''}`;

      if (node.type !== 'directory' || !node.children || node.children.length === 0) {
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
  }, [structure]);

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
        children: []
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
            current.children.push({
              name: part,
              type: 'file',
              path: `${current.path}/${part}`
            });
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
          path: `${path}/${item.name}`
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
    onStructureUpdate(null, null);
    
    try {
      const item = e.dataTransfer.items[0];
      if (!item) throw new Error('No files were dropped');

      if (item.webkitGetAsEntry?.().isDirectory) {
        const structure = await readDirectoryStructure(item.webkitGetAsEntry());
        onStructureUpdate(structure, null);
        
        if (defaultExpanded) {
          const allPaths = getAllFolderPaths(structure);
          setExpandedFolders(new Set(allPaths));
        }
        return;
      }

      if (item.kind === 'file') {
        const file = item.getAsFile();
        
        if (/\.zip$/i.test(file.name)) {
          const structure = await extractZipStructure(file);
          onStructureUpdate(structure, null);
          
          if (defaultExpanded) {
            const allPaths = getAllFolderPaths(structure);
            setExpandedFolders(new Set(allPaths));
          }
          return;
        }

        throw new Error('Only folders and ZIP files are supported');
      }

      throw new Error('Unsupported item type');
    } catch (err) {
      console.error('Drop processing failed:', err);
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
            <FiFolder className="mr-1.5 text-teal-600 flex-shrink-0" />
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
            className={`flex items-center ${isFolder && hasChildren ? 'cursor-pointer hover:bg-gray-100' : ''} p-1 rounded`}
            onClick={() => isFolder && hasChildren && toggleFolder(node.path)}
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
              <FiFolder className="mr-1.5 text-teal-600 flex-shrink-0" />
            ) : (
              <FiFile className="mr-1.5 text-teal-500 flex-shrink-0" />
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

  return (
  <div className="p-4 md:p-6 group">
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-8 text-center mb-6 transition-colors ${
        isLoading 
          ? 'border-teal-400 bg-teal-50' 
          : error 
            ? 'border-red-400 bg-red-50' 
            : 'border-gray-300 bg-gray-50 hover:border-teal-400 cursor-pointer'
      }`}
    >
      <div className="flex flex-col items-center justify-center space-y-3">
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500"></div>
            <p className="text-teal-600 font-medium">Processing files...</p>
          </>
        ) : (
          <>
            <FiUpload className={`w-10 h-10 transition-colors ${
              error 
                ? 'text-red-400' 
                : 'text-gray-400 group-hover:text-teal-400'
            }`} />
            <div>
              <p className="text-lg font-medium text-gray-700">
                Drag and drop a folder or ZIP file
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Supported formats: folder, .zip (max {MAX_FILE_SIZE_MB}MB)
              </p>
            </div>
          </>
        )}
      </div>
    </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 text-red-700 p-4 rounded mb-6 flex items-start">
          <FiAlertCircle className="flex-shrink-0 mr-2 mt-0.5" />
          <div>
            <p className="font-medium">Error:</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {structure && !isLoading && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-700">Folder Structure: <span className="text-teal-600">{structure.name}</span></h3>
            <div className="flex gap-2">
              <button 
                onClick={toggleExpandAll}
                className="flex items-center text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                {areAllFoldersExpanded() ? (
                  <>
                    <FiMinimize2 className="mr-1.5" size={14} />
                    Collapse All
                  </>
                ) : (
                  <>
                    <FiMaximize2 className="mr-1.5" size={14} />
                    Expand All
                  </>
                )}
              </button>
              <button 
                onClick={copyVisualStructure}
                className="flex items-center text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                <FiCopy className="mr-1.5" size={14} />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-x-auto">
            <div 
              className="p-4 overflow-y-auto"
              style={{ maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight }}
            >
              {renderStructure(structure)}
            </div>
            <div className="bg-gray-50 px-4 py-2 text-xs text-gray-500 border-t border-gray-200 flex justify-between">
              <span>{itemCount} items</span>
              <span>{new Date().toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

FolderStructure.propTypes = {
  structure: PropTypes.shape({
    name: PropTypes.string,
    type: PropTypes.string,
    path: PropTypes.string,
    children: PropTypes.array,
  }),
  error: PropTypes.string,
  onStructureUpdate: PropTypes.func.isRequired,
  defaultExpanded: PropTypes.bool,
  maxHeight: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number
  ]),
};

FolderStructure.defaultProps = {
  defaultExpanded: true,
  maxHeight: '35vh'
};

export default FolderStructure;