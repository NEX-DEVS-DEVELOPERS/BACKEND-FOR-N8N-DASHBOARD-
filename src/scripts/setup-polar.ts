
import { Polar } from '@polar-sh/sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const polar = new Polar({
    accessToken: process.env.POLAR_ACCESS_TOKEN || '',
});

async function setup() {
    try {
        console.log('Fetching products to check if they exist...');
        const existing = await polar.products.list({});
        const existingNames = new Set(existing.result.items?.map(p => p.name) || []);

        const products = [
            {
                name: 'Pro Plan',
                description: 'Perfect for most clients and active workflows.',
                prices: [{ amount: 2900, currency: 'usd', type: 'month' }]
            },
            {
                name: 'Enterprise Plan',
                description: 'Mission-critical support for zero downtime.',
                prices: [{ amount: 9900, currency: 'usd', type: 'month' }]
            },
            {
                name: '24/7 Support Add-on',
                description: 'Add full 24/7/365 coverage to your Pro plan.',
                prices: [{ amount: 1000, currency: 'usd', type: 'month' }]
            }
        ];

        for (const p of products) {
            if (existingNames.has(p.name)) {
                console.log(`Product "${p.name}" already exists.`);
                continue;
            }

            console.log(`Creating product: ${p.name}...`);
            const product = await polar.products.create({
                name: p.name,
                description: p.description,
                prices: p.prices.map(price => ({
                    amountType: 'fixed',
                    priceAmount: price.amount,
                    priceCurrency: price.currency,
                    recurringInterval: 'month'
                })) as any
            });
            console.log(`Created product: ${product.name} (${product.id})`);
        }

        console.log('Polar setup complete!');
    } catch (error) {
        console.error('Error setting up Polar:', error);
    }
}

setup();
