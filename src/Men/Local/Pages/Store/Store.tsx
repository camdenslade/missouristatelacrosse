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
    <div className="relative max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Team Store</h1>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowOrderLogs(true)}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm font-medium"
            >
              View Orders
            </button>
          )}
          <button
            onClick={() => navigate(orderLookupPath)}
            className="px-4 py-2 border border-[#5E0009] text-[#5E0009] rounded text-sm font-medium hover:bg-[#5E0009] hover:text-white"
          >
            Lookup Order
          </button>
        </div>
      </div>

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
                  onAddToCart={handleAddToCart}
                />
              ))}
            </div>
          )}

          <button
            onClick={() => setShowCart(true)}
            className="fixed bottom-6 right-6 w-32 h-32 bg-[#5E0009] text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-red-800"
          >
            <FaShoppingCart className="text-5xl" />
            {cart.length > 0 && (
              <span className="absolute top-2 right-2 bg-white text-[#5E0009] rounded-full px-4 py-2 text-xl font-bold shadow">
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

