'use client';

import { useFormik } from 'formik';
import type { Product } from 'lib/shopify/types';
import { useMemo } from 'react';
import { DataGrid, type Column } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';

// Define the row type for the data grid
type ProductRow = {
  id: string;
  handle: string;
  title: string;
  price: string;
  availableForSale: boolean;
  variants: number;
  tags: string;
  updatedAt: string;
};

// Client component that displays products in a data grid
export default function ProductsGrid({ products }: { products: Product[] }) {
  // Initialize Formik for notes field
  const formik = useFormik({
    initialValues: {
      notes: ''
    },
    onSubmit: () => {
      // No submission handler needed as per requirements
    }
  });

  // Transform products to grid rows
  const rows: ProductRow[] = useMemo(() => {
    return products.map((product) => ({
      id: product.id,
      handle: product.handle,
      title: product.title,
      price: `${product.priceRange.minVariantPrice.currencyCode} ${product.priceRange.minVariantPrice.amount}`,
      availableForSale: product.availableForSale,
      variants: product.variants.length,
      tags: product.tags.join(', '),
      updatedAt: new Date(product.updatedAt).toLocaleDateString()
    }));
  }, [products]);

  // Define columns for the data grid - memoized to prevent recreation
  const columns: Column<ProductRow>[] = useMemo(() => [
    {
      key: 'title',
      name: 'Title',
      width: 200,
      resizable: true,
      sortable: true
    },
    {
      key: 'handle',
      name: 'Handle',
      width: 150,
      resizable: true,
      sortable: true
    },
    {
      key: 'price',
      name: 'Price',
      width: 120,
      resizable: true,
      sortable: true
    },
    {
      key: 'availableForSale',
      name: 'Available',
      width: 100,
      resizable: true,
      sortable: true,
      formatter: ({ row }: { row: ProductRow }) => (
        <span className={row.availableForSale ? 'text-green-600' : 'text-red-600'}>
          {row.availableForSale ? 'Yes' : 'No'}
        </span>
      )
    },
    {
      key: 'variants',
      name: 'Variants',
      width: 100,
      resizable: true,
      sortable: true
    },
    {
      key: 'tags',
      name: 'Tags',
      width: 200,
      resizable: true
    },
    {
      key: 'updatedAt',
      name: 'Updated',
      width: 120,
      resizable: true,
      sortable: true
    }
  ], []);

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Products Dashboard</h1>
      <div className="mb-4 text-sm text-gray-600">
        Showing {products.length} product{products.length !== 1 ? 's' : ''}
      </div>
      <div className="border rounded-lg overflow-hidden">
        <DataGrid
          columns={columns}
          rows={rows}
          defaultColumnOptions={{
            sortable: true,
            resizable: true
          }}
          className="rdg-light"
          style={{ height: 'calc(100vh - 200px)', width: '100%' }}
        />
      </div>
      
      {/* Notes field at the bottom using Formik */}
      <div className="mt-6">
        <form onSubmit={formik.handleSubmit}>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
            Notes
          </label>
          <input
            type="text"
            id="notes"
            name="notes"
            value={formik.values.notes}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter notes..."
          />
        </form>
      </div>
    </div>
  );
}
