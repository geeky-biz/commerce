import { getProducts } from 'lib/shopify';
import ProductsGrid from './products-grid';

// Server component that fetches products
export default async function DashboardPage() {
  const products = await getProducts({});

  return <ProductsGrid products={products} />;
}
