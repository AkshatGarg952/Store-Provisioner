import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import StoreList from '../components/StoreList';
import CreateStoreModal from '../components/CreateStoreModal';
import { getStores, createStore, deleteStore } from '../services/api';

function Dashboard() {
    const [stores, setStores] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deletingIds, setDeletingIds] = useState(new Set());

    const fetchStores = async () => {
        try {
            const data = await getStores();
            setStores(data);
        } catch (err) {
            console.error("Failed to fetch stores:", err);
        }
    };

    useEffect(() => {
        fetchStores();
        const interval = setInterval(fetchStores, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleCreateStore = async (storeData) => {
        try {
            await createStore(storeData);
            await fetchStores();
        } catch (err) {
            throw err;
        }
    };

    const handleDeleteStore = async (id) => {
        if (window.confirm("Are you sure you want to delete this store?")) {
            try {
                setDeletingIds(prev => new Set(prev).add(id));
                await deleteStore(id);
                setStores(stores.filter(store => store.id !== id));
                await fetchStores();
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

export default Dashboard;
