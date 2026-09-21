// app/app/settings/products/page.js
//
// The catalogue lives in ./ProductCatalogue.js, because the home page's
// set-up dialog renders the same one. This page is the frame.
"use client";

import ProductCatalogue from "./ProductCatalogue";

export default function ProductsPage() {
  return <ProductCatalogue />;
}
