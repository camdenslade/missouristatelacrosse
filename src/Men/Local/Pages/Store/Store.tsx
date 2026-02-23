// src/Men/Local/Pages/Store/Store.jsx
import { useEffect, useReducer, useRef, useState } from "react";
import { FaShoppingCart } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import UnavailableOverlay from "../../../../Global/Common/UnavailableOverlay";
import { useAuth } from "../../../../Global/Context/AuthContext";
import { apiRequest } from "../../../../Services/API";
import { getProgramInfo } from "../../../../Services/programHelper";
import type { PrintifyProduct } from "../../../../types/api";
import Cart from "./components/Cart";
import OrderLogsModal from "./components/OrderLogsModal";
import ProductCard from "./components/ProductCard";
import { useMenCart } from "./context/MenCartContext";

const initialState = {
  products: [],
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
    default:
      return state;
  }
}

export default function Store() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { cart, addToCart, setCart, totalItems } = useMenCart();
  const sidebarRef = useRef(null);
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);
  const navigate = useNavigate();
  const isEnabled = import.meta.env.VITE_TEAMSTORE_ENABLED === "true";
  const { user, roles } = useAuth();
  const { program } = getProgramInfo();
  const [showOrderLogs, setShowOrderLogs] = useState(false);
  const orderLookupPath = program === "women" ? "/women/order-lookup" : "/order-lookup";
  
  const isAdmin = roles?.men === "admin";

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        dispatch({ type: "SET_LOADING", payload: true });
        const data = await apiRequest<PrintifyProduct[]>("/api/printify/products");
        if (Array.isArray(data)) {
          dispatch({ type: "SET_PRODUCTS", payload: data });
        }
      } catch {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    };
    if (isEnabled) fetchProducts();
  }, [isEnabled]);

  const handleAddToCart = (product) => {
    addToCart(product);
    setShowCart(true);
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

  return (
    <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">Team Store</h1>
            <p className="mt-1 text-gray-500">Official Missouri State Lacrosse gear</p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => setShowOrderLogs(true)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:border-gray-400 transition"
              >
                View Orders
              </button>
            )}
            <button
              onClick={() => navigate(orderLookupPath)}
              className="px-4 py-2 text-sm font-medium border border-[#5E0009] text-[#5E0009] rounded-lg hover:bg-[#5E0009] hover:text-white transition"
            >
              Lookup Order
            </button>
          </div>
        </div>
        <div className="mt-4 border-b border-gray-200" />
      </div>

      {isEnabled ? (
        <>
          {state.loading ? (
            <div className="flex flex-col justify-center items-center h-64 gap-3">
              <div className="w-10 h-10 border-[3px] border-[#5E0009] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-500 text-sm">Loading products…</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {state.products.map((p, idx) => (
                <ProductCard
                  key={`${p.id}-${idx}`}
                  product={p}
                  onAddToCart={handleAddToCart}
                />
              ))}
            </div>
          )}

          <button
            onClick={() => setShowCart(true)}
            className="fixed bottom-6 right-6 w-16 h-16 bg-[#5E0009] text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-800 hover:shadow-xl hover:scale-105 transition-all"
          >
            <FaShoppingCart className="text-2xl" />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-white text-[#5E0009] rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow border border-gray-100">
                {totalItems}
              </span>
            )}
          </button>

          <Cart
            cart={Array.isArray(cart) ? cart : []}
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

      {showOrderLogs && (
        <OrderLogsModal
          isOpen={showOrderLogs}
          onClose={() => setShowOrderLogs(false)}
        />
      )}
    </div>
  );
}

