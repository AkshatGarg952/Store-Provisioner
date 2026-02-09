import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import StoreList from './components/StoreList';
import CreateStoreModal from './components/CreateStoreModal';
import { getStores, createStore, deleteStore } from './services/api';

function App() {
  const [stores, setStores] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState(null);

  const [deletingIds, setDeletingIds] = useState(new Set());

  const fetchStores = async () => {
    try {
      const data = await getStores();
      setStores(data);
    } catch (err) {
      console.error("Failed to fetch stores:", err);
      // Optional: Set an error state if you want to show a toast
    }
  };

  // Poll for status updates every 5 seconds
  useEffect(() => {
    fetchStores();
    const interval = setInterval(fetchStores, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateStore = async (storeData) => {
    try {
      await createStore(storeData);
      await fetchStores(); // Refresh list immediately
    } catch (err) {
      console.error("Failed to create store:", err);
      throw err; // Re-throw to let the modal handle the error display
    }
  };

  const handleDeleteStore = async (id) => {
    if (window.confirm("Are you sure you want to delete this store? This action cannot be undone.")) {
      try {
        setDeletingIds(prev => new Set(prev).add(id));
        await deleteStore(id);
        setStores(stores.filter(store => store.id !== id)); // Optimistic update
        await fetchStores(); // Ensure sync
      } catch (err) {
        console.error("Failed to delete store:", err);
        alert("Failed to delete store.");
      } finally {
        setDeletingIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onCreateClick={() => setIsModalOpen(true)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StoreList stores={stores} onDelete={handleDeleteStore} deletingIds={deletingIds} />
      </main>

      <CreateStoreModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateStore}
      />
    </div>
  );
}

export default App;