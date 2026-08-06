import { useState, useEffect } from 'react';
import FolderStructure from './components/FolderStructure';
import TextFolderStructure from './components/TextFolderStructure';

function App() {
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('folderViewMode') || 'text';
  });

  const [structure, setStructure] = useState(null);
  const [error, setError] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem('folderViewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      localStorage.setItem('folderViewMode', 'text');
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const handleStructureUpdate = (newStructure, errorMsg = null) => {
    setStructure(newStructure);
    setError(errorMsg);
    setIsLoading(false);
    
    if (newStructure) {
      const allPaths = getAllFolderPaths(newStructure);
      setExpandedFolders(new Set(allPaths));
    }
  };

  const getAllFolderPaths = (node) => {
    if (node.type !== 'directory') return [];
    let paths = [node.path];
    if (node.children) {
      node.children.forEach(child => {
        paths = [...paths, ...getAllFolderPaths(child)];
      });
    }
    return paths;
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-start py-8 px-4 w-full bg-white min-h-screen">
      <div className="w-full max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Folder Structure Viewer</h1>
          <p className="text-gray-600">
            {viewMode === 'text' 
              ? 'Text view of your folder structure' 
              : 'Visual folder navigation with file previews'}
          </p>
        </div>

        <div className="flex justify-center mb-8">
          <button 
            onClick={() => setViewMode('text')}
            className={`px-4 py-2 rounded-l-lg transition-colors ${
              viewMode === 'text' 
                ? 'bg-rose-600 text-white' 
                : 'bg-gray-200/60 hover:bg-gray-300/60'
            }`}
          >
            Text View
          </button>
          <button 
            onClick={() => setViewMode('folder')}
            className={`px-4 py-2 rounded-r-lg transition-colors ${
              viewMode === 'folder' 
                ? 'bg-rose-600 text-white' 
                : 'bg-gray-200/60 hover:bg-gray-300/60'
            }`}
          >
            Folder View
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-md shadow-gray-200/40 border-2 border-gray-400/10 overflow-hidden w-full transition-all duration-200">
          {viewMode === 'text' ? (
            <TextFolderStructure 
              structure={structure}
              error={error}
              onStructureUpdate={handleStructureUpdate}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          ) : (
            <FolderStructure 
              structure={structure}
              error={error}
              expandedFolders={expandedFolders}
              setExpandedFolders={setExpandedFolders}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
              onStructureUpdate={handleStructureUpdate}
            />
          )}
        </div>

        {error && !isLoading && (
          <div className="mt-6 bg-red-50 border-l-4 border-red-400 text-red-700 p-4 rounded">
            <p className="font-medium">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {isLoading && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl shadow-2xl text-center flex flex-col items-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-600 mb-3"></div>
              <p className="text-base font-semibold text-gray-800">
                Processing files...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;