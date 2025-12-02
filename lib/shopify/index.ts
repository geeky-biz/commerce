import {
  HIDDEN_PRODUCT_TAG,
  SHOPIFY_GRAPHQL_API_ENDPOINT,
  TAGS
} from 'lib/constants';
import { isShopifyError } from 'lib/type-guards';
import { ensureStartsWith } from 'lib/utils';
import {
  unstable_cacheLife as cacheLife,
  unstable_cacheTag as cacheTag,
  revalidateTag
} from 'next/cache';
import { cookies, headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import mockDataJson from '../mock-data.json';
import {
  addToCartMutation,
  createCartMutation,
  editCartItemsMutation,
  removeFromCartMutation
} from './mutations/cart';
import { getCartQuery } from './queries/cart';
import {
  getCollectionProductsQuery,
  getCollectionQuery,
  getCollectionsQuery
} from './queries/collection';
import { getMenuQuery } from './queries/menu';
import { getPageQuery, getPagesQuery } from './queries/page';
import {
  getProductQuery,
  getProductRecommendationsQuery,
  getProductsQuery
} from './queries/product';
import {
  Cart,
  Collection,
  Connection,
  Image,
  Menu,
  Page,
  Product,
  ShopifyAddToCartOperation,
  ShopifyCart,
  ShopifyCartOperation,
  ShopifyCollection,
  ShopifyCollectionOperation,
  ShopifyCollectionProductsOperation,
  ShopifyCollectionsOperation,
  ShopifyCreateCartOperation,
  ShopifyMenuOperation,
  ShopifyPageOperation,
  ShopifyPagesOperation,
  ShopifyProduct,
  ShopifyProductOperation,
  ShopifyProductRecommendationsOperation,
  ShopifyProductsOperation,
  ShopifyRemoveFromCartOperation,
  ShopifyUpdateCartOperation
} from './types';

const domain = process.env.SHOPIFY_STORE_DOMAIN
  ? ensureStartsWith(process.env.SHOPIFY_STORE_DOMAIN, 'https://')
  : '';
const endpoint = `${domain}${SHOPIFY_GRAPHQL_API_ENDPOINT}`;
const key = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN!;

// Check if we should use Shopify API or mock data (default to mock data)
const useShopifyAPI = process.env.USE_SHOPIFY_API === 'true';

// Debug: log which mode we're using
if (useShopifyAPI) {
  console.log('[Shopify] Using REAL Shopify API (USE_SHOPIFY_API=true)');
} else {
  console.log('[Shopify] Using MOCK DATA (USE_SHOPIFY_API not set or false)');
}

// In-memory cart storage for mock data
const mockCarts = new Map<string, ShopifyCart>();

type ExtractVariables<T> = T extends { variables: object }
  ? T['variables']
  : never;

// Mock data structure
type MockData = {
  products: ShopifyProduct[];
  collections: ShopifyCollection[];
  pages: Page[];
  menus: Record<string, { title: string; url: string }[]>;
  collectionProducts: Record<string, string[]>; // collection handle -> product handles
};

// Load mock data from JSON file
function getMockData(): MockData {
  try {
    const data = mockDataJson as MockData;
    // Debug: verify data is loaded
    if (data.products.length === 0) {
      console.warn('Mock data loaded but products array is empty');
    }
    return data;
  } catch (error) {
    console.error('Error loading mock data:', error);
    return {
      products: [],
      collections: [],
      pages: [],
      menus: {},
      collectionProducts: {}
    };
  }
}

// Helper to convert array to Connection format
function toConnection<T>(items: T[]): Connection<T> {
  return {
    edges: items.map((node) => ({ node }))
  };
}

// Helper to sort products
function sortProducts(
  products: ShopifyProduct[],
  sortKey?: string,
  reverse?: boolean
): ShopifyProduct[] {
  const sorted = [...products];

  switch (sortKey) {
    case 'PRICE':
      sorted.sort((a, b) => {
        const aPrice = parseFloat(a.priceRange.minVariantPrice.amount);
        const bPrice = parseFloat(b.priceRange.minVariantPrice.amount);
        return aPrice - bPrice;
      });
      break;
    case 'CREATED_AT':
    case 'CREATED':
      sorted.sort((a, b) => {
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      });
      break;
    case 'BEST_SELLING':
      // For mock data, just use title as a proxy
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'RELEVANCE':
    default:
      // Keep original order
      break;
  }

  if (reverse) {
    sorted.reverse();
  }

  return sorted;
}

// Helper to filter products by search query
function filterProductsByQuery(
  products: ShopifyProduct[],
  query?: string
): ShopifyProduct[] {
  if (!query) {
    return products;
  }

  const lowerQuery = query.toLowerCase();
  return products.filter(
    (product) =>
      product.title.toLowerCase().includes(lowerQuery) ||
      product.description.toLowerCase().includes(lowerQuery) ||
      product.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}

// Get mock response based on query and variables
async function getMockResponse<T>({
  query,
  variables
}: {
  query: string;
  variables?: any;
}): Promise<{ status: number; body: T }> {
  const data = getMockData();
  
  // Debug: log query type for troubleshooting
  const queryPreview = query.substring(0, 150).replace(/\s+/g, ' ');
  if (query.includes('getCollectionProducts') || (query.includes('collection') && query.includes('products'))) {
    console.log(`[Mock] Handling collection products query for handle: ${variables?.handle}, query preview: ${queryPreview}`);
  }

  // Identify query type by checking for unique query strings
  // IMPORTANT: Check getCollectionProducts FIRST before getProducts, since getCollectionProducts
  // also contains "products(" which would match getProducts incorrectly
  
  // Check for getCollectionProducts FIRST (most specific) - must come before getProducts
  const isCollectionProductsQuery = 
    query.includes('query getCollectionProducts') || 
    query.includes('getCollectionProducts') ||
    (query.includes('collection(') && query.includes('products('));
  
  if (isCollectionProductsQuery) {
    const handle = variables?.handle as string;
    const productHandles = data.collectionProducts[handle] || [];
    let products = data.products.filter((p) => productHandles.includes(p.handle));
    products = sortProducts(products, variables?.sortKey, variables?.reverse);
    
    // Debug logging
    console.log(`[Mock] Collection "${handle}": found ${productHandles.length} product handles, matched ${products.length} products`);
    console.log(`[Mock] Product handles in collection:`, productHandles);
    console.log(`[Mock] Available product handles in data:`, data.products.map(p => p.handle));
    
    if (handle && productHandles.length === 0) {
      console.log(`[Mock] Collection "${handle}" has no products mapped. Available collections:`, Object.keys(data.collectionProducts));
    }
    
    // Always return collection object, even if empty, to match Shopify API behavior
    const response = {
      status: 200,
      body: {
        data: {
          collection: {
            products: toConnection(products)
          }
        }
      } as T
    };
    
    console.log(`[Mock] Returning response with collection:`, JSON.stringify(response.body).substring(0, 200));
    return response;
  }

  // Check for getProductRecommendations FIRST (more specific) before getProduct
  // since "getProductRecommendations" contains "getProduct"
  if (query.includes('query getProductRecommendations') || query.includes('productRecommendations')) {
    // Return first 3 products as recommendations (excluding the current product if found)
    const productId = variables?.productId as string;
    const recommendations = data.products
      .filter((p) => p.id !== productId)
      .slice(0, 3);
    
    console.log(`[Mock] Product recommendations for productId "${productId}": found ${recommendations.length} recommendations`);
    
    return {
      status: 200,
      body: {
        data: {
          productRecommendations: recommendations
        }
      } as T
    };
  }

  // Check for getProduct (single product) - must come after getProductRecommendations
  if (query.includes('query getProduct') || (query.includes('product(') && !query.includes('products(') && !query.includes('Recommendations'))) {
    const handle = variables?.handle as string;
    const product = data.products.find((p) => p.handle === handle);
    console.log(`[Mock] getProduct for handle "${handle}": ${product ? 'found' : 'not found'}`);
    return {
      status: 200,
      body: {
        data: {
          product: product || null
        }
      } as T
    };
  }

  // Check for getProducts - must exclude collection products queries
  if ((query.includes('query getProducts') || query.includes('products(')) && !query.includes('collection(')) {
    let products = [...data.products];
    products = filterProductsByQuery(products, variables?.query);
    products = sortProducts(products, variables?.sortKey, variables?.reverse);
    return {
      status: 200,
      body: {
        data: {
          products: toConnection(products)
        }
      } as T
    };
  }

  if (query.includes('query getCollections') || query.includes('collections(')) {
    return {
      status: 200,
      body: {
        data: {
          collections: toConnection(data.collections)
        }
      } as T
    };
  }

  if (query.includes('query getCollection') && !query.includes('Products')) {
    const handle = variables?.handle as string;
    const collection = data.collections.find((c) => c.handle === handle);
    return {
      status: 200,
      body: {
        data: {
          collection: collection || null
        }
      } as T
    };
  }

  if (query.includes('query getCart')) {
    const cartId = variables?.cartId as string;
    const cart = mockCarts.get(cartId);
    return {
      status: 200,
      body: {
        data: {
          cart: cart || null
        }
      } as T
    };
  }

  if (query.includes('mutation createCart')) {
    const cartId = `gid://shopify/Cart/${Date.now()}`;
    const newCart: ShopifyCart = {
      id: cartId,
      checkoutUrl: `https://checkout.shopify.com/carts/${cartId}/checkout`,
      cost: {
        subtotalAmount: { amount: '0.00', currencyCode: 'USD' },
        totalAmount: { amount: '0.00', currencyCode: 'USD' },
        totalTaxAmount: { amount: '0.00', currencyCode: 'USD' }
      },
      lines: { edges: [] },
      totalQuantity: 0
    };
    mockCarts.set(cartId, newCart);
    return {
      status: 200,
      body: {
        data: {
          cartCreate: {
            cart: newCart
          }
        }
      } as T
    };
  }

  if (query.includes('mutation addToCart') || query.includes('cartLinesAdd')) {
    const cartId = variables?.cartId as string;
    const lines = variables?.lines as Array<{ merchandiseId: string; quantity: number }>;
    const cart = mockCarts.get(cartId);

    if (!cart) {
      throw new Error('Cart not found');
    }

    // Find products for the merchandise IDs
    const newLines = lines.map((line) => {
      const variantId = line.merchandiseId;
      const product = data.products.find((p) =>
        p.variants.edges.some((v) => v.node.id === variantId)
      );
      const variant = product?.variants.edges.find((v) => v.node.id === variantId)?.node;

      if (!product || !variant) {
        throw new Error(`Product variant not found: ${variantId}`);
      }

      const lineId = `gid://shopify/CartLine/${Date.now()}-${Math.random()}`;
      const lineTotal = parseFloat(variant.price.amount) * line.quantity;

      return {
        id: lineId,
        quantity: line.quantity,
        cost: {
          totalAmount: {
            amount: lineTotal.toFixed(2),
            currencyCode: variant.price.currencyCode
          }
        },
        merchandise: {
          id: variant.id,
          title: variant.title,
          selectedOptions: variant.selectedOptions,
          product: {
            id: product.id,
            handle: product.handle,
            title: product.title,
            featuredImage: product.featuredImage
          }
        }
      };
    });

    // Update cart
    const existingLines = removeEdgesAndNodes(cart.lines);
    const updatedLines = [...existingLines, ...newLines];
    const subtotal = updatedLines.reduce(
      (sum, line) => sum + parseFloat(line.cost.totalAmount.amount),
      0
    );

    const updatedCart: ShopifyCart = {
      ...cart,
      lines: toConnection(updatedLines),
      cost: {
        subtotalAmount: { amount: subtotal.toFixed(2), currencyCode: 'USD' },
        totalAmount: { amount: subtotal.toFixed(2), currencyCode: 'USD' },
        totalTaxAmount: { amount: '0.00', currencyCode: 'USD' }
      },
      totalQuantity: updatedLines.reduce((sum, line) => sum + line.quantity, 0)
    };

    mockCarts.set(cartId, updatedCart);

    return {
      status: 200,
      body: {
        data: {
          cartLinesAdd: {
            cart: updatedCart
          }
        }
      } as T
    };
  }

  if (query.includes('mutation removeFromCart') || query.includes('cartLinesRemove')) {
    const cartId = variables?.cartId as string;
    const lineIds = variables?.lineIds as string[];
    const cart = mockCarts.get(cartId);

    if (!cart) {
      throw new Error('Cart not found');
    }

    const existingLines = removeEdgesAndNodes(cart.lines);
    const updatedLines = existingLines.filter((line) => !lineIds.includes(line.id || ''));

    const subtotal = updatedLines.reduce(
      (sum, line) => sum + parseFloat(line.cost.totalAmount.amount),
      0
    );

    const updatedCart: ShopifyCart = {
      ...cart,
      lines: toConnection(updatedLines),
      cost: {
        subtotalAmount: { amount: subtotal.toFixed(2), currencyCode: 'USD' },
        totalAmount: { amount: subtotal.toFixed(2), currencyCode: 'USD' },
        totalTaxAmount: { amount: '0.00', currencyCode: 'USD' }
      },
      totalQuantity: updatedLines.reduce((sum, line) => sum + line.quantity, 0)
    };

    mockCarts.set(cartId, updatedCart);

    return {
      status: 200,
      body: {
        data: {
          cartLinesRemove: {
            cart: updatedCart
          }
        }
      } as T
    };
  }

  if (query.includes('mutation editCartItems') || query.includes('cartLinesUpdate')) {
    const cartId = variables?.cartId as string;
    const lines = variables?.lines as Array<{
      id: string;
      merchandiseId: string;
      quantity: number;
    }>;
    const cart = mockCarts.get(cartId);

    if (!cart) {
      throw new Error('Cart not found');
    }

    const existingLines = removeEdgesAndNodes(cart.lines);
    const updatedLines = existingLines.map((line) => {
      const update = lines.find((l) => l.id === line.id);
      if (update) {
        const variantId = update.merchandiseId;
        const product = data.products.find((p) =>
          p.variants.edges.some((v) => v.node.id === variantId)
        );
        const variant = product?.variants.edges.find((v) => v.node.id === variantId)?.node;

        if (!variant) {
          return line;
        }

        const lineTotal = parseFloat(variant.price.amount) * update.quantity;
        return {
          ...line,
          quantity: update.quantity,
          cost: {
            totalAmount: {
              amount: lineTotal.toFixed(2),
              currencyCode: variant.price.currencyCode
            }
          }
        };
      }
      return line;
    });

    const subtotal = updatedLines.reduce(
      (sum, line) => sum + parseFloat(line.cost.totalAmount.amount),
      0
    );

    const updatedCart: ShopifyCart = {
      ...cart,
      lines: toConnection(updatedLines),
      cost: {
        subtotalAmount: { amount: subtotal.toFixed(2), currencyCode: 'USD' },
        totalAmount: { amount: subtotal.toFixed(2), currencyCode: 'USD' },
        totalTaxAmount: { amount: '0.00', currencyCode: 'USD' }
      },
      totalQuantity: updatedLines.reduce((sum, line) => sum + line.quantity, 0)
    };

    mockCarts.set(cartId, updatedCart);

    return {
      status: 200,
      body: {
        data: {
          cartLinesUpdate: {
            cart: updatedCart
          }
        }
      } as T
    };
  }

  if (query.includes('query getMenu')) {
    const handle = variables?.handle as string;
    const menuItems = data.menus[handle] || [];
    return {
      status: 200,
      body: {
        data: {
          menu: menuItems.length > 0 ? { items: menuItems } : null
        }
      } as T
    };
  }

  if (query.includes('query getPage')) {
    const handle = variables?.handle as string;
    const page = data.pages.find((p) => p.handle === handle);
    return {
      status: 200,
      body: {
        data: {
          pageByHandle: page || null
        }
      } as T
    };
  }

  if (query.includes('query getPages')) {
    return {
      status: 200,
      body: {
        data: {
          pages: toConnection(data.pages)
        }
      } as T
    };
  }

  // Default response for unknown queries - log for debugging
  // Final fallback: Check if it's a collection products query that didn't match above
  if (query.includes('collection') && query.includes('products') && !query.includes('collections(')) {
    const handle = variables?.handle as string;
    console.log(`[Mock] Fallback: Handling collection products query for handle: ${handle}`);
    const productHandles = data.collectionProducts[handle] || [];
    let products = data.products.filter((p) => productHandles.includes(p.handle));
    products = sortProducts(products, variables?.sortKey, variables?.reverse);
    console.log(`[Mock] Found ${products.length} products for collection "${handle}"`);
    return {
      status: 200,
      body: {
        data: {
          collection: {
            products: toConnection(products)
          }
        }
      } as T
    };
  }
  
  // Final fallback: Check if it's a product recommendations query
  if (query.includes('productRecommendations') || (query.includes('product') && query.includes('Recommendations'))) {
    const productId = variables?.productId as string;
    console.log(`[Mock] Fallback: Handling product recommendations query for productId: ${productId}`);
    const recommendations = data.products
      .filter((p) => p.id !== productId)
      .slice(0, 3);
    return {
      status: 200,
      body: {
        data: {
          productRecommendations: recommendations
        }
      } as T
    };
  }
  
  console.warn('[Mock] Unknown query type, returning empty data. Query preview:', query.substring(0, 200).replace(/\s+/g, ' '));
  return {
    status: 200,
    body: {
      data: {}
    } as T
  };
}

export async function shopifyFetch<T>({
  headers,
  query,
  variables
}: {
  headers?: HeadersInit;
  query: string;
  variables?: ExtractVariables<T>;
}): Promise<{ status: number; body: T } | never> {
  // Use mock data by default unless USE_SHOPIFY_API is explicitly set to 'true'
  if (!useShopifyAPI) {
    return getMockResponse<T>({ query, variables });
  }

  // Use real Shopify API
  try {
    const result = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': key,
        ...headers
      },
      body: JSON.stringify({
        ...(query && { query }),
        ...(variables && { variables })
      })
    });

    const body = await result.json();

    if (body.errors) {
      throw body.errors[0];
    }

    return {
      status: result.status,
      body
    };
  } catch (e) {
    if (isShopifyError(e)) {
      throw {
        cause: e.cause?.toString() || 'unknown',
        status: e.status || 500,
        message: e.message,
        query
      };
    }

    throw {
      error: e,
      query
    };
  }
}

const removeEdgesAndNodes = <T>(array: Connection<T>): T[] => {
  return array.edges.map((edge) => edge?.node);
};

const reshapeCart = (cart: ShopifyCart): Cart => {
  if (!cart.cost?.totalTaxAmount) {
    cart.cost.totalTaxAmount = {
      amount: '0.0',
      currencyCode: cart.cost.totalAmount.currencyCode
    };
  }

  return {
    ...cart,
    lines: removeEdgesAndNodes(cart.lines)
  };
};

const reshapeCollection = (
  collection: ShopifyCollection
): Collection | undefined => {
  if (!collection) {
    return undefined;
  }

  return {
    ...collection,
    path: `/search/${collection.handle}`
  };
};

const reshapeCollections = (collections: ShopifyCollection[]) => {
  const reshapedCollections = [];

  for (const collection of collections) {
    if (collection) {
      const reshapedCollection = reshapeCollection(collection);

      if (reshapedCollection) {
        reshapedCollections.push(reshapedCollection);
      }
    }
  }

  return reshapedCollections;
};

const reshapeImages = (images: Connection<Image>, productTitle: string) => {
  const flattened = removeEdgesAndNodes(images);

  return flattened.map((image) => {
    const filename = image.url.match(/.*\/(.*)\..*/)?.[1];
    return {
      ...image,
      altText: image.altText || `${productTitle} - ${filename}`
    };
  });
};

const reshapeProduct = (
  product: ShopifyProduct,
  filterHiddenProducts: boolean = true
) => {
  if (
    !product ||
    (filterHiddenProducts && product.tags.includes(HIDDEN_PRODUCT_TAG))
  ) {
    return undefined;
  }

  const { images, variants, ...rest } = product;

  return {
    ...rest,
    images: reshapeImages(images, product.title),
    variants: removeEdgesAndNodes(variants)
  };
};

const reshapeProducts = (products: ShopifyProduct[]) => {
  const reshapedProducts = [];

  for (const product of products) {
    if (product) {
      const reshapedProduct = reshapeProduct(product);

      if (reshapedProduct) {
        reshapedProducts.push(reshapedProduct);
      }
    }
  }

  return reshapedProducts;
};

export async function createCart(): Promise<Cart> {
  const res = await shopifyFetch<ShopifyCreateCartOperation>({
    query: createCartMutation
  });

  return reshapeCart(res.body.data.cartCreate.cart);
}

export async function addToCart(
  lines: { merchandiseId: string; quantity: number }[]
): Promise<Cart> {
  const cartId = (await cookies()).get('cartId')?.value!;
  const res = await shopifyFetch<ShopifyAddToCartOperation>({
    query: addToCartMutation,
    variables: {
      cartId,
      lines
    }
  });
  return reshapeCart(res.body.data.cartLinesAdd.cart);
}

export async function removeFromCart(lineIds: string[]): Promise<Cart> {
  const cartId = (await cookies()).get('cartId')?.value!;
  const res = await shopifyFetch<ShopifyRemoveFromCartOperation>({
    query: removeFromCartMutation,
    variables: {
      cartId,
      lineIds
    }
  });

  return reshapeCart(res.body.data.cartLinesRemove.cart);
}

export async function updateCart(
  lines: { id: string; merchandiseId: string; quantity: number }[]
): Promise<Cart> {
  const cartId = (await cookies()).get('cartId')?.value!;
  const res = await shopifyFetch<ShopifyUpdateCartOperation>({
    query: editCartItemsMutation,
    variables: {
      cartId,
      lines
    }
  });

  return reshapeCart(res.body.data.cartLinesUpdate.cart);
}

export async function getCart(): Promise<Cart | undefined> {
  const cartId = (await cookies()).get('cartId')?.value;

  if (!cartId) {
    return undefined;
  }

  const res = await shopifyFetch<ShopifyCartOperation>({
    query: getCartQuery,
    variables: { cartId }
  });

  // Old carts becomes `null` when you checkout.
  if (!res.body.data.cart) {
    return undefined;
  }

  return reshapeCart(res.body.data.cart);
}

export async function getCollection(
  handle: string
): Promise<Collection | undefined> {
  'use cache';
  cacheTag(TAGS.collections);
  cacheLife('days');

  const res = await shopifyFetch<ShopifyCollectionOperation>({
    query: getCollectionQuery,
    variables: {
      handle
    }
  });

  return reshapeCollection(res.body.data.collection);
}

export async function getCollectionProducts({
  collection,
  reverse,
  sortKey
}: {
  collection: string;
  reverse?: boolean;
  sortKey?: string;
}): Promise<Product[]> {
  'use cache';
  cacheTag(TAGS.collections, TAGS.products);
  cacheLife('days');

  const res = await shopifyFetch<ShopifyCollectionProductsOperation>({
    query: getCollectionProductsQuery,
    variables: {
      handle: collection,
      reverse,
      sortKey: sortKey === 'CREATED_AT' ? 'CREATED' : sortKey
    }
  });


  if (!res.body.data?.collection) {
    console.log(`No collection found for \`${collection}\``);
    return [];
  }

  return reshapeProducts(
    removeEdgesAndNodes(res.body.data.collection.products)
  );
}

export async function getCollections(): Promise<Collection[]> {
  'use cache';
  cacheTag(TAGS.collections);
  cacheLife('days');

  const res = await shopifyFetch<ShopifyCollectionsOperation>({
    query: getCollectionsQuery
  });
  
  if (!res.body?.data?.collections) {
    return [
      {
        handle: '',
        title: 'All',
        description: 'All products',
        seo: {
          title: 'All',
          description: 'All products'
        },
        path: '/search',
        updatedAt: new Date().toISOString()
      }
    ];
  }
  
  const shopifyCollections = removeEdgesAndNodes(res.body.data.collections);
  const collections = [
    {
      handle: '',
      title: 'All',
      description: 'All products',
      seo: {
        title: 'All',
        description: 'All products'
      },
      path: '/search',
      updatedAt: new Date().toISOString()
    },
    // Filter out the `hidden` collections.
    // Collections that start with `hidden-*` need to be hidden on the search page.
    ...reshapeCollections(shopifyCollections).filter(
      (collection) => !collection.handle.startsWith('hidden')
    )
  ];

  return collections;
}

export async function getMenu(handle: string): Promise<Menu[]> {
  'use cache';
  cacheTag(TAGS.collections);
  cacheLife('days');

  const res = await shopifyFetch<ShopifyMenuOperation>({
    query: getMenuQuery,
    variables: {
      handle
    }
  });

  return (
    res.body?.data?.menu?.items.map((item: { title: string; url: string }) => ({
      title: item.title,
      path: item.url
        .replace(domain, '')
        .replace('/collections', '/search')
        .replace('/pages', '')
    })) || []
  );
}

export async function getPage(handle: string): Promise<Page> {
  const res = await shopifyFetch<ShopifyPageOperation>({
    query: getPageQuery,
    variables: { handle }
  });

  return res.body.data.pageByHandle;
}

export async function getPages(): Promise<Page[]> {
  const res = await shopifyFetch<ShopifyPagesOperation>({
    query: getPagesQuery
  });

  return removeEdgesAndNodes(res.body.data.pages);
}

export async function getProduct(handle: string): Promise<Product | undefined> {
  'use cache';
  cacheTag(TAGS.products);
  cacheLife('days');

  const res = await shopifyFetch<ShopifyProductOperation>({
    query: getProductQuery,
    variables: {
      handle
    }
  });

  return reshapeProduct(res.body.data.product, false);
}

export async function getProductRecommendations(
  productId: string
): Promise<Product[]> {
  'use cache';
  cacheTag(TAGS.products);
  cacheLife('days');

  const res = await shopifyFetch<ShopifyProductRecommendationsOperation>({
    query: getProductRecommendationsQuery,
    variables: {
      productId
    }
  });


  if (!res.body.data?.productRecommendations) {
    return [];
  }

  const recommendations = res.body.data.productRecommendations;
  if (!Array.isArray(recommendations)) {
    console.error(`[getProductRecommendations] Expected array but got:`, typeof recommendations, recommendations);
    return [];
  }

  return reshapeProducts(recommendations);
}

export async function getProducts({
  query,
  reverse,
  sortKey
}: {
  query?: string;
  reverse?: boolean;
  sortKey?: string;
}): Promise<Product[]> {
  'use cache';
  cacheTag(TAGS.products);
  cacheLife('days');

  const res = await shopifyFetch<ShopifyProductsOperation>({
    query: getProductsQuery,
    variables: {
      query,
      reverse,
      sortKey
    }
  });

  if (!res.body.data?.products) {
    return [];
  }

  return reshapeProducts(removeEdgesAndNodes(res.body.data.products));
}

// This is called from `app/api/revalidate.ts` so providers can control revalidation logic.
export async function revalidate(req: NextRequest): Promise<NextResponse> {
  // We always need to respond with a 200 status code to Shopify,
  // otherwise it will continue to retry the request.
  const collectionWebhooks = [
    'collections/create',
    'collections/delete',
    'collections/update'
  ];
  const productWebhooks = [
    'products/create',
    'products/delete',
    'products/update'
  ];
  const topic = (await headers()).get('x-shopify-topic') || 'unknown';
  const secret = req.nextUrl.searchParams.get('secret');
  const isCollectionUpdate = collectionWebhooks.includes(topic);
  const isProductUpdate = productWebhooks.includes(topic);

  if (!secret || secret !== process.env.SHOPIFY_REVALIDATION_SECRET) {
    console.error('Invalid revalidation secret.');
    return NextResponse.json({ status: 401 });
  }

  if (!isCollectionUpdate && !isProductUpdate) {
    // We don't need to revalidate anything for any other topics.
    return NextResponse.json({ status: 200 });
  }

  if (isCollectionUpdate) {
    revalidateTag(TAGS.collections);
  }

  if (isProductUpdate) {
    revalidateTag(TAGS.products);
  }

  return NextResponse.json({ status: 200, revalidated: true, now: Date.now() });
}
