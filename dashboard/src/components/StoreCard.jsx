import React from 'react';
import { Trash2, ExternalLink } from 'lucide-react';
import StatusBadge from './StatusBadge';

import { Link } from 'react-router-dom';

const StoreCard = ({ store, onDelete, isDeleting }) => {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex justify-between items-start">
          <div>
            <Link to={`/store/${store.id}`} className="block hover:underline">
              <h3 className="text-lg leading-6 font-medium text-indigo-600">{store.name}</h3>
            </Link>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">ID: {store.id}</p>
          </div>
          <StatusBadge status={store.status} />
        </div>

        <div className="mt-4">
          <p className="text-sm text-gray-500">
            Engine: <span className="font-semibold text-gray-700 capitalize">{store.engine}</span>
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Created: {new Date(store.createdAt).toLocaleString()}
          </p>
        </div>

        <div className="mt-6 flex justify-between items-center">
          {store.status === 'Ready' && store.url ? (
            <a
              href={store.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Visit Store <ExternalLink className="ml-1 h-4 w-4" />
            </a>
          ) : (
            <span className="text-sm text-gray-400 cursor-not-allowed">Visit Store</span>
          )}

          <button
            onClick={() => onDelete(store.id)}
            disabled={isDeleting}
            className={`inline-flex items-center text-sm font-medium ${isDeleting ? 'text-gray-400 cursor-not-allowed' : 'text-red-600 hover:text-red-500'
              }`}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StoreCard;