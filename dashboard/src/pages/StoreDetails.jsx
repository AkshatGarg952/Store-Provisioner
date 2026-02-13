import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Activity, AlertTriangle } from 'lucide-react';
import { getStore, getStoreEvents } from '../services/api';
import StatusBadge from '../components/StatusBadge';

function StoreDetails() {
    const { id } = useParams();
    const [store, setStore] = useState(null);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    const getEventColorClass = (type) => {
        if (type === 'ERROR') return 'bg-red-500';
        if (type === 'WARNING') return 'bg-yellow-500';
        if (type === 'SUCCESS') return 'bg-emerald-500';
        return 'bg-blue-500';
    };

    const fetchData = useCallback(async () => {
        try {
            const storeData = await getStore(id);
            setStore(storeData);

            try {
                const eventsData = await getStoreEvents(id);
                setEvents(eventsData);
            } catch (eventErr) {
                console.warn("Failed to fetch events:", eventErr);
            }
        } catch (err) {
            console.error("Failed to fetch store details:", err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 3000);
        return () => clearInterval(interval);
    }, [fetchData]);

    if (loading && !store) return <div className="p-8 text-center">Loading...</div>;
    if (!store) return <div className="p-8 text-center">Store not found</div>;

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center">
                        <Link to="/" className="mr-4 text-gray-500 hover:text-gray-700">
                            <ArrowLeft className="h-6 w-6" />
                        </Link>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {store.name} <span className="text-gray-400 text-sm font-normal">({store.id})</span>
                        </h1>
                        <div className="ml-auto">
                            <StatusBadge status={store.status} />
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {store.status === 'Failed' && (
                    <div className="rounded-md bg-red-50 p-4 mb-6">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden="true" />
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-red-800">Provisioning Failed</h3>
                                <div className="mt-2 text-sm text-red-700">
                                    <p>{store.errorReason || "Unknown error occurred."}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Details Card */}
                    <div className="bg-white shadow sm:rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Store Configuration</h3>
                            <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
                                <div className="sm:col-span-1">
                                    <dt className="text-sm font-medium text-gray-500">Engine</dt>
                                    <dd className="mt-1 text-sm text-gray-900 capitalize">{store.engine}</dd>
                                </div>
                                <div className="sm:col-span-1">
                                    <dt className="text-sm font-medium text-gray-500">Created At</dt>
                                    <dd className="mt-1 text-sm text-gray-900">{new Date(store.createdAt).toLocaleString()}</dd>
                                </div>
                                <div className="sm:col-span-2">
                                    <dt className="text-sm font-medium text-gray-500">Store URL</dt>
                                    <dd className="mt-1 text-sm text-gray-900">
                                        {store.url ? (
                                            <a href={store.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-900 flex items-center">
                                                {store.url} <ExternalLink className="ml-1 h-4 w-4" />
                                            </a>
                                        ) : "N/A"}
                                    </dd>
                                </div>
                            </dl>
                        </div>
                    </div>

                    {/* Activity Log */}
                    <div className="bg-white shadow sm:rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4 flex items-center">
                                <Activity className="h-5 w-5 mr-2 text-gray-500" />
                                Activity Log
                            </h3>
                            <div className="flow-root">
                                <ul className="-mb-8">
                                    {events.map((event, eventIdx) => (
                                        <li key={event.id || eventIdx}>
                                            <div className="relative pb-8">
                                                {eventIdx !== events.length - 1 ? (
                                                    <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                                                ) : null}
                                                <div className="relative flex space-x-3">
                                                    <div>
                                                        <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white 
                                                    ${getEventColorClass(event.type)}`}>
                                                            <Activity className="h-5 w-5 text-white" aria-hidden="true" />
                                                        </span>
                                                    </div>
                                                    <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                                                        <div>
                                                            <p className="text-sm text-gray-500">{event.message}</p>
                                                            <p className="mt-1 text-xs font-semibold text-gray-400">{event.type}</p>
                                                        </div>
                                                        <div className="text-right text-xs whitespace-nowrap text-gray-500">
                                                            <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                    {events.length === 0 && <p className="text-gray-500 text-sm">No events recorded.</p>}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default StoreDetails;
