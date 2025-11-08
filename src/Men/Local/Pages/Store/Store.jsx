// src/Men/Local/Pages/Store/Store.jsx
import { useEffect, useReducer, useRef } from "react";
import { FaShoppingCart } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import UnavailableOverlay from "../../../../Global/Common/UnavailableOverlay.jsx";
import API_BASE from "../../../../Services/API.js";
import Cart from "./components/Cart.jsx";
import ProductCard from "./components/ProductCard.jsx";

const initialState = {
  products: [],
  cart: [],
  loading: true,
  showCart: false,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_PRODUCTS":
      return { ...state, products: action.payload, loading: false };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "TOGGLE_CART":
      return { ...state, showCart: action.payload };
    case "ADD_TO_CART": {
      const product = action.payload;
      const exists = state.cart.find(
        (item) => item.id === product.id && item.variantId === product.variantId
      );
      const newCart = exists
        ? state.cart.map((item) =>
            item.id === product.id && item.variantId === product.variantId
              ? { ...item, quantity: (item.quantity || 1) + 1 }
              : item
          )
        : [...state.cart, { ...product, quantity: 1 }];
      return { ...state, cart: newCart, showCart: true };
    }
    case "SET_CART":
      return { ...state, cart: action.payload };
    default:
      return state;
  }
}

export default function Store() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const sidebarRef = useRef(null);
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);
  const navigate = useNavigate();
  const isEnabled = import.meta.env.VITE_TEAMSTORE_ENABLED === "true";

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        dispatch({ type: "SET_LOADING", payload: true });
        const res = await fetch(`${API_BASE}/api/printify/products`);
        if (!res.ok) throw new Error("Failed to fetch products");
        const json = await res.json();
        if (Array.isArray(json)) {
          dispatch({ type: "SET_PRODUCTS", payload: json });
        }
      } catch {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    };
    if (isEnabled) fetchProducts();
  }, [isEnabled]);

  const addToCart = (product) => {
    dispatch({ type: "ADD_TO_CART", payload: product });
  };

  const setCart = (newCart) => {
    dispatch({ type: "SET_CART", payload: newCart });
  };

  const setShowCart = (val) => {
    dispatch({ type: "TOGGLE_CART", payload: val });
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e) => {
    touchCurrentX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = () => {
    if (touchStartX.current - touchCurrentX.current > 50) {
      setShowCart(false);
    }
  };

  const totalItems = Array.isArray(state.cart)
    ? state.cart.reduce((sum, item) => sum + (item.quantity || 1), 0)
    : 0;

  return (
    <div className="relative max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold mb-6">Team Store</h1>

      {isEnabled ? (
        <>
          {state.loading ? (
            <div className="flex flex-col justify-center items-center h-64 gap-3">
              <div className="w-12 h-12 border-4 border-[#5E0009] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-700 font-medium">Loading products…</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {state.products.map((p, idx) => (
                <ProductCard
                  key={`${p.id}-${idx}`}
                  product={p}
                  onAddToCart={addToCart}
                />
              ))}
            </div>
          )}

          <button
            onClick={() => setShowCart(true)}
            className="fixed bottom-6 right-6 w-32 h-32 bg-[#5E0009] text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-red-800"
          >
            <FaShoppingCart className="text-5xl" />
            {state.cart.length > 0 && (
              <span className="absolute top-4 right-4 bg-white text-[#5E0009] rounded-full px-4 py-2 text-xl font-bold shadow">
                {totalItems}
              </span>
            )}
          </button>

          <Cart
            cart={Array.isArray(state.cart) ? state.cart : []}
            setCart={setCart}
            showCart={state.showCart}
            setShowCart={setShowCart}
            sidebarRef={sidebarRef}
            handleTouchStart={handleTouchStart}
            handleTouchMove={handleTouchMove}
            handleTouchEnd={handleTouchEnd}
          />
        </>
      ) : (
        <UnavailableOverlay message="Team Store is currently unavailable" />
      )}
    </div>
  );
}
