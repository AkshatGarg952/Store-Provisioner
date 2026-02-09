import React from 'react';
import StoreCard from './StoreCard';

const StoreList = ({ stores, onDelete, deletingIds }) => {
  if (stores.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">No stores found. Create one to get started!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mt-6">
      {stores.map((store) => (
        <StoreCard
          key={store.id}
          store={store}
          onDelete={onDelete}
          isDeleting={deletingIds.has(store.id)}
        />
      ))}
    </div>
  );
};

export default StoreList;