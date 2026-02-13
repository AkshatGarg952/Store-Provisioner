
const API_URL = 'http://localhost:3000/api/stores';

async function measure(name, fn) {
    const start = Date.now();
    try {
        const res = await fn();
        const duration = Date.now() - start;
        console.log(`[${name}] Success in ${duration}ms`);
        return res;
    } catch (e) {
        const duration = Date.now() - start;
        console.log(`[${name}] Failed in ${duration}ms: ${e.message}`);
        throw e;
    }
}

async function testPerformance() {
    console.log('--- Starting Performance Test ---');

    let storeId;
    try {
        const data = await measure('Create Store', async () => {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Perf Test', engine: 'woocommerce' })
            });
            if (!response.ok) throw new Error(await response.text());
            return response.json();
        });
        storeId = data.id;
    } catch (e) {
        console.error('Skipping remaining tests due to create failure');
        return;
    }

    await measure('List Stores', async () => {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(await response.text());
        return response.json();
    });

    if (storeId) {
        await measure('Delete Store', async () => {
            const response = await fetch(`${API_URL}/${storeId}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error(await response.text());
            return response.json();
        });
    }
}

testPerformance();
